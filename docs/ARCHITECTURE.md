# WorkSphere Backend Architecture

WorkSphere Backend v2 is a modular, multi-tenant REST API built with Node.js 20+, Express 4, MongoDB 5.0+, and Mongoose 8.

## Request lifecycle

1. `src/server.js` validates configuration (through `src/config/env.js`), opens MongoDB, starts the HTTP server, and starts the deadline-reminder scheduler.
2. `src/app.js` installs security headers, allowlisted CORS, request IDs/logging context, JSON/body limits, cookie parsing, unsafe-key rejection, API rate limiting, and route mounts.
3. `/api/v1` module routers authenticate requests, validate parameters/query/body with Joi, load tenant context and authorize permissions, then call a service.
4. Services own business rules and database access. Multi-document writes use `src/utils/mongo-transaction.js`; controllers map results to the shared response envelope.
5. The error middleware returns consistent error codes and request IDs. Liveness/readiness endpoints are under `/api/v1/health`.

## Modules

- **Auth and users** — registration, sign-in, refresh/logout, password reset, self-service profile and account lifecycle. Email verification is controlled by `EMAIL_VERIFICATION_ENABLED` and is off by default until mail delivery is integrated.
- **Organizations, members, invitations** — tenant creation, memberships, role hierarchy, invitation lifecycle, and organization settings.
- **Projects and tasks** — organization-owned projects, private-project memberships, task workflow, assignees, subtasks, and dependencies.
- **Comments and notifications** — task discussion, mentions, recipient-scoped notifications, and due/overdue reminders.
- **Activities and analytics** — immutable audit timelines and server-side, tenant-scoped MongoDB analytics.

Each module follows a routes → controller → service → model structure and keeps its input validation close to the route. Shared authorization, permissions, logging, configuration, errors, transaction handling, and tenant helpers live under `src/` outside the feature modules.

## Tenant isolation and authorization

A user must have an active `OrganizationMember` record to access an organization route. Organization routes load the membership from the authenticated user ID and URL organization ID; caller-provided role/organization filters are not trusted. Data services include the authorized organization ID in reads, updates, deletions, and aggregation pipelines. Project and task access additionally enforce project visibility and project membership. Notification reads are scoped to both organization and recipient. Activity and analytics access uses the same organization gate and the relevant project access check.

Organization roles (`Owner`, `Admin`, `Manager`, `Member`, `Viewer`) map to the centralized permission matrix in `src/constants/permissions.js`. Project roles (`Owner`, `Editor`, `Viewer`) add project-specific constraints; neither role is accepted from the request as proof of authority.

## Authentication and tokens

Passwords are bcrypt-hashed. Short-lived access tokens are JWTs signed with `JWT_ACCESS_SECRET`. Refresh credentials are opaque random tokens delivered in an HttpOnly cookie; only SHA-256 token hashes and rotation/session metadata are persisted. Email verification, password reset, and invitation tokens are one-time credentials stored as hashes. See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) and [SECURITY.md](SECURITY.md).

## Persistence and consistency

MongoDB stores users, organizations, memberships, projects, tasks, comments, invitations, refresh sessions, notifications, and activities in separate collections. References are ObjectIds; organization-owned documents carry `organizationId`, and project/task children also carry their parent IDs to make tenant/project scopes explicit. See [DATABASE.md](DATABASE.md).

Transactions require a MongoDB replica set or sharded cluster. Analytics requires MongoDB 5.0+ (`$dateTrunc`). Indexes are declared by the Mongoose models and can be provisioned with `npm run db:indexes`; production auto-indexing is disabled by default.

## Public API

The versioned REST API uses JSON and is served under `/api/v1`. Swagger UI is available at `/api-docs`; the generated OpenAPI document is `/openapi.json` (its server base is `/api/v1`). The root `README.md` provides a quick start; [API_DOCUMENTATION.md](API_DOCUMENTATION.md) documents conventions and workflows.

## Operations

Configuration is validated during startup. Production configuration must explicitly supply a strong JWT secret, exact CORS origins, and a reachable non-local MongoDB URI. The process exposes liveness and readiness probes, emits structured logs with request IDs, and drains the scheduler, HTTP server, and MongoDB connection on shutdown. See [docs/deployment.md](docs/deployment.md).
