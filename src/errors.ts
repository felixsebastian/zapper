export class ConfigFileNotFoundError extends Error {
  constructor(
    public configPath: string,
    message?: string,
  ) {
    super(message || `Config file not found: ${configPath}`);
    this.name = "ConfigFileNotFoundError";
  }
}

export class ConfigParseError extends Error {
  constructor(
    public configPath: string,
    public cause?: unknown,
    message?: string,
  ) {
    super(message || `Failed to parse config file: ${configPath}`);
    this.name = "ConfigParseError";
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public issues: string[],
    message?: string,
  ) {
    super(message || `Configuration validation failed: ${issues.join(", ")}`);
    this.name = "ConfigValidationError";
  }
}

export class ServiceNotFoundError extends Error {
  constructor(
    public serviceName: string,
    message?: string,
  ) {
    super(
      message ||
        `Service not found: ${serviceName}. Check service names or aliases`,
    );
    this.name = "ServiceNotFoundError";
  }
}

export class WhitelistReferenceError extends Error {
  constructor(
    public whitelistName: string,
    public entityType: string,
    public entityName: string,
    public availableWhitelists?: string[],
    message?: string,
  ) {
    super(
      message ||
        `${entityType} '${entityName}' references unknown whitelist '${whitelistName}'` +
          (availableWhitelists && availableWhitelists.length > 0
            ? `. Available whitelists: ${availableWhitelists.join(", ")}`
            : ""),
    );
    this.name = "WhitelistReferenceError";
  }
}

export class ContainerNotRunningError extends Error {
  constructor(
    public containerName: string,
    public dockerName?: string,
    message?: string,
  ) {
    super(
      message ||
        `Container not running: ${containerName}` +
          (dockerName ? ` (${dockerName})` : ""),
    );
    this.name = "ContainerNotRunningError";
  }
}

export class ContextNotLoadedError extends Error {
  constructor(message?: string) {
    super(message || "Context not loaded");
    this.name = "ContextNotLoadedError";
  }
}

export class GitOperationError extends Error {
  constructor(
    public operation: string,
    public repoPath?: string,
    message?: string,
  ) {
    super(
      message ||
        `Git ${operation} failed` + (repoPath ? ` for ${repoPath}` : ""),
    );
    this.name = "GitOperationError";
  }
}

// ANSI color codes
const colors = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
};

export function formatError(error: unknown, showStackTrace = false): string {
  const symbol = "✗";

  if (
    error instanceof ConfigFileNotFoundError ||
    error instanceof ConfigParseError ||
    error instanceof ConfigValidationError ||
    error instanceof ServiceNotFoundError ||
    error instanceof WhitelistReferenceError ||
    error instanceof ContainerNotRunningError ||
    error instanceof ContextNotLoadedError ||
    error instanceof GitOperationError
  ) {
    const errorType = error.name.replace(/Error$/, "");
    const message = error.message;

    let output = `${colors.red}${colors.bold}${symbol} ${errorType}${colors.reset}\n`;
    output += `${colors.dim}${message}${colors.reset}`;

    if (showStackTrace && error.stack) {
      output += `\n\n${colors.dim}${error.stack}${colors.reset}`;
    }

    return output;
  }

  // Unknown error type
  const errorName =
    error instanceof Error ? error.constructor.name : typeof error;
  const errorMessage = error instanceof Error ? error.message : String(error);

  let output = `${colors.red}${colors.bold}${symbol} Unexpected Error: ${errorName}${colors.reset}\n`;
  output += `${colors.dim}${errorMessage}${colors.reset}`;

  if (showStackTrace && error instanceof Error && error.stack) {
    output += `\n\n${colors.dim}${error.stack}${colors.reset}`;
  }

  return output;
}
