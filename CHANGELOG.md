# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-31

### Added

- **Pre-deploy commands** - Run commands on the server BEFORE file sync. Useful for enabling maintenance mode, creating backups, stopping services, etc.
- **Rollback on failure** - Automatically restore previous deployment state when health check fails. Saves a rollback point before deploying and reverts if something goes wrong.
- **Health check** - Verify your deployment is working by hitting a URL after sync. Configurable expected status code, retry count, retry delay. Optionally fail the entire deployment if health check doesn't pass.
- **Slack notifications** - Rich deployment notifications with file counts, bytes transferred, duration, commit hash, health check status, and a link to the workflow run.
- **Discord notifications** - Beautiful embed notifications with the same deployment details.
- **Custom webhook notifications** - Send a plain JSON payload to any URL for custom integrations.
- **Multi-environment support** - Label deployments with environment names (e.g., `production`, `staging`). Shown in notifications and stored in sync state.
- **New action outputs** - `rolled-back`, `health-check-passed`, `notification-sent`, `environment`.

### Changed

- Sync state version bumped to `2` (adds `environment` field).
- Internal stage numbering updated to accommodate new stages (11 stages total).

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

[1.1.0]: https://github.com/Tecbeckp/ssh-deploy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Tecbeckp/ssh-deploy/releases/tag/v1.0.0
