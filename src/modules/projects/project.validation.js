const Joi = require('joi');

const organizationId = Joi.string().hex().length(24).required();
const projectId = Joi.string().hex().length(24).required();
const projectParamsSchema = Joi.object({ organizationId, projectId }).required();
const projectMemberParamsSchema = Joi.object({
  organizationId,
  projectId,
  userId: Joi.string().hex().length(24).required()
}).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().min(1).max(100),
  status: Joi.string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled'),
  visibility: Joi.string().valid('organization', 'private'),
  archived: Joi.boolean().default(false),
  dueAfter: Joi.date().iso(),
  dueBefore: Joi.date().iso(),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'dueDate').default('updatedAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
}).custom((value, helpers) => {
  if (value.dueAfter && value.dueBefore && value.dueAfter > value.dueBefore) return helpers.error('date.range');
  return value;
}).required();

const projectFields = {
  name: Joi.string().trim().min(2).max(160),
  description: Joi.string().trim().max(5000).allow(''),
  status: Joi.string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled'),
  visibility: Joi.string().valid('organization', 'private'),
  startDate: Joi.date().iso().allow(null),
  dueDate: Joi.date().iso().allow(null)
};

const createProjectSchema = Joi.object(projectFields).fork(Object.keys(projectFields), (schema) => schema.optional())
  .keys({ name: projectFields.name.required() }).custom((value, helpers) => {
    if (value.startDate && value.dueDate && value.startDate > value.dueDate) return helpers.error('date.range');
    return value;
  }).required();

const updateProjectSchema = Joi.object(projectFields).min(1).custom((value, helpers) => {
  if (value.startDate && value.dueDate && value.startDate > value.dueDate) return helpers.error('date.range');
  return value;
}).required();

const addProjectMemberSchema = Joi.object({ role: Joi.string().valid('Editor', 'Viewer').default('Editor') }).required();
const updateProjectMemberSchema = Joi.object({ role: Joi.string().valid('Editor', 'Viewer').required() }).required();
const memberPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).required();

module.exports = {
  projectParamsSchema,
  projectMemberParamsSchema,
  paginationSchema,
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberSchema,
  memberPaginationSchema
};
