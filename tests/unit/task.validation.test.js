const validation = require('../../src/modules/tasks/task.validation');

function validate(schema, value) {
  return schema.validate(value, { abortEarly: false, convert: true });
}

describe('Task validation', () => {
  test('requires a title and validates workflow, priority, and unique labels/dependencies', () => {
    expect(validate(validation.createTaskSchema, {}).error).toBeDefined();
    expect(validate(validation.createTaskSchema, { title: 'Do work', status: 'blocked' }).error).toBeDefined();
    expect(validate(validation.createTaskSchema, { title: 'Do work', priority: 'critical' }).error).toBeDefined();
    expect(validate(validation.createTaskSchema, { title: 'Do work', labels: ['ops', 'ops'] }).error).toBeDefined();
    expect(validate(validation.createTaskSchema, { title: 'Do work', dependencies: ['a'.repeat(24), 'a'.repeat(24)] }).error).toBeDefined();
    expect(validate(validation.createTaskSchema, { title: 'Do work', labels: [' ops '], priority: 'high' }).value.labels).toEqual(['ops']);
  });

  test('keeps assignment separate from create/update permissions and validates dates and filters', () => {
    expect(validate(validation.createTaskSchema, { title: 'Do work', assigneeId: 'a'.repeat(24) }).error).toBeDefined();
    expect(validate(validation.updateTaskSchema, { assigneeId: 'a'.repeat(24) }).error).toBeDefined();
    expect(validate(validation.taskAssignmentSchema, { assigneeId: null }).error).toBeUndefined();
    expect(validate(validation.taskStatusSchema, { status: 'done' }).error).toBeUndefined();
    expect(validate(validation.paginationSchema, { dueAfter: '2026-11-10', dueBefore: '2026-11-01' }).error).toBeDefined();
    expect(validate(validation.paginationSchema, { limit: '10', status: 'in_progress' }).value)
      .toMatchObject({ limit: 10, status: 'in_progress', page: 1, sort: 'updatedAt' });
  });
});
