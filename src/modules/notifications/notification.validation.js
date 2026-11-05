const Joi = require('joi');

const notificationParamsSchema = Joi.object({
  organizationId: Joi.string().hex().length(24).required(),
  notificationId: Joi.string().hex().length(24).required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().valid('mention', 'task_assigned', 'comment', 'task_due_soon', 'task_overdue', 'system'),
  unreadOnly: Joi.boolean().default(false)
}).required();

module.exports = { notificationParamsSchema, paginationSchema };
