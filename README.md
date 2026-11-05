# WorkSphere Backend

WorkSphere Backend **v2.0.0** is a multi-tenant project management SaaS API built with Node.js, Express, MongoDB, and Mongoose. Phases 1–14 are integrated: foundation, authentication, user management, organizations/multi-tenancy, RBAC, projects, tasks, comments/collaboration, notifications, activity logs, analytics, security hardening, production readiness, and final integration/release preparation.

> Release note: this version is prepared for a reviewed release pull request. Live MongoDB replica-set, production mail delivery, load, backup recovery, and deployment verification remain deployment/release-environment checks.

## Requirements

- Node.js 20 or later
- MongoDB 5.0+ running as a local replica set or a managed replica-set/sharded-cluster URI

## Setup

```bash
npm ci
cp .env.example .env
# Edit MONGODB_URI and other settings in .env
npm run dev
```

The server listens on `0.0.0.0:3000` by default and will start only after it connects to MongoDB. For a production deployment, provide environment variables through the hosting platform rather than a committed file.

## Endpoints

- `GET /` — WorkSphere API welcome/status response
- `GET /api/v1/health` — liveness probe (works without a database connection)
- `GET /api/v1/health/ready` — readiness probe (returns 503 if MongoDB is disconnected)
- `GET /api-docs` — Swagger UI
- `GET /openapi.json` — OpenAPI 3.0 document

API routes are versioned under `/api/v1`. Errors use a consistent JSON shape with an error code and request ID. Request IDs are returned in `X-Request-Id`; request logging intentionally excludes request bodies and credentials.

## Configuration

Copy `.env.example` to `.env`; startup validates configured values and ranges. Production startup additionally requires an explicitly configured strong `JWT_ACCESS_SECRET`, exact non-wildcard `CORS_ORIGIN` values, and a non-local `MONGODB_URI`. Refresh credentials are random opaque tokens, so a separate `JWT_REFRESH_SECRET` is not used. Cookie `Secure` is automatically enabled in production.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT` | Runtime mode and listen port. |
| `MONGODB_URI` | MongoDB connection string; use a replica-set/sharded deployment for transaction workflows. |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, `MONGODB_SOCKET_TIMEOUT_MS`, `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE` | Database connection and pool tuning. |
| `MONGOOSE_AUTO_INDEX` | Override schema auto-indexing; defaults on outside production and off in production. |
| `JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS` | Access JWT signing secret and token lifetimes. Refresh tokens themselves are opaque random values. |
| `EMAIL_VERIFICATION_ENABLED` | Defaults to `false`; requires a functioning mail transport before enabling. |
| `BCRYPT_ROUNDS` | Password hashing work factor (minimum 10; default 12). |
| `CORS_ORIGIN` | Comma-separated exact allowed origins; do not use `*` with credentials. |
| `COOKIE_SAME_SITE` | `strict`, `lax`, or `none`; `none` requires production Secure cookies. |
| `TRUST_PROXY_HOPS` | Trusted reverse-proxy hop count; set only for a known proxy topology. |
| `LOG_LEVEL` | Structured logger verbosity. |
| `REQUEST_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS` | HTTP request and graceful-shutdown bounds. |

No mail-vendor credentials are provided: configure a production mail transport through the application integration layer. Never commit a real `.env` or secret.

## Documentation

- [Architecture](ARCHITECTURE.md) — modules, request lifecycle, tenant boundaries, authentication, and operations.
- [Database](DATABASE.md) — collections, relationships, transactions, indexes, and MongoDB setup.
- [API documentation](API_DOCUMENTATION.md) — conventions and end-to-end endpoint workflows; the running service exposes Swagger UI at `/api-docs` and its live OpenAPI contract at `/openapi.json`.
- [Contributing](CONTRIBUTING.md) — development and Git/PR workflow.
- [Security](SECURITY.md) — vulnerability reporting and security responsibilities.
- [Testing](TESTING.md) — quality gates and optional replica-set verification.
- [Changelog](CHANGELOG.md) — v2.0.0 changes and release verification status.
- [Deployment](docs/deployment.md) — production configuration and operations.

## Tests and lint

```bash
npm test
npm run test:coverage
npm run lint
npm audit --audit-level=high
```

The unit and HTTP integration suites use isolated model fakes and do not require a live database. Any future live-database integration tests must use an isolated test database and must never target development or production data. CI runs tests and coverage on Node.js 20 and 22, lint, application/OpenAPI startup validation, and an npm dependency audit.

## MongoDB transactions

Organization creation/update/deletion, project creation/update/archive/restore/deletion and project membership changes, task creation/update/status/assignment/deletion, comment create/update/delete with activity/mention notifications, organization-member role/removal changes, and invitation creation/revocation/acceptance use multi-document transactions. These operations require MongoDB 5.0 or later running as a replica set or sharded cluster; analytics uses `$dateTrunc` for UTC productivity buckets. A local standalone `mongod` is sufficient for health endpoints but not these operations. For local transaction development, configure MongoDB as a single-node replica set and connect using a replica-set URI, for example `mongodb://127.0.0.1:27017/worksphere?replicaSet=rs0`.

