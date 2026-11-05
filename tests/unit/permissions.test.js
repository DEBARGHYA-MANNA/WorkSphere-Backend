const { hasPermission, ROLE_PERMISSIONS, PERMISSIONS } = require('../../src/constants/permissions');

describe('Centralized RBAC permissions', () => {
  test('all defined roles have explicit permission sets', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(['Admin', 'Manager', 'Member', 'Owner', 'Viewer'].sort());
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  test('unknown roles and permissions are denied by default', () => {
    expect(hasPermission('Unknown', PERMISSIONS.ORGANIZATION_READ)).toBe(false);
    expect(hasPermission('Member', 'organization:delete')).toBe(false);
  });
});
