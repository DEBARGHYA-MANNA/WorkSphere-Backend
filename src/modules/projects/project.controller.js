const projectService = require('./project.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await projectService.list(
    req.organization._id,
    req.membership.role,
    req.auth.userId,
    req.validated.query
  );
  res.status(200).json({
    success: true,
    message: 'Projects retrieved successfully',
    data: result.projects,
    pagination: result.pagination,
    requestId: req.id
  });
});

const create = asyncHandler(async (req, res) => {
  const result = await projectService.create(req.organization._id, req.auth.userId, req.validated.body);
  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: result,
    requestId: req.id
  });
});

const get = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Project retrieved successfully',
    data: { project: req.resource },
    requestId: req.id
  });
});

const update = asyncHandler(async (req, res) => {
  const project = await projectService.update(req.resource, req.auth.userId, req.validated.body);
  res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    data: { project },
    requestId: req.id
  });
});

const remove = asyncHandler(async (req, res) => {
  await projectService.remove(req.resource, req.organization._id, req.auth.userId);
  res.status(200).json({ success: true, message: 'Project deleted successfully', data: null, requestId: req.id });
});

const archive = asyncHandler(async (req, res) => {
  const project = await projectService.archive(req.resource._id, req.organization._id, req.auth.userId);
  res.status(200).json({
    success: true,
    message: 'Project archived successfully',
    data: { project },
    requestId: req.id
  });
});

const restore = asyncHandler(async (req, res) => {
  const project = await projectService.restore(req.resource._id, req.organization._id, req.auth.userId);
  res.status(200).json({
    success: true,
    message: 'Project restored successfully',
    data: { project },
    requestId: req.id
  });
});

const listMembers = asyncHandler(async (req, res) => {
  const result = await projectService.listMembers(req.organization._id, req.resource._id, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Project members retrieved successfully',
    data: result.members,
    pagination: result.pagination,
    requestId: req.id
  });
});

const addMember = asyncHandler(async (req, res) => {
  const member = await projectService.addMember(
    req.organization._id,
    req.resource._id,
    req.auth.userId,
    req.validated.params.userId,
    req.validated.body.role
  );
  res.status(201).json({ success: true, message: 'Project member added successfully', data: { member }, requestId: req.id });
});

const updateMember = asyncHandler(async (req, res) => {
  const member = await projectService.updateMemberRole(
    req.organization._id,
    req.resource._id,
    req.validated.params.userId,
    req.validated.body.role,
    req.auth.userId
  );
  res.status(200).json({ success: true, message: 'Project member role updated successfully', data: { member }, requestId: req.id });
});

const removeMember = asyncHandler(async (req, res) => {
  const member = await projectService.removeMember(
    req.organization._id,
    req.resource._id,
    req.validated.params.userId,
    req.auth.userId
  );
  res.status(200).json({ success: true, message: 'Project member removed successfully', data: { member }, requestId: req.id });
});

module.exports = { list, create, get, update, remove, archive, restore, listMembers, addMember, updateMember, removeMember };
