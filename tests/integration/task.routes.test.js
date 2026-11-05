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
    req.resource = { _id: req.params.taskId, organizationId: req.organization._id, projectId: req.params.projectId };
    next();
  }
}));

jest.mock('../../src/modules/tasks/task.service', () => ({
  create: jest.fn(), list: jest.fn(), listMyTasks: jest.fn(), listSubtasks: jest.fn(), update: jest.fn(),
  updateStatus: jest.fn(), assign: jest.fn(), remove: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/modules/tasks/task.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'cccccccccccccccccccccccc';
const TASK_ID = 'dddddddddddddddddddddddd';
const ASSIGNEE_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';
const BASE = `/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/tasks`;

describe('Task API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates and filters tasks within a project', async () => {
    const task = { _id: TASK_ID, title: 'Ship release' };
    taskService.create.mockResolvedValue(task);
    const created = await request(app).post(BASE).send({ title: 'Ship release', priority: 'high', labels: ['release'] });
    expect(created.status).toBe(201);
    expect(taskService.create).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb', {
      title: 'Ship release', priority: 'high', labels: ['release']
    });

    taskService.list.mockResolvedValue({ tasks: [task], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const listed = await request(app).get(`${BASE}?status=todo&priority=high&page=1`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([task]);
    expect(taskService.list).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, expect.objectContaining({ status: 'todo', priority: 'high' }));
  });

  test('updates, changes status, assigns, and deletes tasks through separate policy routes', async () => {
    taskService.update.mockResolvedValue({ _id: TASK_ID, title: 'Updated' });
    const updated = await request(app).patch(`${BASE}/${TASK_ID}`).send({ title: 'Updated' });
    expect(updated.status).toBe(200);
    expect(taskService.update).toHaveBeenCalledWith(expect.objectContaining({ _id: TASK_ID }), 'bbbbbbbbbbbbbbbbbbbbbbbb', { title: 'Updated' });

    taskService.updateStatus.mockResolvedValue({ _id: TASK_ID, status: 'done' });
    const status = await request(app).patch(`${BASE}/${TASK_ID}/status`).send({ status: 'done' });
    expect(status.status).toBe(200);
    expect(taskService.updateStatus).toHaveBeenCalledWith(expect.objectContaining({ _id: TASK_ID }), 'bbbbbbbbbbbbbbbbbbbbbbbb', 'done');

    taskService.assign.mockResolvedValue({ _id: TASK_ID, assigneeId: ASSIGNEE_ID });
    const assigned = await request(app).patch(`${BASE}/${TASK_ID}/assignee`).send({ assigneeId: ASSIGNEE_ID });
    expect(assigned.status).toBe(200);
    expect(taskService.assign).toHaveBeenCalledWith(expect.objectContaining({ _id: TASK_ID }), 'bbbbbbbbbbbbbbbbbbbbbbbb', ASSIGNEE_ID);

    taskService.remove.mockResolvedValue(undefined);
    const removed = await request(app).delete(`${BASE}/${TASK_ID}`);
    expect(removed.status).toBe(200);
    expect(taskService.remove).toHaveBeenCalledWith(expect.objectContaining({ _id: TASK_ID }), 'bbbbbbbbbbbbbbbbbbbbbbbb');
  });

  test('serves subtasks and organization-wide My Tasks; rejects assignment during task creation', async () => {
    taskService.listSubtasks.mockResolvedValue({ tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    const subtasks = await request(app).get(`${BASE}/${TASK_ID}/subtasks`);
    expect(subtasks.status).toBe(200);
    expect(taskService.listSubtasks).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, TASK_ID, expect.objectContaining({ page: 1 }));

    taskService.listMyTasks.mockResolvedValue({ tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    const mine = await request(app).get(`/api/v1/organizations/${ORG_ID}/tasks/my`);
    expect(mine.status).toBe(200);
    expect(taskService.listMyTasks).toHaveBeenCalledWith(ORG_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb', 'Owner', expect.objectContaining({ page: 1 }));

    const invalid = await request(app).post(BASE).send({ title: 'Ship release', assigneeId: ASSIGNEE_ID });
    expect(invalid.status).toBe(400);
    expect(taskService.create).not.toHaveBeenCalled();
  });
});
