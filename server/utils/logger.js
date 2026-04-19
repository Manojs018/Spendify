import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Use console logging by default
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file rotation only if not on Vercel and in production/other environments
if (!process.env.VERCEL && (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true')) {
  logger.add(new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '14d',
    maxSize: '20m',
    zippedArchive: true,
  }));
  
  logger.add(new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    zippedArchive: true,
  }));
}

// Keep the previous dev console logic as a fallback if needed, or refine it
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
  // Already added one console transport, so we can adjust it or leave it
}

export default logger;
