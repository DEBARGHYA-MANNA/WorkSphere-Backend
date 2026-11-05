# WorkSphere Backend

WorkSphere is a multi-tenant project management SaaS backend built with Node.js, Express, MongoDB, and Mongoose. This repository is being delivered incrementally; the current implementation is **Phase 1: Project Foundation**.

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

Multi-document transactions planned for later phases require MongoDB to run as a replica set or sharded cluster. A local standalone `mongod` is sufficient for the current health endpoints, but not for transaction-backed features. For local transaction development, configure MongoDB as a single-node replica set and connect using a replica-set URI, for example `mongodb://127.0.0.1:27017/worksphere?replicaSet=rs0`.

## Current scope

Phase 1 includes environment configuration, Mongoose connectivity, Winston logging, security middleware, request validation utilities, standardized error/404 handling, Swagger/OpenAPI, health/readiness endpoints, and Jest/Supertest coverage. Authentication and product-domain features are intentionally out of scope until subsequent phases.

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
