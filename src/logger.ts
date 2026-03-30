export type LogLevel = "minimal" | "standard" | "verbose";

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = "standard") {
    this.level = level;
  }

  private shouldLog(msgLevel: LogLevel): boolean {
    const levels: LogLevel[] = ["minimal", "standard", "verbose"];
    return levels.indexOf(msgLevel) <= levels.indexOf(this.level);
  }

  /** Always shown */
  minimal(message: string): void {
    if (this.shouldLog("minimal")) {
      console.log(message);
    }
  }

  /** Shown at standard and verbose */
  standard(message: string): void {
    if (this.shouldLog("standard")) {
      console.log(message);
    }
  }

  /** Only shown at verbose */
  verbose(message: string): void {
    if (this.shouldLog("verbose")) {
      console.log(message);
    }
  }

  /** Banner-style output for stage headers */
  banner(title: string): void {
    if (this.shouldLog("minimal")) {
      const line = "-".repeat(60);
      console.log("");
      console.log(line);
      console.log(`  ${title}`);
      console.log(line);
    }
  }

  /** Error output - always shown */
  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  /** Warning output - always shown */
  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  /** Summary table */
  summary(rows: [string, string | number][]): void {
    if (!this.shouldLog("minimal")) return;
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      console.log(`  ${key.padEnd(maxKey + 2)} ${value}`);
    }
  }
}
