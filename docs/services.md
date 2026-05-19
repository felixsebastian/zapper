# Services

Zapper treats local processes and containers as peer services. Native services
run through PM2. Docker services run through Docker CLI.

## Native Processes

```yaml
native:
  api:
    cmd: pnpm dev
```

Full native process shape:

```yaml
native:
  api:
    cmd: pnpm dev
    aliases: [be, backend]
    cwd: ./backend
    env: "*"
    depends_on: [postgres]
    repo: myorg/api-repo
    healthcheck: 10
```

- `cmd` is required.
- `aliases` are alternate names accepted by service-targeting commands.
- `cwd` is relative to the project root.
- `env` controls env routing for the service.
- `depends_on` starts dependencies first.
- `repo` is used by `zap clone`.
- `healthcheck` can be a number of seconds or a URL to poll.

## Docker Services

```yaml
docker:
  redis:
    image: redis:latest
    ports:
      - 6379:6379
```

Full Docker service shape:

```yaml
docker:
  postgres:
    image: postgres:15
    aliases: [db, pg]
    ports:
      - 5432:5432
    env: .zap/env/postgres.yaml
    volumes:
      - /var/lib/postgresql/data
      - postgres-logs:/var/log/postgresql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks: [backend]
    command: postgres -c log_statement=all
    depends_on: [other]
    healthcheck: 10
```

- `image` is required.
- `ports` use `host:container` mappings and support `${VAR}` interpolation.
- `env` controls env routing for the container.
- `volumes` supports managed volumes, named volumes, and bind mounts.
- `networks` passes Docker network names.
- `command` overrides the image command.

## Environment Routing

Service `env` has three modes:

```yaml
env: "*"
```

Pass all values from the root env stack.

```yaml
env: [.env.common, .env.frontend, .env.frontend.user]
```

Use a service-specific env file stack instead of the root stack.

```yaml
env: .zap/env/api.yaml
```

Filter the root env stack through a strict whitelist file:

```yaml
vars:
  - DATABASE_URL
  - JWT_SECRET
```

Inline variable whitelists are not supported in `zap.yaml`. Arrays under
service `env` are file stacks.

## Dependencies

Use `depends_on` to control startup order:

```yaml
docker:
  postgres:
    image: postgres:15

native:
  api:
    cmd: pnpm dev
    depends_on: [postgres]
```

When you run `zap up api`, Zapper starts `postgres` before `api`.

`depends_on` affects start order only:

- `zap up` and `zap restart` start waves are dependency-aware.
- `zap down` stops targeted services in a single wave.
- `zap restart <service>` restarts only the targeted service, not its dependencies.

## Profiles

Profiles are top-level runtime selections. A profile can choose the env file
stack, the services that participate in the stack, and whether it gets an
isolated stack instance.

```yaml
profiles:
  default:
    env_files: [.env.local, .env]
    services: [api, postgres]
  e2e:
    env_files: [.env.local, .env.e2e, .env]
    services: [api, postgres, worker]
    isolate: true

native:
  api:
    cmd: pnpm dev

  worker:
    cmd: pnpm worker
```

```bash
zap up
zap profile use e2e
zap restart
zap profile reset
```

## Docker Volumes

Zapper supports Compose-style mounts plus a managed volume form.

```yaml
docker:
  postgres:
    image: postgres:15
    volumes:
      - /var/lib/postgresql/data
      - /var/lib/postgresql/wal:ro
      - postgres-logs:/var/log/postgresql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      - internal_dir: /var/lib/postgresql/wal
        mode: ro
      - name: postgres-config
        internal_dir: /etc/postgresql
```

When a volume entry is only a container path, or an object without `name`,
Zapper generates a Docker volume name and stores it under the selected instance
in `.zap/state.json`. Each instance gets its own generated volume for the same
service/path pair.

Explicit named volumes keep Compose-style behavior and are shared anywhere that
name is reused. Bind mounts such as `./init.sql:/container/path` are omitted
from `zap volume list`.

```bash
zap volume list postgres
zap volume list --managed postgres
zap volume list --managed --id-only postgres
zap volume prune
zap volume reset
```

`zap volume prune` deletes generated Docker volumes that are still in state but
no longer appear in `zap.yaml`. `zap volume reset` forgets generated assignments
without deleting Docker volumes.

## Common Docker Examples

```yaml
docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432
    env: .env.postgres
    volumes:
      - /var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379

  mongodb:
    image: mongo:7
    ports:
      - 27017:27017
    volumes:
      - /data/db
```
