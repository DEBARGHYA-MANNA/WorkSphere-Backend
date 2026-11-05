const { createCommentService } = require('../../src/modules/comments/comment.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TASK_ID = 'cccccccccccccccccccccccc';
const AUTHOR_ID = 'dddddddddddddddddddddddd';
const MENTION_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';
const COMMENT_ID = 'ffffffffffffffffffffffff';

function query(value) {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  promise.session = () => promise;
  promise.sort = () => promise;
  promise.skip = () => promise;
  promise.limit = () => promise;
  promise.lean = () => promise;
  return promise;
}

function transaction(work) {
  return work({ id: 'comment-session' });
}

function setup({ visibility = 'organization', mentionRole = 'Member', projectMember = true } = {}) {
  const comments = [];
  class CommentModel {
    constructor(data) { Object.assign(this, data); this._id = COMMENT_ID; this.deletedAt ??= null; }
    async save(options) { this.session = options?.session; if (!comments.includes(this)) comments.push(this); return this; }
    static find(filter) {
      return query(comments.filter((comment) => comment.organizationId === filter.organizationId && comment.projectId === filter.projectId && comment.taskId === filter.taskId && comment.deletedAt === null));
    }
    static countDocuments(filter) {
      return Promise.resolve(comments.filter((comment) => comment.organizationId === filter.organizationId && comment.projectId === filter.projectId && comment.taskId === filter.taskId && comment.deletedAt === null).length);
    }
    static findOne(filter) {
      return query(comments.find((comment) => comment.organizationId === filter.organizationId && comment.projectId === filter.projectId && comment.taskId === filter.taskId && comment._id === filter._id && comment.deletedAt === null) || null);
    }
  }
  const OrganizationMemberModel = {
    find: jest.fn().mockImplementation((filter) => {
      const ids = filter.userId.$in || [];
      return query(ids.map((userId) => ({ userId, role: mentionRole })));
    })
  };
  const ProjectMemberModel = {
    find: jest.fn().mockImplementation((filter) => {
      const ids = filter.userId.$in || [];
      return query(projectMember ? ids.map((userId) => ({ userId })) : []);
    })
  };
  const ActivityService = { record: jest.fn().mockResolvedValue({}) };
  const NotificationService = { create: jest.fn().mockResolvedValue({}) };
  const service = createCommentService({
    CommentModel,
    OrganizationMemberModel,
    ProjectMemberModel,
    ActivityService,
    NotificationService,
    runInTransaction: transaction,
    clock: () => new Date('2026-11-05T00:00:00Z')
  });
  return {
    service, comments, CommentModel, OrganizationMemberModel, ProjectMemberModel,
    ActivityService, NotificationService,
    project: { _id: PROJECT_ID, visibility },
    task: { _id: TASK_ID, title: 'Ship release' }
  };
}

describe('Comment service', () => {
  test('creates comments, records activity, and notifies mentioned active members transactionally', async () => {
    const context = setup();
    const comment = await context.service.create({
      organizationId: ORG_ID,
      project: context.project,
      task: context.task,
      actorId: AUTHOR_ID,
      body: 'Please review this change',
      mentions: [MENTION_ID, AUTHOR_ID]
    });

    expect(comment).toMatchObject({ organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID, authorId: AUTHOR_ID });
    expect(comment.session).toEqual({ id: 'comment-session' });
    expect(context.ActivityService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'comment_created', targetId: COMMENT_ID }), { id: 'comment-session' });
    expect(context.NotificationService.create).toHaveBeenCalledTimes(1);
    expect(context.NotificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: MENTION_ID, category: 'mention', sourceId: COMMENT_ID, taskId: TASK_ID
    }), { id: 'comment-session' });
  });

  test('requires mentions to belong to the organization and private project', async () => {
    const organizationContext = setup();
    organizationContext.OrganizationMemberModel.find.mockImplementation(() => query([]));
    await expect(organizationContext.service.validateMentions(ORG_ID, organizationContext.project, [MENTION_ID]))
      .rejects.toMatchObject({ code: 'COMMENT_MENTION_MEMBER_NOT_FOUND' });

    const privateContext = setup({ visibility: 'private', projectMember: false });
    await expect(privateContext.service.validateMentions(ORG_ID, privateContext.project, [MENTION_ID]))
      .rejects.toMatchObject({ code: 'COMMENT_MENTION_MEMBER_NOT_FOUND' });
  });

  test('lists only undeleted comments and restricts edits to their author', async () => {
    const context = setup();
    context.comments.push({
      _id: COMMENT_ID, organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID,
      authorId: AUTHOR_ID, body: 'Old comment', mentions: [], deletedAt: null, save: jest.fn()
    });
    const list = await context.service.list(ORG_ID, PROJECT_ID, TASK_ID, { page: 1, limit: 10 });
    expect(list.comments).toHaveLength(1);
    await expect(context.service.update({
      organizationId: ORG_ID, project: context.project, task: context.task, commentId: COMMENT_ID,
      actorId: MENTION_ID, changes: { body: 'Edited' }
    })).rejects.toMatchObject({ code: 'COMMENT_EDIT_FORBIDDEN' });

    const edited = await context.service.update({
      organizationId: ORG_ID, project: context.project, task: context.task, commentId: COMMENT_ID,
      actorId: AUTHOR_ID, changes: { body: 'Edited', mentions: [MENTION_ID] }
    });
    expect(edited).toMatchObject({ body: 'Edited', editedAt: new Date('2026-11-05T00:00:00Z') });
    expect(context.ActivityService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'comment_updated' }), { id: 'comment-session' });
  });

  test('soft deletes comments for the author and records the tombstone activity', async () => {
    const context = setup();
    context.comments.push({
      _id: COMMENT_ID, organizationId: ORG_ID, projectId: PROJECT_ID, taskId: TASK_ID,
      authorId: AUTHOR_ID, body: 'Remove me', mentions: [], deletedAt: null, save: jest.fn()
    });
    await expect(context.service.remove({
      organizationId: ORG_ID, project: context.project, task: context.task, commentId: COMMENT_ID,
      actorId: MENTION_ID, organizationRole: 'Member'
    })).rejects.toMatchObject({ code: 'COMMENT_DELETE_FORBIDDEN' });

    const deleted = await context.service.remove({
      organizationId: ORG_ID, project: context.project, task: context.task, commentId: COMMENT_ID,
      actorId: AUTHOR_ID, organizationRole: 'Member'
    });
    expect(deleted.deletedAt).toEqual(new Date('2026-11-05T00:00:00Z'));
    expect(deleted.deletedBy).toBe(AUTHOR_ID);
    expect(context.ActivityService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'comment_deleted' }), { id: 'comment-session' });
  });
});
