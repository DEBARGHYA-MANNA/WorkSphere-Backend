const express = require('express');
const validate = require('../../middlewares/validate');
const projectAccess = require('../projects/project-access');
const { PERMISSIONS } = require('../../constants/permissions');
const taskAccess = require('./task-access');
const controller = require('./task.controller');
const validation = require('./task.validation');
const commentRoutes = require('../comments/comment.routes');

const router = express.Router({ mergeParams: true });
router.use(validate(validation.projectTaskParamsSchema, 'params'));
router.use(projectAccess(PERMISSIONS.PROJECT_READ), (req, res, next) => {
  req.project = req.resource;
  return next();
});

router.get('/',
  taskAccess.authorizeCollection(PERMISSIONS.TASK_READ),
  validate(validation.paginationSchema, 'query'),
  controller.list
);
router.post('/',
  taskAccess.authorizeCollection(PERMISSIONS.TASK_CREATE),
  validate(validation.createTaskSchema),
  controller.create
);
router.get('/:taskId',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_READ),
  controller.get
);
router.patch('/:taskId',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_UPDATE),
  validate(validation.updateTaskSchema),
  controller.update
);
router.patch('/:taskId/status',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_UPDATE),
  validate(validation.taskStatusSchema),
  controller.updateStatus
);
router.patch('/:taskId/assignee',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_ASSIGN),
  validate(validation.taskAssignmentSchema),
  controller.assign
);
router.delete('/:taskId',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_DELETE),
  controller.remove
);
router.get('/:taskId/subtasks',
  validate(validation.taskParamsSchema, 'params'),
  taskAccess.authorizeTask(PERMISSIONS.TASK_READ),
  validate(validation.paginationSchema, 'query'),
  controller.listSubtasks
);
router.use('/:taskId/comments', commentRoutes);

module.exports = router;
