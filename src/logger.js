import { config } from './config.js';

const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = logLevels[config.logLevel] || logLevels.info;

const formatLog = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data) return `${prefix} ${message} ${JSON.stringify(data)}`;
  return `${prefix} ${message}`;
};

export const logger = {
  error: (message, data) => currentLevel >= logLevels.error && console.error(formatLog('error', message, data)),
  warn: (message, data) => currentLevel >= logLevels.warn && console.warn(formatLog('warn', message, data)),
  info: (message, data) => currentLevel >= logLevels.info && console.log(formatLog('info', message, data)),
  debug: (message, data) => currentLevel >= logLevels.debug && console.log(formatLog('debug', message, data))
};
