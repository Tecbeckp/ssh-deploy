export type LogLevel = "minimal" | "standard" | "verbose";
export declare class Logger {
    private level;
    constructor(level?: LogLevel);
    private shouldLog;
    /** Always shown */
    minimal(message: string): void;
    /** Shown at standard and verbose */
    standard(message: string): void;
    /** Only shown at verbose */
    verbose(message: string): void;
    /** Error output - always shown */
    error(message: string): void;
    /** Warning output - always shown */
    warn(message: string): void;
    /** Success line */
    success(message: string): void;
    /** Info line */
    info(message: string): void;
    /** Main hero banner - shown once at the very start */
    heroBanner(): void;
    /** Stage banner with icon and step count */
    stageBanner(stageNum: number, totalStages: number, icon: string, title: string): void;
    /** Special banner for rollback */
    rollbackBanner(): void;
    /** Config info block */
    configBlock(rows: [string, string][]): void;
    /** Changes summary box */
    diffSummary(added: number, modified: number, deleted: number, unchanged: number, addedSize: string, modifiedSize: string, deletedSize: string): void;
    /** File transfer line */
    fileAdd(filePath: string, size: string): void;
    fileModify(filePath: string, size: string): void;
    fileDelete(filePath: string): void;
    /** Command execution line */
    cmdRun(index: number, total: number, cmd: string): void;
    cmdSuccess(durationMs: number): void;
    cmdFail(exitCode: number): void;
    cmdOutput(label: string, output: string): void;
    /** Final summary box */
    finalSummary(rows: [string, string][], status: "success" | "failure" | "rolled_back"): void;
    /** No changes banner */
    noChangesBanner(): void;
    /** Commands summary box */
    cmdSummary(total: number, passed: number, failed: number): void;
    /** Deprecated - kept for backward compat */
    banner(title: string): void;
    /** Deprecated - kept for backward compat */
    summary(rows: [string, string | number][]): void;
}
