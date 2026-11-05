const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const developmentAccessSecret = 'local-development-secret-do-not-use-in-production';
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).default('mongodb://127.0.0.1:27017/worksphere'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  JWT_ACCESS_SECRET: Joi.string().min(32).default(developmentAccessSecret),
  ACCESS_TOKEN_TTL: Joi.string().pattern(/^[1-9][0-9]*[smhd]$/).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('lax')
}).unknown(true);

const { error, value } = schema.validate(process.env, { convert: true });
if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}
if (value.NODE_ENV === 'production' && (
  value.JWT_ACCESS_SECRET === developmentAccessSecret ||
  value.JWT_ACCESS_SECRET === 'replace-with-a-random-secret-at-least-32-characters-long'
)) {
  throw new Error('JWT_ACCESS_SECRET must be set to a unique secret in production');
}
if (value.COOKIE_SAME_SITE === 'none' && value.NODE_ENV !== 'production') {
  throw new Error('COOKIE_SAME_SITE=none requires production Secure cookies');
}

module.exports = Object.freeze({
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  mongoUri: value.MONGODB_URI,
  corsOrigins: value.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  logLevel: value.LOG_LEVEL,
  isProduction: value.NODE_ENV === 'production',
  accessTokenSecret: value.JWT_ACCESS_SECRET,
  accessTokenTtl: value.ACCESS_TOKEN_TTL,
  refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
  bcryptRounds: value.BCRYPT_ROUNDS,
  cookieSameSite: value.COOKIE_SAME_SITE
});
