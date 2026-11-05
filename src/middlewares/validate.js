const AppError = require('../utils/app-error');

function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      convert: true,
      stripUnknown: false
    });

    if (error) {
      return next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', error.details.map(({ message, path, type }) => ({
        message: message.replace(/"/g, ''),
        field: path.join('.'),
        type
      }))));
    }

    req.validated = { ...(req.validated || {}), [property]: value };
    return next();
  };
}

module.exports = validate;
