const commentService = require('./comment.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await commentService.list(
    req.organization._id,
    req.params.projectId,
    req.params.taskId,
    req.validated.query
  );
  res.status(200).json({
    success: true,
    message: 'Comments retrieved successfully',
    data: result.comments,
    pagination: result.pagination,
    requestId: req.id
  });
});

const create = asyncHandler(async (req, res) => {
  const comment = await commentService.create({
    organizationId: req.organization._id,
    project: req.project,
    task: req.resource,
    actorId: req.auth.userId,
    ...req.validated.body
  });
  res.status(201).json({ success: true, message: 'Comment created successfully', data: { comment }, requestId: req.id });
});

const update = asyncHandler(async (req, res) => {
  const comment = await commentService.update({
    organizationId: req.organization._id,
    project: req.project,
    task: req.resource,
    commentId: req.validated.params.commentId,
    actorId: req.auth.userId,
    changes: req.validated.body
  });
  res.status(200).json({ success: true, message: 'Comment updated successfully', data: { comment }, requestId: req.id });
});

const remove = asyncHandler(async (req, res) => {
  const comment = await commentService.remove({
    organizationId: req.organization._id,
    project: req.project,
    task: req.resource,
    commentId: req.validated.params.commentId,
    actorId: req.auth.userId,
    organizationRole: req.membership.role,
    projectRole: req.projectMembership?.role
  });
  res.status(200).json({ success: true, message: 'Comment deleted successfully', data: { comment }, requestId: req.id });
});

module.exports = { list, create, update, remove };
