jest.mock('../../src/middlewares/authenticate', () => (req, res, next) => {
  req.auth = { userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', sessionId: 'test-session' };
  req.user = { _id: req.auth.userId, email: 'owner@example.com', emailVerified: true, status: 'active' };
  next();
});

jest.mock('../../src/middlewares/organization-access', () => {
  const middleware = (req, res, next) => {
    req.organization = { _id: req.params.organizationId, status: 'active' };
    req.membership = { userId: req.auth.userId, role: 'Owner', status: 'active' };
    next();
  };
  middleware.authorizeOrganizationPermission = () => (req, res, next) => next();
  return middleware;
});

jest.mock('../../src/modules/projects/project-access', () => () => (req, res, next) => {
  req.resource = { _id: req.params.projectId, organizationId: req.organization._id, visibility: 'organization' };
  next();
});

jest.mock('../../src/modules/tasks/task-access', () => ({
  authorizeCollection: () => (req, res, next) => next(),
  authorizeTask: () => (req, res, next) => {
    req.resource = { _id: req.params.taskId, organizationId: req.organization._id, projectId: req.params.projectId, title: 'Ship release' };
    next();
  }
}));

jest.mock('../../src/modules/comments/comment.service', () => ({
  list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn()
}));
jest.mock('../../src/modules/activities/activity.service', () => ({ list: jest.fn() }));

const request = require('supertest');
const app = require('../../src/app');
const commentService = require('../../src/modules/comments/comment.service');
const activityService = require('../../src/modules/activities/activity.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'cccccccccccccccccccccccc';
const TASK_ID = 'dddddddddddddddddddddddd';
const COMMENT_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';
const MENTION_ID = 'ffffffffffffffffffffffff';
const COMMENT_BASE = `/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/tasks/${TASK_ID}/comments`;

describe('Comments and activity API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates, retrieves, updates, and deletes comments with validated mentions', async () => {
    commentService.create.mockResolvedValue({ _id: COMMENT_ID, body: 'Please review' });
    const created = await request(app).post(COMMENT_BASE).send({ body: 'Please review', mentions: [MENTION_ID] });
    expect(created.status).toBe(201);
    expect(commentService.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: ORG_ID,
      actorId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      body: 'Please review',
      mentions: [MENTION_ID]
    }));

    commentService.list.mockResolvedValue({ comments: [{ _id: COMMENT_ID }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const listed = await request(app).get(`${COMMENT_BASE}?page=1`);
    expect(listed.status).toBe(200);
    expect(listed.body.data[0]._id).toBe(COMMENT_ID);

    commentService.update.mockResolvedValue({ _id: COMMENT_ID, body: 'Updated' });
    const updated = await request(app).patch(`${COMMENT_BASE}/${COMMENT_ID}`).send({ body: 'Updated' });
    expect(updated.status).toBe(200);
    expect(commentService.update).toHaveBeenCalledWith(expect.objectContaining({ commentId: COMMENT_ID, changes: { body: 'Updated' } }));

    commentService.remove.mockResolvedValue({ _id: COMMENT_ID, deletedAt: new Date() });
    const removed = await request(app).delete(`${COMMENT_BASE}/${COMMENT_ID}`);
    expect(removed.status).toBe(200);
    expect(commentService.remove).toHaveBeenCalledWith(expect.objectContaining({ commentId: COMMENT_ID }));
  });

  test('retrieves the project activity history', async () => {
    activityService.list.mockResolvedValue({ activities: [{ action: 'comment_created' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const response = await request(app).get(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/activity`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].action).toBe('comment_created');
    expect(activityService.list).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, expect.objectContaining({ page: 1, limit: 20 }));
  });
});
