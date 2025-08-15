import winston from 'winston';
import path from 'path';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Custom format for console logging
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
});

// Create logger configuration
const createLoggerConfig = () => {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = process.env.LOG_FILE_PATH || './logs';
  
  // Ensure logs directory exists
  const logPath = path.resolve(logDir);
  
  const transports: winston.transport[] = [
    // Console transport with colors in development
    new winston.transports.Console({
      level: logLevel,
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        process.env.NODE_ENV === 'development' 
          ? combine(colorize(), consoleFormat)
          : json()
      )
    })
  ];

  // Add file transports in production
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      // Error log file
      new winston.transports.File({
        filename: path.join(logPath, 'error.log'),
        level: 'error',
        format: combine(
          errors({ stack: true }),
          timestamp(),
          json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10
      }),
      
      // Combined log file
      new winston.transports.File({
        filename: path.join(logPath, 'combined.log'),
        format: combine(
          timestamp(),
          json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10
      })
    );
  }

  return {
    level: logLevel,
    format: combine(
      timestamp(),
      errors({ stack: true }),
      json()
    ),
    transports,
    exitOnError: false
  };
};

// Create the main logger instance
export const createLogger = () => {
  const logger = winston.createLogger(createLoggerConfig());

  // Add custom methods for specific use cases
  return {
    ...logger,
    
    // Strategy-specific logging
    strategy: (message: string, strategyData?: any) => {
      logger.info(`[STRATEGY] ${message}`, { 
        module: 'strategy',
        data: strategyData 
      });
    },

    // AI Engine logging
    ai: (message: string, aiData?: any) => {
      logger.info(`[AI-ENGINE] ${message}`, { 
        module: 'ai-engine',
        data: aiData 
      });
    },

    // Execution layer logging
    execution: (message: string, executionData?: any) => {
      logger.info(`[EXECUTION] ${message}`, { 
        module: 'execution',
        data: executionData 
      });
    },

    // Monitoring logging
    monitoring: (message: string, monitoringData?: any) => {
      logger.info(`[MONITORING] ${message}`, { 
        module: 'monitoring',
        data: monitoringData 
      });
    },

    // Blockchain interaction logging
    blockchain: (message: string, blockchainData?: any) => {
      logger.info(`[BLOCKCHAIN] ${message}`, { 
        module: 'blockchain',
        data: blockchainData 
      });
    },

    // Performance logging
    performance: (operation: string, duration: number, metadata?: any) => {
      logger.info(`[PERFORMANCE] ${operation} completed in ${duration}ms`, {
        module: 'performance',
        operation,
        duration,
        metadata
      });
    },

    // Security logging
    security: (event: string, details?: any) => {
      logger.warn(`[SECURITY] ${event}`, {
        module: 'security',
        event,
        details,
        timestamp: new Date().toISOString()
      });
    },

    // API request logging
    request: (method: string, url: string, statusCode: number, duration: number, userId?: string) => {
      logger.info(`[REQUEST] ${method} ${url} - ${statusCode} (${duration}ms)`, {
        module: 'request',
        method,
        url,
        statusCode,
        duration,
        userId
      });
    }
  };
};

// Export a default logger instance
export const logger = createLogger();

// Error handler for uncaught exceptions
export const setupErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

export default logger;
