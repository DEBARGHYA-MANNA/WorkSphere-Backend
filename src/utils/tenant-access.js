const OrganizationMember = require('../modules/members/organization-member.model');

const AppError = require('./app-error');

function organizationScopedFilter(organizationId, filter = {}) {
  if (!organizationId) throw new TypeError('organizationId is required to scope tenant data');
  return { ...filter, organizationId };
}

function assertResourceOrganization(resourceOrganizationId, authorizedOrganizationId) {
  const resourceId = resourceOrganizationId?._id || resourceOrganizationId;
  const authorizedId = authorizedOrganizationId?._id || authorizedOrganizationId;
  if (!resourceId || !authorizedId || String(resourceId) !== String(authorizedId)) {
    throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  }
}

async function findActiveMembership({ organizationId, userId, MemberModel = OrganizationMember }) {
  return MemberModel.findOne(organizationScopedFilter(organizationId, { userId, status: 'active' }));
}

module.exports = { organizationScopedFilter, assertResourceOrganization, findActiveMembership };
