const express = require('express');
const validate = require('../../middlewares/validate');
const projectAccess = require('../projects/project-access');
const { PERMISSIONS } = require('../../constants/permissions');
const controller = require('./analytics.controller');
const validation = require('./analytics.validation');

const organizationRouter = express.Router({ mergeParams: true });
organizationRouter.get('/',
  validate(validation.organizationParamsSchema, 'params'),
  validate(validation.querySchema, 'query'),
  controller.organization
);

const projectRouter = express.Router({ mergeParams: true });
projectRouter.get('/:projectId/analytics',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_READ),
  validate(validation.querySchema, 'query'),
  controller.project
);

module.exports = { organizationRouter, projectRouter };
