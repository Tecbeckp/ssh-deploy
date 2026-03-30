import * as path from "path";
import type {
  DeployArguments,
  DeployResult,
  SyncState,
  CommandResult,
} from "./types";
import { SSHClient } from "./ssh-client";
import { getLocalFiles, computeDiff, formatBytes } from "./hash";
import { Logger } from "./logger";

const SYNC_STATE_VERSION = 1;

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
    commands: args.commands ?? [],
    commandsWorkingDir: args.commandsWorkingDir ?? args.serverDir ?? "./",
  };
}

export async function deploy(args: DeployArguments): Promise<DeployResult> {
  const config = applyDefaults(args);
  const logger = new Logger(config.logLevel);
  const startTime = Date.now();
  const commandResults: CommandResult[] = [];

  // Normalize server dir to always end with /
  const serverDir = config.serverDir.endsWith("/")
    ? config.serverDir
    : config.serverDir + "/";

  const stateFilePath = `${serverDir}${config.stateName}`;

  logger.banner("SSH Deploy - Smart Sync");
  logger.minimal(`  Host:      ${config.host}:${config.port}`);
  logger.minimal(`  User:      ${config.username}`);
  logger.minimal(`  Local:     ${path.resolve(config.localDir)}`);
  logger.minimal(`  Remote:    ${serverDir}`);
  logger.minimal(`  Dry Run:   ${config.dryRun}`);
  logger.minimal("");

  // ── Stage 1: Connect ──
  logger.banner("Stage 1: Connecting to server");
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
    await ssh.initSftp();
  } catch (err: any) {
    throw new Error(`Connection failed: ${err.message}`);
  }

  try {
    // ── Stage 2: Ensure remote directory exists ──
    logger.banner("Stage 2: Preparing remote directory");
    await ssh.mkdirRecursive(serverDir);
    logger.standard(`  Remote directory ready: ${serverDir}`);

    // ── Stage 3: Read remote sync state ──
    logger.banner("Stage 3: Reading remote state");
    let remoteState: SyncState | null = null;

    if (config.dangerousCleanSlate) {
      logger.warn("  dangerous-clean-slate is enabled! Deleting all remote content.");
      if (!config.dryRun) {
        const remoteFiles = await ssh.listFilesRecursive(serverDir);
        for (const file of remoteFiles) {
          await ssh.deleteFile(`${serverDir}${file}`);
          logger.verbose(`    Deleted: ${file}`);
        }
      }
      logger.standard("  Remote directory cleared.");
    } else {
      const stateContent = await ssh.readFile(stateFilePath);
      if (stateContent) {
        try {
          remoteState = JSON.parse(stateContent);
          logger.standard(`  Found existing sync state (${Object.keys(remoteState!.files).length} files tracked)`);
          logger.verbose(`  Last deployed: ${remoteState!.timestamp}`);
        } catch {
          logger.warn("  Corrupt sync state file found, treating as first deploy");
          remoteState = null;
        }
      } else {
        logger.standard("  No sync state found - first deployment");
      }
    }

    // ── Stage 4: Scan local files & compute diff ──
    logger.banner("Stage 4: Scanning local files");
    const localFiles = await getLocalFiles(config.localDir, config.exclude, logger);
    const diff = computeDiff(localFiles, remoteState, logger);

    const totalChanges = diff.upload.length + diff.replace.length + diff.delete.length;

    if (totalChanges === 0) {
      logger.minimal("");
      logger.minimal("  No changes detected. Server is up to date.");
      ssh.disconnect();
      return {
        filesUploaded: 0,
        filesReplaced: 0,
        filesDeleted: 0,
        filesUnchanged: diff.same.length,
        bytesTransferred: 0,
        durationMs: Date.now() - startTime,
        commandResults: [],
        diff,
      };
    }

    // ── Stage 5: Sync files ──
    logger.banner("Stage 5: Syncing files");
    logger.minimal(`  Uploading ${diff.upload.length} new file(s) (${formatBytes(diff.uploadSize)})`);
    logger.minimal(`  Replacing ${diff.replace.length} modified file(s) (${formatBytes(diff.replaceSize)})`);
    logger.minimal(`  Deleting ${diff.delete.length} removed file(s) (${formatBytes(diff.deleteSize)})`);
    logger.minimal("");

    let bytesTransferred = 0;

    if (!config.dryRun) {
      // Upload new files
      for (const file of diff.upload) {
        const localPath = path.join(path.resolve(config.localDir), file.path);
        const remotePath = `${serverDir}${file.path}`;
        const remoteDir = path.posix.dirname(remotePath);

        await ssh.mkdirRecursive(remoteDir);
        await ssh.uploadFile(localPath, remotePath);
        bytesTransferred += file.size;
        logger.standard(`    + ${file.path} (${formatBytes(file.size)})`);
      }

      // Replace modified files
      for (const file of diff.replace) {
        const localPath = path.join(path.resolve(config.localDir), file.path);
        const remotePath = `${serverDir}${file.path}`;

        await ssh.uploadFile(localPath, remotePath);
        bytesTransferred += file.size;
        logger.standard(`    ~ ${file.path} (${formatBytes(file.size)})`);
      }

      // Delete removed files
      for (const file of diff.delete) {
        const remotePath = `${serverDir}${file.path}`;
        await ssh.deleteFile(remotePath);
        await ssh.removeEmptyDirs(remotePath, serverDir);
        logger.standard(`    - ${file.path}`);
      }
    } else {
      logger.minimal("  [DRY RUN] No files were changed on the server");
      for (const file of diff.upload) {
        logger.standard(`    + ${file.path} (${formatBytes(file.size)})`);
      }
      for (const file of diff.replace) {
        logger.standard(`    ~ ${file.path} (${formatBytes(file.size)})`);
      }
      for (const file of diff.delete) {
        logger.standard(`    - ${file.path}`);
      }
    }

    // ── Stage 6: Run post-deploy commands ──
    if (config.commands.length > 0) {
      logger.banner("Stage 6: Running post-deploy commands");
      const cwd = config.commandsWorkingDir || serverDir;

      for (let i = 0; i < config.commands.length; i++) {
        const cmd = config.commands[i].trim();
        if (!cmd || cmd.startsWith("#")) continue;

        logger.standard(`  [${i + 1}/${config.commands.length}] $ ${cmd}`);

        if (!config.dryRun) {
          const result = await ssh.exec(cmd, cwd);
          commandResults.push(result);

          if (result.stdout) {
            logger.verbose(`    stdout: ${result.stdout}`);
          }
          if (result.stderr) {
            logger.verbose(`    stderr: ${result.stderr}`);
          }

          if (result.exitCode !== 0) {
            logger.warn(`    Command failed with exit code ${result.exitCode}`);
          } else {
            logger.standard(`    Done (${result.durationMs}ms)`);
          }
        } else {
          logger.standard("    [DRY RUN] Skipped");
          commandResults.push({
            command: cmd,
            stdout: "",
            stderr: "",
            exitCode: 0,
            durationMs: 0,
          });
        }
      }
    }

    // ── Stage 7: Save sync state ──
    logger.banner("Stage 7: Saving sync state");
    if (!config.dryRun) {
      const newState: SyncState = {
        version: SYNC_STATE_VERSION,
        timestamp: new Date().toISOString(),
        commitHash: process.env.GITHUB_SHA || undefined,
        files: localFiles,
      };
      await ssh.writeFile(stateFilePath, JSON.stringify(newState, null, 2));
      logger.standard(`  Sync state saved to ${stateFilePath}`);
    } else {
      logger.standard("  [DRY RUN] Sync state not updated");
    }

    // ── Summary ──
    const durationMs = Date.now() - startTime;
    logger.banner("Deployment Complete");
    logger.summary([
      ["New files:", String(diff.upload.length)],
      ["Modified files:", String(diff.replace.length)],
      ["Deleted files:", String(diff.delete.length)],
      ["Unchanged files:", String(diff.same.length)],
      ["Bytes transferred:", formatBytes(bytesTransferred)],
      ["Duration:", `${(durationMs / 1000).toFixed(1)}s`],
      ["Commands run:", String(commandResults.length)],
    ]);
    logger.minimal("");

    ssh.disconnect();

    return {
      filesUploaded: diff.upload.length,
      filesReplaced: diff.replace.length,
      filesDeleted: diff.delete.length,
      filesUnchanged: diff.same.length,
      bytesTransferred,
      durationMs,
      commandResults,
      diff,
    };
  } catch (err) {
    ssh.disconnect();
    throw err;
  }
}
