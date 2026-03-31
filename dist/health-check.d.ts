import type { HealthCheckResult } from "./types";
import type { Logger } from "./logger";
/** Run health check with retries */
export declare function runHealthCheck(url: string, expectedStatus: number, retries: number, retryDelay: number, timeout: number, logger: Logger): Promise<HealthCheckResult>;
