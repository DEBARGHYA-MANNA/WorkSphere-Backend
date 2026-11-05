jest.mock('../../src/middlewares/authenticate', () => (req, res, next) => {
  req.auth = { userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', sessionId: 'test-session' };
  req.user = { _id: req.auth.userId, emailVerified: true, status: 'active' };
  next();
});

jest.mock('../../src/middlewares/organization-access', () => {
  const middleware = (req, res, next) => {
    req.organization = { _id: req.params.organizationId, status: 'active' };
    req.membership = { userId: req.auth.userId, role: 'Manager', status: 'active' };
    next();
  };
  middleware.authorizeOrganizationPermission = () => (req, res, next) => next();
  return middleware;
});

jest.mock('../../src/modules/projects/project-access', () => () => (req, res, next) => {
  req.resource = { _id: req.params.projectId, organizationId: req.organization._id, visibility: 'organization' };
  next();
});

jest.mock('../../src/modules/analytics/analytics.service', () => ({
  organization: jest.fn(), project: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const analyticsService = require('../../src/modules/analytics/analytics.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PROJECT_ID = 'cccccccccccccccccccccccc';

 describe('Analytics API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns organization statistics with date filters and selected trend granularity', async () => {
    analyticsService.organization.mockResolvedValue({ overview: { totalTasks: 12 }, productivity: [] });
    const response = await request(app).get(`/api/v1/organizations/${ORG_ID}/analytics?from=2026-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z&granularity=week`);
    expect(response.status).toBe(200);
    expect(analyticsService.organization).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      granularity: 'week'
    }));
  });

  test('returns project statistics and rejects invalid date ranges', async () => {
    analyticsService.project.mockResolvedValue({ scope: 'project' });
    const response = await request(app).get(`/api/v1/organizations/${ORG_ID}/projects/${PROJECT_ID}/analytics`);
    expect(response.status).toBe(200);
    expect(analyticsService.project).toHaveBeenCalledWith(ORG_ID, PROJECT_ID, expect.objectContaining({ granularity: 'day' }));

    const invalid = await request(app).get(`/api/v1/organizations/${ORG_ID}/analytics?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z`);
    expect(invalid.status).toBe(400);
    expect(analyticsService.organization).not.toHaveBeenCalled();
  });
});
