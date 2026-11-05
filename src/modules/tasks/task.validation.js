const Joi = require('joi');

const organizationId = Joi.string().hex().length(24).required();
const projectId = Joi.string().hex().length(24).required();
const taskId = Joi.string().hex().length(24).required();
const taskParamsSchema = Joi.object({ organizationId, projectId, taskId }).required();
const projectTaskParamsSchema = Joi.object({ organizationId, projectId }).required();
const objectId = Joi.string().hex().length(24);

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().min(1).max(120),
  status: Joi.string().valid('todo', 'in_progress', 'in_review', 'done', 'cancelled'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  assigneeId: objectId,
  parentTaskId: objectId.allow(null),
  label: Joi.string().trim().min(1).max(40),
  dueAfter: Joi.date().iso(),
  dueBefore: Joi.date().iso(),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status').default('updatedAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
}).custom((value, helpers) => {
  if (value.dueAfter && value.dueBefore && value.dueAfter > value.dueBefore) return helpers.error('date.range');
  return value;
}).required();

const createTaskFields = {
  title: Joi.string().trim().min(2).max(180).required(),
  description: Joi.string().trim().max(10000).allow(''),
  status: Joi.string().valid('todo', 'in_progress', 'in_review', 'done', 'cancelled'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  dueDate: Joi.date().iso().allow(null),
  labels: Joi.array().items(Joi.string().trim().min(1).max(40)).max(20).unique(),
  parentTaskId: objectId.allow(null),
  dependencies: Joi.array().items(objectId).max(25).unique()
};

const createTaskSchema = Joi.object(createTaskFields).required();
const updateTaskSchema = Joi.object({
  title: createTaskFields.title.optional(),
  description: createTaskFields.description,
  status: createTaskFields.status,
  priority: createTaskFields.priority,
  dueDate: createTaskFields.dueDate,
  labels: createTaskFields.labels,
  parentTaskId: createTaskFields.parentTaskId,
  dependencies: createTaskFields.dependencies
}).min(1).required();
const taskAssignmentSchema = Joi.object({ assigneeId: objectId.allow(null).required() }).required();
const taskStatusSchema = Joi.object({ status: Joi.string().valid('todo', 'in_progress', 'in_review', 'done', 'cancelled').required() }).required();

module.exports = {
  taskParamsSchema,
  projectTaskParamsSchema,
  paginationSchema,
  createTaskSchema,
  updateTaskSchema,
  taskAssignmentSchema,
  taskStatusSchema
};
