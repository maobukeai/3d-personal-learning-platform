/* eslint-disable no-console */
import { config } from '../config/env';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

const getLogLevel = (): number => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return config.NODE_ENV === 'production' ? LOG_LEVELS.warn : LOG_LEVELS.debug;
};

const formatMessage = (level: string, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
};

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (getLogLevel() <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message), ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (getLogLevel() <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message), ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (getLogLevel() <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (getLogLevel() <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message), ...args);
    }
  },
};
export default logger;
