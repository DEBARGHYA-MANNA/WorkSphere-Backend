const Joi = require('joi');

const organizationId = Joi.string().hex().length(24).required();
const invitationParamsSchema = Joi.object({
  organizationId,
  invitationId: Joi.string().hex().length(24).required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).required();
const createInvitationSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  role: Joi.string().valid('Admin', 'Manager', 'Member', 'Viewer')
}).required();
const acceptInvitationSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).pattern(/^[A-Za-z0-9_-]+$/).required()
}).required();

module.exports = { invitationParamsSchema, paginationSchema, createInvitationSchema, acceptInvitationSchema };
