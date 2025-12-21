# Zapper Usage

## Installation

```bash
npm install -g pm2 zapper-cli
```

For VS Code/Cursor, install the extension: `felixsebastian.zapper-vscode`

## Quick Start

Create a `zap.yaml` in your project root:

```yaml
project: myapp
env_files: [.env]

bare_metal:
  backend:
    cmd: pnpm dev
    env:
      - APP_ENV
      - PORT
      - DATABASE_URL

  frontend:
    cmd: pnpm dev
    cwd: ./frontend
    env:
      - APP_ENV
      - VITE_API_URL

docker:
  mongodb:
    image: mongo:latest
    ports:
      - 27017:27017
    volumes:
      - mongodb-data:/data/db

  redis:
    image: redis:latest
    ports:
      - 6379:6379

tasks:
  seed:
    env: [DATABASE_URL]
    cmds:
      - pnpm db:seed

  lint:
    cmds:
      - pnpm eslint . --fix
      - pnpm tsc --noEmit
```

Then run:

```bash
zap up        # start everything
zap status    # check what's running
zap down      # stop everything
zap task seed # run a task
```

## CLI Commands

```bash
zap up                    # Start all services
zap up --service backend  # Start specific service
zap down                  # Stop all services
zap restart               # Restart all services
zap status                # Show service status
zap logs --service api    # Follow logs for a service
zap task <name>           # Run a task
zap reset                 # Stop all and delete .zap folder
zap clone                 # Clone repos defined in config
```

## Environment Variables

Zapper uses a whitelist approach: you define where env vars live, then each service declares which ones it needs.

### Recommended pattern

Create two files in your project root:

- `.env.base` — non-secrets (ports, URLs), **committed** to git
- `.env` — secrets (API keys, passwords), **gitignored**

```yaml
env_files: [.env.base, .env]
```

### Whitelisting per service

Each service gets only the vars it explicitly lists:

```yaml
bare_metal:
  backend:
    cmd: pnpm dev
    env:
      - PORT
      - DATABASE_URL
      - JWT_SECRET

  frontend:
    cmd: pnpm dev
    env:
      - VITE_API_URL
```

The backend sees `PORT`, `DATABASE_URL`, and `JWT_SECRET`. The frontend only sees `VITE_API_URL`. No leakage.

### Inline overrides

You can override values inline for specific scenarios (e.g., test profiles):

```yaml
bare_metal:
  backend-test:
    profiles: [test]
    cmd: pnpm dev
    env:
      - PORT=8422
      - DATABASE_URL=mongodb://localhost:27017/test
```

## Tasks

Define common operations alongside your services:

```yaml
tasks:
  seed:
    desc: Seed the database
    env: [DATABASE_URL]
    cmds:
      - pnpm db:seed

  checks:
    desc: Run all checks before committing
    cmds:
      - pnpm eslint . --fix
      - pnpm tsc --noEmit
      - pnpm test
```

```bash
zap task seed
zap task checks
```

Tasks can access whitelisted env vars just like services.

## Docker Services

```yaml
docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432
    env:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=dev
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

## Git Cloning

For multi-repo setups, zapper can clone repos into your workspace:

```yaml
project: myapp
git_method: ssh  # or http, cli (GitHub CLI)

bare_metal:
  api:
    cmd: pnpm dev
    cwd: ./api
    repo: myorg/api-service

  web:
    cmd: pnpm dev
    cwd: ./web
    repo: myorg/web-app
```

```bash
zap clone              # clone all repos
zap clone --service api  # clone just one
```
