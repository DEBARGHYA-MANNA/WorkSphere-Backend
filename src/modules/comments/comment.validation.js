const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const commentParamsSchema = Joi.object({
  organizationId: objectId.required(),
  projectId: objectId.required(),
  taskId: objectId.required(),
  commentId: objectId.required()
}).required();
const taskCommentParamsSchema = Joi.object({
  organizationId: objectId.required(),
  projectId: objectId.required(),
  taskId: objectId.required()
}).required();
const createCommentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(10000).required(),
  mentions: Joi.array().items(objectId).unique().max(20).default([])
}).required();
const updateCommentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(10000),
  mentions: Joi.array().items(objectId).unique().max(20)
}).min(1).required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
}).required();

module.exports = { commentParamsSchema, taskCommentParamsSchema, createCommentSchema, updateCommentSchema, paginationSchema };
