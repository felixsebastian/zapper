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

export class Logger {
  private level: LogLevel;
  private silent: boolean;
  private timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.silent = options.silent ?? false;
    this.timestamp = options.timestamp ?? false;
  }

  private formatMessage(
    level: string,
    message: string,
    data?: unknown,
  ): string {
    const timestamp = this.timestamp ? `[${new Date().toISOString()}] ` : "";
    const levelStr = `[${level.toUpperCase()}] `;
    const dataStr = this.formatData(data);
    return `${timestamp}${levelStr}${message}${dataStr}`;
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

  error(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      (
        globalThis as { console?: { error: (msg: string) => void } }
      ).console?.error(this.formatMessage("ERROR", message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      (
        globalThis as { console?: { warn: (msg: string) => void } }
      ).console?.warn(this.formatMessage("WARN", message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const timestamp = this.timestamp ? `[${new Date().toISOString()}] ` : "";
      const dataStr = this.formatData(data);
      (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
        `${timestamp}${message}${dataStr}`,
      );
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
        this.formatMessage("DEBUG", message, data),
      );
    }
  }

  success(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      (globalThis as { console?: { log: (msg: string) => void } }).console?.log(
        `✅ ${this.formatMessage("SUCCESS", message, data)}`,
      );
    }
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
