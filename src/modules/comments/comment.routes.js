const express = require('express');
const validate = require('../../middlewares/validate');
const { PERMISSIONS } = require('../../constants/permissions');
const taskAccess = require('../tasks/task-access');
const controller = require('./comment.controller');
const validation = require('./comment.validation');

const router = express.Router({ mergeParams: true });
router.use(
  validate(validation.taskCommentParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_READ)
);

router.get('/', validate(validation.paginationSchema, 'query'), controller.list);
router.post('/',
  taskAccess.authorizeTask(PERMISSIONS.COMMENT_CREATE),
  validate(validation.createCommentSchema),
  controller.create
);
router.patch('/:commentId',
  validate(validation.commentParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.COMMENT_CREATE),
  validate(validation.updateCommentSchema),
  controller.update
);
router.delete('/:commentId',
  validate(validation.commentParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.COMMENT_DELETE),
  controller.remove
);

module.exports = router;
