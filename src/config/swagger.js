module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'WorkSphere API',
    version: '1.0.0',
    description: 'REST API for the WorkSphere project management platform.'
  },
  servers: [{ url: '/api/v1', description: 'Current API' }],
  tags: [{ name: 'System', description: 'Service health and readiness' }],
  paths: {
    '/health': {
      get: {
        summary: 'Check service liveness',
        tags: ['System'],
        responses: { 200: { description: 'The API process is running' } }
      }
    },
    '/health/ready': {
      get: {
        summary: 'Check service and database readiness',
        tags: ['System'],
        responses: {
          200: { description: 'API and MongoDB are ready' },
          503: { description: 'MongoDB is not connected' }
        }
      }
    }
  }
};
