const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const organizationAccess = require('../../middlewares/organization-access');
const { authorizeOrganizationPermission } = require('../../middlewares/organization-access');
const { PERMISSIONS } = require('../../constants/permissions');
const controller = require('./organization.controller');
const validation = require('./organization.validation');
const memberRoutes = require('../members/member.routes');
const { organizationRouter: invitationRoutes } = require('../invitations/invitation.routes');
const projectRoutes = require('../projects/project.routes');
const myTaskRoutes = require('../tasks/my-task.routes');
const notificationRoutes = require('../notifications/notification.routes');
const activityRoutes = require('../activities/activity.routes');
const analyticsRoutes = require('../analytics/analytics.routes');

const router = express.Router();
router.use(authenticate);
router.get('/', validate(validation.paginationSchema, 'query'), controller.list);
router.post('/', validate(validation.createOrganizationSchema), controller.create);

router.use('/:organizationId', validate(validation.paramsSchema, 'params'), organizationAccess);
router.get('/:organizationId', authorizeOrganizationPermission(PERMISSIONS.ORGANIZATION_READ), controller.get);
router.post('/:organizationId/switch', authorizeOrganizationPermission(PERMISSIONS.ORGANIZATION_READ), controller.switchContext);
router.patch('/:organizationId',
  authorizeOrganizationPermission(PERMISSIONS.ORGANIZATION_UPDATE),
  validate(validation.updateOrganizationSchema),
  controller.update
);
router.delete('/:organizationId', authorizeOrganizationPermission(PERMISSIONS.ORGANIZATION_DELETE), controller.remove);
router.use('/:organizationId/activity', authorizeOrganizationPermission(PERMISSIONS.ORGANIZATION_READ), activityRoutes.organizationRouter);
router.use('/:organizationId/analytics', authorizeOrganizationPermission(PERMISSIONS.ANALYTICS_READ), analyticsRoutes.organizationRouter);
router.use('/:organizationId/members', memberRoutes);
router.use('/:organizationId/invitations', invitationRoutes);
router.use('/:organizationId/projects', projectRoutes);
router.use('/:organizationId/tasks', myTaskRoutes);
router.use('/:organizationId/notifications', notificationRoutes);

module.exports = router;
