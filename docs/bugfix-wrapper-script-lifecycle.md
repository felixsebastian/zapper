# Bug Fix: Wrapper Script Lifecycle Issue

## Problem

Users reported seeing repeated errors like:

```
/bin/bash: /path/to/.zap/project.service.1766369416975.sh: No such file or directory
```

This occurred when:
1. A service was started successfully
2. The service encountered errors during runtime
3. PM2 attempted to restart the service automatically

## Root Cause

The issue was in `Pm2Manager.startProcessWithTempEcosystem()`:

```typescript
try {
  await this.runPm2Command(["start", tempFile]);
} finally {
  try {
    unlinkSync(wrapperScript);  // ❌ Deleted immediately!
  } catch (e) {
    void e;
  }
}
```

**The wrapper script was deleted immediately after starting the process.** 

PM2 stores a reference to the script path and uses it for:
- Automatic restarts on crashes
- Manual restarts via `pm2 restart`
- Process recovery

When PM2 tried to restart the process, the script file was already gone, causing the error.

## Solution

### Changes Made

1. **Keep wrapper scripts alive** - Don't delete them immediately after starting
2. **Clean up old scripts** - Remove scripts when:
   - Starting a new instance (before creating the new script)
   - Stopping a process
   - Deleting a process

### Implementation

Added `cleanupWrapperScripts()` method:

```typescript
private static cleanupWrapperScripts(
  projectName: string,
  processName: string,
  configDir?: string,
): void {
  const zapDir = path.join(configDir || ".", ".zap");
  if (!existsSync(zapDir)) return;

  const scriptPattern = `${projectName}.${processName}.`;
  const files = readdirSync(zapDir);

  for (const file of files) {
    if (file.startsWith(scriptPattern) && file.endsWith(".sh")) {
      unlinkSync(path.join(zapDir, file));
    }
  }
}
```

Called in:
- `startProcessWithTempEcosystem()` - before creating new script
- `stopProcess()` - when stopping
- `deleteProcess()` - when deleting
- `deleteAllMatchingProcesses()` - when cleaning up

### Testing

Added comprehensive tests in `Pm2Manager.test.ts`:
- Verify scripts are kept after starting
- Verify old scripts are cleaned when starting new instance
- Verify scripts are cleaned when deleting process
- Verify only specific process scripts are cleaned

## Impact

- ✅ PM2 can now successfully restart processes
- ✅ No more "file not found" errors
- ✅ Scripts are automatically cleaned up
- ✅ No manual cleanup required

## Files Changed

- `src/core/process/Pm2Manager.ts`
- `src/core/process/Pm2Manager.test.ts` (new)
- `CHANGELOG.md`

