const Task = require('./task.model');
const ProjectMember = require('../projects/project-member.model');
const { authorizeResource } = require('../../middlewares/authorize');
const { hasPermission, PERMISSIONS } = require('../../constants/permissions');
const { organizationScopedFilter } = require('../../utils/tenant-access');
const asyncHandler = require('../../utils/async-handler');
const AppError = require('../../utils/app-error');

const PROJECT_TASK_PERMISSIONS = Object.freeze({
  Owner: Object.freeze(Object.values(PERMISSIONS).filter((permission) => permission.startsWith('task:') || [PERMISSIONS.COMMENT_CREATE, PERMISSIONS.COMMENT_DELETE].includes(permission))),
  Editor: Object.freeze([
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE
  ]),
  Viewer: Object.freeze([PERMISSIONS.TASK_READ])
});
const ORGANIZATION_WIDE_ROLES = new Set(['Owner', 'Admin', 'Manager']);

function createTaskAccess({ TaskModel = Task, ProjectMemberModel = ProjectMember } = {}) {
  async function getProjectMembership(req) {
    if (req.projectMembership !== undefined) return req.projectMembership;
    req.projectMembership = await ProjectMemberModel.findOne(organizationScopedFilter(req.organization._id, {
      projectId: req.params.projectId,
      userId: req.auth.userId,
      status: 'active'
    }));
    return req.projectMembership;
  }

  async function hasPermissionForTask(req, permission) {
    if ((req.project || req.resource)?.archivedAt && permission !== PERMISSIONS.TASK_READ) {
      throw new AppError('Archived projects are read-only until restored', 409, 'PROJECT_ARCHIVED');
    }
    const organizationRole = req.membership.role;
    if (ORGANIZATION_WIDE_ROLES.has(organizationRole)) return hasPermission(organizationRole, permission);
    const projectMembership = await getProjectMembership(req);
    if (projectMembership) return PROJECT_TASK_PERMISSIONS[projectMembership.role]?.includes(permission) || false;
    return hasPermission(organizationRole, permission);
  }

  function authorizeCollection(permission) {
    return asyncHandler(async (req, res, next) => {
      if (!await hasPermissionForTask(req, permission)) {
        throw new AppError('You do not have permission to perform this task action', 403, 'FORBIDDEN');
      }
      return next();
    });
  }

  function authorizeTask(permission) {
    return authorizeResource({
      permission,
      loadResource: (req) => TaskModel.findOne(organizationScopedFilter(req.organization._id, {
        projectId: req.params.projectId,
        _id: req.params.taskId
      })),
      permissionCheck: ({ req }) => hasPermissionForTask(req, permission)
    });
  }

  return { authorizeCollection, authorizeTask, hasPermissionForTask };
}

const taskAccess = createTaskAccess();
module.exports = taskAccess;
module.exports.createTaskAccess = createTaskAccess;
module.exports.PROJECT_TASK_PERMISSIONS = PROJECT_TASK_PERMISSIONS;
