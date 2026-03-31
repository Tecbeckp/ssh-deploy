# SSH Deploy

**Deploy files to a server via SSH/SFTP. Smart sync — only changed files are transferred.**

Unlike FTP-based solutions, SSH Deploy uses a secure SSH/SFTP connection and tracks deployment state to perform incremental syncs. It hashes every local file, compares against the last deployed state, and only uploads new/modified files while deleting removed ones.

---

## Quick Start

Add this to `.github/workflows/deploy.yml`:

```yml
on: push
name: Deploy website on push
jobs:
  web-deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: SSH Deploy
        uses: Tecbeckp/ssh-deploy@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          private-key: ${{ secrets.SSH_PRIVATE_KEY }}
          server-dir: /var/www/html/
```

---

## Settings

### Connection

| Input | Required | Default | Description |
|---|---|---|---|
| `host` | **Yes** | — | SSH server hostname or IP |
| `username` | **Yes** | — | SSH username |
| `private-key` | **Yes** | — | Full SSH private key content (use `${{ secrets.SSH_PRIVATE_KEY }}`) |
| `port` | No | `22` | SSH port |
| `passphrase` | No | `""` | Passphrase for encrypted SSH keys |
| `timeout` | No | `30000` | Connection timeout in milliseconds |

### Deployment

| Input | Required | Default | Description |
|---|---|---|---|
| `local-dir` | No | `./` | Local folder to deploy (must end with `/`) |
| `server-dir` | No | `./` | Remote folder to deploy to (must end with `/`) |
| `state-name` | No | `.ssh-deploy-sync-state.json` | Filename for tracking deployed state on the server |
| `dry-run` | No | `false` | Preview changes without deploying |
| `dangerous-clean-slate` | No | `false` | Delete ALL files on server before deploying |
| `exclude` | No | `.git*`, `node_modules` | Glob patterns to exclude (one per line or comma-separated) |
| `log-level` | No | `standard` | Logging verbosity: `minimal`, `standard`, or `verbose` |
| `environment` | No | `production` | Environment name (shown in notifications & state tracking) |

### Commands

| Input | Required | Default | Description |
|---|---|---|---|
| `pre-commands` | No | `""` | Commands to run on server **BEFORE** file sync (one per line) |
| `commands` | No | `""` | Commands to run on server **AFTER** file sync (one per line) |
| `commands-working-dir` | No | Same as `server-dir` | Working directory for remote commands |

### Rollback

| Input | Required | Default | Description |
|---|---|---|---|
| `rollback-on-failure` | No | `false` | Auto-rollback if health check fails |
| `rollback-limit` | No | `3` | Max rollback states to keep on server |

### Health Check

| Input | Required | Default | Description |
|---|---|---|---|
| `health-check-url` | No | `""` | URL to check after deployment (e.g., `https://example.com/health`) |
| `health-check-status` | No | `200` | Expected HTTP status code |
| `health-check-retries` | No | `3` | Number of retry attempts |
| `health-check-retry-delay` | No | `5000` | Delay between retries in milliseconds |
| `health-check-fail-deploy` | No | `false` | Fail the entire deployment if health check fails |

### Notifications

| Input | Required | Default | Description |
|---|---|---|---|
| `webhook-url` | No | `""` | Webhook URL for notifications (Slack/Discord/custom) |
| `webhook-type` | No | `slack` | Webhook provider: `slack`, `discord`, or `custom` |

---

## Outputs

Use these in subsequent workflow steps via `${{ steps.<step-id>.outputs.<output> }}`:

| Output | Description |
|---|---|
| `files-uploaded` | Number of new files uploaded |
| `files-replaced` | Number of modified files replaced |
| `files-deleted` | Number of removed files deleted from server |
| `files-unchanged` | Number of unchanged files |
| `bytes-transferred` | Total bytes transferred |
| `duration-ms` | Total deployment duration in milliseconds |
| `total-changes` | Total files changed (uploaded + replaced + deleted) |
| `rolled-back` | Whether the deployment was rolled back (`true`/`false`) |
| `health-check-passed` | Whether the health check passed (`true`/`false`/`N/A`) |
| `notification-sent` | Whether notification was sent (`true`/`false`) |
| `environment` | Environment that was deployed to |

---

## How It Works

