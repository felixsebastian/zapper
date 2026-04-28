# Instances

Zapper is instance-first. A project can have multiple stack instances, and each instance has:

- Its own random `id` (used in PM2/Docker names)
- Its own assigned `ports` map
- Its own generated Docker `volumes` map for path-only volume mounts

This prevents collisions across separate checkouts and also supports multiple stacks from one repo (for example, E2E runs).

## Defaults

- If `--instance` is omitted, Zapper resolves the default instance key from `state.json` (`defaultInstance`, fallback: `default`).
- Instance keys must contain lowercase letters and hyphens only.

## Initialization

- Any config-backed command ensures the target instance exists before running.
- `zap init` is the explicit/idempotent way to force that setup and then run `init_task` if configured.
- `zap init -R` re-randomizes all configured ports for the selected instance.
- `zap volume prune` deletes generated Docker volumes whose service/path no longer exists in the current config.
- `zap volume reset` clears generated volume assignments in state without deleting Docker volumes.

Examples:

```bash
zap status
zap up
zap up --instance e2e
zap init --instance e2e
```

## Naming

PM2 and Docker names are always namespaced:

- `zap.<project>.<instanceId>.<service>`

## State file

Zapper stores instance state in `.zap/state.json`:

```json
{
  "defaultInstance": "default",
  "instances": {
    "default": {
      "id": "a1b2c3",
      "ports": {
        "FRONTEND_PORT": "54321"
      },
      "volumes": {
        "zap.myapp.a1b2c3.vol1": {
          "service": "postgres",
          "internal_dir": "/var/lib/postgresql/data"
        }
      }
    },
    "e2e": {
      "id": "k9m2pq",
      "ports": {
        "FRONTEND_PORT": "61234"
      },
      "volumes": {
        "zap.myapp.k9m2pq.vol1": {
          "service": "postgres",
          "internal_dir": "/var/lib/postgresql/data"
        }
      }
    }
  }
}
```
