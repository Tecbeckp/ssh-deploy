import * as https from "https";
import * as http from "http";
import type { HealthCheckResult } from "./types";
import type { Logger } from "./logger";

/** Perform a single HTTP(S) GET request and return status code */
function httpGet(url: string, timeout: number): Promise<{ statusCode: number; responseTimeMs: number }> {
  const startTime = Date.now();
  const client = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout }, (res) => {
      res.resume();
      resolve({
        statusCode: res.statusCode ?? 0,
        responseTimeMs: Date.now() - startTime,
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Health check timed out after ${timeout}ms`));
    });
  });
}

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run health check with retries */
export async function runHealthCheck(
  url: string,
  expectedStatus: number,
  retries: number,
  retryDelay: number,
  timeout: number,
  logger: Logger
): Promise<HealthCheckResult> {
  let lastError: string | undefined;
  let lastStatusCode = 0;
  let lastResponseTime = 0;

  for (let attempt = 1; attempt <= retries; attempt++) {
    logger.minimal(`  \uD83D\uDC93 Attempt ${attempt}/${retries}...`);

    try {
      const result = await httpGet(url, timeout);
      lastStatusCode = result.statusCode;
      lastResponseTime = result.responseTimeMs;

      if (result.statusCode === expectedStatus) {
        logger.success(`Status: ${result.statusCode} \u2014 Response time: ${result.responseTimeMs}ms`);
        return {
          passed: true,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          attempts: attempt,
        };
      }

      lastError = `Expected status ${expectedStatus}, got ${result.statusCode}`;
      logger.warn(`${lastError} (${result.responseTimeMs}ms)`);
    } catch (err: any) {
      lastError = err.message;
      logger.warn(`Request failed: ${lastError}`);
    }

    if (attempt < retries) {
      logger.info(`Retrying in ${retryDelay / 1000}s...`);
      await sleep(retryDelay);
    }
  }

  return {
    passed: false,
    statusCode: lastStatusCode,
    responseTimeMs: lastResponseTime,
    attempts: retries,
    error: lastError,
  };
}