1. **Connect** — Establishes SSH connection and initializes SFTP.
2. **Prepare** — Ensures remote directory exists.
3. **Pre-deploy commands** — Runs commands before file sync (e.g., enable maintenance mode, create backup).
4. **Read remote state** — Downloads sync state JSON from server. If missing, treats as first deploy.
5. **Scan & diff** — Hashes local files with MD5, compares against remote state.
6. **Rollback point** — Saves current state as rollback point (if rollback enabled).
7. **Sync files** — Creates directories, uploads new/changed files, deletes removed files via SFTP.
8. **Post-deploy commands** — Runs commands after sync (e.g., `composer install`, `pm2 restart`).
9. **Health check** — Hits a URL to verify the deployment is working. Retries on failure.
10. **Save state** — Writes updated state file for the next deployment. If health check failed and rollback is enabled, restores previous state instead.
11. **Notify** — Sends deployment status to Slack, Discord, or a custom webhook.

---

## Examples

### Basic deployment

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/
```

### Pre-deploy commands (maintenance mode, backup)

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/my-app/
    pre-commands: |
      php artisan down --secret="deploy-bypass"
      tar -czf /backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/www/html/my-app/
    commands: |
      composer install --no-dev
      php artisan migrate --force
      php artisan up
```

### Health check with auto-rollback

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/my-app/
    rollback-on-failure: true
    health-check-url: https://example.com/health
    health-check-status: 200
    health-check-retries: 5
    health-check-retry-delay: 3000
    health-check-fail-deploy: true
```

If the health check fails after all retries, the action will:
1. Restore the previous file state on the server
2. Mark the deployment as rolled back
3. Fail the GitHub Actions step

### Slack notifications

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: slack
    environment: production
```

Sends a rich Slack message with: status, file counts, bytes transferred, duration, health check result, commit hash, and a link to the workflow run.

### Discord notifications

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/
    webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
    webhook-type: discord
    environment: staging
```

### Multi-environment (staging + production)

```yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Deploy to staging
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/staging'
        uses: Tecbeckp/ssh-deploy@v1
        with:
          host: ${{ secrets.STAGING_SSH_HOST }}
          username: ${{ secrets.STAGING_SSH_USERNAME }}
          private-key: ${{ secrets.STAGING_SSH_KEY }}
          server-dir: /var/www/staging/
          environment: staging
          health-check-url: https://staging.example.com/health
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}

      # Deploy to production
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        uses: Tecbeckp/ssh-deploy@v1
        with:
          host: ${{ secrets.PROD_SSH_HOST }}
          username: ${{ secrets.PROD_SSH_USERNAME }}
          private-key: ${{ secrets.PROD_SSH_KEY }}
          server-dir: /var/www/production/
          environment: production
          rollback-on-failure: true
          health-check-url: https://example.com/health
          health-check-fail-deploy: true
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Build then deploy (React / Next.js / Vue)

```yml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm ci
- run: npm run build

- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    local-dir: build/
    server-dir: /var/www/html/my-app/
    environment: production
```

### Dry run (preview changes)

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/
    dry-run: true
    log-level: verbose
```

### Exclude files

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/
    exclude: |
      **/.git*
      **/node_modules/**
      **/.env
      **/storage/logs/**
      **/*.map
```

### Use outputs in subsequent steps

```yml
- uses: Tecbeckp/ssh-deploy@v1
  id: deploy
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/

- run: |
    echo "Deployed ${{ steps.deploy.outputs.total-changes }} files"
    echo "Duration: ${{ steps.deploy.outputs.duration-ms }}ms"
    echo "Rolled back: ${{ steps.deploy.outputs.rolled-back }}"
    echo "Health check: ${{ steps.deploy.outputs.health-check-passed }}"
```

### Full production setup (all features)

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/my-app/
    environment: production
    log-level: verbose
    exclude: |
      **/.git*
      **/node_modules/**
      **/.env
    pre-commands: |
      php artisan down
      cp -r /var/www/html/my-app /backups/pre-deploy-$(date +%s)
    commands: |
      composer install --no-dev --optimize-autoloader
      php artisan migrate --force
      php artisan config:cache
      php artisan route:cache
      php artisan up
    rollback-on-failure: true
    health-check-url: https://example.com/health
    health-check-retries: 5
    health-check-retry-delay: 3000
    health-check-fail-deploy: true
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: slack
```

---

## Setting up SSH Keys

Generate an SSH key pair:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
```

