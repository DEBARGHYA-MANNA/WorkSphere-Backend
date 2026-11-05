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
