# Instances (Git Worktrees)

When the same project exists in multiple directories (typically via git worktrees), Zapper can accidentally share PM2 processes and Docker containers across those directories. That can cause one directory's `zap up` to clobber another, and `zap status`/`zap logs` to report the wrong instance.

---

## Current Behavior

Zapper detects git worktrees automatically by checking if `.git` is a file (with a `gitdir:` pointer) instead of a directory.

If you run any `zap` command in a worktree and no instance ID is configured, Zapper:

1. Prints a large warning
2. Continues normally (no interactive prompt, no blocking)

The warning is there to make collisions obvious without changing command behavior.

---

## Explicit Isolation

Use `zap isolate` to enable isolation for the current directory:

```bash
zap isolate
```

This writes `.zap/instance.json` with a generated instance ID:

```json
{
  "instanceId": "wt-a1b2c3",
  "mode": "isolate"
}
```

Once isolated, process/container names are namespaced:

- PM2: `zap.<project>.<instanceId>.<service>`
- Docker: `zap.<project>.<instanceId>.<service>`

This prevents collisions with other worktrees of the same project.

---

## Port Conflicts

Isolation namespaces service names, but it does not change ports. If two worktrees use the same ports, they will still conflict.

Use environment sets to provide different ports per worktree:

```yaml
env_files:
  default: [.env.base, .env]
  worktree: [.env.base, .env.worktree]
```

```bash
# .env.worktree
PORT=3100
FRONTEND_PORT=5200
PG_PORT=5433
```

Then in the worktree:

```bash
zap env worktree
zap isolate
zap up
```

---

## Configuration

`instance.json` lives in `.zap/` (already gitignored):

```json
{
  "instanceId": "my-feature-branch"
}
```

`instanceId` can be any string matching `[a-zA-Z0-9_-]+`.

---

## Automation

Automation tools that create worktrees can preconfigure isolation by writing `.zap/instance.json` before running any `zap` command:

```bash
git worktree add ../myapp-feature-123 feature-123
mkdir -p ../myapp-feature-123/.zap
echo '{"instanceId":"feature-123","mode":"isolate"}' > ../myapp-feature-123/.zap/instance.json

# Optional port overrides
cp .env.worktree.template ../myapp-feature-123/.env.worktree
cd ../myapp-feature-123
zap env worktree
zap up
```

---

## Summary

| Scenario | What happens |
|----------|-------------|
| Normal repo (no worktree) | Nothing changes |
| Worktree, no isolation | Startup warning is shown, command still runs |
| Worktree, `zap isolate` run | Instance ID is created in `.zap/instance.json` |
| Worktree, isolated, `zap up` | Processes/containers are namespaced under instance ID |
| Automation creates worktree | Prewrite `.zap/instance.json` to avoid warning |
