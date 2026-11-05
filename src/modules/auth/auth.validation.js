const Joi = require('joi');

const password = Joi.string().min(12).max(72).custom((value, helpers) => {
  if (Buffer.byteLength(value, 'utf8') > 72) return helpers.error('string.max');
  return value;
}).required();
const email = Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required();
const oneTimeToken = Joi.string().trim().min(32).max(256).pattern(/^[A-Za-z0-9_-]+$/).required();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email,
  password
}).required();

const loginSchema = Joi.object({
  email,
  password: Joi.string().min(1).max(72).custom((value, helpers) => {
    if (Buffer.byteLength(value, 'utf8') > 72) return helpers.error('string.max');
    return value;
  }).required()
}).required();

const verifyEmailSchema = Joi.object({ token: oneTimeToken }).required();
const forgotPasswordSchema = Joi.object({ email }).required();
const resetPasswordSchema = Joi.object({ token: oneTimeToken, password }).required();

module.exports = { registerSchema, loginSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema };
