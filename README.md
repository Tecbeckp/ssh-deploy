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

| Input | Required | Default | Description |
|---|---|---|---|
| `host` | **Yes** | — | SSH server hostname or IP |
| `username` | **Yes** | — | SSH username |
| `private-key` | **Yes** | — | Full SSH private key content (use `${{ secrets.SSH_PRIVATE_KEY }}`) |
| `port` | No | `22` | SSH port |
| `passphrase` | No | `""` | Passphrase for encrypted SSH keys |
| `local-dir` | No | `./` | Local folder to deploy (must end with `/`) |
| `server-dir` | No | `./` | Remote folder to deploy to (must end with `/`) |
| `state-name` | No | `.ssh-deploy-sync-state.json` | Filename for tracking deployed state on the server |
| `dry-run` | No | `false` | Preview changes without deploying |
| `dangerous-clean-slate` | No | `false` | Delete ALL files on server before deploying |
| `exclude` | No | `.git*`, `node_modules` | Glob patterns to exclude (one per line or comma-separated) |
| `log-level` | No | `standard` | Logging verbosity: `minimal`, `standard`, or `verbose` |
| `timeout` | No | `30000` | Connection timeout in milliseconds |
| `commands` | No | `""` | Commands to run on the server after deployment (one per line) |
| `commands-working-dir` | No | Same as `server-dir` | Working directory for post-deploy commands |

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

---

## How It Works

1. **Connect** — Establishes an SSH connection and initializes SFTP.
2. **Read remote state** — Downloads `.ssh-deploy-sync-state.json` from the server. If missing, treats it as first deploy.
3. **Scan local files** — Walks the local directory, hashing every file with MD5.
4. **Diff** — Compares local hashes against remote state. Produces lists of files to upload (new), replace (modified), delete (removed), and skip (unchanged).
5. **Sync** — Creates directories, uploads new/changed files, deletes removed files via SFTP.
6. **Run commands** — Executes post-deploy commands over SSH (e.g., `composer install`, `pm2 restart`).
7. **Save state** — Writes updated state file to the server for the next deployment's diffing.

---

## Examples

### Basic deployment on push

```yml
on: push
name: Deploy
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Tecbeckp/ssh-deploy@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          private-key: ${{ secrets.SSH_PRIVATE_KEY }}
          server-dir: /var/www/html/
```

### Build then deploy (React / Next.js / Vue)

```yml
on: push
name: Build & Deploy
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
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
```

### Deploy with post-deploy commands

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    server-dir: /var/www/html/my-app/
    commands: |
      composer install --no-dev --optimize-autoloader
      php artisan migrate --force
      php artisan config:cache
      php artisan queue:restart
      sudo systemctl reload php8.3-fpm
```

### Custom port & encrypted key

```yml
- uses: Tecbeckp/ssh-deploy@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    port: 2222
    username: ${{ secrets.SSH_USERNAME }}
    private-key: ${{ secrets.SSH_PRIVATE_KEY }}
    passphrase: ${{ secrets.SSH_PASSPHRASE }}
    server-dir: /home/deploy/app/
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

- run: echo "Deployed ${{ steps.deploy.outputs.total-changes }} files in ${{ steps.deploy.outputs.duration-ms }}ms"
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

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret | Value |
|---|---|
| `SSH_HOST` | Your server IP or hostname |
| `SSH_USERNAME` | SSH username (e.g., `root`, `deploy`, `ubuntu`) |
| `SSH_PRIVATE_KEY` | Entire content of `deploy_key` file |

---

## FAQ

<details>
<summary><b>How does it track what's been deployed?</b></summary>

A JSON file (`.ssh-deploy-sync-state.json`) is stored on the server in your `server-dir`. It contains MD5 hashes of every deployed file. On the next run, local files are hashed and compared against this state to determine what changed.

Delete this file on the server to force a full re-deploy.
</details>

<details>
<summary><b>Is it safe to use with multiple branches?</b></summary>

Each `server-dir` has its own state file, so deploying different branches to different directories works perfectly. If you deploy multiple branches to the same directory, they will overwrite each other — use separate `server-dir` paths for each environment.
</details>

<details>
<summary><b>What if my SSH key has a passphrase?</b></summary>

Use the `passphrase` input:

```yml
passphrase: ${{ secrets.SSH_PASSPHRASE }}
```
</details>

<details>
<summary><b>Can I run this locally for testing?</b></summary>

You can test with [act](https://github.com/nektos/act), which runs GitHub Actions locally:

```bash
act -s SSH_HOST=myserver.com -s SSH_USERNAME=deploy -s SSH_PRIVATE_KEY="$(cat ~/.ssh/deploy_key)"
```
</details>

<details>
<summary><b>How do I force a full re-deploy?</b></summary>

Either:
1. Delete `.ssh-deploy-sync-state.json` from the server
2. Use `dangerous-clean-slate: true` (this deletes ALL files first)
</details>

<details>
<summary><b>What happens if a command fails?</b></summary>

Failed commands are logged as warnings but do not fail the deployment. The exit code is captured in the action output. If you need the workflow to fail on command errors, check the output in a subsequent step.
</details>

---

## Comparison with FTP Deploy

| Feature | FTP Deploy | SSH Deploy |
|---|---|---|
| Protocol | FTP / FTPS | SSH / SFTP |
| Encryption | Optional (FTPS) | Always encrypted |
| Post-deploy commands | No | Yes |
| Key-based auth | No | Yes |
| Password auth | Yes | No (key-based only) |
| Smart sync | Yes | Yes |
| Dry run | Yes | Yes |
| File exclusion | Yes | Yes |
| Action outputs | No | Yes |

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
