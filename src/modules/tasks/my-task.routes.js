const express = require('express');
const validate = require('../../middlewares/validate');
const { authorizeOrganizationPermission } = require('../../middlewares/organization-access');
const { PERMISSIONS } = require('../../constants/permissions');
const controller = require('./task.controller');
const validation = require('./task.validation');

const router = express.Router({ mergeParams: true });
router.get('/my',
  authorizeOrganizationPermission(PERMISSIONS.TASK_READ),
  validate(validation.paginationSchema, 'query'),
  controller.listMyTasks
);

module.exports = router;
