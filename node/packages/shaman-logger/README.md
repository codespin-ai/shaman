# @codespin/shaman-logger

Logging utilities for the Shaman AI Agent Coordination Framework.

## Overview

This package provides a centralized logging interface for all Shaman packages. It ensures consistent log formatting and provides a foundation for future enhancements like log levels, structured logging, and external logging service integration.

## Installation

```bash
npm install @codespin/shaman-logger
```

## Usage

### Basic Usage

```typescript
import { logger } from "@codespin/shaman-logger";

// Simple logging
logger.info("Application started");
logger.debug("Processing request", { requestId: "123" });
logger.warn("Deprecated function called");
logger.error("Failed to connect", new Error("Connection timeout"));
```

### Scoped Loggers

Create loggers scoped to specific modules:

```typescript
import { createLogger } from "@codespin/shaman-logger";

const log = createLogger("AgentExecutor");

log.info("Executing agent", { agentName: "assistant" });
log.error("Agent execution failed", error);
```

## API

### Log Levels

- `debug`: Detailed information for debugging
- `info`: General informational messages
- `warn`: Warning messages for potentially harmful situations
- `error`: Error messages for failure scenarios

### Logger Interface

```typescript
interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
}
```

### Functions

- `logger`: Default logger instance
- `createLogger(scope: string)`: Create a scoped logger instance

## Log Format

Logs are formatted as:

```
[ISO-8601 timestamp] [LEVEL] [scope?] message {context?}
```

Example:

```
[2024-01-20T10:30:45.123Z] [INFO] [AgentExecutor] Executing agent {"agentName":"assistant"}
```

## Future Enhancements

- Configurable log levels
- Output to files or external services
- Structured logging formats (JSON)
- Performance metrics
- Integration with observability package
