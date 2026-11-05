const Comment = require('../../src/modules/comments/comment.model');
const Activity = require('../../src/modules/activities/activity.model');
const Notification = require('../../src/modules/notifications/notification.model');

describe('Collaboration and notification models', () => {
  test('validates comments with mention references and task-scoped tenant fields', async () => {
    const comment = new Comment({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa', projectId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      taskId: 'cccccccccccccccccccccccc', authorId: 'dddddddddddddddddddddddd',
      body: 'Please review this'
    });
    await expect(comment.validate()).resolves.toBeUndefined();
    expect(comment.mentions).toEqual([]);
    expect(Comment.schema.indexes().some(([fields]) => fields.taskId === 1)).toBe(true);
  });

  test('validates activity event types and notification categories', async () => {
    const activity = new Activity({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa', projectId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      taskId: 'cccccccccccccccccccccccc', actorId: 'dddddddddddddddddddddddd',
      action: 'comment_created', targetType: 'comment', targetId: 'eeeeeeeeeeeeeeeeeeeeeeee'
    });
    await expect(activity.validate()).resolves.toBeUndefined();

    const notification = new Notification({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa', recipientId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      category: 'task_due_soon', title: 'Due soon', message: 'A task is due'
    });
    await expect(notification.validate()).resolves.toBeUndefined();
    expect(Notification.schema.indexes().some(([, options]) => options.unique && options.sparse)).toBe(true);

    const invalid = new Notification({
      organizationId: 'aaaaaaaaaaaaaaaaaaaaaaaa', recipientId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      category: 'unrecognized', title: 'x', message: 'x'
    });
    await expect(invalid.validate()).rejects.toMatchObject({ errors: { category: expect.any(Object) } });
  });
});
