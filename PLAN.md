Zapper is a lightweight dev environment runner that uses a single YAML file to define and launch your local development setup. It manages app processes, containers, and environment variables by delegating to tools you already use—like PM2 for process management, Docker for containers, and asdf for runtime versioning. With a simple zap.yaml file, you can define multiple services (e.g. frontend, backend, database), selectively pass env vars to each, and boot everything up with a single command: zap up. Under the hood, Zapper is implemented in Node.js for tight integration with PM2, and it shells out to Docker and other CLI tools to orchestrate the rest of the stack with minimal overhead.

## Core Modules

### 1. Config Parser (`src/config/`)
- **YamlParser**: Parse zap.yaml files into structured config
- **ConfigValidator**: Validate config schema and required fields
- **EnvResolver**: Resolve environment variables and interpolate values

### 2. Process Manager (`src/process/`)
- **Pm2Manager**: Interface with PM2 for process management
- **ProcessOrchestrator**: Start/stop/restart services based on config
- **HealthChecker**: Monitor service health and status

### 3. Container Manager (`src/containers/`)
- **DockerManager**: Interface with Docker CLI for container operations
- **ContainerOrchestrator**: Manage container lifecycle (start/stop/restart)
- **NetworkManager**: Handle Docker network setup and service discovery

### 4. Runtime Manager (`src/runtime/`)
- **AsdfManager**: Interface with asdf for runtime version management
- **VersionResolver**: Resolve and switch runtime versions per service

### 5. CLI Interface (`src/cli/`)
- **CommandParser**: Parse CLI arguments and subcommands
- **OutputFormatter**: Format and display status/output
- **InteractivePrompts**: Handle user input for confirmations

### 6. Core Orchestrator (`src/core/`)
- **Zapper**: Main orchestrator that coordinates all modules
- **ServiceManager**: Manage service dependencies and startup order
- **StateManager**: Track and persist service states

## Test Cases

### Config Module Tests
- Parse valid YAML config files
- Reject invalid YAML syntax
- Validate required service fields
- Test environment variable interpolation
- Handle missing optional fields gracefully

### Process Module Tests
- Start PM2 processes with correct config
- Stop running processes
- Restart processes
- Handle PM2 connection errors
- Monitor process health status

### Container Module Tests
- Start Docker containers with proper config
- Stop running containers
- Handle Docker daemon not running
- Manage container networks
- Test container health checks

### Runtime Module Tests
- Switch asdf versions per service
- Handle missing runtime versions
- Install required versions automatically
- Validate version compatibility

### CLI Module Tests
- Parse valid command arguments
- Handle invalid commands gracefully
- Format output correctly
- Handle interactive prompts

### Integration Tests
- Full service startup sequence
- Service dependency resolution
- Error handling and recovery
- Concurrent service management
- Config hot-reloading