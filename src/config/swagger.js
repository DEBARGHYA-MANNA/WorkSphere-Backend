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
    { name: 'Users', description: 'Profile and self-service account management' },
    { name: 'Organizations', description: 'Organization setup, settings, and switching' },
    { name: 'Members', description: 'Tenant-scoped member and role management' },
    { name: 'Invitations', description: 'Organization invitations and acceptance' },
    { name: 'Projects', description: 'Tenant-scoped projects, lifecycle, and project membership' },
    { name: 'Tasks', description: 'Project-scoped tasks, assignment, workflow, and dependencies' },
    { name: 'Comments', description: 'Task comments, edits, deletes, and member mentions' },
    { name: 'Activity', description: 'Immutable organization, project, membership, task, and comment event history' },
    { name: 'Analytics', description: 'Tenant-scoped task, project, workload, and productivity aggregates' },
    { name: 'Notifications', description: 'Recipient-scoped notification inbox and read state' }
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
      },
      patch: {
        tags: ['Users'],
        summary: 'Update profile details; changing email requires reverification and revokes sessions',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdate' } } } },
        responses: {
          200: { description: 'Profile updated' },
          400: { description: 'Request validation failed' },
          409: { description: 'Email is already registered' }
        }
      },
      delete: {
        tags: ['Users'],
        summary: 'Deactivate the authenticated account (soft deactivation)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeactivateAccountRequest' } } } },
        responses: {
          200: { description: 'Account disabled and all sessions revoked' },
          401: { description: 'Password confirmation failed or access token is invalid' }
        }
      }
    },
    '/users/me/password': {
      patch: {
        tags: ['Users'],
        summary: 'Change the authenticated user password',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordChangeRequest' } } } },
        responses: {
          200: { description: 'Password changed and all sessions revoked' },
          400: { description: 'Request validation failed' },
          401: { description: 'Current password or access token is invalid' }
        }
      }
    },
    '/users/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Look up a user by id; currently restricted to the authenticated user',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
        responses: {
          200: { description: 'User profile' },
          404: { description: 'User not found or outside the permitted lookup scope' }
        }
      }
    },
    '/organizations': {
      get: {
        tags: ['Organizations'], summary: 'List organizations for the authenticated user', security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
        responses: { 200: { description: 'Organizations with the current user role and pagination' } }
      },
      post: {
        tags: ['Organizations'], summary: 'Create an organization and its initial Owner membership', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrganizationRequest' } } } },
        responses: { 201: { description: 'Organization created' }, 400: { description: 'Validation failed' }, 409: { description: 'Organization slug already exists' } }
      }
    },
    '/organizations/{organizationId}': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Organizations'], summary: 'Get organization details after membership validation', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Organization details' }, 404: { description: 'Organization not found or inaccessible' } }
      },
      patch: {
        tags: ['Organizations'], summary: 'Update organization details or settings (Owner/Admin)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrganizationRequest' } } } },
        responses: { 200: { description: 'Organization updated' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Organization not found or inaccessible' } }
      },
      delete: {
        tags: ['Organizations'], summary: 'Delete organization and related membership, invitation, project, and task records (Owner)', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Organization deleted' }, 403: { description: 'Only the Owner may delete' }, 404: { description: 'Organization not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/switch': {
      post: {
        tags: ['Organizations'], summary: 'Select an organization context after membership verification', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Selected organization and membership role' }, 404: { description: 'Organization not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/members': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Members'], summary: 'List members in the organization (tenant-scoped)', security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
        responses: { 200: { description: 'Paginated organization members' }, 404: { description: 'Organization not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/members/{memberId}/role': {
      patch: {
        tags: ['Members'], summary: 'Change a member role (Owner/Admin; Owner cannot be assigned)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateMemberRoleRequest' } } } },
        responses: { 200: { description: 'Member role changed' }, 403: { description: 'Insufficient permission or role escalation attempted' }, 404: { description: 'Member not found in this organization' } }
      }
    },
    '/organizations/{organizationId}/members/{memberId}': {
      delete: {
        tags: ['Members'], summary: 'Remove a member (subject to role hierarchy)', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Member removed' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Member not found in this organization' } }
      }
    },
    '/organizations/{organizationId}/projects': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Projects'], summary: 'List projects visible to the current organization member', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'q', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] } },
          { in: 'query', name: 'visibility', schema: { type: 'string', enum: ['organization', 'private'] } },
          { in: 'query', name: 'archived', schema: { type: 'boolean', default: false } },
          { in: 'query', name: 'dueAfter', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'dueBefore', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'name', 'dueDate'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: { 200: { description: 'Filtered, paginated projects visible to the caller' }, 403: { description: 'Insufficient permission' } }
      },
      post: {
        tags: ['Projects'], summary: 'Create a project and assign its creator as project Owner', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectCreateRequest' } } } },
        responses: { 201: { description: 'Project created with initial Owner membership' }, 400: { description: 'Validation failed' }, 403: { description: 'Insufficient permission' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Projects'], summary: 'Get a project after tenant and project visibility checks', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Project details' }, 404: { description: 'Project not found or inaccessible' }, 403: { description: 'Insufficient permission' } }
      },
      patch: {
        tags: ['Projects'], summary: 'Update project fields', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectUpdateRequest' } } } },
        responses: { 200: { description: 'Project updated' }, 400: { description: 'Validation failed' }, 403: { description: 'Insufficient permission' }, 409: { description: 'Archived projects must be restored first' } }
      },
      delete: {
        tags: ['Projects'], summary: 'Permanently delete a project, its tasks, and project memberships', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Project deleted' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Project not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/archive': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Projects'], summary: 'Archive a project without deleting its data', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Project archived' }, 403: { description: 'Insufficient permission' }, 409: { description: 'Project is already archived' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/restore': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Projects'], summary: 'Restore an archived project', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Project restored' }, 403: { description: 'Insufficient permission' }, 409: { description: 'Project is not archived' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/members': {
      get: {
        tags: ['Projects'], summary: 'List active project members', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'organizationId', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'projectId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Paginated project members' }, 404: { description: 'Project not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/members/{userId}': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'userId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      post: {
        tags: ['Projects'], summary: 'Add an active organization member to the project', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectMemberAddRequest' } } } },
        responses: { 201: { description: 'Project membership created' }, 404: { description: 'User is not an active member of this organization' }, 409: { description: 'User is already a project member' } }
      },
      patch: {
        tags: ['Projects'], summary: 'Change a project member role', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectMemberRoleRequest' } } } },
        responses: { 200: { description: 'Project member role updated' }, 403: { description: 'Project Owner role is protected' }, 404: { description: 'Project member not found' } }
      },
      delete: {
        tags: ['Projects'], summary: 'Remove a project member (the project Owner is protected)', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Project member removed' }, 403: { description: 'Project Owner role is protected' }, 404: { description: 'Project member not found' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Tasks'], summary: 'List project tasks with filtering, sorting, and pagination', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'q', schema: { type: 'string', maxLength: 120 } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] } },
          { in: 'query', name: 'priority', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
          { in: 'query', name: 'assigneeId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'parentTaskId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'label', schema: { type: 'string', maxLength: 40 } },
          { in: 'query', name: 'dueAfter', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'dueBefore', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: { 200: { description: 'Paginated project tasks' }, 403: { description: 'Insufficient permission' } }
      },
      post: {
        tags: ['Tasks'], summary: 'Create a task or subtask in the project', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskCreateRequest' } } } },
        responses: { 201: { description: 'Task created' }, 400: { description: 'Validation failed' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Parent or dependency not found in this project' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Tasks'], summary: 'Get a task within its authorized organization and project', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Task details' }, 404: { description: 'Task not found or inaccessible' } }
      },
      patch: {
        tags: ['Tasks'], summary: 'Update task details, status, priority, due date, labels, subtask parent, or dependencies', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdateRequest' } } } },
        responses: { 200: { description: 'Task updated' }, 400: { description: 'Validation failed' }, 403: { description: 'Insufficient permission' }, 409: { description: 'Task relationship cycle detected' } }
      },
      delete: {
        tags: ['Tasks'], summary: 'Delete a task and clean its parent/dependency references', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Task deleted' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Task not found' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/status': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Tasks'], summary: 'Change a task workflow status', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskStatusRequest' } } } },
        responses: { 200: { description: 'Task status changed; completion timestamp is maintained' }, 403: { description: 'Insufficient permission' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/assignee': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Tasks'], summary: 'Assign or unassign a task', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskAssignmentRequest' } } } },
        responses: { 200: { description: 'Task assignment updated' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Assignee is not eligible for this project' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/subtasks': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Tasks'], summary: 'List direct subtasks of a task', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Paginated subtasks' }, 404: { description: 'Parent task not found' } }
      }
    },
    '/organizations/{organizationId}/tasks/my': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Tasks'], summary: 'List tasks assigned to the current user across accessible projects', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'q', schema: { type: 'string', maxLength: 120 } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] } },
          { in: 'query', name: 'priority', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
          { in: 'query', name: 'label', schema: { type: 'string', maxLength: 40 } },
          { in: 'query', name: 'dueAfter', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'dueBefore', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: { 200: { description: 'Paginated tasks assigned to the authenticated user' }, 403: { description: 'Insufficient permission' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/comments': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Comments'], summary: 'Retrieve task comments in chronological order', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } }
        ],
        responses: { 200: { description: 'Paginated, non-deleted task comments' }, 404: { description: 'Task not found or inaccessible' } }
      },
      post: {
        tags: ['Comments'], summary: 'Create a comment and optionally mention active project members', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CommentCreateRequest' } } } },
        responses: { 201: { description: 'Comment created; mentioned members receive notifications' }, 400: { description: 'Validation failed' }, 404: { description: 'A mentioned member is inactive or lacks private-project access' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'taskId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'commentId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Comments'], summary: 'Edit a comment authored by the current user', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CommentUpdateRequest' } } } },
        responses: { 200: { description: 'Comment updated' }, 403: { description: 'Only its author may edit the comment' }, 404: { description: 'Comment not found' } }
      },
      delete: {
        tags: ['Comments'], summary: 'Soft-delete a comment; activity history is retained', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Comment deleted' }, 403: { description: 'Insufficient permission' }, 404: { description: 'Comment not found' } }
      }
    },
    '/organizations/{organizationId}/activity': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Activity'], summary: 'List organization activity including membership and role changes', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'projectId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'taskId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'actorId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'action', schema: { type: 'string', enum: ['organization_created', 'organization_updated', 'project_created', 'project_updated', 'project_archived', 'project_restored', 'project_deleted', 'member_joined', 'member_role_changed', 'member_removed', 'project_member_added', 'project_member_role_changed', 'project_member_removed', 'invitation_created', 'invitation_revoked', 'invitation_accepted', 'task_created', 'task_updated', 'task_status_changed', 'task_assigned', 'task_deleted', 'comment_created', 'comment_updated', 'comment_deleted'] } },
          { in: 'query', name: 'targetType', schema: { type: 'string', enum: ['organization', 'project', 'organization_member', 'project_member', 'invitation', 'task', 'comment'] } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: { 200: { description: 'Paginated activity records scoped to this organization' }, 400: { description: 'Invalid filters or date range' }, 403: { description: 'Organization membership is required' } }
      }
    },
    '/organizations/{organizationId}/analytics': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Analytics'], summary: 'Get organization task, project, workload, and productivity analytics', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'granularity', schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' } }
        ],
        responses: { 200: { description: 'Organization analytics, distributions, member workload, and completion trends' }, 400: { description: 'Invalid date range' }, 403: { description: 'Owner, Admin, or Manager access required' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/analytics': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Analytics'], summary: 'Get task and productivity analytics for a project', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'granularity', schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' } }
        ],
        responses: { 200: { description: 'Project analytics scoped to the active organization' }, 404: { description: 'Project is not accessible' } }
      }
    },
    '/organizations/{organizationId}/projects/{projectId}/activity': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'projectId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      get: {
        tags: ['Activity'], summary: 'Retrieve immutable task and comment activity history for a project', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'taskId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'actorId', schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
          { in: 'query', name: 'action', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: { 200: { description: 'Paginated activity events' }, 404: { description: 'Project not found or inaccessible' } }
      }
    },
    '/organizations/{organizationId}/notifications': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Notifications'], summary: 'List notifications for the authenticated recipient', security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { in: 'query', name: 'category', schema: { type: 'string', enum: ['mention', 'task_assigned', 'comment', 'task_due_soon', 'task_overdue', 'system'] } },
          { in: 'query', name: 'unreadOnly', schema: { type: 'boolean', default: false } }
        ],
        responses: { 200: { description: 'Paginated notifications for the current user' } }
      }
    },
    '/organizations/{organizationId}/notifications/unread-count': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      get: {
        tags: ['Notifications'], summary: 'Count unread notifications for the current user', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Unread notification count' } }
      }
    },
    '/organizations/{organizationId}/notifications/read-all': {
      parameters: [{ in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }],
      patch: {
        tags: ['Notifications'], summary: 'Mark all unread notifications as read', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Number of notifications updated' } }
      }
    },
    '/organizations/{organizationId}/notifications/{notificationId}/read': {
      parameters: [
        { in: 'path', name: 'organizationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
        { in: 'path', name: 'notificationId', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
      ],
      patch: {
        tags: ['Notifications'], summary: 'Mark one of the current user notifications as read', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notification read state updated' }, 404: { description: 'Notification not found' } }
      }
    },
    '/organizations/{organizationId}/invitations': {
      get: {
        tags: ['Invitations'], summary: 'List pending organization invitations', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Paginated pending invitations; token values are never returned' } }
      },
      post: {
        tags: ['Invitations'], summary: 'Invite a user by email with a permitted role', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateInvitationRequest' } } } },
        responses: { 201: { description: 'Invitation sent' }, 403: { description: 'Role cannot be assigned by this member' }, 409: { description: 'Member or pending invitation already exists' } }
      }
    },
    '/organizations/{organizationId}/invitations/{invitationId}': {
      delete: {
        tags: ['Invitations'], summary: 'Revoke a pending invitation', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Invitation revoked' }, 404: { description: 'Invitation not found in this organization' } }
      }
    },
    '/invitations/accept': {
      post: {
        tags: ['Invitations'], summary: 'Accept an invitation using the verified account email', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AcceptInvitationRequest' } } } },
        responses: { 200: { description: 'Organization membership activated' }, 400: { description: 'Invitation invalid, expired, or intended for another account' }, 409: { description: 'Already an organization member' } }
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
      },
      ProfileUpdate: {
        type: 'object', minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email', description: 'Changing email clears verification and revokes sessions.' },
          bio: { type: 'string', maxLength: 500 },
          avatarUrl: { type: 'string', format: 'uri', nullable: true, maxLength: 2048 },
          timezone: { type: 'string', maxLength: 64, description: 'IANA time zone name.' }
        }
      },
      PasswordChangeRequest: {
        type: 'object', required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1, maxLength: 72 },
          newPassword: { type: 'string', minLength: 12, maxLength: 72 }
        }
      },
      DeactivateAccountRequest: {
        type: 'object', required: ['password'],
        properties: { password: { type: 'string', minLength: 1, maxLength: 72 } }
      },
      CreateOrganizationRequest: {
        type: 'object', required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          settings: {
            type: 'object',
            properties: {
              allowMemberInvites: { type: 'boolean' },
              defaultMemberRole: { type: 'string', enum: ['Member', 'Viewer'] }
            }
          }
        }
      },
      UpdateOrganizationRequest: {
        type: 'object', minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          description: { type: 'string', maxLength: 2000 },
          settings: {
            type: 'object', minProperties: 1,
            properties: {
              allowMemberInvites: { type: 'boolean' },
              defaultMemberRole: { type: 'string', enum: ['Member', 'Viewer'] }
            }
          }
        }
      },
      UpdateMemberRoleRequest: {
        type: 'object', required: ['role'],
        properties: { role: { type: 'string', enum: ['Admin', 'Manager', 'Member', 'Viewer'] } }
      },
      CreateInvitationRequest: {
        type: 'object', required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['Admin', 'Manager', 'Member', 'Viewer'] }
        }
      },
      AcceptInvitationRequest: {
        type: 'object', required: ['token'],
        properties: { token: { type: 'string', minLength: 32, maxLength: 256 } }
      },
      CommentCreateRequest: {
        type: 'object', required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 10000 },
          mentions: { type: 'array', maxItems: 20, uniqueItems: true, items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
        }
      },
      CommentUpdateRequest: {
        type: 'object', minProperties: 1,
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 10000 },
          mentions: { type: 'array', maxItems: 20, uniqueItems: true, items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
        }
      },
      TaskCreateRequest: {
        type: 'object', required: ['title'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 180 },
          description: { type: 'string', maxLength: 10000 },
          status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          labels: { type: 'array', maxItems: 20, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 40 } },
          parentTaskId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$', nullable: true },
          dependencies: { type: 'array', maxItems: 25, uniqueItems: true, items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
        }
      },
      TaskUpdateRequest: {
        type: 'object', minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 180 },
          description: { type: 'string', maxLength: 10000 },
          status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          labels: { type: 'array', maxItems: 20, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 40 } },
          parentTaskId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$', nullable: true },
          dependencies: { type: 'array', maxItems: 25, uniqueItems: true, items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }
        }
      },
      TaskAssignmentRequest: {
        type: 'object', required: ['assigneeId'],
        properties: { assigneeId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$', nullable: true } }
      },
      TaskStatusRequest: {
        type: 'object', required: ['status'],
        properties: { status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] } }
      },
      ProjectCreateRequest: {
        type: 'object', required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 160 },
          description: { type: 'string', maxLength: 5000 },
          status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
          visibility: { type: 'string', enum: ['organization', 'private'] },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      ProjectUpdateRequest: {
        type: 'object', minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 160 },
          description: { type: 'string', maxLength: 5000 },
          status: { type: 'string', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
          visibility: { type: 'string', enum: ['organization', 'private'] },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      ProjectMemberAddRequest: {
        type: 'object',
        properties: { role: { type: 'string', enum: ['Editor', 'Viewer'], default: 'Editor' } }
      },
      ProjectMemberRoleRequest: {
        type: 'object', required: ['role'],
        properties: { role: { type: 'string', enum: ['Editor', 'Viewer'] } }
      }
    }
  }
};
