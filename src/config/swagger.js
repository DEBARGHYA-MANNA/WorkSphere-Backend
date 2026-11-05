module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'WorkSphere API',
    version: '1.0.0',
    description: 'REST API for the WorkSphere project management platform.'
  },
  servers: [{ url: '/api/v1', description: 'Current API' }],
  tags: [
    { name: 'System', description: 'Service health and readiness' },
    { name: 'Authentication', description: 'Registration, sessions, and account verification' },
    { name: 'Users', description: 'Current user profile' }
  ],
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
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a user and send email verification',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          201: { description: 'Account created; email verification is required' },
          400: { description: 'Request validation failed' },
          409: { description: 'Email address is already registered' }
        }
      }
    },
    '/auth/resend-verification': {
      post: {
        tags: ['Authentication'],
        summary: 'Resend email verification instructions without revealing account existence',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EmailRequest' } } } },
        responses: { 200: { description: 'Generic response' } }
      }
    },
    '/auth/verify-email': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify an email address using its one-time token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OneTimeTokenRequest' } } } },
        responses: {
          200: { description: 'Email verified; access token and refresh cookie issued' },
          400: { description: 'Token is invalid or expired' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate with email and password',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          200: { description: 'Login successful; access token returned and refresh token set as an HttpOnly cookie' },
          401: { description: 'Credentials are invalid or email has not been verified' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate the refresh token and issue a new access token',
        security: [{ refreshCookie: [] }],
        responses: {
          200: { description: 'Refresh token rotated; replacement set as an HttpOnly cookie' },
          401: { description: 'Refresh token is invalid, expired, or reused' }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke the current refresh-token session',
        security: [{ refreshCookie: [] }],
        responses: { 200: { description: 'Current session revoked and refresh cookie cleared' } }
      }
    },
    '/auth/logout-all': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke all refresh-token sessions for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'All sessions revoked' },
          401: { description: 'Access token is missing, invalid, expired, or revoked' }
        }
      }
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Request a password reset email',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EmailRequest' } } } },
        responses: { 200: { description: 'Generic response, whether or not the email is registered' } }
      }
    },
    '/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset a password with a one-time token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } } },
        responses: {
          200: { description: 'Password changed; all existing sessions revoked' },
          400: { description: 'Token is invalid or expired' }
        }
      }
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get the authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Access token is missing, invalid, expired, or revoked' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'worksphereRefreshToken' }
    },
    schemas: {
      RegisterRequest: {
        type: 'object', required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12, maxLength: 72, description: 'At least 12 characters; no more than 72 UTF-8 bytes.' }
        }
      },
      LoginRequest: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 1, maxLength: 72 } }
      },
      EmailRequest: {
        type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } }
      },
      OneTimeTokenRequest: {
        type: 'object', required: ['token'], properties: { token: { type: 'string', minLength: 32, maxLength: 256 } }
      },
      ResetPasswordRequest: {
        type: 'object', required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 32, maxLength: 256 },
          password: { type: 'string', minLength: 12, maxLength: 72 }
        }
      }
    }
  }
};
