import { Client, SFTPWrapper } from "ssh2";
import type { Logger } from "./logger";
import type { CommandResult } from "./types";
import * as path from "path";

export class SSHClient {
  private client: Client;
  private sftp: SFTPWrapper | null = null;
  private logger: Logger;
  private config: {
    host: string;
    port: number;
    username: string;
    privateKey: string;
    passphrase?: string;
    timeout: number;
    compression: boolean;
    uploadConcurrency: number;
  };

  constructor(
    config: {
      host: string;
      port: number;
      username: string;
      privateKey: string;
      passphrase?: string;
      timeout: number;
      compression?: boolean;
      uploadConcurrency?: number;
    },
    logger: Logger
  ) {
    this.client = new Client();
    this.config = {
      ...config,
      compression: config.compression ?? false,
      uploadConcurrency: config.uploadConcurrency ?? 5,
    };
    this.logger = logger;
  }

  /** Establish SSH connection */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`SSH connection timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      this.client.on("ready", () => {
        clearTimeout(timer);
        this.logger.standard("  SSH connection established");
        resolve();
      });

      this.client.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      const connectConfig: any = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        privateKey: this.config.privateKey,
        passphrase: this.config.passphrase,
        readyTimeout: this.config.timeout,
      };

      // Add compression algorithms if enabled
      if (this.config.compression) {
        connectConfig.algorithms = {
          compress: ["zlib@openssh.com", "zlib"],
        };
      }

      this.client.connect(connectConfig);
    });
  }

  /** Initialize SFTP subsystem */
  async initSftp(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          reject(new Error(`SFTP initialization failed: ${err.message}`));
          return;
        }
        this.sftp = sftp;
        this.logger.verbose("  SFTP subsystem initialized");
        resolve();
      });
    });
  }

  private getSftp(): SFTPWrapper {
    if (!this.sftp) {
      throw new Error("SFTP not initialized. Call initSftp() first.");
    }
    return this.sftp;
  }

  /** Check if a remote path exists */
  async exists(remotePath: string): Promise<boolean> {
    const sftp = this.getSftp();
    return new Promise((resolve) => {
      sftp.stat(remotePath, (err) => {
        resolve(!err);
      });
    });
  }

  /** Read a remote file as string */
  async readFile(remotePath: string): Promise<string | null> {
    const sftp = this.getSftp();
    return new Promise((resolve) => {
      sftp.readFile(remotePath, "utf8", (err, data) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(typeof data === "string" ? data : data.toString("utf8"));
      });
    });
  }

  /** Write string content to a remote file */
  async writeFile(remotePath: string, content: string): Promise<void> {
    const sftp = this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.writeFile(remotePath, content, (err) => {
        if (err) {
          reject(new Error(`Failed to write ${remotePath}: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /** Upload a local file to remote path */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const sftp = this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, { concurrency: 32 }, (err) => {
        if (err) {
          reject(new Error(`Failed to upload ${localPath} -> ${remotePath}: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /** Upload multiple files in parallel */
  async uploadFilesParallel(
    files: Array<{ localPath: string; remotePath: string }>,
    concurrency: number = 5
  ): Promise<void> {
    const results: Promise<void>[] = [];

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map((file) => this.uploadFile(file.localPath, file.remotePath));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === "rejected") {
          throw result.reason;
        }
      }
    }
  }

  /** Delete a remote file */
  async deleteFile(remotePath: string): Promise<void> {
    const sftp = this.getSftp();
    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) {
          reject(new Error(`Failed to delete ${remotePath}: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /** Create remote directory recursively */
  async mkdirRecursive(remotePath: string): Promise<void> {
    const sftp = this.getSftp();
    const parts = remotePath.replace(/\\/g, "/").split("/").filter(Boolean);
    let current = remotePath.startsWith("/") ? "/" : "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const dirExists = await this.exists(current);
      if (!dirExists) {
        await new Promise<void>((resolve, reject) => {
          sftp.mkdir(current, (err) => {
            if (err && (err as any).code !== 4) {
              reject(new Error(`Failed to create directory ${current}: ${err.message}`));
              return;
            }
            resolve();
          });
        });
      }
    }
  }

  /** List all files in a remote directory recursively */
  async listFilesRecursive(remotePath: string, basePath: string = ""): Promise<string[]> {
    const sftp = this.getSftp();
    const files: string[] = [];

    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(new Error(`Failed to list ${remotePath}: ${err.message}`));
          return;
        }
        resolve(list || []);
      });
    });

    for (const entry of entries) {
      const fullPath = `${remotePath}/${entry.filename}`;
      const relativePath = basePath ? `${basePath}/${entry.filename}` : entry.filename;

      if (entry.attrs.isDirectory()) {
        const subFiles = await this.listFilesRecursive(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  /** Remove a directory recursively */
  async rmdirRecursive(remotePath: string): Promise<void> {
    const sftp = this.getSftp();

    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          resolve([]);
          return;
        }
        resolve(list || []);
      });
    });

    for (const entry of entries) {
      const fullPath = `${remotePath}/${entry.filename}`;
      if (entry.attrs.isDirectory()) {
        await this.rmdirRecursive(fullPath);
      } else {
        await this.deleteFile(fullPath);
      }
    }

    await new Promise<void>((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) {
          reject(new Error(`Failed to remove directory ${remotePath}: ${err.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /** Remove empty parent directories up to the base path */
  async removeEmptyDirs(filePath: string, basePath: string): Promise<void> {
    const sftp = this.getSftp();
    let dir = path.posix.dirname(filePath);

    while (dir !== basePath && dir !== "." && dir !== "/") {
      const entries = await new Promise<any[]>((resolve) => {
        sftp.readdir(dir, (err, list) => {
          resolve(err ? [{ placeholder: true }] : list || []);
        });
      });

      if (entries.length === 0) {
        await new Promise<void>((resolve) => {
          sftp.rmdir(dir, () => resolve());
        });
        this.logger.verbose(`    Removed empty directory: ${dir}`);
        dir = path.posix.dirname(dir);
      } else {
        break;
      }
    }
  }

  /** Execute a command on the remote server */
  async exec(command: string, cwd?: string): Promise<CommandResult> {
    const startTime = Date.now();
    const fullCommand = cwd ? `cd ${cwd} && ${command}` : command;

    return new Promise((resolve, reject) => {
      this.client.exec(fullCommand, (err, stream) => {
        if (err) {
          reject(new Error(`Failed to execute command: ${err.message}`));
          return;
        }

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          resolve({
            command,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code ?? 0,
            durationMs: Date.now() - startTime,
          });
        });
      });
    });
  }

  /** Close the SSH connection */
  disconnect(): void {
    this.client.end();
    this.logger.verbose("  SSH connection closed");
  }
}
