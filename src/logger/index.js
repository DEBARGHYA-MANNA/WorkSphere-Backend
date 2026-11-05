const winston = require('winston');
const env = require('../config/env');

const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;
    return JSON.stringify({ timestamp, level, message, ...metadata });
  })
);

module.exports = winston.createLogger({
  level: env.logLevel,
  format: structuredFormat,
  defaultMeta: { service: 'worksphere-backend' },
  transports: [new winston.transports.Console({
    format: env.isProduction ? structuredFormat : developmentFormat
  })]
});
