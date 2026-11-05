const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const { authorizeOrganizationPermission } = require('../../middlewares/organization-access');
const { PERMISSIONS } = require('../../constants/permissions');
const controller = require('./invitation.controller');
const validation = require('./invitation.validation');

const organizationRouter = express.Router({ mergeParams: true });
organizationRouter.get('/', authorizeOrganizationPermission(PERMISSIONS.INVITATION_READ), validate(validation.paginationSchema, 'query'), controller.list);
organizationRouter.post('/',
  authorizeOrganizationPermission(PERMISSIONS.MEMBER_INVITE),
  validate(validation.createInvitationSchema),
  controller.create
);
organizationRouter.delete('/:invitationId',
  authorizeOrganizationPermission(PERMISSIONS.INVITATION_REVOKE),
  validate(validation.invitationParamsSchema, 'params'),
  controller.revoke
);

const acceptanceRouter = express.Router();
acceptanceRouter.post('/accept', authenticate, validate(validation.acceptInvitationSchema), controller.accept);

module.exports = { organizationRouter, acceptanceRouter };
