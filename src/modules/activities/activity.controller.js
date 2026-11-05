const activityService = require('./activity.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await activityService.list(req.organization._id, req.resource._id, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Activity history retrieved successfully',
    data: result.activities,
    pagination: result.pagination,
    requestId: req.id
  });
});

module.exports = { list };
