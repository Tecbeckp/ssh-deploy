import * as core from "@actions/core";
import { deploy } from "./deploy";
import type { DeployArguments } from "./types";

function optionalString(name: string): string | undefined {
  const val = core.getInput(name);
  return val === "" ? undefined : val;
}

function optionalInt(name: string, fallback: number): number {
  const val = core.getInput(name);
  if (val === "") return fallback;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) {
    throw new Error(`Input "${name}" must be a number, got "${val}"`);
  }
  return parsed;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const val = core.getInput(name).toLowerCase();
  if (val === "" || val === "false") return fallback;
  if (val === "true") return true;
  throw new Error(`Input "${name}" must be "true" or "false", got "${val}"`);
}

function optionalLogLevel(name: string): "minimal" | "standard" | "verbose" {
  const val = core.getInput(name).toLowerCase();
  if (val === "" || val === "standard") return "standard";
  if (val === "minimal" || val === "verbose") return val;
  throw new Error(`Input "${name}" must be "minimal", "standard", or "verbose", got "${val}"`);
}

function optionalWebhookType(name: string): "slack" | "discord" | "custom" {
  const val = core.getInput(name).toLowerCase();
  if (val === "" || val === "slack") return "slack";
  if (val === "discord" || val === "custom") return val;
  throw new Error(`Input "${name}" must be "slack", "discord", or "custom", got "${val}"`);
}

function parseMultilineInput(name: string): string[] {
  return core
    .getMultilineInput(name)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("#");
    });
}

async function run(): Promise<void> {
  try {
    const exclude = core
      .getMultilineInput("exclude")
      .flatMap((line) => line.split(",").map((s) => s.trim()))
      .filter(Boolean);

    const args: DeployArguments = {
      host: core.getInput("host", { required: true }),
      port: optionalInt("port", 22),
      username: core.getInput("username", { required: true }),
      privateKey: core.getInput("private-key", { required: true }),
      passphrase: optionalString("passphrase"),
      localDir: core.getInput("local-dir") || "./",
      serverDir: core.getInput("server-dir") || "./",
      stateName: core.getInput("state-name") || ".ssh-deploy-sync-state.json",
      dryRun: optionalBool("dry-run", false),
      dangerousCleanSlate: optionalBool("dangerous-clean-slate", false),
      exclude,
      logLevel: optionalLogLevel("log-level"),
      timeout: optionalInt("timeout", 30000),
      preCommands: parseMultilineInput("pre-commands"),
      commands: parseMultilineInput("commands"),
      commandsWorkingDir: optionalString("commands-working-dir"),
      rollbackOnFailure: optionalBool("rollback-on-failure", false),
      rollbackLimit: optionalInt("rollback-limit", 3),
      healthCheckUrl: optionalString("health-check-url"),
      healthCheckExpectedStatus: optionalInt("health-check-status", 200),
      healthCheckRetries: optionalInt("health-check-retries", 3),
      healthCheckRetryDelay: optionalInt("health-check-retry-delay", 5000),
      healthCheckFailDeploy: optionalBool("health-check-fail-deploy", false),
      webhookUrl: optionalString("webhook-url"),
      webhookType: optionalWebhookType("webhook-type"),
      environment: core.getInput("environment") || "production",
    };

    // Mask secrets in logs
    core.setSecret(args.privateKey);
    if (args.passphrase) core.setSecret(args.passphrase);
    if (args.webhookUrl) core.setSecret(args.webhookUrl);

    const result = await deploy(args);

    // Set outputs
    core.setOutput("files-uploaded", result.filesUploaded);
    core.setOutput("files-replaced", result.filesReplaced);
    core.setOutput("files-deleted", result.filesDeleted);
    core.setOutput("files-unchanged", result.filesUnchanged);
    core.setOutput("bytes-transferred", result.bytesTransferred);
    core.setOutput("duration-ms", result.durationMs);
    core.setOutput("total-changes", result.filesUploaded + result.filesReplaced + result.filesDeleted);
    core.setOutput("rolled-back", result.rolledBack);
    core.setOutput("health-check-passed", result.healthCheck?.passed ?? "N/A");
    core.setOutput("notification-sent", result.notificationSent);
    core.setOutput("environment", result.environment);

    // Warnings
    const failedPreCmds = result.preCommandResults.filter((r) => r.exitCode !== 0);
    if (failedPreCmds.length > 0) {
      core.warning(`${failedPreCmds.length} pre-deploy command(s) failed.`);
    }

    const failedPostCmds = result.commandResults.filter((r) => r.exitCode !== 0);
    if (failedPostCmds.length > 0) {
      core.warning(`${failedPostCmds.length} post-deploy command(s) failed.`);
    }

    if (result.rolledBack) {
      core.warning("Deployment was rolled back due to health check failure.");
    }
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
