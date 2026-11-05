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
  INVITATION_REVOKE: 'invitation:revoke'
});

const ownerPermissions = Object.values(PERMISSIONS);
const ROLE_PERMISSIONS = Object.freeze({
  Owner: Object.freeze(ownerPermissions),
  Admin: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.MEMBER_MANAGE_ROLES,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.INVITATION_REVOKE
  ]),
  Manager: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.INVITATION_READ,
    PERMISSIONS.INVITATION_REVOKE
  ]),
  Member: Object.freeze([PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBER_READ]),
  Viewer: Object.freeze([PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBER_READ])
});

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

function canAssignRole(actorRole, targetRole) {
  return targetRole !== 'Owner' && ROLE_RANK[targetRole] !== undefined && ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

function canManageMember(actorRole, targetRole) {
  return targetRole !== 'Owner' && ROLE_RANK[targetRole] !== undefined && ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

module.exports = { ROLE_RANK, ROLE_PERMISSIONS, PERMISSIONS, hasPermission, canAssignRole, canManageMember };
