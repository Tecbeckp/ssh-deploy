import * as https from "https";
import * as http from "http";
import type { DeployResult } from "./types";
import type { Logger } from "./logger";

/** Send HTTP POST request with JSON body */
function httpPost(url: string, body: string): Promise<number> {
  const client = url.startsWith("https") ? https : http;
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Notification request timed out"));
    });

    req.write(body);
    req.end();
  });
}

/** Format bytes to human-readable */
function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/** Build Slack message payload */
function buildSlackPayload(result: DeployResult, status: "success" | "failure" | "rolled_back"): string {
  const emoji = status === "success" ? ":white_check_mark:" : status === "rolled_back" ? ":rewind:" : ":x:";
  const color = status === "success" ? "#36a64f" : status === "rolled_back" ? "#ff9900" : "#dc3545";
  const title = status === "success"
    ? "Deployment Successful"
    : status === "rolled_back"
      ? "Deployment Rolled Back"
      : "Deployment Failed";

  const commitHash = process.env.GITHUB_SHA?.substring(0, 8) || "unknown";
  const repo = process.env.GITHUB_REPOSITORY || "unknown";
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";

  return JSON.stringify({
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${title}*\n*Env:* \`${result.environment}\` | *Repo:* \`${repo}\` | *Commit:* \`${commitHash}\``,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*New Files:*\n${result.filesUploaded}` },
              { type: "mrkdwn", text: `*Modified:*\n${result.filesReplaced}` },
              { type: "mrkdwn", text: `*Deleted:*\n${result.filesDeleted}` },
              { type: "mrkdwn", text: `*Transferred:*\n${fmtBytes(result.bytesTransferred)}` },
              { type: "mrkdwn", text: `*Duration:*\n${(result.durationMs / 1000).toFixed(1)}s` },
              { type: "mrkdwn", text: `*Health Check:*\n${result.healthCheck ? (result.healthCheck.passed ? "Passed" : "Failed") : "N/A"}` },
            ],
          },
          ...(runUrl
            ? [
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "View Run" },
                      url: runUrl,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    ],
  });
}

/** Build Discord message payload */
function buildDiscordPayload(result: DeployResult, status: "success" | "failure" | "rolled_back"): string {
  const emoji = status === "success" ? "✅" : status === "rolled_back" ? "⏪" : "❌";
  const color = status === "success" ? 0x36a64f : status === "rolled_back" ? 0xff9900 : 0xdc3545;
  const title = status === "success"
    ? "Deployment Successful"
    : status === "rolled_back"
      ? "Deployment Rolled Back"
      : "Deployment Failed";

  const commitHash = process.env.GITHUB_SHA?.substring(0, 8) || "unknown";
  const repo = process.env.GITHUB_REPOSITORY || "unknown";
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;

  return JSON.stringify({
    embeds: [
      {
        title: `${emoji} ${title}`,
        color,
        description: `**Env:** \`${result.environment}\` | **Repo:** \`${repo}\` | **Commit:** \`${commitHash}\``,
        fields: [
          { name: "New Files", value: String(result.filesUploaded), inline: true },
          { name: "Modified", value: String(result.filesReplaced), inline: true },
          { name: "Deleted", value: String(result.filesDeleted), inline: true },
          { name: "Transferred", value: fmtBytes(result.bytesTransferred), inline: true },
          { name: "Duration", value: `${(result.durationMs / 1000).toFixed(1)}s`, inline: true },
          { name: "Health Check", value: result.healthCheck ? (result.healthCheck.passed ? "Passed ✅" : "Failed ❌") : "N/A", inline: true },
        ],
        ...(runUrl ? { url: runUrl } : {}),
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Build a simple JSON payload for custom webhooks */
function buildCustomPayload(result: DeployResult, status: "success" | "failure" | "rolled_back"): string {
  return JSON.stringify({
    status,
    environment: result.environment,
    repository: process.env.GITHUB_REPOSITORY || "unknown",
    commit: process.env.GITHUB_SHA || "unknown",
    ref: process.env.GITHUB_REF || "unknown",
    filesUploaded: result.filesUploaded,
    filesReplaced: result.filesReplaced,
    filesDeleted: result.filesDeleted,
    filesUnchanged: result.filesUnchanged,
    bytesTransferred: result.bytesTransferred,
    durationMs: result.durationMs,
    rolledBack: result.rolledBack,
    healthCheck: result.healthCheck ?? null,
    timestamp: new Date().toISOString(),
  });
}

/** Send deployment notification */
export async function sendNotification(
  webhookUrl: string,
  webhookType: "slack" | "discord" | "custom",
  result: DeployResult,
  status: "success" | "failure" | "rolled_back",
  logger: Logger
): Promise<boolean> {
  logger.standard(`  Sending ${webhookType} notification...`);

  let payload: string;
  switch (webhookType) {
    case "slack":
      payload = buildSlackPayload(result, status);
      break;
    case "discord":
      payload = buildDiscordPayload(result, status);
      break;
    case "custom":
      payload = buildCustomPayload(result, status);
      break;
  }

  try {
    const statusCode = await httpPost(webhookUrl, payload);
    if (statusCode >= 200 && statusCode < 300) {
      logger.standard(`  Notification sent successfully (HTTP ${statusCode})`);
      return true;
    }
    logger.warn(`  Notification returned HTTP ${statusCode}`);
    return false;
  } catch (err: any) {
    logger.warn(`  Failed to send notification: ${err.message}`);
    return false;
  }
}
