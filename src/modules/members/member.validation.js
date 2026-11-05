const Joi = require('joi');

const organizationId = Joi.string().hex().length(24).required();
const paramsSchema = Joi.object({ organizationId }).required();
const memberParamsSchema = Joi.object({
  organizationId,
  memberId: Joi.string().hex().length(24).required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).required();
const updateRoleSchema = Joi.object({
  role: Joi.string().valid('Admin', 'Manager', 'Member', 'Viewer').required()
}).required();

module.exports = { paramsSchema, memberParamsSchema, paginationSchema, updateRoleSchema };
