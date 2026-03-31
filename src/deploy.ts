import * as path from "path";
import type {
  DeployArguments,
  DeployResult,
  SyncState,
  CommandResult,
  HealthCheckResult,
} from "./types";
import { SSHClient } from "./ssh-client";
import { getLocalFiles, computeDiff, formatBytes } from "./hash";
import { runHealthCheck } from "./health-check";
import { sendNotification } from "./notify";
import { Logger } from "./logger";

const SYNC_STATE_VERSION = 2;
const TOTAL_STAGES = 11;

/** Apply defaults to partial arguments */
function applyDefaults(args: DeployArguments): Required<DeployArguments> {
  return {
    host: args.host,
    port: args.port ?? 22,
    username: args.username,
    privateKey: args.privateKey,
    passphrase: args.passphrase ?? "",
    localDir: args.localDir ?? "./",
    serverDir: args.serverDir ?? "./",
    stateName: args.stateName ?? ".ssh-deploy-sync-state.json",
    dryRun: args.dryRun ?? false,
    dangerousCleanSlate: args.dangerousCleanSlate ?? false,
    exclude: args.exclude ?? [],
    logLevel: args.logLevel ?? "standard",
    timeout: args.timeout ?? 30000,
    preCommands: args.preCommands ?? [],
    commands: args.commands ?? [],
    commandsWorkingDir: args.commandsWorkingDir ?? args.serverDir ?? "./",
    rollbackOnFailure: args.rollbackOnFailure ?? false,
    rollbackLimit: args.rollbackLimit ?? 3,
    healthCheckUrl: args.healthCheckUrl ?? "",
    healthCheckExpectedStatus: args.healthCheckExpectedStatus ?? 200,
    healthCheckRetries: args.healthCheckRetries ?? 3,
    healthCheckRetryDelay: args.healthCheckRetryDelay ?? 5000,
    healthCheckFailDeploy: args.healthCheckFailDeploy ?? false,
    webhookUrl: args.webhookUrl ?? "",
    webhookType: args.webhookType ?? "slack",
    environment: args.environment ?? "production",
  };
}

/** Run a list of commands via SSH, returning results */
async function runCommands(
  ssh: SSHClient,
  commands: string[],
  cwd: string,
  dryRun: boolean,
  logger: Logger
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  if (commands.length === 0) return results;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i].trim();
    if (!cmd || cmd.startsWith("#")) continue;

    logger.cmdRun(i + 1, commands.length, cmd);

    if (!dryRun) {
      const result = await ssh.exec(cmd, cwd);
      results.push(result);

      logger.cmdOutput("stdout", result.stdout);
      logger.cmdOutput("stderr", result.stderr);

      if (result.exitCode !== 0) {
        logger.cmdFail(result.exitCode);
      } else {
        logger.cmdSuccess(result.durationMs);
      }
    } else {
      logger.info("[DRY RUN] Skipped");
      results.push({
        command: cmd,
        stdout: "",
        stderr: "",
        exitCode: 0,
        durationMs: 0,
      });
    }
  }

  const passed = results.filter((r) => r.exitCode === 0).length;
  const failed = results.filter((r) => r.exitCode !== 0).length;
  logger.cmdSummary(results.length, passed, failed);

  return results;
}

/** Perform rollback by restoring previous sync state */
async function performRollback(
  ssh: SSHClient,
  serverDir: string,
  rollbackStatePath: string,
  currentLocalFiles: Record<string, any>,
  logger: Logger
): Promise<boolean> {
  logger.rollbackBanner();

  const rollbackContent = await ssh.readFile(rollbackStatePath);
  if (!rollbackContent) {
    logger.warn("No rollback state found. Cannot rollback.");
    return false;
  }

  let rollbackState: SyncState;
  try {
    rollbackState = JSON.parse(rollbackContent);
  } catch {
    logger.warn("Corrupt rollback state. Cannot rollback.");
    return false;
  }

  logger.info(`Restoring to state from: ${rollbackState.timestamp}`);
  logger.info(`Rollback state has ${Object.keys(rollbackState.files).length} files`);

  let removedCount = 0;
  for (const filePath of Object.keys(currentLocalFiles)) {
    if (!rollbackState.files[filePath]) {
      const remotePath = `${serverDir}${filePath}`;
      try {
        await ssh.deleteFile(remotePath);
        await ssh.removeEmptyDirs(remotePath, serverDir);
        logger.fileDelete(filePath);
        removedCount++;
      } catch {
        // File might not have been uploaded yet
      }
    }
  }

  logger.success(`Rollback completed. Removed ${removedCount} new file(s).`);
  return true;
}

