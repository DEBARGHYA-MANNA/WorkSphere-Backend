# WorkSphere Backend

WorkSphere is a multi-tenant project management SaaS backend built with Node.js, Express, MongoDB, and Mongoose. This repository is being delivered incrementally; the current implementation includes **Phases 1–4: Foundation, Authentication, User Management, and Organizations/Multi-Tenancy**.

## Requirements

- Node.js 20 or later
- MongoDB running locally or a managed MongoDB URI

## Setup

```bash
npm install
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

See `.env.example` for the supported environment variables. `CORS_ORIGIN` accepts a comma-separated list of allowed origins. Avoid `*` when using credentialed browser requests.

## Tests and lint

```bash
npm test
npm run lint
```

The initial integration tests exercise the HTTP foundation and do not require a live database. Later database integration tests should use an isolated test database and must never target development or production data.

## MongoDB transactions

Organization creation/deletion and invitation acceptance use multi-document transactions, which require MongoDB to run as a replica set or sharded cluster. A local standalone `mongod` is sufficient for health endpoints but not these operations. For local transaction development, configure MongoDB as a single-node replica set and connect using a replica-set URI, for example `mongodb://127.0.0.1:27017/worksphere?replicaSet=rs0`.

## Current scope

The foundation, authentication, self-service user management, organization/member/invitation APIs, centralized RBAC, and tenant access checks are implemented in phases. Project, task, comment, notification, activity, and analytics modules remain future work.

## Authentication (Phase 2)

Available authentication routes under `/api/v1/auth`:

- `POST /register` — creates an account and emails a one-time verification token.
- `POST /resend-verification` — retries verification delivery without revealing whether an account exists.
- `POST /verify-email` — verifies the account and starts a session.
- `POST /login` and `POST /refresh` — return short-lived access JWTs; refresh tokens are rotated and sent only in an HttpOnly cookie.
- `POST /logout` and authenticated `POST /logout-all` — revoke the current session or all account sessions.
- `POST /forgot-password` and `POST /reset-password` — issue and consume one-time reset tokens; successful reset revokes existing sessions.
- `GET /api/v1/users/me` — example access-token-protected user endpoint.

Refresh tokens and one-time email/password tokens are generated from cryptographically secure randomness and only SHA-256 hashes are persisted. Reuse of an already-rotated refresh token revokes that session family. Passwords are bcrypt-hashed (12 rounds by default) and are never returned by the API. Access tokens are signed with HS256, default to a 15-minute lifetime, and are checked against active server-side session records so logout/revocation takes effect immediately.

Set `JWT_ACCESS_SECRET` to a unique random value of at least 32 characters in production. Refresh cookies are `HttpOnly`, `SameSite=Lax` by default, scoped to the auth routes, and use `Secure` in production. Set `COOKIE_SAME_SITE=none` only for cross-site browser deployments over HTTPS.

Email is behind a provider-independent transport interface. Configure a transport with `configureMailTransport({ sendMail(message) { ... } })` during application startup to deliver verification and reset messages. No provider credentials or vendor dependency are included. Without a configured transport, local development logs that delivery was skipped without logging any token; emails will not be delivered.

## Authentication test coverage

Authentication service tests cover registration hashing, email verification, credential checks, refresh rotation/reuse revocation, logout, logout-all, and password reset/session invalidation. HTTP tests cover validation, refresh-cookie handling, logout, protected routes, and generic password-reset responses. Tests use isolated in-memory model fakes for service behavior and do not require connecting to a development or production database.

## User management (Phase 3)

- `GET /api/v1/users/me` retrieves the authenticated profile.
- `PATCH /api/v1/users/me` updates name, bio, avatar URL, timezone, and optionally email. Email changes clear verification, send a new one-time verification token, and revoke existing sessions.
- `PATCH /api/v1/users/me/password` verifies the current password, changes the hash, and revokes all sessions.
- `DELETE /api/v1/users/me` performs a password-confirmed soft deactivation, sets account status to disabled, and revokes sessions. It does not hard-delete or anonymize account data.
- `GET /api/v1/users/:userId` is currently restricted to looking up the authenticated user. A global user directory/search is intentionally deferred until organization membership exists, so users cannot enumerate accounts across tenants.

Profile updates reject account-status or role fields; users can only deactivate their own account. Email re-verification is required before an updated email can be used to sign in.

## Organizations and multi-tenancy (Phase 4)

- `POST /api/v1/organizations` creates an organization with its initial Owner membership in one MongoDB transaction.
- `GET /api/v1/organizations` lists only organizations where the authenticated user has an active membership.
- `GET`, `PATCH`, `DELETE /api/v1/organizations/:organizationId` enforce membership and role permissions; deletion is limited to the Owner and transactionally removes organization memberships and invitations.
- `POST /api/v1/organizations/:organizationId/switch` confirms and returns the selected organization context. All organization-scoped routes independently validate membership; clients cannot switch by simply supplying an arbitrary ID.
- `GET /api/v1/organizations/:organizationId/members` provides tenant-scoped, paginated member listings. Role changes and removals enforce a strict hierarchy; Owner cannot be assigned or removed.
- Nested organization invitation routes create, list, and revoke invitations. `POST /api/v1/invitations/accept` requires a valid, unexpired token and the matching verified account email; acceptance atomically activates membership and consumes the token.

Roles are Owner, Admin, Manager, Member, and Viewer, with permission checks centralized in `src/constants/permissions.js`. Organization-owned queries use a required organization scope helper. User lookup remains self-scoped until organization membership provides a safe directory boundary.

Organization creation/deletion and invitation acceptance depend on MongoDB transaction support. Configure the database as a replica set as described above. The mail transport abstraction must be configured to deliver organization invitations.
