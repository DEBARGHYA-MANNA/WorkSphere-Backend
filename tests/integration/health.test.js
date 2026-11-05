const request = require('supertest');
const app = require('../../src/app');

describe('System endpoints', () => {
  test('GET /api/v1/health reports liveness without requiring MongoDB', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok', database: expect.any(String) }
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('GET /api/v1/health/ready reports unavailable while MongoDB is disconnected', async () => {
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      data: { status: 'not_ready', database: 'disconnected' }
    });
  });

  test('Swagger UI and OpenAPI JSON are served', async () => {
    const docs = await request(app).get('/api-docs/');
    const spec = await request(app).get('/openapi.json');

    expect(docs.status).toBe(200);
    expect(docs.text).toContain('WorkSphere API Documentation');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.3');
    expect(spec.body.paths['/health']).toBeDefined();
  });

  test('unknown routes use the standard error response', async () => {
    const response = await request(app).get('/api/v1/missing');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
      requestId: expect.any(String)
    });
  });

  test('rejects Mongo-style operators from request payloads', async () => {
    const response = await request(app)
      .post('/api/v1/health')
      .send({ filter: { $gt: '' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });
});