export async function deploy(args: DeployArguments): Promise<DeployResult> {
  const config = applyDefaults(args);
  const logger = new Logger(config.logLevel);
  const startTime = Date.now();
  const preCommandResults: CommandResult[] = [];
  const commandResults: CommandResult[] = [];
  let rolledBack = false;
  let healthCheckResult: HealthCheckResult | undefined;
  let notificationSent = false;

  // Normalize server dir
  const serverDir = config.serverDir.endsWith("/")
    ? config.serverDir
    : config.serverDir + "/";

  const stateFilePath = `${serverDir}${config.stateName}`;
  const rollbackStatePath = `${serverDir}.ssh-deploy-rollback-state.json`;
  const cwd = config.commandsWorkingDir || serverDir;

  // ── Hero Banner ──
  logger.heroBanner();

  // ── Configuration Block ──
  const configRows: [string, string][] = [
    ["\uD83C\uDF10 Host", `${config.host}:${config.port}`],
    ["\uD83D\uDC64 User", config.username],
    ["\uD83D\uDCC2 Local", path.resolve(config.localDir)],
    ["\uD83D\uDCE1 Remote", serverDir],
    ["\uD83C\uDFAF Environment", config.environment],
  ];
  if (config.dryRun) configRows.push(["\uD83E\uDDEA Dry Run", "ENABLED"]);
  if (config.rollbackOnFailure) configRows.push(["\u23EA Rollback", "enabled"]);
  if (config.healthCheckUrl) configRows.push(["\uD83E\uDE7A Health Check", config.healthCheckUrl]);
  if (config.webhookUrl) configRows.push(["\uD83D\uDD14 Webhook", config.webhookType]);
  logger.configBlock(configRows);

  // Helper to build partial result for notifications on early failure
  const buildResult = (overrides?: Partial<DeployResult>): DeployResult => ({
    filesUploaded: 0,
    filesReplaced: 0,
    filesDeleted: 0,
    filesUnchanged: 0,
    bytesTransferred: 0,
    durationMs: Date.now() - startTime,
    preCommandResults,
    commandResults,
    diff: { upload: [], replace: [], delete: [], same: [], uploadSize: 0, replaceSize: 0, deleteSize: 0 },
    rolledBack,
    healthCheck: healthCheckResult,
    notificationSent,
    environment: config.environment,
    ...overrides,
  });

  // ══════════════════════════════════════════════════════════
  //  STAGE 1: Connect
  // ══════════════════════════════════════════════════════════
  logger.stageBanner(1, TOTAL_STAGES, "\uD83D\uDD17", "Connecting to Server");

  const ssh = new SSHClient(
    {
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: config.privateKey,
      passphrase: config.passphrase || undefined,
      timeout: config.timeout,
    },
    logger
  );

  try {
    await ssh.connect();
    logger.success(`SSH connection established to ${config.host}:${config.port}`);
    await ssh.initSftp();
    logger.success("SFTP subsystem initialized");
  } catch (err: any) {
    logger.error(`Connection failed: ${err.message}`);
    const result = buildResult();
    if (config.webhookUrl) {
      notificationSent = await sendNotification(config.webhookUrl, config.webhookType, result, "failure", logger);
    }
    throw new Error(`Connection failed: ${err.message}`);
  }

  try {
    // ══════════════════════════════════════════════════════════
    //  STAGE 2: Prepare Remote Directory
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(2, TOTAL_STAGES, "\uD83D\uDCC1", "Preparing Remote Directory");
    await ssh.mkdirRecursive(serverDir);
    logger.success(`Remote directory ready: ${serverDir}`);

    // ══════════════════════════════════════════════════════════
    //  STAGE 3: Pre-Deploy Commands
    // ══════════════════════════════════════════════════════════
    if (config.preCommands.length > 0) {
      logger.stageBanner(3, TOTAL_STAGES, "\u2699\uFE0F", "Running Pre-Deploy Commands");
      const preResults = await runCommands(ssh, config.preCommands, cwd, config.dryRun, logger);
      preCommandResults.push(...preResults);
    } else {
      logger.stageBanner(3, TOTAL_STAGES, "\u2699\uFE0F", "Pre-Deploy Commands");
      logger.info("No pre-deploy commands configured. Skipping.");
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 4: Read Remote State
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(4, TOTAL_STAGES, "\uD83D\uDCE5", "Reading Remote State");
    let remoteState: SyncState | null = null;

    if (config.dangerousCleanSlate) {
      logger.warn("\u26A0\uFE0F  DANGEROUS CLEAN SLATE is enabled!");
      logger.warn("Deleting ALL remote content before deploying...");
      if (!config.dryRun) {
        const remoteFiles = await ssh.listFilesRecursive(serverDir);
        for (const file of remoteFiles) {
          await ssh.deleteFile(`${serverDir}${file}`);
          logger.verbose(`    \uD83D\uDDD1\uFE0F  Deleted: ${file}`);
        }
        logger.success(`Cleared ${remoteFiles.length} files from server`);
      } else {
        logger.info("[DRY RUN] Would delete all remote files");
      }
    } else {
      const stateContent = await ssh.readFile(stateFilePath);
      if (stateContent) {
        try {
          remoteState = JSON.parse(stateContent);
          const fileCount = Object.keys(remoteState!.files).length;
          logger.success(`Found sync state: ${fileCount} files tracked`);
          logger.verbose(`  Last deployed: ${remoteState!.timestamp}`);
          if (remoteState!.environment) {
            logger.verbose(`  Environment: ${remoteState!.environment}`);
          }
        } catch {
          logger.warn("Corrupt sync state file found, treating as first deploy");
          remoteState = null;
        }
      } else {
        logger.info("\uD83C\uDD95 No sync state found \u2014 this is the first deployment!");
      }
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 5: Scan & Compute Diff
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(5, TOTAL_STAGES, "\uD83D\uDD0D", "Scanning & Computing Diff");
    const localFiles = await getLocalFiles(config.localDir, config.exclude, logger);
    logger.success(`Scanned ${Object.keys(localFiles).length} local files`);

    const diff = computeDiff(localFiles, remoteState, logger);
    const totalChanges = diff.upload.length + diff.replace.length + diff.delete.length;

    logger.diffSummary(
      diff.upload.length, diff.replace.length, diff.delete.length, diff.same.length,
      formatBytes(diff.uploadSize), formatBytes(diff.replaceSize), formatBytes(diff.deleteSize)
    );

    if (totalChanges === 0) {
      logger.noChangesBanner();

      if (config.healthCheckUrl) {
        logger.stageBanner(9, TOTAL_STAGES, "\uD83E\uDE7A", "Health Check");
        healthCheckResult = await runHealthCheck(
          config.healthCheckUrl, config.healthCheckExpectedStatus,
          config.healthCheckRetries, config.healthCheckRetryDelay,
          config.timeout, logger
        );
        if (healthCheckResult.passed) {
          logger.success(`Health check passed (${healthCheckResult.responseTimeMs}ms)`);
        } else {
          logger.warn(`Health check failed: ${healthCheckResult.error}`);
        }
      }

      ssh.disconnect();
      const result = buildResult({ filesUnchanged: diff.same.length, diff });

      if (config.webhookUrl) {
        notificationSent = await sendNotification(config.webhookUrl, config.webhookType, result, "success", logger);
      }

      logger.finalSummary([
        ["Environment:", config.environment],
        ["Status:", "\u2705 No changes needed"],
        ["Tracked files:", String(diff.same.length)],
      ], "success");

      return { ...result, notificationSent };
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 6: Save Rollback Point
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(6, TOTAL_STAGES, "\uD83D\uDCBE", "Saving Rollback Point");
    if (config.rollbackOnFailure && !config.dryRun) {
      if (remoteState) {
        await ssh.writeFile(rollbackStatePath, JSON.stringify(remoteState, null, 2));
        logger.success(`Rollback point saved (${Object.keys(remoteState.files).length} files)`);
      } else {
        logger.info("First deployment \u2014 no rollback point needed");
      }
    } else if (config.rollbackOnFailure && config.dryRun) {
      logger.info("[DRY RUN] Would save rollback point");
    } else {
      logger.info("Rollback not enabled. Skipping.");
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 7: Sync Files
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(7, TOTAL_STAGES, "\uD83D\uDCE4", "Syncing Files to Server");
    let bytesTransferred = 0;

    if (!config.dryRun) {
      // Upload new files
      if (diff.upload.length > 0) {
        logger.minimal(`  \u2795 Uploading ${diff.upload.length} new file(s)...`);
        for (const file of diff.upload) {
          const localPath = path.join(path.resolve(config.localDir), file.path);
          const remotePath = `${serverDir}${file.path}`;
          const remoteDir = path.posix.dirname(remotePath);

          await ssh.mkdirRecursive(remoteDir);
          await ssh.uploadFile(localPath, remotePath);
          bytesTransferred += file.size;
          logger.fileAdd(file.path, formatBytes(file.size));
        }
      }

      // Replace modified files
      if (diff.replace.length > 0) {
        logger.minimal(`  \u270F\uFE0F  Replacing ${diff.replace.length} modified file(s)...`);
        for (const file of diff.replace) {
          const localPath = path.join(path.resolve(config.localDir), file.path);
          const remotePath = `${serverDir}${file.path}`;

          await ssh.uploadFile(localPath, remotePath);
          bytesTransferred += file.size;
          logger.fileModify(file.path, formatBytes(file.size));
        }
      }

      // Delete removed files
      if (diff.delete.length > 0) {
        logger.minimal(`  \uD83D\uDDD1\uFE0F  Deleting ${diff.delete.length} removed file(s)...`);
        for (const file of diff.delete) {
          const remotePath = `${serverDir}${file.path}`;
          await ssh.deleteFile(remotePath);
          await ssh.removeEmptyDirs(remotePath, serverDir);
          logger.fileDelete(file.path);
        }
      }

      logger.minimal("");
      logger.success(`Sync complete! Transferred ${formatBytes(bytesTransferred)}`);
    } else {
      logger.minimal("  \uD83E\uDDEA [DRY RUN] No files were changed on the server");
      logger.minimal("");
      for (const file of diff.upload) {
        logger.fileAdd(file.path, formatBytes(file.size));
      }
      for (const file of diff.replace) {
        logger.fileModify(file.path, formatBytes(file.size));
      }
      for (const file of diff.delete) {
        logger.fileDelete(file.path);
      }
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 8: Post-Deploy Commands
    // ══════════════════════════════════════════════════════════
    if (config.commands.length > 0) {
      logger.stageBanner(8, TOTAL_STAGES, "\u2699\uFE0F", "Running Post-Deploy Commands");
      const postResults = await runCommands(ssh, config.commands, cwd, config.dryRun, logger);
      commandResults.push(...postResults);
    } else {
      logger.stageBanner(8, TOTAL_STAGES, "\u2699\uFE0F", "Post-Deploy Commands");
      logger.info("No post-deploy commands configured. Skipping.");
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 9: Health Check
    // ══════════════════════════════════════════════════════════
    if (config.healthCheckUrl) {
      logger.stageBanner(9, TOTAL_STAGES, "\uD83E\uDE7A", "Health Check");
      logger.info(`URL: ${config.healthCheckUrl}`);
      logger.info(`Expected status: ${config.healthCheckExpectedStatus}`);
      logger.info(`Max retries: ${config.healthCheckRetries}`);
      logger.minimal("");

      healthCheckResult = await runHealthCheck(
        config.healthCheckUrl,
        config.healthCheckExpectedStatus,
        config.healthCheckRetries,
        config.healthCheckRetryDelay,
        config.timeout,
        logger
      );

      if (healthCheckResult.passed) {
        logger.success(`Health check PASSED in ${healthCheckResult.attempts} attempt(s) (${healthCheckResult.responseTimeMs}ms)`);
      } else {
        logger.error(`Health check FAILED after ${healthCheckResult.attempts} attempt(s): ${healthCheckResult.error}`);

        // Rollback if configured
        if (config.rollbackOnFailure && config.healthCheckFailDeploy && !config.dryRun) {
          rolledBack = await performRollback(ssh, serverDir, rollbackStatePath, localFiles, logger);

          if (rolledBack) {
            const oldState = await ssh.readFile(rollbackStatePath);
            if (oldState) {
              await ssh.writeFile(stateFilePath, oldState);
            }
          }
        }
      }
    } else {
      logger.stageBanner(9, TOTAL_STAGES, "\uD83E\uDE7A", "Health Check");
      logger.info("No health check URL configured. Skipping.");
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 10: Save Sync State
    // ══════════════════════════════════════════════════════════
    logger.stageBanner(10, TOTAL_STAGES, "\uD83D\uDCBE", "Saving Sync State");
    if (!rolledBack) {
      if (!config.dryRun) {
        const newState: SyncState = {
          version: SYNC_STATE_VERSION,
          timestamp: new Date().toISOString(),
          commitHash: process.env.GITHUB_SHA || undefined,
          environment: config.environment,
          files: localFiles,
        };
        await ssh.writeFile(stateFilePath, JSON.stringify(newState, null, 2));
        logger.success(`Sync state saved (${Object.keys(localFiles).length} files tracked)`);
        logger.info(`State file: ${stateFilePath}`);
      } else {
        logger.info("[DRY RUN] Sync state not updated");
      }
    } else {
      logger.warn("Sync state restored to previous version (rollback)");
    }

    // ══════════════════════════════════════════════════════════
    //  STAGE 11: Notifications
    // ══════════════════════════════════════════════════════════
    const durationMs = Date.now() - startTime;

    const finalResult: DeployResult = {
      filesUploaded: diff.upload.length,
      filesReplaced: diff.replace.length,
      filesDeleted: diff.delete.length,
      filesUnchanged: diff.same.length,
      bytesTransferred,
      durationMs,
      preCommandResults,
      commandResults,
      diff,
      rolledBack,
      healthCheck: healthCheckResult,
      notificationSent: false,
      environment: config.environment,
    };

    if (config.webhookUrl) {
      logger.stageBanner(11, TOTAL_STAGES, "\uD83D\uDD14", "Sending Notification");
      const status = rolledBack ? "rolled_back" : "success";
      notificationSent = await sendNotification(config.webhookUrl, config.webhookType, finalResult, status, logger);
      finalResult.notificationSent = notificationSent;
      if (notificationSent) {
        logger.success(`${config.webhookType} notification sent successfully`);
      } else {
        logger.warn("Failed to send notification");
      }
    } else {
      logger.stageBanner(11, TOTAL_STAGES, "\uD83D\uDD14", "Notifications");
      logger.info("No webhook configured. Skipping.");
    }

    ssh.disconnect();

    // ══════════════════════════════════════════════════════════
    //  FINAL SUMMARY
    // ══════════════════════════════════════════════════════════
    const commitHash = process.env.GITHUB_SHA?.substring(0, 8) || "local";
    const summaryStatus = rolledBack ? "rolled_back" : "success";

    logger.finalSummary([
      ["\uD83C\uDFAF Environment:", config.environment],
      ["\uD83D\uDD17 Server:", `${config.host}:${config.port}`],
      ["\uD83D\uDCE1 Remote Path:", serverDir],
      ["\uD83D\uDD16 Commit:", commitHash],
      ["", ""],
      ["\u2795 New files:", String(diff.upload.length)],
      ["\u270F\uFE0F  Modified:", String(diff.replace.length)],
      ["\uD83D\uDDD1\uFE0F  Deleted:", String(diff.delete.length)],
      ["\u2796 Unchanged:", String(diff.same.length)],
      ["\uD83D\uDCE6 Transferred:", formatBytes(bytesTransferred)],
      ["", ""],
      ["\u23F1\uFE0F  Duration:", `${(durationMs / 1000).toFixed(1)}s`],
      ["\u2699\uFE0F  Pre-commands:", `${preCommandResults.length} run`],
      ["\u2699\uFE0F  Post-commands:", `${commandResults.length} run`],
      ["\uD83E\uDE7A Health check:", healthCheckResult ? (healthCheckResult.passed ? "\u2705 PASSED" : "\u274C FAILED") : "N/A"],
      ["\u23EA Rolled back:", rolledBack ? "\u26A0\uFE0F  YES" : "No"],
      ["\uD83D\uDD14 Notified:", notificationSent ? "\u2705 Sent" : "N/A"],
    ], summaryStatus);

    // If health check failed and should fail the deploy
    if (healthCheckResult && !healthCheckResult.passed && config.healthCheckFailDeploy) {
      throw new Error(`Health check failed: ${healthCheckResult.error}`);
    }

    return finalResult;
  } catch (err: any) {
    // Send failure notification
    if (config.webhookUrl) {
      const failResult = buildResult();
      await sendNotification(config.webhookUrl, config.webhookType, failResult, "failure", logger);
    }
    ssh.disconnect();

    logger.finalSummary([
      ["\uD83C\uDFAF Environment:", config.environment],
      ["\uD83D\uDCA5 Error:", err.message],
    ], "failure");

    throw err;
  }
}
