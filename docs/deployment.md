# Production deployment and operations

This service is a Node.js 20+ / MongoDB backend. Analytics uses MongoDB 5.0+ aggregation operators. Organization, project, task, comment, invitation, and activity operations that span documents require MongoDB replica-set or sharded-cluster transactions.

## 1. Build and secrets

1. Build from a reviewed commit on `main`/`develop` after CI succeeds.
2. Install production dependencies with `npm ci --omit=dev` and run with `npm start` under a process supervisor or container orchestrator.
3. Inject configuration through the hosting platform's secret/config store. Do not bake `.env` into an image or commit it. At minimum configure:
   - `NODE_ENV=production`
   - `JWT_ACCESS_SECRET`: a unique cryptographically random value of at least 32 characters; rotate with an explicit session-invalidation plan.
   - `MONGODB_URI`: a credentialed TLS connection to a MongoDB 5.0+ replica set/sharded cluster, with least-privilege application credentials.
   - `CORS_ORIGIN`: comma-separated exact browser origins; wildcard and implicit localhost defaults are rejected in production.
   - `COOKIE_SAME_SITE`: `lax` for same-site deployments or `none` for cross-site HTTPS deployments. Production cookies are Secure and HttpOnly.
   - `EMAIL_VERIFICATION_ENABLED`: currently defaults to `false`; only set to `true` after a production mail transport is configured and tested. With it disabled, registration signs users in without verifying email ownership.
4. Configure a trusted TLS-terminating reverse proxy. Set `TRUST_PROXY_HOPS` only to the known proxy-hop count; leave it at zero when connecting directly.
5. Tune `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`, MongoDB selection/socket timeouts, `REQUEST_TIMEOUT_MS`, and `SHUTDOWN_TIMEOUT_MS` to the deployment's concurrency and platform limits.

See `.env.example` for the full configuration list. The production configuration loader rejects development JWT secrets, wildcard CORS, and localhost MongoDB URIs.

## 2. Database and indexes

- Use a replica set or sharded cluster so transactional APIs work. Back up the database and rehearse restore procedures before release.
- `MONGOOSE_AUTO_INDEX` defaults off in production to avoid surprise index builds during process startup. Provision schema indexes as a controlled migration before deploying code that depends on them:

  ```bash
  # Run with the standard production environment injected by the secret manager.
  npm run db:indexes
  ```

- Index creation can consume I/O and disk space. Review the generated index changes against production data, schedule large builds appropriately, and monitor build completion before rolling out the API.
- Use a dedicated test database for any integration test that connects to MongoDB; never point tests at staging or production data.

## 3. Health, shutdown, and scaling

- `GET /api/v1/health` is the liveness probe; it must not be used as a database-ready signal.
- `GET /api/v1/health/ready` returns 503 until MongoDB is connected and is the readiness probe.
- Send SIGTERM (or SIGINT in local operations) for graceful shutdown. The process stops the reminder scheduler, waits for an active reminder scan, drains HTTP connections, and disconnects MongoDB; `SHUTDOWN_TIMEOUT_MS` bounds the drain.
- The reminder scheduler is process-local and safe to run in multiple replicas because notification records have MongoDB-backed unique deduplication keys. Do not add an external queue for this scan without a measured need.
- Configure container CPU/memory limits and restart policy outside the application. Use rolling deployments with readiness checks.

## 4. Logs and monitoring

- Logs are structured JSON, include a service name and request ID, and deliberately omit request bodies, authorization headers, passwords, and token values.
- Forward logs to the platform's existing log/alerting system. Alert on elevated 5xx/429 rates, repeated MongoDB disconnects, readiness failures, reminder scan failures, and shutdown timeouts.
- No vendor-specific metrics or tracing agent is enabled by default. Add one only when a concrete monitoring requirement and data-retention policy exist.

## 5. CI/CD and release checklist

GitHub Actions CI runs lint, coverage-enabled tests, startup/OpenAPI validation, and `npm audit` on Node.js 20 and 22 for pull requests and protected branch pushes. Deployment is intentionally left to the repository owner's hosting provider because no cloud platform or deployment credentials are defined here; configure a protected-environment deployment workflow using that provider's secret store.

Before release:

- [ ] CI passes and dependency audit has no unresolved high/critical findings.
- [ ] Production secrets and exact CORS origins are configured outside source control.
- [ ] MongoDB replica set, TLS, least-privilege credentials, backups, and indexes are verified.
- [ ] Swagger/OpenAPI at `/api-docs` and `/openapi.json` matches deployed routes.
- [ ] Liveness/readiness probes and SIGTERM drain behavior are tested in the target platform.
- [ ] Structured logs reach the monitoring system without sensitive request data.
- [ ] Rollback and database recovery procedures are documented and rehearsed.
