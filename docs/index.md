# Zapper

A lightweight dev environment runner for local multi-service projects.

## Install

```bash
npm install -g pm2 @mp-lb/zapper
```

## Create `zap.yaml`

```yaml
project: myapp
env: [.env]

native:
  backend:
    cmd: pnpm dev
    env: "*"

  frontend:
    cmd: pnpm dev
    cwd: ./frontend
    env: "*"

docker:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432
```

## Run

```bash
zap up
zap status
zap down
```

See the [full reference](usage.md) for every `zap.yaml` field and command.

For packaging and local machine runtime plans, see
[Local Runtime Compatibility](local-runtime.md).

For the local menu bar app development loop, see
[macOS Development](macos-development.md).
