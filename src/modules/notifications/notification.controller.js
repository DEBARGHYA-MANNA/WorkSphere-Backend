const notificationService = require('./notification.service');
const asyncHandler = require('../../utils/async-handler');

const list = asyncHandler(async (req, res) => {
  const result = await notificationService.list(req.organization._id, req.auth.userId, req.validated.query);
  res.status(200).json({
    success: true,
    message: 'Notifications retrieved successfully',
    data: result.notifications,
    pagination: result.pagination,
    requestId: req.id
  });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.organization._id, req.auth.userId);
  res.status(200).json({ success: true, message: 'Unread notification count retrieved successfully', data: { count }, requestId: req.id });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(
    req.organization._id,
    req.auth.userId,
    req.validated.params.notificationId
  );
  res.status(200).json({ success: true, message: 'Notification marked as read', data: { notification }, requestId: req.id });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.organization._id, req.auth.userId);
  res.status(200).json({ success: true, message: 'Notifications marked as read', data: result, requestId: req.id });
});

module.exports = { list, unreadCount, markRead, markAllRead };
