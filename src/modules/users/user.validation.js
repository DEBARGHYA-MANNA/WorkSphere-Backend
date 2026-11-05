const Joi = require('joi');

const password = Joi.string().min(12).max(72).custom((value, helpers) => {
  if (Buffer.byteLength(value, 'utf8') > 72) return helpers.error('string.max');
  return value;
});
const currentPassword = Joi.string().min(1).max(72).custom((value, helpers) => {
  if (Buffer.byteLength(value, 'utf8') > 72) return helpers.error('string.max');
  return value;
});
const email = Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254);
const timezone = Joi.string().trim().max(64).custom((value, helpers) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch (_error) {
    return helpers.error('any.invalid');
  }
});

const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email,
  bio: Joi.string().trim().max(500).allow(''),
  avatarUrl: Joi.string().uri({ scheme: ['https'] }).max(2048).allow(null),
  timezone
}).min(1).required();

const changePasswordSchema = Joi.object({
  currentPassword: currentPassword.required(),
  newPassword: password.required().invalid(Joi.ref('currentPassword'))
}).required();

const deactivateAccountSchema = Joi.object({ password: currentPassword.required() }).required();
const userIdParamsSchema = Joi.object({ userId: Joi.string().hex().length(24).required() }).required();

module.exports = { profileSchema, changePasswordSchema, deactivateAccountSchema, userIdParamsSchema };
