const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const organizationParamsSchema = Joi.object({ organizationId: objectId.required() }).required();
const projectParamsSchema = Joi.object({
  organizationId: objectId.required(),
  projectId: objectId.required()
}).required();
const querySchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  granularity: Joi.string().valid('day', 'week', 'month').default('day')
}).custom((value, helpers) => {
  if (value.from && value.to && value.from > value.to) return helpers.error('date.range');
  return value;
}, 'analytics date range validation').messages({ 'date.range': 'from must be earlier than or equal to to' }).required();

module.exports = { organizationParamsSchema, projectParamsSchema, querySchema };
