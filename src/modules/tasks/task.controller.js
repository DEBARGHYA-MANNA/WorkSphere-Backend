const taskService = require('./task.service');
const asyncHandler = require('../../utils/async-handler');

const create = asyncHandler(async (req, res) => {
  const task = await taskService.create(
    req.organization._id,
    req.params.projectId,
    req.auth.userId,
    req.validated.body
  );
  res.status(201).json({ success: true, message: 'Task created successfully', data: { task }, requestId: req.id });
});

const list = asyncHandler(async (req, res) => {
  const result = await taskService.list(
    req.organization._id,
    req.params.projectId,
    req.validated.query
  );
  res.status(200).json({
    success: true,
    message: 'Tasks retrieved successfully',
    data: result.tasks,
    pagination: result.pagination,
    requestId: req.id
  });
});

const get = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Task retrieved successfully', data: { task: req.resource }, requestId: req.id });
});

const update = asyncHandler(async (req, res) => {
  const task = await taskService.update(req.resource, req.auth.userId, req.validated.body);
  res.status(200).json({ success: true, message: 'Task updated successfully', data: { task }, requestId: req.id });
});

const updateStatus = asyncHandler(async (req, res) => {
  const task = await taskService.updateStatus(req.resource, req.auth.userId, req.validated.body.status);
  res.status(200).json({ success: true, message: 'Task status updated successfully', data: { task }, requestId: req.id });
});

const assign = asyncHandler(async (req, res) => {
  const task = await taskService.assign(req.resource, req.auth.userId, req.validated.body.assigneeId);
  res.status(200).json({ success: true, message: 'Task assignment updated successfully', data: { task }, requestId: req.id });
});

const remove = asyncHandler(async (req, res) => {
  await taskService.remove(req.resource, req.auth.userId);
  res.status(200).json({ success: true, message: 'Task deleted successfully', data: null, requestId: req.id });
});

const listSubtasks = asyncHandler(async (req, res) => {
  const result = await taskService.listSubtasks(
    req.organization._id,
    req.params.projectId,
    req.resource._id,
    req.validated.query
  );
  res.status(200).json({
    success: true,
    message: 'Subtasks retrieved successfully',
    data: result.tasks,
    pagination: result.pagination,
    requestId: req.id
  });
});

const listMyTasks = asyncHandler(async (req, res) => {
  const result = await taskService.listMyTasks(
    req.organization._id,
    req.auth.userId,
    req.membership.role,
    req.validated.query
  );
  res.status(200).json({
    success: true,
    message: 'My tasks retrieved successfully',
    data: result.tasks,
    pagination: result.pagination,
    requestId: req.id
  });
});

module.exports = { create, list, get, update, updateStatus, assign, remove, listSubtasks, listMyTasks };
