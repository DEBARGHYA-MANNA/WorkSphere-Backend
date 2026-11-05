const express = require('express');
const validate = require('../../middlewares/validate');
const { PERMISSIONS } = require('../../constants/permissions');
const projectAccess = require('../projects/project-access');
const controller = require('./activity.controller');
const validation = require('./activity.validation');

const router = express.Router({ mergeParams: true });
router.get('/:projectId/activity',
  validate(validation.paramsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_READ),
  validate(validation.paginationSchema, 'query'),
  controller.list
);

module.exports = router;
