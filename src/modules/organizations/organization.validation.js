const Joi = require('joi');

const organizationId = Joi.string().hex().length(24).required();
const paramsSchema = Joi.object({ organizationId }).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).required();
const settingsSchema = Joi.object({
  allowMemberInvites: Joi.boolean(),
  defaultMemberRole: Joi.string().valid('Member', 'Viewer')
}).min(1);

const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(2000).allow(''),
  settings: settingsSchema
}).required();

const updateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(2000).allow(''),
  settings: settingsSchema
}).min(1).required();

module.exports = { paramsSchema, paginationSchema, createOrganizationSchema, updateOrganizationSchema };
