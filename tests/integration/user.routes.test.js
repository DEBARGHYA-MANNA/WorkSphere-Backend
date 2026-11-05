jest.mock('../../src/middlewares/authenticate', () => (req, res, next) => {
  req.auth = { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sessionId: 'test-session' };
  req.user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' };
  next();
});

jest.mock('../../src/modules/users/user.service', () => ({
  getProfile: jest.fn(),
  getUserById: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  deactivateAccount: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const userService = require('../../src/modules/users/user.service');

const user = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Avery Example',
  email: 'avery@example.com',
  emailVerified: true,
  status: 'active',
  toJSON() { return { _id: this._id, name: this.name, email: this.email, emailVerified: this.emailVerified, status: this.status }; }
};

describe('User management HTTP routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /users/me returns the authenticated user profile', async () => {
    userService.getProfile.mockResolvedValue(user);
    const response = await request(app).get('/api/v1/users/me');
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('avery@example.com');
    expect(userService.getProfile).toHaveBeenCalledWith(user._id);
  });

  test('profile updates reject protected and unknown fields', async () => {
    const response = await request(app).patch('/api/v1/users/me').send({ status: 'active', role: 'owner' });
    expect(response.status).toBe(400);
    expect(userService.updateProfile).not.toHaveBeenCalled();
  });

  test('profile email changes clear the refresh cookie and require verification', async () => {
    userService.updateProfile.mockResolvedValue({ user, emailVerificationRequired: true });
    const response = await request(app).patch('/api/v1/users/me').send({ email: 'avery.new@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.data.emailVerificationRequired).toBe(true);
    expect(response.headers['set-cookie'][0]).toMatch(/worksphereRefreshToken=;/);
    expect(userService.updateProfile).toHaveBeenCalledWith(user._id, { email: 'avery.new@example.com' });
  });

  test('password change validates fields and clears the refresh cookie', async () => {
    userService.changePassword.mockResolvedValue(user);
    const invalid = await request(app).patch('/api/v1/users/me/password').send({ newPassword: 'short' });
    expect(invalid.status).toBe(400);

    const response = await request(app).patch('/api/v1/users/me/password').send({
      currentPassword: 'Current-Password-123',
      newPassword: 'New-Password-Secure-456'
    });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/worksphereRefreshToken=;/);
  });

  test('account deactivation requires password confirmation', async () => {
    userService.deactivateAccount.mockResolvedValue(user);
    const response = await request(app).delete('/api/v1/users/me').send({ password: 'Current-Password-123' });
    expect(response.status).toBe(200);
    expect(userService.deactivateAccount).toHaveBeenCalledWith(user._id, { password: 'Current-Password-123' });
  });

  test('user id lookup is routed through the self-scoped service', async () => {
    userService.getUserById.mockResolvedValue(user);
    const response = await request(app).get(`/api/v1/users/${user._id}`);
    expect(response.status).toBe(200);
    expect(userService.getUserById).toHaveBeenCalledWith(user._id, user._id);

    const invalid = await request(app).get('/api/v1/users/not-an-object-id');
    expect(invalid.status).toBe(400);
  });
});
