jest.mock('../../src/modules/auth/auth.service', () => ({
  register: jest.fn(),
  login: jest.fn(),
  resendVerification: jest.fn(),
  verifyEmail: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/auth.service');

const publicUser = {
  _id: 'user-123',
  name: 'Avery Example',
  email: 'avery@example.com',
  emailVerified: true,
  status: 'active',
  toJSON() { return { _id: this._id, name: this.name, email: this.email, emailVerified: this.emailVerified }; }
};

const session = {
  accessToken: 'access.jwt.token',
  refreshToken: 'opaque-refresh-token-value',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  user: publicUser
};

describe('Authentication HTTP routes', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registration validates input and never includes a password in the response', async () => {
    authService.register.mockResolvedValue(publicUser);
    const invalid = await request(app).post('/api/v1/auth/register').send({ email: 'bad' });
    expect(invalid.status).toBe(400);

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Avery Example', email: 'avery@example.com', password: 'Correct-Horse-Battery-9'
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('Correct-Horse-Battery-9');
  });

  test('login sets an HttpOnly refresh cookie and returns only the access token in JSON', async () => {
    authService.login.mockResolvedValue(session);
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'avery@example.com', password: 'Correct-Horse-Battery-9'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe('access.jwt.token');
    expect(JSON.stringify(response.body)).not.toContain(session.refreshToken);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('worksphereRefreshToken=');
  });

  test('refresh takes its token from the cookie and replaces that cookie', async () => {
    authService.refresh.mockResolvedValue({ ...session, refreshToken: 'rotated-refresh-token' });
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'worksphereRefreshToken=old-refresh-token');

    expect(response.status).toBe(200);
    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(response.headers['set-cookie'][0]).toContain('worksphereRefreshToken=rotated-refresh-token');
  });

  test('logout revokes the cookie session and clears the cookie', async () => {
    authService.logout.mockResolvedValue(undefined);
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'worksphereRefreshToken=old-refresh-token');

    expect(response.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('old-refresh-token');
    expect(response.headers['set-cookie'][0]).toMatch(/worksphereRefreshToken=;/);
  });

  test('protected profile endpoint requires a valid bearer token', async () => {
    const response = await request(app).get('/api/v1/users/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('resend-verification keeps the response generic', async () => {
    authService.resendVerification.mockResolvedValue(undefined);
    const response = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'unknown@example.com' });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('If the account exists');
  });

  test('rejects malformed bearer tokens before accessing protected resources', async () => {
    const response = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer not-a-jwt');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  test('forgot password keeps the response generic', async () => {
    authService.forgotPassword.mockResolvedValue(undefined);
    const response = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'unknown@example.com' });
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('If an account exists');
  });
});
