import type { DeployResult } from "./types";
import type { Logger } from "./logger";
/** Send deployment notification */
export declare function sendNotification(webhookUrl: string, webhookType: "slack" | "discord" | "custom", result: DeployResult, status: "success" | "failure" | "rolled_back", logger: Logger): Promise<boolean>;
