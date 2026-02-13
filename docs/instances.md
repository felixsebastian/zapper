# Instances (Git Worktrees)

When the same project exists in multiple directories (typically via git worktrees), Zapper needs to keep them separate. Without this, two directories with the same `project` name silently share PM2 processes and Docker containers — leading to one directory's `zap up` clobbering the other's, and commands like `zap status` and `zap logs` reporting on the wrong instance.

---

## How It Works

Zapper detects git worktrees automatically. When you run any `zap` command inside a worktree, Zapper notices and asks what you want to do:

```
This project is inside a git worktree.
Another instance of "myapp" may be running from /home/user/myapp.

? How should this instance be handled?
  > Isolate (run independently with a separate instance ID)
    Exclusive (only allow one running instance at a time)
```

Your choice is saved to `.zap/instance.json` so you're only asked once.

### Isolate

Creates a separate instance. PM2 processes and Docker containers get a unique namespace so they don't collide with the main worktree or other instances.

Zapper generates an instance ID (a short hash derived from the worktree path) and stores it:

```json
// .zap/instance.json
{
  "instanceId": "wt-a1b2c3"
}
```

PM2 process names become `zap.myapp.wt-a1b2c3.api` instead of `zap.myapp.api`. Docker container names follow the same pattern. Each instance has its own logs, wrapper scripts, and state — all within its own `.zap/` directory as usual.

### Exclusive

No instance ID is created. Instead, Zapper enforces that only one directory can run this project at a time. If processes are already running from a different directory, Zapper blocks and tells you:

```
Project "myapp" is already running from /home/user/myapp.
Stop it first with `zap down`, or use `zap up --force` to take over.
```

Read-only commands (`zap status`, `zap logs`) still work from any directory but display a warning:

```
Note: these processes were started from /home/user/myapp, not the current directory.
```

---

## Port Conflicts

When running isolated instances, each instance tries to bind the same ports (since they share the same `zap.yaml`). Zapper does not manage ports — they come from your environment variables and are your responsibility.

To run two instances simultaneously, give each one different ports. The simplest way is with [environment sets](usage.md#environment-variables):

```yaml
env_files:
  default: [.env.base, .env]
  worktree: [.env.base, .env.worktree]
```

Where `.env.worktree` overrides the port variables:

```bash
# .env.worktree
PORT=3100
FRONTEND_PORT=5200
PG_PORT=5433
```

Then in the worktree, switch environment:

```bash
zap env worktree
zap up
```

For automated worktree creation, the automation script just needs to:

1. Create the worktree
2. Create a `.env.worktree` with different ports
3. Run `zap env worktree` (or write `.zap/state.json` directly)

Zapper handles the instance detection and isolation automatically.

---

## Configuration

### `.zap/instance.json`

This file lives inside the `.zap/` directory (which is already gitignored) and is created automatically when you make your choice on first run. You can also create it manually:

```json
{
  "instanceId": "my-feature-branch"
}
```

The `instanceId` can be any string matching `[a-zA-Z0-9_-]+`. It gets inserted into PM2/Docker names: `zap.{project}.{instanceId}.{service}`.

To opt into exclusive mode instead of isolation, omit `instanceId` or set it to `null`:

```json
{
  "mode": "exclusive"
}
```

### For automation

Automation tools creating worktrees can skip the interactive prompt entirely by writing `.zap/instance.json` before any `zap` command runs:

```bash
# Example: automated worktree setup
git worktree add ../myapp-feature-123 feature-123
mkdir -p ../myapp-feature-123/.zap
echo '{"instanceId": "feature-123"}' > ../myapp-feature-123/.zap/instance.json

# Optionally set up different ports
cp .env.worktree.template ../myapp-feature-123/.env.worktree
cd ../myapp-feature-123
zap env worktree
zap up
```

### Worktree detection

Zapper detects worktrees by checking if `.git` is a file (containing a `gitdir:` pointer) rather than a directory. This is how git represents worktrees — the main worktree has a `.git/` directory, while linked worktrees have a `.git` file.

If you're in a worktree and there is no `.zap/instance.json`, Zapper prompts you. If you're not in a worktree, nothing changes — Zapper works exactly as before.

---

## Commands

No new commands are added. Existing commands work the same way, with instance-awareness built in.

### Status output

When running as an instance, `zap status` shows the instance ID:

```
myapp (instance: wt-a1b2c3)

  SERVICE     STATUS
  api         up
  worker      up
  postgres    up
```

### Logs

`zap logs` shows logs for the current instance only. Each instance has its own log files in its own `.zap/logs/` directory.

### Reset

`zap reset` only affects the current instance. It stops the instance's processes and deletes its `.zap/` directory. Other instances are untouched.

---

## Summary

| Scenario | What happens |
|----------|-------------|
| Normal repo (no worktree) | Nothing changes |
| Worktree, first `zap` command | Prompted to choose: isolate or exclusive |
| Worktree, `.zap/instance.json` exists | Instance ID used automatically, no prompt |
| Worktree, isolated, `zap up` | Processes namespaced under instance ID |
| Worktree, exclusive, `zap up` | Blocked if another directory is already running |
| Worktree, `zap status` | Shows instance context in output |
| Automation creates worktree | Write `.zap/instance.json` to skip prompt |
