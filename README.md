# Zapper

A lightweight dev environment runner that uses a single YAML file to define and launch your local development setup. Zapper manages app processes, containers, and environment variables by delegating to tools you already use—like PM2 for process management, Docker for containers, and asdf for runtime versioning.

## Features

- **Simple Configuration**: Single `zap.yaml` file to define your entire dev stack
- **Process Management**: Uses PM2 for reliable process management with auto-restart
- **Container Support**: Full Docker integration for databases, caches, and services
- **Environment Variables**: Flexible env var management with interpolation
- **Service Dependencies**: Automatic dependency resolution and startup ordering
- **Health Monitoring**: Built-in health checks and status reporting

## Installation

```bash
# Install globally
npm install -g zapper-cli

# Or use with npx
npx zapper-cli
```

## Quick Start

1. Create a `zap.yaml` file in your project root:

```yaml
version: "1.0"
environment:
  NODE_ENV: development
  DATABASE_URL: postgresql://localhost:5432/myapp

services:
  frontend:
    name: frontend
    type: process
    script: npm run dev
    cwd: ./frontend
    env:
      PORT: 3000
      API_URL: http://localhost:8000
    depends_on:
      - api

  api:
    name: api
    type: process
    script: npm run dev
    cwd: ./api
    env:
      PORT: 8000
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      - database

  database:
    name: database
    type: container
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
```

2. Start your development environment:

```bash
# Start all services
zap up

# Start specific service
zap up --service api

# Check status
zap status

# View logs
zap logs --service api

# Stop all services
zap down
```

## Configuration

### Service Types

#### Process Services
Use PM2 to manage Node.js processes:

```yaml
api:
  name: api
  type: process
  script: npm run dev
  cwd: ./api
  instances: 2
  max_memory: 512M
  env:
    PORT: 8000
```

#### Container Services
Use Docker for databases, caches, and other services:

```yaml
database:
  name: database
  type: container
  image: postgres:15
  ports:
    - "5432:5432"
  environment:
    POSTGRES_DB: myapp
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

### Environment Variables

Global environment variables are available to all services:

```yaml
environment:
  NODE_ENV: development
  DATABASE_URL: postgresql://localhost:5432/myapp
```

Service-specific environment variables:

```yaml
services:
  api:
    env:
      PORT: 8000
      DATABASE_URL: ${DATABASE_URL}  # Interpolate global vars
```

### Dependencies

Services can depend on other services:

```yaml
frontend:
  depends_on:
    - api
    - database
```

## CLI Commands

```bash
zap up                    # Start all services
zap up --service api      # Start specific service
zap down                  # Stop all services
zap restart               # Restart all services
zap status                # Show service status
zap logs --service api    # Show service logs
zap logs --follow         # Follow logs
```

## Development

### Prerequisites

- Node.js 18+
- PM2 (`npm install -g pm2`)
- Docker (for container services)
- asdf (optional, for runtime versioning)

### Setup

```bash
# Clone and install dependencies
git clone <repository>
cd zapper
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Run in development
pnpm dev
```

### Project Structure

```
src/
├── config/           # Configuration parsing and validation
├── process/          # PM2 process management
├── containers/       # Docker container management
├── runtime/          # asdf runtime version management
├── cli/              # Command line interface
├── core/             # Main orchestrator
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run specific test file
pnpm test yaml-parser.test.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT 