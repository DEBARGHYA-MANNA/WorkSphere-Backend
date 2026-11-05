const Joi = require('joi');

const paramsSchema = Joi.object({
  organizationId: Joi.string().hex().length(24).required(),
  projectId: Joi.string().hex().length(24).required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  taskId: Joi.string().hex().length(24)
}).required();

module.exports = { paramsSchema, paginationSchema };
