const ROLE_RANK = Object.freeze({ Viewer: 0, Member: 1, Manager: 2, Admin: 3, Owner: 4 });

const PERMISSIONS = Object.freeze({
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_DELETE: 'organization:delete',
  MEMBER_READ: 'member:read',
  MEMBER_INVITE: 'member:invite',
  MEMBER_REMOVE: 'member:remove',
  MEMBER_MANAGE_ROLES: 'member:manage_roles',
  INVITATION_READ: 'invitation:read',
  INVITATION_REVOKE: 'invitation:revoke',
  PROJECT_CREATE: 'project:create',
  PROJECT_READ: 'project:read',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  TASK_CREATE: 'task:create',
  TASK_READ: 'task:read',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',
  COMMENT_CREATE: 'comment:create',
  COMMENT_DELETE: 'comment:delete'
});

const OWNER_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));
const ROLE_PERMISSIONS = Object.freeze({
  Owner: OWNER_PERMISSIONS,
  Admin: Object.freeze(OWNER_PERMISSIONS.filter((permission) => permission !== PERMISSIONS.ORGANIZATION_DELETE)),
  Manager: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.INVITATION_REVOKE,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE
  ]),
  Member: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE
  ]),
  Viewer: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.TASK_READ
  ])
});

function hasPermission(role, permission) {
  return Object.hasOwn(ROLE_PERMISSIONS, role) && ROLE_PERMISSIONS[role].includes(permission);
}

function canAssignRole(actorRole, targetRole) {
  return targetRole !== 'Owner' &&
    Object.hasOwn(ROLE_RANK, targetRole) &&
    Object.hasOwn(ROLE_RANK, actorRole) &&
    ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

function canManageMember(actorRole, targetRole) {
  return targetRole !== 'Owner' &&
    Object.hasOwn(ROLE_RANK, targetRole) &&
    Object.hasOwn(ROLE_RANK, actorRole) &&
    ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

module.exports = { ROLE_RANK, ROLE_PERMISSIONS, OWNER_PERMISSIONS, PERMISSIONS, hasPermission, canAssignRole, canManageMember };
