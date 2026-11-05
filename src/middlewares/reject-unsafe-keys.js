const AppError = require('../utils/app-error');

function containsUnsafeKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) =>
    key.startsWith('$') || key.includes('.') || containsUnsafeKey(nested)
  );
}

function rejectUnsafeKeys(req, res, next) {
  if (containsUnsafeKey(req.body) || containsUnsafeKey(req.query) || containsUnsafeKey(req.params)) {
    return next(new AppError('Request contains unsupported fields', 400, 'INVALID_REQUEST'));
  }
  return next();
}

module.exports = rejectUnsafeKeys;
