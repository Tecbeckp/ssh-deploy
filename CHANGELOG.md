# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-30

### Added

- **SSH/SFTP deployment** - Deploy files to any server over SSH using SFTP protocol.
- **Smart sync** - Only uploads new and modified files, deletes removed files. Tracks state via a JSON file stored on the server.
- **File hashing** - MD5-based change detection ensures only truly modified files are transferred.
- **Post-deploy commands** - Execute arbitrary commands on the server after file sync (e.g., `composer install`, `pm2 restart`, `php artisan migrate`).
- **Exclude patterns** - Glob-based file exclusion. `.git` and `node_modules` are always excluded by default.
- **Dry-run mode** - Preview what would change without touching the server.
- **Dangerous clean slate** - Option to wipe all remote files before deploying (use with caution).
- **Configurable logging** - Three log levels: `minimal`, `standard`, `verbose`.
- **Action outputs** - Exposes `files-uploaded`, `files-replaced`, `files-deleted`, `files-unchanged`, `bytes-transferred`, `duration-ms`, and `total-changes` for use in subsequent workflow steps.
- **Passphrase support** - Encrypted SSH private keys are supported.
- **Configurable timeout** - Set connection and operation timeout in milliseconds.
- **Sample workflows** - Included sample YAML files for basic, advanced (Node.js build), and Laravel deployments.

[1.0.0]: https://github.com/Tecbeckp/ssh-deploy/releases/tag/v1.0.0
