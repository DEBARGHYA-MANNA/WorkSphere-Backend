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
  req.resource = { _id: req.params.projectId, organizationId: req.organization._id, name: 'Plan' };
  next();
});

jest.mock('../../src/modules/projects/project.service', () => ({
  list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), archive: jest.fn(), restore: jest.fn(),
  listMembers: jest.fn(), addMember: jest.fn(), updateMemberRole: jest.fn(), removeMember: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const projectService = require('../../src/modules/projects/project.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'cccccccccccccccccccccccc';
const USER_ID = 'dddddddddddddddddddddddd';

describe('Project API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates and lists projects under their organization with validated filters', async () => {
    const project = { _id: PROJECT_ID, name: 'Launch' };
    projectService.create.mockResolvedValue({ project, membership: { role: 'Owner' } });
    const created = await request(app).post(`/api/v1/organizations/${ORG_ID}/projects`).send({ name: 'Launch' });
    expect(created.status).toBe(201);
    expect(projectService.create).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', { name: 'Launch' });

    projectService.list.mockResolvedValue({ projects: [project], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const listed = await request(app).get(`/api/v1/organizations/${ORG_ID}/projects?status=active&page=1`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([project]);
    expect(projectService.list).toHaveBeenCalledWith(
      ORG_ID, 'Owner', 'bbbbbbbbbbbbbbbbbbbbbbbb', expect.objectContaining({ status: 'active', page: 1, limit: 20 })
    );
  });

  test('validates project identifiers and fields before calling mutation services', async () => {
    const badId = await request(app).get(`/api/v1/organizations/${ORG_ID}/projects/not-an-id`);
    expect(badId.status).toBe(400);
    const badBody = await request(app).patch(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}`).send({ status: 'unknown' });
    expect(badBody.status).toBe(400);
    expect(projectService.update).not.toHaveBeenCalled();
  });

  test('supports archive, restore, and project membership routes', async () => {
    projectService.archive.mockResolvedValue({ _id: PROJECT_ID, archivedAt: new Date() });
    const archived = await request(app).patch(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/archive`);
    expect(archived.status).toBe(200);
    expect(projectService.archive).toHaveBeenCalledWith(PROJECT_ID, ORG_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb');

    projectService.addMember.mockResolvedValue({ userId: USER_ID, role: 'Editor' });
    const added = await request(app).post(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/members/${USER_ID}`).send({ role: 'Editor' });
    expect(added.status).toBe(201);
    expect(projectService.addMember).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb', USER_ID, 'Editor');

    projectService.removeMember.mockResolvedValue({ userId: USER_ID, status: 'removed' });
    const removed = await request(app).delete(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/members/${USER_ID}`);
    expect(removed.status).toBe(200);
    expect(projectService.removeMember).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, USER_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb');
  });
});
