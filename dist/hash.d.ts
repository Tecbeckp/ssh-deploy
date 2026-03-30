import type { FileRecord, SyncState, DiffResult } from "./types";
import type { Logger } from "./logger";
/** Scan a local directory and build file records */
export declare function getLocalFiles(localDir: string, exclude: string[], logger: Logger): Promise<Record<string, FileRecord>>;
/** Compare local files against remote state to produce a diff */
export declare function computeDiff(localFiles: Record<string, FileRecord>, remoteState: SyncState | null, logger: Logger): DiffResult;
/** Format bytes to human-readable string */
export declare function formatBytes(bytes: number): string;