## Current scope

The foundation, authentication, self-service user management, organization/member/invitation APIs, centralized RBAC, project/task management, comments, audit activity history, notifications, organization/project analytics, and production-oriented configuration are implemented. See [Deployment](docs/deployment.md) for production setup and operational guidance.

## Authentication (Phase 2)

Available authentication routes under `/api/v1/auth`:

- `POST /register` — creates an account. Email verification is **disabled by default**, so the account can sign in immediately without a mailer. Set `EMAIL_VERIFICATION_ENABLED=true` only after a verification mail transport is configured.
- `POST /resend-verification` and `POST /verify-email` — are inactive while verification is disabled; they remain available for a future mailer-backed flow.
- `POST /login` and `POST /refresh` — return short-lived access JWTs; refresh tokens are rotated and sent only in an HttpOnly cookie.
- `POST /logout` and authenticated `POST /logout-all` — revoke the current session or all account sessions.
- `POST /forgot-password` and `POST /reset-password` — issue and consume one-time reset tokens; successful reset revokes existing sessions.
- `GET /api/v1/users/me` — example access-token-protected user endpoint.

Refresh tokens and one-time email/password tokens are generated from cryptographically secure randomness and only SHA-256 hashes are persisted. Reuse of an already-rotated refresh token revokes that session family. Passwords are bcrypt-hashed (12 rounds by default) and are never returned by the API. Access tokens are signed with HS256, default to a 15-minute lifetime, and are checked against active server-side session records so logout/revocation takes effect immediately.

Set `JWT_ACCESS_SECRET` to a unique random value of at least 32 characters in production. Refresh cookies are `HttpOnly`, `SameSite=Lax` by default, scoped to the auth routes, and use `Secure` in production. Set `COOKIE_SAME_SITE=none` only for cross-site browser deployments over HTTPS.

Email is behind a provider-independent transport interface. Email verification is temporarily opt-out (`EMAIL_VERIFICATION_ENABLED=false`), and registration does not return a verification token. Do not turn it on until a mail transport is configured with `configureMailTransport({ sendMail(message) { ... } })`. Password-reset and invitation emails still need a mail transport; without one, delivery is skipped and tokens are not returned in API responses.

## Authentication test coverage

Authentication service tests cover registration hashing, email verification, credential checks, refresh rotation/reuse revocation, logout, logout-all, and password reset/session invalidation. HTTP tests cover validation, refresh-cookie handling, logout, protected routes, and generic password-reset responses. Tests use isolated in-memory model fakes for service behavior and do not require connecting to a development or production database.

## User management (Phase 3)

- `GET /api/v1/users/me` retrieves the authenticated profile.
- `PATCH /api/v1/users/me` updates name, bio, avatar URL, timezone, and optionally email. Email changes revoke existing sessions; they require re-verification only when `EMAIL_VERIFICATION_ENABLED=true` and a mail transport is configured.
- `PATCH /api/v1/users/me/password` verifies the current password, changes the hash, and revokes all sessions.
- `DELETE /api/v1/users/me` performs a password-confirmed soft deactivation, sets account status to disabled, and revokes sessions. It does not hard-delete or anonymize account data.
- `GET /api/v1/users/:userId` is currently restricted to looking up the authenticated user. A global user directory/search is intentionally deferred until organization membership exists, so users cannot enumerate accounts across tenants.

