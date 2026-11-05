const validation = require('../../src/modules/projects/project.validation');

function validate(schema, value) {
  return schema.validate(value, { abortEarly: false, convert: true });
}

describe('Project validation', () => {
  test('requires a project name and validates date order and allowed visibility', () => {
    expect(validate(validation.createProjectSchema, { description: 'A project' }).error).toBeDefined();
    expect(validate(validation.createProjectSchema, {
      name: 'Launch', startDate: '2026-11-10', dueDate: '2026-11-01'
    }).error).toBeDefined();
    expect(validate(validation.createProjectSchema, { name: 'Launch', visibility: 'public' }).error).toBeDefined();
    expect(validate(validation.createProjectSchema, { name: 'Launch' }).error).toBeUndefined();
  });

  test('validates pagination, supported filters, and date ranges', () => {
    expect(validate(validation.paginationSchema, { page: '2', limit: '10', archived: 'true' }).value)
      .toMatchObject({ page: 2, limit: 10, archived: true, sort: 'updatedAt', order: 'desc' });
    expect(validate(validation.paginationSchema, { page: '0' }).error).toBeDefined();
    expect(validate(validation.paginationSchema, { dueAfter: '2026-11-10', dueBefore: '2026-11-01' }).error).toBeDefined();
  });

  test('only permits Editor or Viewer as assignable project membership roles', () => {
    expect(validate(validation.addProjectMemberSchema, {}).value).toEqual({ role: 'Editor' });
    expect(validate(validation.addProjectMemberSchema, { role: 'Owner' }).error).toBeDefined();
    expect(validate(validation.updateProjectMemberSchema, { role: 'Viewer' }).error).toBeUndefined();
  });
});
