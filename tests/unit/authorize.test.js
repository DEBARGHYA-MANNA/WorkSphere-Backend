const { authorizePermission, authorizeResource } = require('../../src/middlewares/authorize');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../../src/constants/permissions');

function runMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error || null)));
}

describe('Authorization middleware', () => {
  test('checks permissions against server-loaded organization membership, not request input', async () => {
    const req = { membership: { role: 'Viewer', status: 'active' }, body: { role: 'Owner' } };
    const allowed = await runMiddleware(authorizePermission(PERMISSIONS.TASK_READ), req);
    expect(allowed).toBeNull();

    const denied = await runMiddleware(authorizePermission(PERMISSIONS.TASK_UPDATE), req);
    expect(denied).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    const missingRole = await runMiddleware(authorizePermission(PERMISSIONS.ORGANIZATION_READ), { auth: { userId: 'user-id' } });
    expect(missingRole).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    const removedMembership = await runMiddleware(authorizePermission(PERMISSIONS.ORGANIZATION_READ), {
      membership: { role: 'Owner', status: 'removed' }
    });
    expect(removedMembership).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('resource authorization permits same-tenant resources with permission', async () => {
    const resource = { _id: 'task-1', organizationId: 'org-1', assigneeId: 'user-1' };
    const policy = jest.fn().mockResolvedValue(true);
    const req = {
      organization: { _id: 'org-1' },
      membership: { role: 'Member', userId: 'user-1', status: 'active' },
      params: { taskId: 'task-1' }
    };
    const middleware = authorizeResource({
      permission: PERMISSIONS.TASK_UPDATE,
      loadResource: jest.fn().mockResolvedValue(resource),
      isAllowed: policy
    });

    const error = await runMiddleware(middleware, req);
    expect(error).toBeNull();
    expect(req.resource).toBe(resource);
    expect(policy).toHaveBeenCalledWith({ resource, req, membership: req.membership });
  });

  test('resource authorization conceals cross-tenant resources and rejects resource policy failures', async () => {
    const resource = { _id: 'task-foreign', organizationId: 'other-org' };
    const policy = jest.fn().mockResolvedValue(true);
    const middleware = authorizeResource({ permission: PERMISSIONS.TASK_READ, loadResource: async () => resource, isAllowed: policy });
    const req = { organization: { _id: 'org-1' }, membership: { role: 'Member', status: 'active' } };

    const tenantError = await runMiddleware(middleware, req);
    expect(tenantError).toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
    expect(policy).not.toHaveBeenCalled();

    const policyDenied = authorizeResource({
      permission: PERMISSIONS.TASK_UPDATE,
      loadResource: async () => ({ _id: 'task-1', organizationId: 'org-1' }),
      isAllowed: async () => false
    });
    const denied = await runMiddleware(policyDenied, req);
    expect(denied).toMatchObject({ statusCode: 403, code: 'RESOURCE_FORBIDDEN' });
  });

  test('owner, admin, manager, member, and viewer have explicit least-privilege matrices', () => {
    expect(ROLE_PERMISSIONS.Owner).toEqual(expect.arrayContaining(Object.values(PERMISSIONS)));
    expect(ROLE_PERMISSIONS.Admin).not.toContain(PERMISSIONS.ORGANIZATION_DELETE);
    expect(ROLE_PERMISSIONS.Manager).toContain(PERMISSIONS.TASK_ASSIGN);
    expect(ROLE_PERMISSIONS.Member).toContain(PERMISSIONS.TASK_UPDATE);
    expect(ROLE_PERMISSIONS.Viewer).toContain(PERMISSIONS.TASK_READ);
    expect(ROLE_PERMISSIONS.Viewer).not.toContain(PERMISSIONS.TASK_UPDATE);
  });
});
