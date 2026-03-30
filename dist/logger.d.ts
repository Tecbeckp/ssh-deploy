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
    /** Banner-style output for stage headers */
    banner(title: string): void;
    /** Error output - always shown */
    error(message: string): void;
    /** Warning output - always shown */
    warn(message: string): void;
    /** Summary table */
    summary(rows: [string, string | number][]): void;
}
