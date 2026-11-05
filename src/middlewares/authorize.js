const AppError = require('../utils/app-error');
const asyncHandler = require('../utils/async-handler');
const { hasPermission } = require('../constants/permissions');
const { assertResourceOrganization } = require('../utils/tenant-access');

function authorizePermission(permission, { getRole = (req) => req.membership?.status === 'active' ? req.membership.role : undefined } = {}) {
  return (req, res, next) => {
    const role = getRole(req);
    if (!role || !hasPermission(role, permission)) {
      return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

function authorizeResource({ permission, loadResource, getOrganizationId = (req) => req.organization?._id, isAllowed }) {
  if (!permission) throw new TypeError('permission is required');
  if (typeof loadResource !== 'function') throw new TypeError('loadResource must be a function');
  return asyncHandler(async (req, res, next) => {
    if (!req.organization || req.membership?.status !== 'active') {
      throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }
    const resource = await loadResource(req);
    if (!resource) throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');

    assertResourceOrganization(
      resource.organizationId,
      getOrganizationId(req)
    );
    if (permission && !hasPermission(req.membership?.role, permission)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }
    if (isAllowed && !await isAllowed({ resource, req, membership: req.membership })) {
      throw new AppError('You do not have permission to access this resource', 403, 'RESOURCE_FORBIDDEN');
    }

    req.resource = resource;
    return next();
  });
}

module.exports = { authorizePermission, authorizeResource };
