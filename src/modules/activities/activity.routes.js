const express = require('express');
const validate = require('../../middlewares/validate');
const { PERMISSIONS } = require('../../constants/permissions');
const projectAccess = require('../projects/project-access');
const controller = require('./activity.controller');
const validation = require('./activity.validation');

const projectRouter = express.Router({ mergeParams: true });
projectRouter.get('/:projectId/activity',
  validate(validation.paramsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_READ),
  validate(validation.paginationSchema, 'query'),
  controller.list
);

const organizationRouter = express.Router({ mergeParams: true });
organizationRouter.get('/',
  validate(validation.organizationParamsSchema, 'params'),
  validate(validation.organizationPaginationSchema, 'query'),
  controller.listOrganization
);

module.exports = projectRouter;
module.exports.organizationRouter = organizationRouter;
