const express = require('express');
const validate = require('../../middlewares/validate');
const { authorizeOrganizationPermission } = require('../../middlewares/organization-access');
const { PERMISSIONS } = require('../../constants/permissions');
const controller = require('./member.controller');
const validation = require('./member.validation');

const router = express.Router({ mergeParams: true });
router.get('/', authorizeOrganizationPermission(PERMISSIONS.MEMBER_READ), validate(validation.paginationSchema, 'query'), controller.list);
router.patch('/:memberId/role',
  authorizeOrganizationPermission(PERMISSIONS.MEMBER_MANAGE_ROLES),
  validate(validation.memberParamsSchema, 'params'),
  validate(validation.updateRoleSchema),
  controller.updateRole
);
router.delete('/:memberId',
  authorizeOrganizationPermission(PERMISSIONS.MEMBER_REMOVE),
  validate(validation.memberParamsSchema, 'params'),
  controller.remove
);

module.exports = router;
