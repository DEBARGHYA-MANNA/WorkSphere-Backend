const mongoose = require('mongoose');
const Organization = require('../modules/organizations/organization.model');
const OrganizationMember = require('../modules/members/organization-member.model');
const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');
const { findActiveMembership } = require('../utils/tenant-access');
const { authorizePermission } = require('./authorize');

function createOrganizationAccess({ OrganizationModel = Organization, MemberModel = OrganizationMember } = {}) {
  return asyncHandler(async (req, res, next) => {
    const organizationId = req.params.organizationId;
    if (!mongoose.isValidObjectId(organizationId)) {
      throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }

    const membership = await findActiveMembership({
      organizationId,
      userId: req.auth.userId,
      MemberModel
    });
    if (!membership) throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');

    const organization = await OrganizationModel.findOne({ _id: organizationId, status: 'active' });
    if (!organization) throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');

    req.organization = organization;
    req.membership = membership;
    return next();
  });
}

const authorizeOrganizationPermission = authorizePermission;

module.exports = createOrganizationAccess();
module.exports.createOrganizationAccess = createOrganizationAccess;
module.exports.authorizeOrganizationPermission = authorizeOrganizationPermission;
