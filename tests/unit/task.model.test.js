const Task = require('../../src/modules/tasks/task.model');

describe('Task model', () => {
  test('enforces task fields, nested relationships, and valid labels', async () => {
    const task = new Task({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      projectId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      createdBy: 'cccccccccccccccccccccccc',
      updatedBy: 'cccccccccccccccccccccccc',
      title: 'Task',
      priority: 'urgent',
      status: 'blocked',
      labels: ['build', 'build']
    });
    await expect(task.validate()).rejects.toMatchObject({
      errors: {
        status: expect.any(Object),
        labels: expect.any(Object)
      }
    });
    expect(task.priorityRank).toBe(4);
    expect(task.toJSON()).not.toHaveProperty('priorityRank');
  });

  test('rejects self-parent and self-dependency references', async () => {
    const id = 'dddddddddddddddddddddddd';
    const task = new Task({
      _id: id,
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      projectId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      createdBy: 'cccccccccccccccccccccccc',
      updatedBy: 'cccccccccccccccccccccccc',
      title: 'Task',
      parentTaskId: id,
      dependencies: [id]
    });
    await expect(task.validate()).rejects.toMatchObject({
      errors: {
        parentTaskId: expect.any(Object),
        dependencies: expect.any(Object)
      }
    });
  });
});