Profile updates reject account-status or role fields; users can only deactivate their own account. With verification disabled, a changed email remains usable immediately; turn verification on only after mail delivery is ready.

## Organizations and multi-tenancy (Phase 4)

- `POST /api/v1/organizations` creates an organization with its initial Owner membership in one MongoDB transaction.
- `GET /api/v1/organizations` lists only organizations where the authenticated user has an active membership.
- `GET`, `PATCH`, `DELETE /api/v1/organizations/:organizationId` enforce membership and role permissions; deletion is limited to the Owner and transactionally removes organization memberships, invitations, projects, project memberships, and tasks.
- `POST /api/v1/organizations/:organizationId/switch` confirms and returns the selected organization context. All organization-scoped routes independently validate membership; clients cannot switch by simply supplying an arbitrary ID.
- `GET /api/v1/organizations/:organizationId/members` provides tenant-scoped, paginated member listings. Role changes and removals enforce a strict hierarchy; Owner cannot be assigned or removed.
- Nested organization invitation routes create, list, and revoke invitations. `POST /api/v1/invitations/accept` requires a valid, unexpired token and the matching active account email; email verification is required only when `EMAIL_VERIFICATION_ENABLED=true`. Acceptance atomically activates membership and consumes the token.

Roles are Owner, Admin, Manager, Member, and Viewer, with permission checks centralized in `src/constants/permissions.js`. Organization-owned queries use a required organization scope helper. User lookup remains self-scoped until organization membership provides a safe directory boundary.

Organization creation/deletion, project creation/deletion, task deletion, organization-member removal (which revokes project memberships and clears task assignments), and invitation acceptance depend on MongoDB transaction support. Configure the database as a replica set as described above. The mail transport abstraction must be configured to deliver organization invitations.

## Role-based access control (Phase 5)

The centralized permission matrix in `src/constants/permissions.js` defines Owner, Admin, Manager, Member, and Viewer access across organization, member, invitation, project, and task operations. `authorizePermission` checks the active organization membership loaded from MongoDB; it never trusts client-supplied roles. `authorizeResource` additionally verifies the resource organization matches the authorized context and supports project-specific visibility and project-role policies.

Role assignments use a strict rank hierarchy: Owner is the only role that can assign Admin; Owner cannot be assigned through organization member management or removed; admins cannot manage peers or the Owner; managers can invite/remove only lower-level roles. Project membership has Owner, Editor, and Viewer roles; only an active organization member can be added, the project creator receives Owner, and that Owner membership is protected. Removing someone from an organization also removes their active project memberships transactionally.

## Project management (Phase 6)

All project APIs are nested under `/api/v1/organizations/:organizationId/projects` and require an authenticated, active organization membership:

- `POST /` and `GET /` create and list tenant-scoped projects. Listing supports name search, status, visibility, archive state, due-date range, whitelisted sorting, and pagination. Organization-visible projects are visible to organization members; private projects are visible to their members and organization Owner/Admin/Manager roles.
- `GET /:projectId`, `PATCH /:projectId`, and `DELETE /:projectId` retrieve, update, and permanently delete a project. Updates are blocked while archived; deletion also removes project memberships and tasks.
- `PATCH /:projectId/archive` and `PATCH /:projectId/restore` archive and restore projects without hard deletion.
- `GET /:projectId/members`, `POST /:projectId/members/:userId`, `PATCH /:projectId/members/:userId`, and `DELETE /:projectId/members/:userId` list and manage project membership. Assignable roles are Editor and Viewer; the creator remains the protected project Owner.

Project ownership is separate from organization role: project Owner/Editor/Viewer permissions are combined with the centrally defined organization permissions, and project queries always include the authorized organization ID. Project create/delete and organization member removal use MongoDB transactions.

## Task management (Phase 7)

