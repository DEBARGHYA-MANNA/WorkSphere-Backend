const { randomUUID } = require('node:crypto');
const logger = require('../logger');

function requestContext(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });
  next();
}

module.exports = requestContext;
