export interface DeployArguments {
  /** SSH server hostname or IP */
  host: string;
  /** SSH port (default: 22) */
  port: number;
  /** SSH username */
  username: string;
  /** SSH private key content */
  privateKey: string;
  /** SSH passphrase for encrypted keys */
  passphrase?: string;
  /** Local directory to deploy (default: "./") */
  localDir: string;
  /** Remote directory on server (default: "./") */
  serverDir: string;
  /** Filename for tracking deployed state (default: ".ssh-deploy-sync-state.json") */
  stateName: string;
  /** Preview changes without deploying (default: false) */
  dryRun: boolean;
  /** Delete ALL remote content before deploying (default: false) */
  dangerousCleanSlate: boolean;
  /** Glob patterns to exclude from deployment */
  exclude: string[];
  /** Log level: "minimal" | "standard" | "verbose" */
  logLevel: "minimal" | "standard" | "verbose";
  /** Connection/operation timeout in milliseconds (default: 30000) */
  timeout: number;
  /** Enable SSH compression for slower networks (default: false) */
  compression: boolean;
  /** Max concurrent file uploads (default: 5) */
  uploadConcurrency: number;
  /** Commands to execute on server BEFORE file sync */
  preCommands: string[];
  /** Commands to execute on server AFTER file sync */
  commands: string[];
  /** Working directory for remote commands (defaults to serverDir) */
  commandsWorkingDir?: string;
  /** Enable rollback on failure (default: false) */
  rollbackOnFailure: boolean;
  /** Maximum number of rollback states to keep (default: 3) */
  rollbackLimit: number;
  /** Health check URL to verify deployment (optional) */
  healthCheckUrl?: string;
  /** Expected HTTP status code for health check (default: 200) */
  healthCheckExpectedStatus: number;
  /** Max retries for health check (default: 3) */
  healthCheckRetries: number;
  /** Delay between health check retries in ms (default: 5000) */
  healthCheckRetryDelay: number;
  /** Fail deployment if health check fails (default: false) */
  healthCheckFailDeploy: boolean;
  /** Webhook URL for notifications (Slack/Discord/custom) */
  webhookUrl?: string;
  /** Webhook type: "slack" | "discord" | "custom" */
  webhookType: "slack" | "discord" | "custom";
  /** Environment name for display in notifications (e.g., "production", "staging") */
  environment: string;
}

export interface DeployArgumentsWithDefaults extends Required<DeployArguments> {}

export interface FileRecord {
  /** Relative file path */
  path: string;
  /** MD5 hash of file content */
  hash: string;
  /** File size in bytes */
  size: number;
}

export interface SyncState {
  /** Schema version */
  version: number;
  /** ISO timestamp of last deployment */
  timestamp: string;
  /** Commit hash if available */
  commitHash?: string;
  /** Environment name */
  environment?: string;
  /** Map of file path -> file record */
  files: Record<string, FileRecord>;
}

export interface DiffResult {
  /** Files to upload (new) */
  upload: FileRecord[];
  /** Files to replace (modified) */
  replace: FileRecord[];
  /** Files to delete (removed from local) */
  delete: FileRecord[];
  /** Files that are unchanged */
  same: FileRecord[];
  /** Total bytes to upload */
  uploadSize: number;
  /** Total bytes to replace */
  replaceSize: number;
  /** Total bytes to delete */
  deleteSize: number;
}

export interface CommandResult {
  /** The command that was executed */
  command: string;
  /** stdout output */
  stdout: string;
  /** stderr output */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface HealthCheckResult {
  /** Whether the health check passed */
  passed: boolean;
  /** HTTP status code received */
  statusCode: number;
  /** Response time in ms */
  responseTimeMs: number;
  /** Number of attempts made */
  attempts: number;
  /** Error message if failed */
  error?: string;
}

export interface DeployResult {
  /** Total files uploaded */
  filesUploaded: number;
  /** Total files replaced */
  filesReplaced: number;
  /** Total files deleted */
  filesDeleted: number;
  /** Total files unchanged */
  filesUnchanged: number;
  /** Total bytes transferred */
  bytesTransferred: number;
  /** Total deployment duration in milliseconds */
  durationMs: number;
  /** Results of pre-deploy commands */
  preCommandResults: CommandResult[];
  /** Results of post-deploy commands */
  commandResults: CommandResult[];
  /** Diff details */
  diff: DiffResult;
  /** Whether a rollback was performed */
  rolledBack: boolean;
  /** Health check result */
  healthCheck?: HealthCheckResult;
  /** Whether notification was sent */
  notificationSent: boolean;
  /** Environment name */
  environment: string;
}
