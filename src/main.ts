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

async function run(): Promise<void> {
  try {
    const exclude = core
      .getMultilineInput("exclude")
      .flatMap((line) => line.split(",").map((s) => s.trim()))
      .filter(Boolean);

    const commands = core
      .getMultilineInput("commands")
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed !== "" && !trimmed.startsWith("#");
      });

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
      commands,
      commandsWorkingDir: optionalString("commands-working-dir"),
    };

    // Mask the private key in logs
    core.setSecret(args.privateKey);
    if (args.passphrase) {
      core.setSecret(args.passphrase);
    }

    const result = await deploy(args);

    // Set outputs
    core.setOutput("files-uploaded", result.filesUploaded);
    core.setOutput("files-replaced", result.filesReplaced);
    core.setOutput("files-deleted", result.filesDeleted);
    core.setOutput("files-unchanged", result.filesUnchanged);
    core.setOutput("bytes-transferred", result.bytesTransferred);
    core.setOutput("duration-ms", result.durationMs);
    core.setOutput("total-changes", result.filesUploaded + result.filesReplaced + result.filesDeleted);

    // Check for failed commands
    const failedCommands = result.commandResults.filter((r) => r.exitCode !== 0);
    if (failedCommands.length > 0) {
      core.warning(
        `${failedCommands.length} post-deploy command(s) failed. Check logs for details.`
      );
    }
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
