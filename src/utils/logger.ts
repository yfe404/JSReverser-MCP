/**
 * Logger utility
 */

import chalk from 'chalk';
import { safeStringify } from './safeJson.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;

  // Performance optimization - use static constant to avoid recreating the array
  private static readonly LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVELS.indexOf(level) >= Logger.LEVELS.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    // Use safeStringify to handle circular references and special objects
    const formattedArgs = args.length > 0 ? ' ' + safeStringify(args) : '';
    return `${prefix} ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // Use stderr to avoid interfering with MCP's stdout communication
      console.error(chalk.gray(this.formatMessage('debug', message, ...args)));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // Use stderr to avoid interfering with MCP's stdout communication
      console.error(chalk.blue(this.formatMessage('info', message, ...args)));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.error(chalk.yellow(this.formatMessage('warn', message, ...args)));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red(this.formatMessage('error', message, ...args)));
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // Use stderr to avoid interfering with MCP's stdout communication
      console.error(chalk.green(this.formatMessage('info', message, ...args)));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Safe environment variable parsing
function parseLogLevel(value: string | undefined): LogLevel {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (value && validLevels.includes(value as LogLevel)) {
    return value as LogLevel;
  }
  return 'info';
}

// Export singleton
export const logger = new Logger(parseLogLevel(process.env.LOG_LEVEL));

