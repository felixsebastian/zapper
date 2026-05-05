# Zapper for macOS

Native macOS menu bar app for the local Zapper system view.

The app uses a bundled Zapper CLI runtime and reads `zap system projects --json`.
It does not read `.zap` state or `zap.yaml` files directly.

The dashboard can start and stop whole instances or individual services. Project
home links come from `zap home --json` for each registered instance.

## Build

```bash
apps/macos/bin/build
```

The build script uses `swiftc` and creates:

```text
apps/macos/build/Zapper.app
```

No Xcode project is required for this first version.

By default the build also packages a local Node runtime, the built CLI from
`packages/cli/dist`, production CLI dependencies, and PM2 into
`Contents/Resources/ZapperRuntime`. Run `pnpm --filter @mp-lb/zapper build`
before building the app. Set `PACKAGE_ZAPPER_RUNTIME=0` to skip runtime
packaging for a development-only build.

Local builds use ad-hoc signing by default. To sign with a Developer ID
certificate already installed in your keychain, pass its identity explicitly:

```bash
CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
CODESIGN_OPTIONS=runtime \
apps/macos/bin/build
```

## Run

```bash
apps/macos/bin/run
```

Release builds prefer the bundled `zap` wrapper, which runs the bundled CLI with
the bundled Node runtime. If you need to test against an external CLI, set
`ZAPPER_CLI_PATH` before running the app, or use the terminal button in the app
to choose an executable.
