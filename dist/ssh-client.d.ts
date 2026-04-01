import type { Logger } from "./logger";
import type { CommandResult } from "./types";
export declare class SSHClient {
    private client;
    private sftp;
    private logger;
    private config;
    constructor(config: {
        host: string;
        port: number;
        username: string;
        privateKey: string;
        passphrase?: string;
        timeout: number;
        compression?: boolean;
        uploadConcurrency?: number;
    }, logger: Logger);
    /** Establish SSH connection */
    connect(): Promise<void>;
    /** Initialize SFTP subsystem */
    initSftp(): Promise<void>;
    private getSftp;
    /** Check if a remote path exists */
    exists(remotePath: string): Promise<boolean>;
    /** Read a remote file as string */
    readFile(remotePath: string): Promise<string | null>;
    /** Write string content to a remote file */
    writeFile(remotePath: string, content: string): Promise<void>;
    /** Upload a local file to remote path */
    uploadFile(localPath: string, remotePath: string): Promise<void>;
    /** Upload multiple files in parallel */
    uploadFilesParallel(files: Array<{
        localPath: string;
        remotePath: string;
    }>, concurrency?: number): Promise<void>;
    /** Delete a remote file */
    deleteFile(remotePath: string): Promise<void>;
    /** Create remote directory recursively */
    mkdirRecursive(remotePath: string): Promise<void>;
    /** List all files in a remote directory recursively */
    listFilesRecursive(remotePath: string, basePath?: string): Promise<string[]>;
    /** Remove a directory recursively */
    rmdirRecursive(remotePath: string): Promise<void>;
    /** Remove empty parent directories up to the base path */
    removeEmptyDirs(filePath: string, basePath: string): Promise<void>;
    /** Execute a command on the remote server */
    exec(command: string, cwd?: string): Promise<CommandResult>;
    /** Close the SSH connection */
    disconnect(): void;
}
