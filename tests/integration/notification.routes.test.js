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

jest.mock('../../src/modules/notifications/notification.service', () => ({
  list: jest.fn(), unreadCount: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const notificationService = require('../../src/modules/notifications/notification.service');

const ORG_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const NOTIFICATION_ID = 'cccccccccccccccccccccccc';

describe('Notification API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists only the signed-in user notifications with validated category filters', async () => {
    notificationService.list.mockResolvedValue({
      notifications: [{ _id: NOTIFICATION_ID, category: 'mention' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });
    const response = await request(app).get(`/api/v1/organizations/${ORG_ID}/notifications?category=mention&unreadOnly=true`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].category).toBe('mention');
    expect(notificationService.list).toHaveBeenCalledWith(ORG_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb', expect.objectContaining({
      category: 'mention', unreadOnly: true, page: 1, limit: 20
    }));
  });

  test('exposes unread counts and read/read-all actions', async () => {
    notificationService.unreadCount.mockResolvedValue(3);
    const count = await request(app).get(`/api/v1/organizations/${ORG_ID}/notifications/unread-count`);
    expect(count.status).toBe(200);
    expect(count.body.data.count).toBe(3);

    notificationService.markRead.mockResolvedValue({ _id: NOTIFICATION_ID, readAt: new Date() });
    const read = await request(app).patch(`/api/v1/organizations/${ORG_ID}/notifications/${NOTIFICATION_ID}/read`);
    expect(read.status).toBe(200);
    expect(notificationService.markRead).toHaveBeenCalledWith(ORG_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb', NOTIFICATION_ID);

    notificationService.markAllRead.mockResolvedValue({ modifiedCount: 3 });
    const all = await request(app).patch(`/api/v1/organizations/${ORG_ID}/notifications/read-all`);
    expect(all.status).toBe(200);
    expect(notificationService.markAllRead).toHaveBeenCalledWith(ORG_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb');
  });
});
