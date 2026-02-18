import winston from 'winston';
import { env } from '../config/env';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => {
      const extraFields = Object.fromEntries(
        Object.entries(info).filter(
          ([key]) => !['timestamp', 'level', 'message', 'stack', 'splat', Symbol.for('level'), Symbol.for('message')].includes(key)
        )
      );

      // Filter out massive objects like ABIs to prevent console spam
      const filteredFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(extraFields)) {
        // Skip arrays with more than 50 items or objects with 'abi' in the key name
        if (key.toLowerCase().includes('abi') || key.toLowerCase().includes('args')) {
          filteredFields[key] = Array.isArray(value) ? `[Array: ${value.length} items]` : '[Hidden: too large]';
        } else if (Array.isArray(value) && value.length > 50) {
          filteredFields[key] = `[Array: ${value.length} items]`;
        } else {
          filteredFields[key] = value;
        }
      }

      const hasExtraFields = Object.keys(filteredFields).length > 0;

      return `${info.timestamp} [${info.level}]: ${info.message}${
        info.stack ? `\n${info.stack}` : ''
      }${
        hasExtraFields
          ? `\n${JSON.stringify(filteredFields, null, 2)}`
          : ''
      }`;
    }
  )
);

const transports: winston.transport[] = [
    new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
];

if (env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    })
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels,
  format,
  transports,
  exitOnError: false,
});

export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