This creates two files:
- `deploy_key` — Private key (add to GitHub Secrets as `SSH_PRIVATE_KEY`)
- `deploy_key.pub` — Public key (add to server's `~/.ssh/authorized_keys`)

**On the server:**

```bash
cat deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**On GitHub:**

Go to your repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**

| Secret | Value |
|---|---|
| `SSH_HOST` | Your server IP or hostname |
| `SSH_USERNAME` | SSH username (e.g., `root`, `deploy`, `ubuntu`) |
| `SSH_PRIVATE_KEY` | Entire content of `deploy_key` file |

---

## Setting up Notifications

### Slack

1. Go to [Slack API](https://api.slack.com/apps) > Create New App > From scratch
2. Enable **Incoming Webhooks** > Add New Webhook to Workspace
3. Copy the webhook URL
4. Add as GitHub Secret: `SLACK_WEBHOOK_URL`

### Discord

1. Go to your Discord server > Channel Settings > Integrations > Webhooks
2. Create a new webhook > Copy webhook URL
3. Add `/slack` to the end of the URL (Discord Slack-compatible endpoint) **OR** use `webhook-type: discord`
4. Add as GitHub Secret: `DISCORD_WEBHOOK_URL`

### Custom

Use `webhook-type: custom` to send a plain JSON POST to any URL. The payload includes all deployment details (see [types.ts](src/types.ts) for the full schema).

---

## Deployment Pipeline

```
┌─────────────────────────────────────────────────────┐
│                  SSH Deploy Pipeline                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Connect to server via SSH                       │
│  2. Prepare remote directory                        │
│  3. Run pre-deploy commands ◄── maintenance mode    │
│  4. Read remote sync state                          │
│  5. Scan local files & compute diff                 │
│  6. Save rollback point                             │
│  7. Sync files (upload/replace/delete)              │
│  8. Run post-deploy commands ◄── migrations, cache  │
│  9. Health check ◄── verify site is working         │
│     └── FAIL? ──► Auto rollback (if enabled)        │
│ 10. Save sync state                                 │
│ 11. Send notification ◄── Slack/Discord/Custom      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## FAQ

<details>
<summary><b>How does it track what's been deployed?</b></summary>

A JSON file (`.ssh-deploy-sync-state.json`) is stored on the server in your `server-dir`. It contains MD5 hashes of every deployed file. On the next run, local files are hashed and compared against this state to determine what changed.

Delete this file on the server to force a full re-deploy.
</details>

<details>
<summary><b>How does rollback work?</b></summary>

When `rollback-on-failure` is enabled, the action saves the current sync state before deploying. If the health check fails (with `health-check-fail-deploy: true`), it removes newly added files and restores the previous sync state. This means the next deployment will re-upload those files.

Note: Rollback removes new files but does not restore deleted or overwritten files. For full rollback capability, use `pre-commands` to create a backup before deploying.
</details>

<details>
<summary><b>Is it safe to use with multiple branches?</b></summary>

Each `server-dir` has its own state file, so deploying different branches to different directories works perfectly. Use the `environment` input to label each deployment.
</details>

<details>
<summary><b>What if my SSH key has a passphrase?</b></summary>

Use the `passphrase` input:

```yml
passphrase: ${{ secrets.SSH_PASSPHRASE }}
```
</details>

<details>
<summary><b>What happens if a command fails?</b></summary>

Failed commands are logged as warnings but do not fail the deployment. The exit code is captured in the action output. If you need the workflow to fail on command errors, check the output in a subsequent step.
</details>

<details>
<summary><b>How do I force a full re-deploy?</b></summary>

Either:
1. Delete `.ssh-deploy-sync-state.json` from the server
2. Use `dangerous-clean-slate: true` (this deletes ALL files first)
</details>

<details>
<summary><b>Can I use this with GitHub Environments?</b></summary>

Yes! Use GitHub's built-in Environments feature for approval gates:

```yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # ← requires manual approval if configured
    steps:
      - uses: Tecbeckp/ssh-deploy@v1
        with:
          environment: production
          # ...
```

Configure approval rules in: repo Settings > Environments > production > Required reviewers.
</details>

---

## Comparison with FTP Deploy

| Feature | FTP Deploy | SSH Deploy |
|---|---|---|
| Protocol | FTP / FTPS | SSH / SFTP |
| Encryption | Optional (FTPS) | Always encrypted |
| Pre-deploy commands | No | Yes |
| Post-deploy commands | No | Yes |
| Rollback | No | Yes (auto on health check failure) |
| Health check | No | Yes (with retries) |
| Notifications | No | Yes (Slack/Discord/Custom) |
| Multi-environment | No | Yes |
| Key-based auth | No | Yes |
| Smart sync | Yes | Yes |
| Dry run | Yes | Yes |
| File exclusion | Yes | Yes |
| Action outputs | No | Yes (11 outputs) |

---

## Contributing

1. Clone the repo
2. `npm install`
3. Make changes in `src/`
4. `npm run build` to compile with `ncc`
5. Commit the `dist/` folder with your changes

Test locally with [act](https://github.com/nektos/act).

---

## License

MIT - see [LICENSE](LICENSE)
