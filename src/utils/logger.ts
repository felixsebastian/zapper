export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  silent?: boolean;
  timestamp?: boolean;
}

const colors = {
  reset: "\u001B[0m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  white: "\u001B[37m",
};

const emoji = {
  error: "❌",
  warn: "⚠️",
  info: "🔹",
  debug: "🐞",
  success: "⚡️",
};

export class Logger {
  private level: LogLevel;
  private silent: boolean;
  private timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.silent = options.silent ?? false;
    this.timestamp = options.timestamp ?? false;
  }

  private prefix(): string {
    return this.timestamp ? `[${new Date().toISOString()}] ` : "";
  }

  private shouldLog(level: LogLevel): boolean {
    return !this.silent && level <= this.level;
  }

  private formatData(data?: unknown): string {
    if (data === undefined) return "";
    if (data instanceof Error) {
      const stack = data.stack ? `\n${data.stack}` : "";
      return ` ${data.name}: ${data.message}${stack}`;
    }
    try {
      return ` ${JSON.stringify(data)}`;
    } catch {
      return ` ${String(data)}`;
    }
  }

  private withEmojiPrefix(
    kind: "error" | "warn" | "info" | "debug" | "success",
    message: string,
  ): string {
    // Ensure single space between emoji and message
    return `${this.prefix()}${emoji[kind]} ${message}`;
  }

  error(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const msg = `${this.withEmojiPrefix("error", message)}${this.formatData(data)}`;
    (
      globalThis as { console?: { error: (msg: string) => void } }
    ).console?.error(`${colors.red}${msg}${colors.reset}`);
  }

  warn(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const msg = `${this.withEmojiPrefix("warn", message)}${this.formatData(data)}`;
    (globalThis as { console?: { warn: (msg: string) => void } }).console?.warn(
      `${colors.yellow}${msg}${colors.reset}`,
    );
  }

  info(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const msg = `${this.withEmojiPrefix("info", message)}${this.formatData(data)}`;
    (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
      `${colors.white}${msg}${colors.reset}`,
    );
  }

  debug(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const msg = `${this.withEmojiPrefix("debug", message)}${this.formatData(data)}`;
    (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
      msg,
    );
  }

  success(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const msg = `${this.withEmojiPrefix("success", message)}${this.formatData(data)}`;
    (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
      `${colors.green}${msg}${colors.reset}`,
    );
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  setTimestamp(timestamp: boolean): void {
    this.timestamp = timestamp;
  }
}

// Default logger instance
export const logger = new Logger();

// Create logger with specific options
export const createLogger = (options: LoggerOptions): Logger =>
  new Logger(options);
