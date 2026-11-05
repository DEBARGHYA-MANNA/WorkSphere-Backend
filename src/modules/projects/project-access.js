const Project = require('./project.model');
const ProjectMember = require('./project-member.model');
const { authorizeResource } = require('../../middlewares/authorize');
const { hasPermission, PERMISSIONS } = require('../../constants/permissions');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const AppError = require('../../utils/app-error');

const PROJECT_ROLE_PERMISSIONS = Object.freeze({
  Owner: Object.freeze([
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_MANAGE_MEMBERS
  ]),
  Editor: Object.freeze([PERMISSIONS.PROJECT_READ, PERMISSIONS.PROJECT_UPDATE]),
  Viewer: Object.freeze([PERMISSIONS.PROJECT_READ])
});
const ORGANIZATION_WIDE_PROJECT_ACCESS = new Set(['Owner', 'Admin', 'Manager']);

function createProjectResourceAccess({ ProjectModel = Project, ProjectMemberModel = ProjectMember } = {}) {
  async function getProjectMember(req, project) {
    if (req.projectMembership !== undefined) return req.projectMembership;
    req.projectMembership = await ProjectMemberModel.findOne(organizationScopedFilter(req.organization._id, {
      projectId: project._id,
      userId: req.auth.userId,
      status: 'active'
    }));
    return req.projectMembership;
  }

  return function projectResourceAccess(permission) {
    return authorizeResource({
      permission,
      loadResource: (req) => ProjectModel.findOne(organizationScopedFilter(req.organization._id, {
        _id: req.params.projectId
      })),
      isAllowed: async ({ resource, req }) => {
        if (resource.visibility === 'organization' || ORGANIZATION_WIDE_PROJECT_ACCESS.has(req.membership.role)) return true;
        if (!await getProjectMember(req, resource)) {
          throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
        }
        return true;
      },
      permissionCheck: async ({ resource, req }) => {
        const requiredPermission = permission;
        if (hasPermission(req.membership.role, requiredPermission)) return true;
        const projectMember = await getProjectMember(req, resource);
        return PROJECT_ROLE_PERMISSIONS[projectMember?.role]?.includes(requiredPermission) || false;
      }
    });
  };
}

const projectResourceAccess = createProjectResourceAccess();
module.exports = projectResourceAccess;
module.exports.createProjectResourceAccess = createProjectResourceAccess;
module.exports.PROJECT_ROLE_PERMISSIONS = PROJECT_ROLE_PERMISSIONS;
