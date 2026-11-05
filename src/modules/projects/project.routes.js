const express = require('express');
const validate = require('../../middlewares/validate');
const { authorizeOrganizationPermission } = require('../../middlewares/organization-access');
const { PERMISSIONS } = require('../../constants/permissions');
const projectAccess = require('./project-access');
const controller = require('./project.controller');
const validation = require('./project.validation');
const taskRoutes = require('../tasks/task.routes');
const activityRoutes = require('../activities/activity.routes');

const router = express.Router({ mergeParams: true });

router.get('/',
  authorizeOrganizationPermission(PERMISSIONS.PROJECT_READ),
  validate(validation.paginationSchema, 'query'),
  controller.list
);
router.post('/',
  authorizeOrganizationPermission(PERMISSIONS.PROJECT_CREATE),
  validate(validation.createProjectSchema),
  controller.create
);
router.get('/:projectId',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_READ),
  controller.get
);
router.patch('/:projectId',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_UPDATE),
  validate(validation.updateProjectSchema),
  controller.update
);
router.delete('/:projectId',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_DELETE),
  controller.remove
);
router.patch('/:projectId/archive',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_UPDATE),
  controller.archive
);
router.patch('/:projectId/restore',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_UPDATE),
  controller.restore
);
router.get('/:projectId/members',
  validate(validation.projectParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_READ),
  validate(validation.memberPaginationSchema, 'query'),
  controller.listMembers
);
router.post('/:projectId/members/:userId',
  validate(validation.projectMemberParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_MANAGE_MEMBERS),
  validate(validation.addProjectMemberSchema),
  controller.addMember
);
router.patch('/:projectId/members/:userId',
  validate(validation.projectMemberParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_MANAGE_MEMBERS),
  validate(validation.updateProjectMemberSchema),
  controller.updateMember
);
router.delete('/:projectId/members/:userId',
  validate(validation.projectMemberParamsSchema, 'params'),
  projectAccess(PERMISSIONS.PROJECT_MANAGE_MEMBERS),
  controller.removeMember
);
router.use('/:projectId/tasks', taskRoutes);
router.use(activityRoutes);

module.exports = router;
