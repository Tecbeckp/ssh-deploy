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

  /** Error output - always shown */
  error(message: string): void {
    console.error(`  \u274C ${message}`);
  }

  /** Warning output - always shown */
  warn(message: string): void {
    console.warn(`  \u26A0\uFE0F  ${message}`);
  }

  /** Success line */
  success(message: string): void {
    if (this.shouldLog("minimal")) {
      console.log(`  \u2705 ${message}`);
    }
  }

  /** Info line */
  info(message: string): void {
    if (this.shouldLog("standard")) {
      console.log(`  \u2139\uFE0F  ${message}`);
    }
  }

  /** Main hero banner - shown once at the very start */
  heroBanner(): void {
    if (!this.shouldLog("minimal")) return;
    console.log("");
    console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    console.log("\u2551                                                            \u2551");
    console.log("\u2551        \uD83D\uDE80 SSH DEPLOY - SMART SYNC                        \u2551");
    console.log("\u2551        Secure \u2022 Incremental \u2022 Intelligent                  \u2551");
    console.log("\u2551                                                            \u2551");
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("");
  }

  /** Stage banner with icon and step count */
  stageBanner(stageNum: number, totalStages: number, icon: string, title: string): void {
    if (!this.shouldLog("minimal")) return;
    console.log("");
    console.log("\u2552\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2555");
    console.log(`\u2502  ${icon}  Stage ${stageNum}/${totalStages}: ${title.padEnd(43)}\u2502`);
    console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
    console.log("");
  }

  /** Special banner for rollback */
  rollbackBanner(): void {
    if (!this.shouldLog("minimal")) return;
    console.log("");
    console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    console.log("\u2551        \u23EA ROLLBACK IN PROGRESS                            \u2551");
    console.log("\u2551        Restoring previous deployment state...            \u2551");
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("");
  }

  /** Config info block */
  configBlock(rows: [string, string][]): void {
    if (!this.shouldLog("minimal")) return;
    console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("  \u2502           \uD83D\uDCCB Deployment Configuration                \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      const line = `  \u2502  ${key.padEnd(maxKey + 2)} ${value}`;
      console.log(line.padEnd(59) + "\u2502");
    }
    console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
    console.log("");
  }

  /** Changes summary box */
  diffSummary(added: number, modified: number, deleted: number, unchanged: number, addedSize: string, modifiedSize: string, deletedSize: string): void {
    if (!this.shouldLog("minimal")) return;
    console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("  \u2502          \uD83D\uDCCA  Changes Summary            \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`  \u2502  \u2795 New files     : ${String(added).padEnd(5)} (${addedSize})`.padEnd(45) + "\u2502");
    console.log(`  \u2502  \u270F\uFE0F  Modified     : ${String(modified).padEnd(5)} (${modifiedSize})`.padEnd(45) + "\u2502");
    console.log(`  \u2502  \uD83D\uDDD1\uFE0F  Deleted      : ${String(deleted).padEnd(5)} (${deletedSize})`.padEnd(45) + "\u2502");
    console.log(`  \u2502  \u2796 Unchanged    : ${String(unchanged).padEnd(5)}`.padEnd(45) + "\u2502");
    console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
    console.log("");
  }

  /** File transfer line */
  fileAdd(filePath: string, size: string): void {
    if (this.shouldLog("standard")) {
      console.log(`     \u2795 ${filePath} (${size})`);
    }
  }

  fileModify(filePath: string, size: string): void {
    if (this.shouldLog("standard")) {
      console.log(`     \u270F\uFE0F  ${filePath} (${size})`);
    }
  }

  fileDelete(filePath: string): void {
    if (this.shouldLog("standard")) {
      console.log(`     \uD83D\uDDD1\uFE0F  ${filePath}`);
    }
  }

  /** Command execution line */
  cmdRun(index: number, total: number, cmd: string): void {
    if (this.shouldLog("standard")) {
      console.log(`  \u25B6\uFE0F  [${index}/${total}] $ ${cmd}`);
    }
  }

  cmdSuccess(durationMs: number): void {
    if (this.shouldLog("standard")) {
      console.log(`     \u2705 Done (${durationMs}ms)`);
    }
  }

  cmdFail(exitCode: number): void {
    console.log(`     \u274C Failed (exit code: ${exitCode})`);
  }

  cmdOutput(label: string, output: string): void {
    if (this.shouldLog("verbose") && output) {
      console.log(`     \uD83D\uDCCB ${label}:`);
      for (const line of output.split("\n")) {
        console.log(`        ${line}`);
      }
    }
  }

  /** Final summary box */
  finalSummary(rows: [string, string][], status: "success" | "failure" | "rolled_back"): void {
    if (!this.shouldLog("minimal")) return;

    const icon = status === "success" ? "\uD83C\uDF89" : status === "rolled_back" ? "\u23EA" : "\uD83D\uDCA5";
    const title = status === "success"
      ? "DEPLOYMENT COMPLETED SUCCESSFULLY!"
      : status === "rolled_back"
        ? "DEPLOYMENT ROLLED BACK"
        : "DEPLOYMENT FAILED";

    console.log("");
    console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    console.log("\u2551                                                            \u2551");
    const titleLine = `\u2551      ${icon} ${title}`;
    console.log(titleLine.padEnd(61) + "\u2551");
    console.log("\u2551                                                            \u2551");
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");

    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      const line = `\u2551  ${key.padEnd(maxKey + 2)} ${value}`;
      console.log(line.padEnd(61) + "\u2551");
    }

    console.log("\u2551                                                            \u2551");
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("");
  }

  /** No changes banner */
  noChangesBanner(): void {
    if (!this.shouldLog("minimal")) return;
    console.log("");
    console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    console.log("\u2551                                                            \u2551");
    console.log("\u2551        \u2139\uFE0F  NO CHANGES DETECTED                             \u2551");
    console.log("\u2551        Server is already up to date.                      \u2551");
    console.log("\u2551                                                            \u2551");
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("");
  }

  /** Commands summary box */
  cmdSummary(total: number, passed: number, failed: number): void {
    if (!this.shouldLog("minimal")) return;
    console.log("");
    console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("  \u2502     \u2699\uFE0F  Commands Summary              \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`  \u2502  Total     : ${String(total).padEnd(23)}\u2502`);
    console.log(`  \u2502  \u2705 Passed  : ${String(passed).padEnd(23)}\u2502`);
    console.log(`  \u2502  \u274C Failed  : ${String(failed).padEnd(23)}\u2502`);
    console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
    console.log("");
  }

  /** Deprecated - kept for backward compat */
  banner(title: string): void {
    if (this.shouldLog("minimal")) {
      const line = "\u2500".repeat(60);
      console.log("");
      console.log(line);
      console.log(`  ${title}`);
      console.log(line);
    }
  }

  /** Deprecated - kept for backward compat */
  summary(rows: [string, string | number][]): void {
    if (!this.shouldLog("minimal")) return;
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      console.log(`  ${key.padEnd(maxKey + 2)} ${value}`);
    }
  }
}
