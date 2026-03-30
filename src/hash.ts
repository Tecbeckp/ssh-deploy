import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import type { FileRecord, SyncState, DiffResult } from "./types";
import type { Logger } from "./logger";

/** Compute MD5 hash of a file */
function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

/** Scan a local directory and build file records */
export async function getLocalFiles(
  localDir: string,
  exclude: string[],
  logger: Logger
): Promise<Record<string, FileRecord>> {
  const absoluteDir = path.resolve(localDir);
  logger.verbose(`  Scanning local directory: ${absoluteDir}`);

  const defaultExcludes = ["**/.git/**", "**/.git*", "**/node_modules/**"];
  const allExcludes = [...new Set([...defaultExcludes, ...exclude])];

  const files = await glob("**/*", {
    cwd: absoluteDir,
    nodir: true,
    dot: true,
    ignore: allExcludes,
  });

  const records: Record<string, FileRecord> = {};
  for (const file of files) {
    const fullPath = path.join(absoluteDir, file);
    const stat = fs.statSync(fullPath);
    const normalizedPath = file.replace(/\\/g, "/");

    records[normalizedPath] = {
      path: normalizedPath,
      hash: hashFile(fullPath),
      size: stat.size,
    };
  }

  logger.standard(`  Found ${Object.keys(records).length} local files`);
  return records;
}

/** Compare local files against remote state to produce a diff */
export function computeDiff(
  localFiles: Record<string, FileRecord>,
  remoteState: SyncState | null,
  logger: Logger
): DiffResult {
  const remoteFiles = remoteState?.files ?? {};

  const upload: FileRecord[] = [];
  const replace: FileRecord[] = [];
  const same: FileRecord[] = [];
  const toDelete: FileRecord[] = [];

  // Check local files against remote state
  for (const [filePath, localRecord] of Object.entries(localFiles)) {
    const remoteRecord = remoteFiles[filePath];
    if (!remoteRecord) {
      upload.push(localRecord);
    } else if (remoteRecord.hash !== localRecord.hash) {
      replace.push(localRecord);
    } else {
      same.push(localRecord);
    }
  }

  // Check for deleted files (exist in remote state but not locally)
  for (const [filePath, remoteRecord] of Object.entries(remoteFiles)) {
    if (!localFiles[filePath]) {
      toDelete.push(remoteRecord);
    }
  }

  const result: DiffResult = {
    upload,
    replace,
    delete: toDelete,
    same,
    uploadSize: upload.reduce((sum, f) => sum + f.size, 0),
    replaceSize: replace.reduce((sum, f) => sum + f.size, 0),
    deleteSize: toDelete.reduce((sum, f) => sum + f.size, 0),
  };

  logger.standard(`  Diff computed:`);
  logger.standard(`    New files:       ${upload.length}`);
  logger.standard(`    Modified files:  ${replace.length}`);
  logger.standard(`    Deleted files:   ${toDelete.length}`);
  logger.standard(`    Unchanged files: ${same.length}`);

  return result;
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
