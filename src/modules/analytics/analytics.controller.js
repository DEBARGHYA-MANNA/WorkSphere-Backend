const analyticsService = require('./analytics.service');
const asyncHandler = require('../../utils/async-handler');

const organization = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.organization(req.organization._id, req.validated.query);
  res.status(200).json({ success: true, message: 'Organization analytics retrieved successfully', data: analytics, requestId: req.id });
});

const project = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.project(req.organization._id, req.resource._id, req.validated.query);
  res.status(200).json({ success: true, message: 'Project analytics retrieved successfully', data: analytics, requestId: req.id });
});

module.exports = { organization, project };
