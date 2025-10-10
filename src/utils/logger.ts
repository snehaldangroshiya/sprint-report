// Unified logger - combines simplicity with essential features
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerOptions {
  level?: LogLevel;
  service?: string;
  enableConsole?: boolean;
}

export class Logger {
  private service?: string;
  private level: LogLevel;
  private enableConsole: boolean;

  constructor(optionsOrService?: LoggerOptions | string) {
    if (typeof optionsOrService === 'string') {
      this.service = optionsOrService;
      this.level = 'info';
      this.enableConsole = true;
    } else {
      if (optionsOrService?.service !== undefined) {
        this.service = optionsOrService.service;
      }
      this.level = optionsOrService?.level || 'info';
      this.enableConsole = optionsOrService?.enableConsole ?? true;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.level);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const servicePrefix = this.service ? `[${this.service}] ` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${servicePrefix}${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level) || !this.enableConsole) return;

    const formatted = this.formatMessage(level, message, data);

    // Always write to stderr for MCP stdio compatibility
    // stdout is reserved for JSON-RPC protocol messages
    process.stderr.write(formatted + '\n');
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  error(error: Error | string, operation?: string, data?: any): void {
    const errorMsg = error instanceof Error ? error.message : error;
    const fullMessage = operation ? `${operation}: ${errorMsg}` : errorMsg;
    this.log('error', fullMessage, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  // Alias for compatibility
  logError(error: Error, operation: string, data?: any): void {
    this.error(error, operation, data);
  }

  // Performance logging
  time(label: string): void {
    console.time(`${this.service ? `[${this.service}] ` : ''}${label}`);
  }

  timeEnd(label: string): void {
    console.timeEnd(`${this.service ? `[${this.service}] ` : ''}${label}`);
  }

  // Create child logger with additional context
  child(service: string): Logger {
    const childService = this.service ? `${this.service}:${service}` : service;
    return new Logger({
      service: childService,
      level: this.level,
      enableConsole: this.enableConsole,
    });
  }
}

// Factory function for easy creation
export function createLogger(
  service?: string,
  options?: Partial<LoggerOptions>
): Logger {
  const loggerOptions: LoggerOptions = {
    level: options?.level || 'info',
    enableConsole: options?.enableConsole ?? true,
  };
  if (service !== undefined) {
    loggerOptions.service = service;
  }
  return new Logger(loggerOptions);
}

// Default logger instance
export const defaultLogger = new Logger({
  service: 'NextReleaseMCP',
  level: 'info',
});

// Alias for compatibility
export type StructuredLogger = Logger;

// Factory function with config compatibility
export function getLogger(
  config?: LoggerOptions | { level: string; enableApiLogging: boolean }
): Logger {
  if (!config) {
    return defaultLogger;
  }

  // Handle different config formats
  if ('enableApiLogging' in config) {
    return new Logger({
      level: (config.level as LogLevel) || 'info',
      enableConsole: config.enableApiLogging,
    });
  }

  return new Logger(config);
}
