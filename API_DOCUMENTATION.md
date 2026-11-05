# WorkSphere API Documentation

## Discovery and conventions

The live OpenAPI 3 document is served at `GET /openapi.json`; Swagger UI is at `/api-docs`. OpenAPI paths are relative to the `/api/v1` server base. All API examples below therefore use the full `/api/v1` route. The OpenAPI document is the authoritative source for request schemas, response schemas, status codes, and endpoint parameters.

- Send and receive JSON unless a route explicitly sets an HttpOnly cookie.
- Authenticated requests use `Authorization: Bearer <access-token>`.
- Access tokens are short-lived. Refresh tokens are rotated opaque cookies; browser clients should send credentials when calling the refresh/logout routes.
- Tenant routes include `:organizationId`; project/task routes include their parent IDs. The server checks active membership and resource relationships independently of client-side organization selection.
- List routes use pagination where documented (`page`, `limit`) and return pagination metadata.
- Errors share a JSON envelope with a stable `code`, message, and request ID. `X-Request-Id` is returned on responses; use it when reporting failures.

## Service and health endpoints

- `GET /` — service welcome/status response.
- `GET /api/v1/health` — liveness; independent of database readiness.
- `GET /api/v1/health/ready` — readiness; returns 503 while MongoDB is unavailable.

## Authentication lifecycle

1. `POST /api/v1/auth/register` creates an account and starts email verification.
2. `POST /api/v1/auth/verify-email` verifies the one-time token and starts a session. `POST /resend-verification` requests a fresh delivery.
3. `POST /api/v1/auth/login` starts an authenticated session.
4. Use the returned access token for protected endpoints. `POST /api/v1/auth/refresh` rotates the refresh cookie and returns a new access token.
5. `POST /api/v1/auth/logout` revokes the current session; authenticated `POST /api/v1/auth/logout-all` revokes all sessions.
6. `POST /api/v1/auth/forgot-password` and `/reset-password` implement one-time password recovery.

The refresh credential is an HttpOnly cookie; JavaScript clients cannot read it. Email/password reset tokens are single-use. In development with no mail adapter configured, delivery is intentionally skipped and a warning is logged without exposing credentials; production deployments must integrate a real mail transport.

## Account and organization workflows

- `GET/PATCH/DELETE /api/v1/users/me` — read/update/deactivate the signed-in account; `PATCH /users/me/password` changes its password.
- `GET /api/v1/users/:userId` — retrieve the authenticated user's own user resource; the API does not expose a global directory.
- `POST /api/v1/organizations` creates an organization and its Owner membership atomically; `GET /api/v1/organizations` lists only active memberships.
- `GET/PATCH/DELETE /api/v1/organizations/:organizationId` — read/update/delete; only an Owner can delete. `POST .../:organizationId/switch` validates membership and returns the selected context.
- `GET .../:organizationId/members`; `PATCH .../:organizationId/members/:memberId/role`; `DELETE .../:organizationId/members/:memberId` — tenant-scoped member management.
- `GET/POST .../:organizationId/invitations`; `DELETE .../:organizationId/invitations/:invitationId`; `POST /api/v1/invitations/accept` — invitation lifecycle. Acceptance requires a valid token and matching verified account email.

## Project and task workflows

Project resources are nested beneath `/api/v1/organizations/:organizationId/projects`:

- `GET/POST /.../projects` lists/creates projects; filters, sorting, visibility, and pagination are validated by the server.
- `GET/PATCH/DELETE /.../projects/:projectId` reads/updates/deletes; `PATCH /:projectId/archive` and `/restore` change archive state.
- `GET /:projectId/members`; `POST/PATCH/DELETE /:projectId/members/:userId` manage project access.
- Tasks live at `/.../projects/:projectId/tasks`: `GET/POST` list/create; `GET/PATCH/DELETE /:taskId` read/update/delete; `PATCH /:taskId/status` changes workflow state; `PATCH /:taskId/assignee` changes assignment; `GET /:taskId/subtasks` lists subtasks.
- `GET /api/v1/organizations/:organizationId/tasks/my` lists assigned tasks in projects visible to the caller.
- Task comments use `/.../tasks/:taskId/comments`: `GET/POST` list/create; `PATCH/DELETE /:commentId` update/soft-delete. Mention targets are checked against organization and private-project membership.

Task dependencies and parent tasks must remain within the same project. Private project membership and organization RBAC both apply. Removing a member cleans up their project access and task assignments transactionally.

## Collaboration, history, analytics

- `GET/PATCH` notification operations are under `/api/v1/organizations/:organizationId/notifications`; `GET /unread-count`, `PATCH /read-all`, and `PATCH /:notificationId/read` provide unread status controls. Notifications are restricted to their recipient.
- `GET /api/v1/organizations/:organizationId/activity` and `GET .../projects/:projectId/activity` return paginated immutable histories with supported actor/action/resource/date filters.
- `GET /api/v1/organizations/:organizationId/analytics` returns organization metrics; `GET .../projects/:projectId/analytics` returns project metrics. Both support optional ISO `from`/`to` datetimes and `granularity=day|week|month`. Trends use UTC buckets and MongoDB 5.0+.

## Security model

Every protected endpoint authenticates first and authorizes on the server. The active organization membership and centralized permission matrix determine organization access. URL IDs are not treated as proof of access: parent-child relationships, organization scope, project visibility, membership, and notification recipient are checked on resource operations. See [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md) for implementation/security notes.

## Examples

```bash
# Liveness
curl -i http://localhost:3000/api/v1/health

# Protected organization listing
curl -i http://localhost:3000/api/v1/organizations \
  -H 'Authorization: Bearer <access-token>'

# OpenAPI
curl -s http://localhost:3000/openapi.json
```

The OpenAPI specification documents per-operation request and response formats; use that rather than relying on illustrative examples here.
