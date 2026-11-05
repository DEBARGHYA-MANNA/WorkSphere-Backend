const AppError = require('../utils/app-error');

function notFound(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
}

module.exports = notFound;
