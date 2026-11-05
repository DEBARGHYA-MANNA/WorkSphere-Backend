const winston = require('winston');
const env = require('../config/env');

const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'worksphere-backend' },
  transports: [new winston.transports.Console({
    format: env.isProduction
      ? winston.format.combine(winston.format.timestamp(), winston.format.json())
      : winston.format.combine(winston.format.colorize(), winston.format.printf(({ timestamp, level, message, requestId }) =>
        `${timestamp} ${level}${requestId ? ` [${requestId}]` : ''}: ${message}`))
  })]
});

module.exports = logger;
