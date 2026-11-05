const Joi = require('joi');
const { ACTIONS, TARGET_TYPES } = require('./activity.constants');

const objectId = Joi.string().hex().length(24);
const paramsSchema = Joi.object({
  organizationId: objectId.required(),
  projectId: objectId.required()
}).required();
const organizationParamsSchema = Joi.object({
  organizationId: objectId.required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  taskId: objectId,
  actorId: objectId,
  action: Joi.string().valid(...ACTIONS),
  targetType: Joi.string().valid(...TARGET_TYPES),
  from: Joi.date().iso(),
  to: Joi.date().iso()
}).custom((value, helpers) => {
  if (value.from && value.to && value.from > value.to) {
    return helpers.error('date.range');
  }
  return value;
}, 'activity date range validation').messages({ 'date.range': 'from must be earlier than or equal to to' }).required();
const organizationPaginationSchema = paginationSchema.keys({ projectId: objectId });

module.exports = { paramsSchema, organizationParamsSchema, paginationSchema, organizationPaginationSchema };