Project tasks are nested under `/api/v1/organizations/:organizationId/projects/:projectId/tasks`. `GET` lists filtered and sorted tasks with pagination; `POST` creates tasks with status, priority, due date, labels, subtask parent, and same-project dependency fields. `GET /:taskId`, `PATCH /:taskId`, and `DELETE /:taskId` retrieve, update, and delete tasks. `PATCH /:taskId/status` updates workflow state, and `PATCH /:taskId/assignee` assigns or unassigns an active organization member (private projects also require project membership). `GET /:taskId/subtasks` lists direct subtasks. `GET /api/v1/organizations/:organizationId/tasks/my` lists tasks assigned to the authenticated user across projects they can access.

Task authorization combines active organization RBAC with project membership roles; private-project visibility and tenant-scoped task queries are enforced on every project task route. Editors can create/update/assign tasks; Viewers are read-only. Dependency and parent relationships must stay within the same project and cycles are rejected. Deleting a task clears references from dependent tasks and unparents its subtasks transactionally. Removing an organization member clears their task assignments, and removing someone from a project unassigns them from that project's tasks.

## Comments and collaboration (Phase 8)

Comments are nested under `/api/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId/comments`. `GET /` retrieves paginated comments; `POST /` creates a comment with optional mentioned organization-member IDs; `PATCH /:commentId` edits the author's comment; and `DELETE /:commentId` soft-deletes it. Mention targets must be active in the organization and, for private projects, have project access. Mentions generate in-app notifications. Task and comment create/update/delete, status, and assignment events are persisted to an immutable project activity feed at `/api/v1/organizations/:organizationId/projects/:projectId/activity`.

## Notifications (Phase 9)

Notifications are private to the authenticated recipient and organization-scoped: `GET /api/v1/organizations/:organizationId/notifications` provides category filtering, unread-only filtering, and pagination; `GET /unread-count` returns the unread count; `PATCH /:notificationId/read` and `PATCH /read-all` mark notifications as read. Notifications are generated for task assignment and comment mentions. A small native Node.js interval scan creates idempotent due-soon and overdue task reminders; it uses MongoDB unique dedupe keys and does not require Redis or BullMQ.

## Activity logs (Phase 10)

The immutable activity model records organization and project lifecycle events, task changes, comments, invitation acceptance/revocation, membership changes, and organization/project role changes. Activities are written in the same MongoDB transaction as the related mutation when supported. `GET /api/v1/organizations/:organizationId/activity` retrieves tenant-scoped activity with pagination, action/actor/resource filters, and ISO date bounds; `GET /api/v1/organizations/:organizationId/projects/:projectId/activity` returns the project-scoped feed. Activity metadata stores changed field names and role identifiers, not credentials or request bodies.

## Analytics (Phase 11)

- `GET /api/v1/organizations/:organizationId/analytics` returns active project/member counts, task totals and completion rate, overdue tasks, status/priority distributions, per-project totals, assigned-member workload, unassigned task counts, and completion trends. Organization analytics are limited to Owner, Admin, and Manager roles.
- `GET /api/v1/organizations/:organizationId/projects/:projectId/analytics` returns equivalent task and productivity metrics for a project visible to the caller.
- Both endpoints accept optional ISO `from`/`to` date-time bounds and a `granularity` of `day`, `week`, or `month`. Operational task statistics use task creation time for the selected window; productivity trends use completion time. Trends are bucketed in UTC.

Aggregation results are computed server-side with tenant/project-scoped MongoDB pipelines; clients cannot submit filters or aggregation operators. Analytics uses MongoDB 5.0+ `$dateTrunc`.

## Testing, security, and production readiness (Phases 12–13)

CI runs lint, unit and HTTP integration tests with coverage on Node.js 20 and 22, validates application/OpenAPI startup, and audits dependencies. Security controls include strict Joi schemas, unsafe-key rejection, server-side RBAC, organization-scoped aggregation, hashed one-time/refresh tokens, rate limiting, and production secret/CORS validation. Dependency and database index reviews are part of the release checklist.

The service emits structured JSON logs with request IDs, provides separate liveness and database-readiness health checks, uses configurable MongoDB connection pools/timeouts, and performs signal-driven graceful shutdown. No third-party monitoring agent is enabled by default; deployers can route structured application logs and health probes into their existing monitoring stack. See [docs/deployment.md](docs/deployment.md) for production configuration, index provisioning, deployment, and operations.
