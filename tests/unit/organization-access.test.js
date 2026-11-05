const { createOrganizationAccess } = require('../../src/middlewares/organization-access');
const { organizationScopedFilter } = require('../../src/utils/tenant-access');
const { canAssignRole, canManageMember, hasPermission, PERMISSIONS } = require('../../src/constants/permissions');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_ORG_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cccccccccccccccccccccccc';

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error || null)));
}

describe('Organization tenant access and RBAC', () => {
  test('organization query scopes cannot be overridden by caller filters', () => {
    expect(organizationScopedFilter(ORG_ID, { organizationId: OTHER_ORG_ID, userId: USER_ID })).toEqual({
      organizationId: ORG_ID,
      userId: USER_ID
    });
    expect(() => organizationScopedFilter(null, {})).toThrow('organizationId is required');
  });

  test('a user with no membership cannot access an organization, even if it exists', async () => {
    const OrganizationModel = { findOne: jest.fn().mockResolvedValue({ _id: ORG_ID, status: 'active' }) };
    const MemberModel = { findOne: jest.fn().mockResolvedValue(null) };
    const middleware = createOrganizationAccess({ OrganizationModel, MemberModel });
    const req = { params: { organizationId: ORG_ID }, auth: { userId: USER_ID } };

    const error = await runMiddleware(middleware, req);
    expect(error).toMatchObject({ statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
    expect(MemberModel.findOne).toHaveBeenCalledWith({ organizationId: ORG_ID, userId: USER_ID, status: 'active' });
    expect(OrganizationModel.findOne).not.toHaveBeenCalled();
  });

  test('active membership grants only the requested organization context', async () => {
    const membership = { organizationId: ORG_ID, userId: USER_ID, role: 'Member', status: 'active' };
    const organization = { _id: ORG_ID, name: 'Acme', status: 'active' };
    const middleware = createOrganizationAccess({
      OrganizationModel: { findOne: jest.fn().mockResolvedValue(organization) },
      MemberModel: { findOne: jest.fn().mockResolvedValue(membership) }
    });
    const req = { params: { organizationId: ORG_ID }, auth: { userId: USER_ID } };

    const error = await runMiddleware(middleware, req);
    expect(error).toBeNull();
    expect(req.organization).toBe(organization);
    expect(req.membership).toBe(membership);
  });

  test('role permissions and assignment hierarchy prevent privilege escalation', () => {
    expect(hasPermission('Owner', PERMISSIONS.ORGANIZATION_DELETE)).toBe(true);
    expect(hasPermission('Admin', PERMISSIONS.ORGANIZATION_DELETE)).toBe(false);
    expect(hasPermission('Member', PERMISSIONS.MEMBER_MANAGE_ROLES)).toBe(false);
    expect(canAssignRole('Owner', 'Admin')).toBe(true);
    expect(canAssignRole('Admin', 'Manager')).toBe(true);
    expect(canAssignRole('Admin', 'Admin')).toBe(false);
    expect(canAssignRole('Manager', 'Admin')).toBe(false);
    expect(canAssignRole('Owner', 'Owner')).toBe(false);
    expect(canManageMember('Admin', 'Owner')).toBe(false);
    expect(canManageMember('Manager', 'Member')).toBe(true);
  });
});
