const request = require('supertest');
const { app } = require('../../src/server');

describe('Root welcome endpoint', () => {
  test('GET / returns the WorkSphere API welcome payload', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Welcome to WorkSphere API',
      status: 'Server is running'
    });
  });
});
