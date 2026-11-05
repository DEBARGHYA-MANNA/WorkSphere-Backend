const express = require('express');
const validate = require('../../middlewares/validate');
const controller = require('./notification.controller');
const validation = require('./notification.validation');

const router = express.Router({ mergeParams: true });
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.get('/', validate(validation.paginationSchema, 'query'), controller.list);
router.patch('/:notificationId/read',
  validate(validation.notificationParamsSchema, 'params'),
  controller.markRead
);

module.exports = router;
