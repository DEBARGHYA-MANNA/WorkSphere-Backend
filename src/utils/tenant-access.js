const OrganizationMember = require('../modules/members/organization-member.model');

function organizationScopedFilter(organizationId, filter = {}) {
  if (!organizationId) throw new TypeError('organizationId is required to scope tenant data');
  return { ...filter, organizationId };
}

async function findActiveMembership({ organizationId, userId, MemberModel = OrganizationMember }) {
  return MemberModel.findOne(organizationScopedFilter(organizationId, { userId, status: 'active' }));
}

module.exports = { organizationScopedFilter, findActiveMembership };
