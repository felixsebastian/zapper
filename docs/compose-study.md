# Docker Compose Study

This study compares Zapper's `zap.yaml` model with the current Docker Compose
file reference, using Docker's public documentation as the reference point.

The goal is not to copy Docker Compose. Compose is a mature container
orchestrator with a large service, network, volume, build, and deployment
surface. Zapper should stay small and local-dev-first, but Compose has several
capabilities that are useful signals for what local development teams expect
from a dev environment runner.

Primary references:

- [Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Services](https://docs.docker.com/reference/compose-file/services/)
- [Build specification](https://docs.docker.com/reference/compose-file/build/)
- [Develop specification](https://docs.docker.com/reference/compose-file/develop/)
- [Networks](https://docs.docker.com/reference/compose-file/networks/)
- [Volumes](https://docs.docker.com/reference/compose-file/volumes/)
- [Secrets](https://docs.docker.com/reference/compose-file/secrets/)
- [Include](https://docs.docker.com/reference/compose-file/include/)
- [Merge Compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
- [Interpolation](https://docs.docker.com/reference/compose-file/interpolation/)

## Current Zapper Baseline

`packages/cli/src/config/schemas.ts` is the source of truth for Zapper config.
Zapper currently supports:

- Project namespacing through root `project`.
- Root environment file stacks through `env` or `env_files`.
- Named random ports through root `ports`.
- Native services under `native`, with `cmd`, optional `cwd`, `env`, `repo`,
  aliases, profiles, healthcheck, and `depends_on`.
- Docker services under `docker` or `containers`, with `image`, optional
  `ports`, `env`, `volumes`, `networks`, `command`, aliases, profiles,
  healthcheck, and `depends_on`.
- One-off tasks under `tasks`, with `cmds`, `env`, `cwd`, aliases, params, and
  nested task references.
- Project metadata through `homepage`, `notes`, and `links`.
- Git clone method selection through `git_method`.

Zapper intentionally treats native processes and containers as peer service
types. Compose is container-only, but it has a much larger set of container
affordances.

## Ranking Criteria

These rankings are about local development, not production orchestration. A
feature ranks higher when it helps a developer boot, inspect, mutate, reset, or
share a local stack with less project-specific glue.

- `P0`: Core local-dev gap. Worth designing soon.
- `P1`: Important for common stacks, but scope needs restraint.
- `P2`: Useful edge or compatibility feature.
- `P3`: Mostly production, ops, or Docker-engine tuning. Usually not worth
  adding directly to Zapper config.

## Highest-Value Gaps

### P0. Build Containers From Local Source

Compose affordance: services can define `build` as a path or object, including
context, Dockerfile, build args, build target, cache, platform, SSH, and build
secrets. Compose can use `build` with `image`, attempting to pull first and
building if needed when no explicit pull policy overrides that behavior.

Zapper gap: Docker services require `image`. There is no first-class way to
say "this service's image comes from this local Dockerfile" or to rebuild it
from `zap up`.

Why it matters locally: many apps have supporting services built from local
source: API images, workers, custom Postgres extensions, local reverse proxies,
or integration-test dependencies. Without `build`, Zapper users must run a
manual task first and keep tag names synchronized by convention.

Recommended Zapper shape:

```yaml
docker:
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
      target: dev
      args:
        NODE_ENV: development
    image: myapp-api:dev
```

Keep the first pass small: `context`, `dockerfile`, `target`, `args`, `image`,
and an explicit rebuild command or flag. Defer multi-platform, provenance,
SBOM, SSH, advanced cache, and publishing semantics.

### P0. File Watch, Sync, Restart, And Rebuild Rules

Compose affordance: the `develop.watch` section can react to file changes with
`sync`, `rebuild`, `restart`, `sync+restart`, or `sync+exec`, with ignore and
include patterns.

Zapper gap: Zapper starts processes and containers, but it has no config-level
watch behavior for Docker services. Native processes can run their own watcher
inside `cmd`, but containerized services need explicit rebuild/restart/sync
workflows.

Why it matters locally: local dev is mostly edit-run-debug. Compose's develop
spec covers the frustrating cases where bind mounts are too slow, image rebuilds
are required, or a process only reloads after a command runs inside the
container.

Recommended Zapper shape:

```yaml
docker:
  api:
    image: myapp-api:dev
    watch:
      - path: ./api/src
        action: rebuild
      - path: ./api/config
        action: restart
```

Start with `restart` and `rebuild`. Treat file sync and `exec` as later work
because they require more platform-specific behavior and a clearer security
model.

### P0. Richer Dependency Readiness

Compose affordance: `depends_on` supports more than ordering. Long syntax can
express conditions such as service started, healthy, or completed successfully,
plus restart and required semantics. Compose also integrates this with service
healthchecks.

Zapper gap: Zapper has `depends_on` and `healthcheck`, but the schema only
allows dependency names. There is no per-edge condition, optional dependency,
or "run after one-shot dependency completed" model.

Why it matters locally: app boot often needs "start db, wait until healthy,
then start API" rather than only "start db first." Seeders, migrations, local
tunnel helpers, and asset builders also benefit from completion-based
dependencies.

Recommended Zapper shape:

```yaml
native:
  api:
    cmd: pnpm dev
    depends_on:
      db:
        condition: healthy
      migrate:
        condition: completed
```

Preserve the current array shorthand as `condition: started`. This matters for
native and Docker services equally, so it fits Zapper's core philosophy better
than a Docker-only compatibility layer.

### P1. Environment Interpolation Defaults And Required Values

Compose affordance: Compose interpolates values using shell-like expressions
such as `${VAR}`, `${VAR:-default}`, `${VAR?error}`, nested expressions, and
`$$` for literal dollar signs. Compose has documented precedence across shell
environment, `.env`, and explicit env files.

Zapper gap: Zapper has env file stacks and task Mustache interpolation, but
`zap.yaml` values do not appear to have a general interpolation model with
defaults, required values, or escaping.

Why it matters locally: dev configs often need portable defaults with a few
machine-local overrides: ports, image tags, repo paths, feature flags, and
credentials that must fail clearly when missing.

Recommended Zapper shape: support interpolation in config values that are
already strings, with a deliberately smaller Compose-compatible subset:
`${VAR}`, `${VAR:-default}`, `${VAR?message}`, and `$$`.

Do not make env precedence ambiguous. Zapper already has an opinionated env
stack model, so document exactly which values feed config interpolation and
which values are passed into services.

### P1. More Complete Volume And Mount Semantics

Compose affordance: top-level `volumes` configure reusable named volumes with
drivers, driver options, external lifecycle, labels, and custom platform names.
Service mounts support richer bind, volume, tmpfs, read-only, consistency, and
mount-path behavior than Zapper's current string/object forms.

Zapper gap: Zapper supports service `volumes`, including generated managed
volumes via object form, but no top-level volume declarations, external named
volumes, driver options, tmpfs, or richer bind options.

Why it matters locally: databases, object stores, search indexes, and language
package caches often need controlled persistence and fast reset semantics. Some
teams also need to reuse an existing host or Docker volume rather than let the
tool generate one.

Recommended Zapper shape:

```yaml
volumes:
  pgdata:
    external: true
    name: shared-pgdata

docker:
  db:
    image: postgres:18
    volumes:
      - pgdata:/var/lib/postgresql/data
      - type: bind
        source: ./fixtures
        target: /fixtures
        read_only: true
```

This should be designed alongside existing `zap volume` behavior so generated
instance-scoped volumes remain easy to reset.

### P1. Secrets As Mounted Files

Compose affordance: top-level `secrets` can source sensitive content from a
file or host environment variable, and services must be explicitly granted
access.

Zapper gap: Zapper passes environment variables, but has no config concept for
mounting secret material as files or granting service-specific secret access.

Why it matters locally: many official images support `_FILE` env conventions,
and file-mounted secrets reduce accidental log/env leakage. This is useful even
outside production orchestration.

Recommended Zapper shape:

```yaml
secrets:
  db_password:
    env: POSTGRES_PASSWORD

docker:
  db:
    image: postgres:18
    secrets:
      - db_password
```

Keep the implementation local and explicit. Do not imply production-grade
secret storage; this is about safer local delivery into containers.

### P1. One-Off Commands Inside Services

Compose affordance: `docker compose run` and `docker compose exec` give users a
standard way to run one-off commands in service context.

Zapper gap: Zapper has tasks, but no first-class "run this command in the
environment of service X" or "exec inside the running container for service X"
model.

Why it matters locally: migrations, database shells, framework CLIs, test
commands, and debug commands often need the same env, working directory, mounts,
and network identity as a service.

Recommended Zapper shape:

```yaml
tasks:
  migrate:
    service: api
    cmd: pnpm prisma migrate dev
```

For Docker services, this could map to `docker exec` when running or a one-off
container when stopped. For native services, it should run locally with the
service's resolved env and cwd.

## Medium-Value Gaps

### P2. Modular Config: Include, Overrides, And Merge

Compose affordance: Compose can merge multiple files with deterministic
override rules, automatically read `compose.override.yaml`, and include other
Compose files as subdomains with their own project directories.

Zapper gap: `zap --config <file>` selects one config. There is no include,
override, or merge system.

Why it matters locally: larger repos may want a base config plus optional
team-specific, machine-specific, or feature-specific additions. It is also a
migration path from existing Compose stacks.

Why it is not P0/P1: merge semantics become support burden quickly, especially
for paths, env interpolation, ports, and named resources. Zapper's profiles and
env stacks already cover some common local variation.

Recommended scope if adopted: prefer a single explicit `include` list over
implicit file discovery. Avoid partial fragment files unless there is a clear
schema and path-resolution story.

### P2. Network Topology Controls

Compose affordance: top-level `networks` can configure default and named
networks with drivers, driver options, attachability, internal isolation, IPAM,
IPv4/IPv6 toggles, external lifecycle, labels, and custom names. Service-level
network entries can provide aliases and more detailed attachment settings.

Zapper gap: Docker services can list network names, but Zapper has no top-level
network declarations, network creation options, per-network aliases, external
networks, or `network_mode`.

Why it matters locally: most local stacks only need "services can find each
other." The important local exceptions are isolation between frontend/backend
tiers, attaching to an existing reverse-proxy network, and using host
networking for low-friction callbacks.

Recommended scope if adopted: support top-level external networks, default
network customization, and `network_mode: host | none | bridge` before adding
IPAM or driver-specific options.

### P2. Container Runtime Options

Compose affordance: services support many runtime controls: `working_dir`,
`user`, `entrypoint`, `privileged`, `cap_add`, `cap_drop`, `devices`, `dns`,
`extra_hosts`, `hostname`, `platform`, `restart`, `stop_signal`, `stop_grace_period`,
`ulimits`, memory limits, CPU limits, logging drivers, labels, annotations, and
more.

Zapper gap: Docker services expose only a small subset: image, ports, env,
volumes, networks, command, aliases, profiles, healthcheck, and dependencies.

Why it matters locally: a few of these are common for local dev:
`working_dir`, `user`, `entrypoint`, `platform`, `extra_hosts`, `privileged`,
`devices`, and `init`. The rest are more operational.

Recommended scope if adopted: add fields only when they solve repeated local
friction. Avoid becoming a generic Docker run schema unless compatibility with
Compose becomes an explicit goal.

### P2. Service Lifecycle Hooks

Compose affordance: `post_start` and `pre_stop` hooks can run commands around a
container lifecycle, with command-specific user, privilege, working directory,
and environment.

Zapper gap: Zapper has `init_task` and tasks, but not per-service lifecycle
hooks.

Why it matters locally: hooks can configure a container after startup, warm
caches, register callbacks, or cleanly tear down local side effects.

Why it is not higher: hooks can hide important behavior and create subtle boot
races. For local dev, explicit tasks and better dependency conditions may cover
most cases with less magic.

### P2. Config Objects

Compose affordance: `configs` are file-like objects mounted into services,
similar to secrets but intended for non-sensitive configuration.

Zapper gap: users must use bind mounts, env files, or image-baked files.

Why it matters locally: useful for config files generated from templates or
shared across services without exposing an entire host directory.

Recommended scope if adopted: consider only after richer mount semantics and
secrets. Local dev can usually use bind mounts.

## Low-Value Or Mostly Out Of Scope

### P3. Deployment-Oriented Fields

Compose includes fields such as `deploy`, placement-style resource
reservations, replicas, update configuration, rollback configuration, and other
orchestration concerns. These are useful in deployment contexts but do not fit
Zapper's lightweight local runner goal.

### P3. Deep Kernel And Isolation Tuning

Fields such as `cgroup`, `cgroup_parent`, `blkio_config`, `cpu_rt_runtime`,
`cpu_rt_period`, `cpuset`, `device_cgroup_rules`, `ipc`, `pid`, `uts`, and
similar low-level controls can matter for specialized containers, but they are
rare local-dev defaults and expensive to document well.

Prefer escape hatches or targeted additions over broad schema support.

### P3. Publishing, Provenance, SBOM, And Multi-Platform Build Output

Compose build supports publishing images, additional tags, provenance
attestations, SBOM controls, and multi-platform builds. These are important for
CI/CD and release workflows, but Zapper's local dev config should not become a
release build system.

### P3. Swarm And Stack Compatibility

Some Compose concepts overlap with `docker stack deploy` while others are
Compose-only. Zapper should not optimize for Swarm compatibility unless the
project goal changes.

## Suggested Roadmap

1. Add Docker `build` support with a narrow local-dev subset.
2. Add richer `depends_on` conditions that apply to both native and Docker
   services.
3. Add Docker service watch actions for `restart` and `rebuild`.
4. Add config interpolation defaults and required-value errors.
5. Design top-level `volumes` and richer service mount syntax around existing
   instance-scoped volume behavior.
6. Add mounted local secrets if the env system continues to be the only way to
   deliver sensitive values.
7. Add service-context tasks for `run`/`exec`-style workflows.
8. Consider explicit config `include` only after the core model settles.

## Non-Goals

Zapper should not aim for full Compose compatibility by default. The useful
direction is a small set of local-dev affordances that preserve Zapper's
native-plus-Docker service model:

- Build and rebuild what the developer edits.
- Wait for dependencies in ways that match actual readiness.
- Keep local data easy to preserve, inspect, and reset.
- Pass config and secrets into services predictably.
- Let tasks run in the same context as services.
- Keep optional topology and runtime controls available without making every
  `zap.yaml` feel like a Docker manual.
