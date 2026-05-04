# Zapper for macOS

Native macOS menu bar app for the local Zapper system view.

The app shells out to the installed `zap` CLI and reads `zap system projects --json`.
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

## Run

```bash
apps/macos/bin/run
```

If the app cannot find `zap`, set `ZAPPER_CLI_PATH` to the CLI executable before
running it.
