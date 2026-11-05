const logger = require('../logger');
const env = require('../config/env');

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details;

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload is too large';
  }

  if (statusCode >= 500) {
    logger.error('Request failed', { requestId: req.id, error: err.message, stack: err.stack });
    if (env.isProduction) {
      message = 'An unexpected error occurred';
      details = undefined;
    }
  } else {
    logger.warn('Request rejected', { requestId: req.id, code, statusCode });
  }

  if (res.headersSent) return next(err);
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, ...(details ? { details } : {}) },
    requestId: req.id
  });
}

module.exports = errorHandler;
