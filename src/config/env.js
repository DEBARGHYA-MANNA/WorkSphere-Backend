const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const developmentAccessSecret = 'local-development-secret-do-not-use-in-production';
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).default('mongodb://127.0.0.1:27017/worksphere'),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(10000),
  MONGODB_SOCKET_TIMEOUT_MS: Joi.number().integer().min(0).max(300000).default(45000),
  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(200).default(20),
  MONGODB_MIN_POOL_SIZE: Joi.number().integer().min(0).max(100).default(0),
  MONGOOSE_AUTO_INDEX: Joi.boolean(),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  JWT_ACCESS_SECRET: Joi.string().min(32).default(developmentAccessSecret),
  EMAIL_VERIFICATION_ENABLED: Joi.boolean().default(false),
  ACCESS_TOKEN_TTL: Joi.string().pattern(/^[1-9][0-9]*[smhd]$/).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('lax'),
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(10000),
  REQUEST_TIMEOUT_MS: Joi.number().integer().min(66000).max(300000).default(120000)
}).unknown(true);

const { error, value } = schema.validate(process.env, { convert: true });
if (error) throw new Error(`Invalid environment configuration: ${error.message}`);

if (value.NODE_ENV === 'production') {
  if (
    !process.env.JWT_ACCESS_SECRET ||
    value.JWT_ACCESS_SECRET === developmentAccessSecret ||
    value.JWT_ACCESS_SECRET === 'replace-with-a-random-secret-at-least-32-characters-long' ||
    /^(change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example)/i.test(value.JWT_ACCESS_SECRET)
  ) {
    throw new Error('JWT_ACCESS_SECRET must be explicitly set to a unique secret in production');
  }
  const configuredOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!configuredOrigins.length || configuredOrigins.includes('*')) {
    throw new Error('CORS_ORIGIN must explicitly list allowed production origins; wildcard origins are not supported');
  }
  if (/localhost|127\.0\.0\.1/i.test(value.MONGODB_URI)) {
    throw new Error('MONGODB_URI must use a managed or network-accessible database in production');
  }
}
if (value.COOKIE_SAME_SITE === 'none' && value.NODE_ENV !== 'production') {
  throw new Error('COOKIE_SAME_SITE=none requires production Secure cookies');
}

module.exports = Object.freeze({
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  mongoUri: value.MONGODB_URI,
  mongoServerSelectionTimeoutMs: value.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  mongoSocketTimeoutMs: value.MONGODB_SOCKET_TIMEOUT_MS,
  mongoMaxPoolSize: value.MONGODB_MAX_POOL_SIZE,
  mongoMinPoolSize: value.MONGODB_MIN_POOL_SIZE,
  mongooseAutoIndex: value.MONGOOSE_AUTO_INDEX ?? value.NODE_ENV !== 'production',
  corsOrigins: value.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxyHops: value.TRUST_PROXY_HOPS,
  logLevel: value.LOG_LEVEL,
  isProduction: value.NODE_ENV === 'production',
  accessTokenSecret: value.JWT_ACCESS_SECRET,
  emailVerificationEnabled: value.EMAIL_VERIFICATION_ENABLED,
  accessTokenTtl: value.ACCESS_TOKEN_TTL,
  refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
  bcryptRounds: value.BCRYPT_ROUNDS,
  cookieSameSite: value.COOKIE_SAME_SITE,
  shutdownTimeoutMs: value.SHUTDOWN_TIMEOUT_MS,
  requestTimeoutMs: value.REQUEST_TIMEOUT_MS
});
