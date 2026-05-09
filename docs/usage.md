# Zapper Reference

Complete reference for `zap.yaml` syntax and all CLI commands.

---

## Table of Contents

- [Installation](#installation)
- [Project Configuration](#project-configuration)
- [CLI Commands](#cli-commands)
- [Native Processes](#native-processes)
- [Docker Services](#docker-services)
- [Environment Variables](#environment-variables)
- [Instances](#instances)
- [Resource Management](resource-management.md)
- [Tasks](#tasks)
- [Dependencies](#dependencies)
- [Profiles](#profiles)
- [Links](#links)
- [Notes](#notes)
- [Git Cloning](#git-cloning)

---

## Installation

```bash
npm install -g pm2 @mp-lb/zapper
```

For VS Code/Cursor, install the extension: `felixsebastian.zapper-vscode`

Docker-backed services require Docker CLI. On macOS, Zapper now attempts to
auto-install Docker Desktop via Homebrew (`brew install --cask docker`) when
Docker is missing. If Homebrew is unavailable or install fails, Zapper exits
with manual install instructions.

---

## Project Configuration

### Minimal config

```yaml
project: myapp

native:
  api:
    cmd: pnpm dev
```

### Full config structure

```yaml
project: myapp # Required. Used as PM2/Docker namespace
env: # Load env vars from these files
  default: [.env.base, .env]
  prod_dbs: [.env.base, .env.prod-dbs]
ports: # Port names to assign random values
  - FRONTEND_PORT
  - BACKEND_PORT
init_task: seed # Optional task to run after `zap init`
git_method: ssh # ssh | http | cli (for repo cloning)

native:
  # ... process definitions

docker:
  # ... container definitions

tasks:
  # ... task definitions

homepage: http://localhost:3000 # Optional default URL for `zap launch`
notes: "API: http://localhost:${API_PORT}" # Optional note text for `zap notes`

links:
  # ... quick reference links
```

---

## CLI Commands

### Global Options

Available with any command:

```bash
--config <file>    # Use a specific config file (default: zap.yaml)
-v, --verbose      # Increase logging verbosity
-q, --quiet        # Reduce logging output
-d, --debug        # Enable debug logging
```

Examples:

```bash
zap --config prod.yaml up
zap --config staging.yaml status
zap --debug restart
zap --verbose --config custom.yaml task build
```

### Starting and stopping

```bash
zap up                      # Start all services
zap up backend              # Start one service (and its dependencies)
zap up api worker db        # Start multiple services
zap up --json               # Output command result as JSON
zap down                    # Stop all services
zap down backend            # Stop one service
zap down api worker db      # Stop multiple services
zap down backend --json     # Output command result as JSON
zap restart                 # Restart all services
zap restart api             # Restart one service (does not restart its dependencies)
zap restart api worker db   # Restart multiple services
zap r api worker            # Short alias for: zap restart api worker
```

### Status and logs

```bash
zap status                  # Show status of all services
zap status api db           # Show status for specific services
zap ls                      # List services/containers plus assigned ports
zap ls --extended           # Include instance, dangling, and alien resource inventory
zap ls --all                # Alias for: zap ls --extended
zap ls api db               # List details for specific services
zap ls --json               # Output detailed list as JSON
zap logs api                # Follow logs for one service
zap logs api worker --no-follow  # Show logs for multiple services and exit
zap startup-log api         # Show saved startup output for one service
```

When passing multiple services to `zap logs`, use `--no-follow`.

If a service fails during startup, Zapper saves the last startup attempt output
under `.zap/logs/`. Use `zap startup-log <service>` to inspect that saved
startup output.

### Tasks

```bash
zap task                           # List all tasks
zap task <name>                    # Run a task
zap run <name>                     # Alias for: zap task <name>
zap task seed
zap task build --target=prod       # Run with named parameters
zap task test -- --coverage        # Run with pass-through args
zap task build --list-params       # Show task parameters as JSON
```

### Utilities

```bash
zap reset                   # Stop all services and delete .zap folder
zap reset --json            # Output command result as JSON
zap kill                    # Kill all PM2 processes and containers for current project, across all instances
zap kill my-old-project     # Kill all PM2 processes and containers for a specific project, across all instances
zap kill --force            # Skip the interactive confirmation
zap kill --json             # Output kill result as JSON
zap global list             # List all discovered Zapper PM2/container resources
zap global ls               # Alias for: zap global list
zap g ls                    # Short alias for: zap global ls
zap global prune            # Prune stale registry entries, then orphaned resources and generated volumes
zap global prune --force    # Skip the interactive prune confirmation
zap g kill --force          # Skip the interactive global kill confirmation
zap clone                   # Clone all repos defined in config
zap clone api               # Clone one repo
zap clone api web           # Clone multiple repos
zap clone --json            # Output command result as JSON
zap init                    # Ensure local state exists for the default instance (and run init_task if configured)
zap init --instance e2e     # Initialize/create a named instance
zap init -R                 # Force full port re-randomization
zap init --json             # Output as JSON
zap instance label          # Print the selected instance display label
zap instance label "local"  # Set a display label for the selected instance
zap volume prune            # Delete stale generated Docker volumes for the selected instance
zap volume reset            # Forget generated volume assignments for the selected instance
zap launch                  # Open homepage (if configured)
zap launch "API Docs"       # Open a configured link by name
zap launch "API Docs" --json # Output command result as JSON
zap links                   # List homepage and configured links
zap links --json            # Output links as JSON
zap home                    # Print homepage URL (if configured)
zap home --json             # Output homepage value as JSON
zap notes                   # Print notes (if configured)
zap notes --json            # Output notes value as JSON
zap open                    # Alias for: zap launch
zap o "API Docs"            # Short alias for: zap launch "API Docs"
```

### System Registry

System commands inspect machine-wide Zapper state rather than only the current
repository. They are intended for desktop integrations, project discovery, and
orphaned resource cleanup.

```bash
zap system projects                  # List registered Zapper projects
zap system projects --json           # Output registered projects as JSON
zap system registry prune            # Remove stale system registry entries
zap system registry forget <target>  # Forget one registry entry by id or path
zap system registry repair           # Prune stale entries and show projects
zap system resources audit           # Show orphaned PM2/Docker resources
zap system resources cleanup         # Delete audited orphaned resources
zap system resources cleanup --include-volumes
```

`zap system projects` always validates registered project roots and config paths.
Missing projects stay in the registry and are returned with `state: "stale"` so
the desktop app and CLI can show a single source of truth.

`zap global prune` audits stale registry entries, PM2 processes, Docker
containers, and generated Docker volumes while the registry metadata is still
available. After confirmation, it deletes orphaned resources and then removes
the stale registry entries. Use `--force` (`-y`) for non-interactive runs.

For `zap global list`, `--all` is now a legacy no-op: the command always lists
all discovered global Zapper resources unless you pass a project name.

On macOS, the system registry defaults to
`~/Library/Application Support/Zapper/registry.json`. On Linux, it defaults to
`$XDG_STATE_HOME/zapper/registry.json`, or `~/.local/state/zapper/registry.json`
when `XDG_STATE_HOME` is unset. Set `ZAPPER_SYSTEM_STATE_HOME` to override the
directory, or `ZAPPER_DISABLE_SYSTEM_REGISTRY=1` to disable registry writes.

If a project's `project` name changes while its project root and config path
stay the same, Zapper updates the registry entry and prints a one-time warning
that old resources may still be running. Use `zap system resources audit` to
find resources left behind by the previous project name.

The system project list is registry-backed and uses normal per-project Zapper
status/list behavior for service details. In JSON output, each listed service
includes `enabled` so integrations can distinguish profile-disabled services
from stopped services. The resources audit scans PM2 and Docker directly so it
can find orphaned resources left behind by renamed projects, removed services,
moved checkouts, or deleted local state.

### Profiles

```bash
zap profile dev             # Enable a profile
zap profile --disable       # Disable active profile
zap profile dev --json      # Output profile action result as JSON
```

### Environments

```bash
zap env --list                    # List available environment sets
zap env prod_dbs                  # Switch env file set
zap env --disable                 # Reset to default env set
zap env prod_dbs --json           # Output environment action result as JSON
```

Aliases:

```bash
zap environment --list
zap envset prod_dbs
```

### JSON Output

Most non-streaming commands support `--json` and will print machine-readable JSON to stdout.
Examples: `up`, `down`, `restart`, `clone`, `reset`, `kill`, `status`, `ls`, `task` (list/params), `profile`, `env`, `state`, `config`, `launch`, `links`, `home`, `notes`, `init`, `instance`, `system`, and git subcommands.

When `--json` is enabled, Zapper suppresses incidental human logs and warnings so the command output stays parseable. Command failures are still reported as errors.

Streaming commands keep stream output and are not JSON-encoded:

```bash
zap logs <service> [more-services...] [--no-follow]
zap startup-log <service> [more-services...]
zap task <name>
```

Service aliases configured with `aliases` on `native` or `docker` entries are resolved before service filtering or execution. The same alias works with service-targeting commands such as `up`, `down`, `restart`, `status`, `ls`, `logs`, `startup-log`, and `clone`.

`zap kill <project>` does not require a local `zap.yaml`; it targets resources by prefix (`zap.<project>.*`).

---

## Native Processes

Native processes run via PM2 on your local machine.

### Basic process

```yaml
native:
  api:
    cmd: pnpm dev
```

### All options

```yaml
native:
  api:
    cmd: pnpm dev              # Required. Command to run
    aliases: [be, backend]     # Alternate service names accepted by commands
    cwd: ./backend             # Working directory (relative to zap.yaml)
    env: "*"                   # Pass all values from the root env stack
    depends_on: [postgres]     # Start these first
    profiles: [dev, test]      # Only start when profile matches
    repo: myorg/api-repo       # Git repo (for zap clone)
    healthcheck: 10            # Seconds to wait before considering "up"
    # OR
    healthcheck: http://localhost:3000/health  # URL to poll for readiness
```

### Working directory

```yaml
native:
  frontend:
    cmd: pnpm dev
    cwd: ./packages/frontend # Relative to project root
```

### Multiple processes

```yaml
native:
  api:
    cmd: pnpm dev
    cwd: ./api

  worker:
    cmd: pnpm worker
    cwd: ./api

  frontend:
    cmd: pnpm dev
    cwd: ./web
```

---

## Docker Services

Containers managed via Docker CLI.

### Basic container

```yaml
docker:
  redis:
    image: redis:latest
    ports:
      - 6379:6379
```

### All options

```yaml
docker:
  postgres:
    image: postgres:15         # Required. Docker image
    aliases: [db, pg]          # Alternate service names accepted by commands
    ports:                     # Port mappings (host:container)
      - 5432:5432
    env: .zap/env/postgres.yaml # Strict whitelist file for root env values
    volumes:                   # Volume mounts
      - /var/lib/postgresql/data
      - postgres-logs:/var/log/postgresql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    depends_on: [other]        # Start dependencies first
    profiles: [dev]            # Profile filtering
    healthcheck: 10            # Seconds to wait before considering "up"
    # OR
    healthcheck: http://localhost:5432  # URL to poll for readiness
```

### Common database setups

#### PostgreSQL

```yaml
docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432
    env: .env.postgres
    volumes:
      - /var/lib/postgresql/data
```

#### MongoDB

```yaml
docker:
  mongodb:
    image: mongo:7
    ports:
      - 27017:27017
    volumes:
      - /data/db
```

### Docker volumes

Zapper supports Compose-style volume mounts and adds a higher-level managed
volume form.

```yaml
docker:
  postgres:
    image: postgres:15
    volumes:
      - /var/lib/postgresql/data # Zapper-managed volume
      - /var/lib/postgresql/wal:ro # Zapper-managed volume with mode
      - postgres-logs:/var/log/postgresql # Explicit named Docker volume
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql # Bind mount
      - internal_dir: /var/lib/postgresql/wal # Zapper-managed volume
        mode: ro
      - name: postgres-config
        internal_dir: /etc/postgresql # Explicit named Docker volume
```

When a volume entry is only a container path, or an object without `name`,
Zapper generates a Docker volume name and stores it under the selected instance
in `.zap/state.json`. Each instance gets its own generated volume name for the
same service/path pair, using names like `zap.myapp.a1b2c3.vol1`. Explicit
names keep Compose-style behavior and are shared anywhere that name is reused.
Use `zap volume prune` to delete generated Docker volumes that are still in
state but no longer appear in `zap.yaml`. Use `zap volume reset` to forget the
generated assignments for the selected instance without deleting Docker volumes.

#### Redis

```yaml
docker:
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
```

#### MySQL

```yaml
docker:
  mysql:
    image: mysql:8
    ports:
      - 3306:3306
    env: .env.mysql
    volumes:
      - mysql-data:/var/lib/mysql
```

---

## Environment Variables

Zapper uses one `env` field for environment variable source and routing:

- Root `env` defines the global env file stack.
- Service `env: "*"` passes all values from the root env stack.
- Service `env: [files...]` uses a service-specific env file stack instead.
- Service `env: path/to/whitelist.yaml` filters the root env stack through a strict whitelist file.

Inline variable whitelists are not supported in `zap.yaml`. Arrays under
service `env` are file stacks.

### Loading from files

```yaml
env: [.env]                    # Single file
env: [.env.base, .env]         # Multiple files (later files override)
```

Env file names are intentionally flexible. Any non-empty filename or path is
accepted, including names such as `.env.something`, `service-env`, or
`config/local.env`. Values that look like uppercase variable names, such as
`DATABASE_URL`, are rejected because service `env` arrays define file stacks,
not inline variable lists.

Root `env_files` is still accepted as a compatibility alias for root `env`.

### Environment sets (recommended)

You can define multiple env file sets and switch between them with
`zap env <name>`. The `default` set is optional; if omitted and no
environment is active, no env files are loaded.

```yaml
env:
  default: [.env.base, .env]
  prod_dbs: [.env.base, .env.prod-dbs]
```

Compatibility alias:

```yaml
env_files: [.env.base, .env]
```

### Recommended pattern

Split into two files:

- `.env.base` — non-secrets (ports, URLs), **committed** to git
- `.env` — secrets (API keys, passwords), **gitignored**

```yaml
env: [.env.base, .env]
```

### Passing all env to a service

Use `env: "*"` when a service can receive every value from the root env stack:

```yaml
env: [.env.base, .env]

native:
  backend:
    cmd: pnpm dev
    env: "*"

  frontend:
    cmd: pnpm dev
    env: "*"
```

### Service-specific file stacks

Use a service-level env file stack when a service should not use the global
stack:

```yaml
native:
  frontend:
    cmd: pnpm dev
    env: [.env.common, .env.frontend, .env.frontend.user]

  backend:
    cmd: pnpm dev
    env: [.env.common, .env.db, .env.backend, .env.backend.user]
```

The service stack replaces the root stack for that service.

### Whitelist files

Use a whitelist file when you want central env files but explicit routing:

```yaml
env: [.env.common, .env.db, .env.user]

native:
  api:
    cmd: pnpm dev
    env: .zap/env/api.yaml
```

`.zap/env/api.yaml`:

```yaml
vars:
  - DATABASE_URL
  - JWT_SECRET
```

### Port assignment

Define port variable names in your config and initialize values with `zap init`:

```yaml
project: myapp
ports:
  - FRONTEND_PORT
  - BACKEND_PORT
  - DB_PORT

env: [.env]

native:
  frontend:
    cmd: pnpm dev
    env: "*"
  backend:
    cmd: pnpm dev
    env: "*"
```

Then run:

```bash
zap init                        # Ensures ports/volumes/state exist for default instance
zap init --instance e2e         # Ensures ports/volumes/state exist for named instance
zap init -R                     # Re-randomizes all configured ports in selected instance
```

Most config-backed commands now perform this initialization step automatically if the target instance has not been created yet, so your first command no longer needs to be `zap up`.

If `init_task` is set, `zap init` runs that task after initialization completes.
This is equivalent to running `zap init` first and then `zap task <init_task>`.

The assigned ports have **highest precedence** - they override values from any `.env` files. This is useful for:

- Avoiding port conflicts when running multiple instances
- Dynamic port assignment in development
- Sharing configurations with different port needs

`zap ls` always shows assigned port variables in a separate Ports table, even
without `--extended`, because they are part of the active instance's key runtime
state.

**Interpolation works with assigned ports:**

```txt
# .env
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
```

After initialization:

```bash
# If FRONTEND_PORT was assigned 54321
FRONTEND_URL will be http://localhost:54321
```

### Docker env vars

Docker services can use env vars too:

```yaml
docker:
  postgres:
    image: postgres:15
    env: "*"
```

Docker `ports` mappings also support interpolation, including values initialized by `ports:`:

```yaml
ports:
  - MONGO_PORT

docker:
  mongodb:
    image: mongo:latest
    ports:
      - ${MONGO_PORT}:27017
```

### Inspecting resolved env vars

```bash
zap env --service api              # Show resolved env vars for a service
zap env api                        # Works if no environment set named 'api'
```

---

## Instances

Instances let you run multiple stacks for the same project without name, port,
or managed-volume collisions.

```bash
zap up                                # Ensures default instance exists on first run
zap up --instance e2e                 # Run a named instance
zap init --instance e2e               # Explicitly create/init named instance state
zap instance label                    # Print the selected instance display label
zap instance label "local checkout"   # Label the selected instance for display
```

If you omit `--instance`, Zapper targets `default`. Instance keys must use lowercase letters and hyphens only. Instance labels can be any string up to 100 characters and are shown alongside the random instance ID in status and registry-backed desktop views. See [Instances](instances.md) for full details.

---

## Tasks

One-off commands that can use your env vars and accept parameters.

### Basic task

```yaml
tasks:
  seed:
    cmds:
      - pnpm db:seed
```

### All options

```yaml
tasks:
  seed:
    desc: Seed the database # Description (shown in help)
    aliases: [s] # Alternate task names accepted by zap task
    cwd: ./backend # Working directory
    env: .zap/env/backend.yaml # Strict whitelist file
    params: # Named parameters
      - name: count
        default: "10"
        desc: Number of records
      - name: env
        required: true
        desc: Target environment
    cmds: # Commands to run (in order)
      - pnpm db:migrate
      - "pnpm db:seed --count={{count}}"
```

### Running tasks

```bash
zap task seed
zap task lint
```

### Running a task automatically after init

Set `init_task` to any defined task name:

```yaml
init_task: seed

tasks:
  seed:
    cmds:
      - pnpm db:seed
```

When you run `zap init`, Zapper performs normal initialization and then runs that task.

### Parameters

Tasks can accept named parameters and pass-through arguments.

#### Named parameters

Define parameters with defaults and validation:

```yaml
tasks:
  build:
    desc: Build for target environment
    params:
      - name: target
        default: development
        desc: Build target
      - name: minify
        desc: Enable minification
    cmds:
      - 'echo "Building for {{target}}"'
      - "npm run build -- --env={{target}}"
```

Run with parameters:

```bash
zap task build --target=production --minify=true
```

#### Required parameters

Mark parameters as required (task fails if not provided):

```yaml
tasks:
  deploy:
    params:
      - name: env
        required: true
        desc: Deployment environment
    cmds:
      - "deploy.sh {{env}}"
```

```bash
zap task deploy --env=staging    # Works
zap task deploy                  # Error: Required parameter 'env' not provided
```

#### Pass-through arguments (REST)

Use <code v-pre>{{REST}}</code> to forward extra CLI arguments:

```yaml
tasks:
  test:
    desc: Run tests with optional args
    cmds:
      - "pnpm vitest {{REST}}"
```

Everything after `--` is passed through:

```bash
zap task test -- --coverage src/
# Runs: pnpm vitest --coverage src/
```

#### Custom delimiters

If your commands contain <code v-pre>{{</code> and <code v-pre>}}</code>, use custom delimiters:

```yaml
project: myapp
task_delimiters: ["<<", ">>"]

tasks:
  build:
    cmds:
      - 'echo "Building <<target>>"'
```

### Listing task parameters

For tooling integration (VS Code extension), get parameter info as JSON:

```bash
zap task build --list-params
```

Output:

```json
{
  "name": "build",
  "params": [
    {
      "name": "target",
      "default": "development",
      "required": false,
      "desc": "Build target"
    }
  ],
  "acceptsRest": false
}
```

### Common task patterns

#### Database operations

```yaml
tasks:
  db:migrate:
    desc: Run database migrations
    env: .zap/env/database.yaml
    cmds:
      - pnpm prisma migrate dev

  db:seed:
    desc: Seed the database
    env: .zap/env/database.yaml
    cmds:
      - pnpm prisma db seed

  db:reset:
    desc: Reset and reseed database
    env: .zap/env/database.yaml
    cmds:
      - pnpm prisma migrate reset --force
```

#### Code quality

```yaml
tasks:
  lint:
    cmds:
      - pnpm eslint . --fix
      - pnpm prettier --write .

  typecheck:
    cmds:
      - pnpm tsc --noEmit

  test:
    env: .zap/env/database.yaml
    cmds:
      - pnpm vitest run

  checks:
    desc: Run all checks before committing
    cmds:
      - pnpm eslint .
      - pnpm tsc --noEmit
      - pnpm vitest run
```

---

## Dependencies

Control startup order with `depends_on`.

### Basic dependency

```yaml
docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432

native:
  api:
    cmd: pnpm dev
    depends_on: [postgres] # Postgres starts first
```

### Dependency chain

```yaml
docker:
  postgres:
    image: postgres:15

  redis:
    image: redis:7

native:
  api:
    cmd: pnpm dev
    depends_on: [postgres, redis]

  worker:
    cmd: pnpm worker
    depends_on: [api] # API (and its deps) start first

  frontend:
    cmd: pnpm dev
    depends_on: [api]
```

When you run `zap up frontend`, Zapper starts: postgres → redis → api → frontend.

`depends_on` affects start order only.

- `zap up` / `zap restart` start waves are dependency-aware.
- `zap down` stops targeted services in a single wave.
- `zap restart <service>` restarts only the targeted service(s), not their dependencies.

---

## Profiles

Run different subsets of services.

### Defining profiles

```yaml
native:
  api:
    cmd: pnpm dev
    profiles: [dev, test]

  api-prod:
    cmd: pnpm start
    profiles: [prod]

  frontend:
    cmd: pnpm dev
    profiles: [dev]

docker:
  postgres:
    image: postgres:15
    profiles: [dev, test]

  postgres-test:
    image: postgres:15
    env: .env.test-db
    profiles: [test]
```

### Using profiles

```bash
zap up                     # Starts only services with no `profiles` field
zap profile dev            # Enables 'dev' profile and starts matching services
zap restart                # Restarts all services using active profile filtering
zap profile --disable      # Disables active profile
```

### Default behavior

Services without a `profiles` field run regardless of profile state.
Services with a `profiles` field run only when an active profile matches.

---

## Links

Quick reference links for your project. These are for your own reference and can be displayed by tooling.

You can also set a top-level `homepage` URL as the default target for `zap launch` with no arguments.
Use `zap home` to print just the homepage URL, or `zap links` to list the homepage alongside your configured links.

### Homepage

```yaml
homepage: http://localhost:3000
```

### Basic usage

```yaml
links:
  - name: API Docs
    url: https://api.example.com/docs
  - name: Staging
    url: https://staging.example.com
  - name: Figma
    url: https://figma.com/file/abc123
```

### Environment variable interpolation

Link URLs support `${VAR}` syntax to reference environment variables from your root `env` files:

```yaml
env: [.env]

links:
  - name: API
    url: http://localhost:${API_PORT}
  - name: Frontend
    url: http://localhost:${FRONTEND_PORT}
```

### Opening links

```bash
zap launch                     # Open homepage
zap launch "API Docs"          # Open by link name (quote if spaces)
zap links                      # List homepage + configured links
zap home                       # Print homepage
zap open                       # Alias for: zap launch
zap o "API Docs"               # Short alias for: zap launch "API Docs"
```

### Properties

| Property | Required | Description                           |
| -------- | -------- | ------------------------------------- |
| `name`   | Yes      | Display name (max 100 characters)     |
| `url`    | Yes      | URL (supports `${VAR}` interpolation) |

---

## Notes

Top-level project notes you can print with `zap notes`.
The notes string supports `${VAR}` interpolation from your root `env` files.

### Configuration

```yaml
env: [.env]
notes: |
  Frontend: http://localhost:${FRONTEND_PORT}
  API: http://localhost:${API_PORT}
```

### Usage

```bash
zap notes                      # Print interpolated notes
zap notes --json               # JSON output
```

---

## Git Cloning

For multi-repo setups, Zapper can clone repositories.

### Configuration

```yaml
project: myapp
git_method: ssh # ssh | http | cli

native:
  api:
    cmd: pnpm dev
    cwd: ./api
    repo: myorg/api-service

  web:
    cmd: pnpm dev
    cwd: ./web
    repo: myorg/web-app
```

### Git methods

| Method | URL Format                          | Notes               |
| ------ | ----------------------------------- | ------------------- |
| `ssh`  | `git@github.com:myorg/repo.git`     | Requires SSH key    |
| `http` | `https://github.com/myorg/repo.git` | May prompt for auth |
| `cli`  | Uses `gh repo clone`                | Requires GitHub CLI |

### Cloning

```bash
zap clone                  # Clone all repos
zap clone api              # Clone one repo
zap clone api web          # Clone multiple repos
```

Repos are cloned to the path specified in `cwd`.

---

## Full Example

A complete example for a typical full-stack app:

```yaml
project: myapp
env: [.env.base, .env]
git_method: ssh

native:
  api:
    cmd: pnpm dev
    cwd: ./api
    repo: myorg/api
    env: .zap/env/api.yaml
    depends_on: [postgres, redis]

  worker:
    cmd: pnpm worker
    cwd: ./api
    env: .zap/env/worker.yaml
    depends_on: [api]

  frontend:
    cmd: pnpm dev
    cwd: ./web
    repo: myorg/web
    env: .zap/env/web.yaml
    depends_on: [api]

docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432
    env: .zap/env/postgres.yaml
    volumes:
      - /var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

tasks:
  db:migrate:
    desc: Run migrations
    env: .zap/env/database.yaml
    cmds:
      - pnpm --filter api prisma migrate dev

  db:seed:
    desc: Seed database
    env: .zap/env/database.yaml
    params:
      - name: count
        default: "10"
        desc: Number of seed records
    cmds:
      - "pnpm --filter api prisma db seed --count={{count}}"

  test:
    desc: Run tests with optional args
    env: .zap/env/database.yaml
    cmds:
      - "pnpm vitest {{REST}}"

  deploy:
    desc: Deploy to environment
    params:
      - name: env
        required: true
        desc: Target environment (staging, production)
    cmds:
      - "deploy.sh {{env}}"

  lint:
    cmds:
      - pnpm eslint . --fix
      - pnpm tsc --noEmit

homepage: http://localhost:5173
notes: "Docs: http://localhost:3000/docs"

links:
  - name: API Docs
    url: http://localhost:3000/docs
  - name: Storybook
    url: http://localhost:6006
```
