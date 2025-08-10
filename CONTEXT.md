Zapper is a lightweight dev environment runner that uses a single YAML file to define and launch your local development setup. It manages app processes, containers, and environment variables by delegating to tools you already use—like PM2 for process management, Docker for containers, and asdf for runtime versioning. With a simple zap.yaml file, you can define multiple services (e.g. frontend, backend, database), selectively pass env vars to each, and boot everything up with a single command: zap up. Under the hood, Zapper is implemented in Node.js for tight integration with PM2, and it shells out to Docker and other CLI tools to orchestrate the rest of the stack with minimal overhead.

Currently a WIP, we have basic start/stop of pm2 processes.

For running the program for testing purposes, create example projects like:

./examples/myproj/zap.yaml

Remember to `pnpm build` and link (its ususally already linked). Then cd into the example project and zap away.

Make sure to clean up after, stopping processes and deleting the relevant .zap folders.
