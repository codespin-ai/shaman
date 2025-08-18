/**
 * Logger module for the Shaman framework
 * Provides consistent logging interface across all packages
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

function formatMessage(
  level: string,
  message: string,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `\n${error.stack || error.message}`;
  }
  return `\n${String(error)}`;
}

export const logger: Logger = {
  debug(message: string, context?: LogContext): void {
    console.log(formatMessage("debug", message, context));
  },

  info(message: string, context?: LogContext): void {
    console.log(formatMessage("info", message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage("warn", message, context));
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    let errorMsg = "";
    if (error) {
      errorMsg = formatError(error);
    } else if (context && !error) {
      // If no error provided but context exists, don't append error formatting
      errorMsg = "";
    }
    console.error(formatMessage("error", message, context) + errorMsg);
  },
};

// Create scoped loggers for specific modules
export function createLogger(scope: string): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      logger.debug(`[${scope}] ${message}`, context);
    },
    info(message: string, context?: LogContext): void {
      logger.info(`[${scope}] ${message}`, context);
    },
    warn(message: string, context?: LogContext): void {
      logger.warn(`[${scope}] ${message}`, context);
    },
    error(message: string, error?: unknown, context?: LogContext): void {
      logger.error(`[${scope}] ${message}`, error, context);
    },
  };
}

// Default export for convenience
export default logger;
