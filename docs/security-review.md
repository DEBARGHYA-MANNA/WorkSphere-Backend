# Security and quality review

Review date: 2026-11-05. Scope: the existing backend plus activity logs, analytics, environment/operational hardening, and the related query/filter changes. This is a code review and automated-test record, not a substitute for an independent penetration test or a production-dataset load test.

## Controls reviewed and tested

- **Authentication:** access tokens are checked against active server-side sessions; refresh and one-time tokens are stored as hashes; password hashing uses bcrypt. Existing auth unit/HTTP tests cover invalid credentials, token rotation/replay, session revocation, password reset, and protected routes.
- **Authorization and tenant isolation:** organization middleware verifies active membership; project/task access checks organization and private-project membership; organization and project activity feeds and analytics include server-derived organization/project IDs. Analytics aggregation uses a server-built pipeline and is never accepted from the request. Organization-wide analytics are restricted to Owner/Admin/Manager; project analytics passes through project-read authorization.
- **Input and query safety:** Joi validation rejects malformed IDs, unknown filter values, invalid date windows, and unsupported fields. `reject-unsafe-keys` rejects client keys beginning with `$` or containing `.`. With Mongoose `sanitizeFilter` enabled, trusted operators are marked only on server-constructed query filters; a regression test verifies trusted filters cast and untrusted operators are rejected.
- **Secrets, cookies, and CORS:** production rejects missing/placeholder JWT secrets, wildcard/unconfigured CORS origins, and localhost database URIs. Refresh cookies are HttpOnly and Secure in production. Secrets are supplied through deployment environment/secret management, never source-controlled.
- **Errors and logging:** API errors have stable codes and request IDs; unexpected production errors return a generic message. Structured logs carry request IDs and operational metadata; request bodies and credentials are not logged.
- **Tenant data deletion:** task deletion removes linked comments/notifications and retains a task-deleted history event; project/organization hard deletion removes nested tenant data; membership removal revokes project memberships and clears assignments/recipient notifications. These cascades and their history writes use transaction boundaries where relevant. User-provided activity/analytics filters are whitelisted.
- **Indexes and performance:** reviewed organization/project/task/activity/notification indexes. Analytics uses a single tenant-scoped `$facet` aggregation per request, and date filters can constrain creation/completion work. Activity feeds are paginated and indexed by organization/project/actor timelines.

## Automated quality checks

- Unit and HTTP integration suite: 35 suites / 128 tests.
- Coverage run: enforced minimums of 80% statements, 65% branches, 75% functions, and 85% lines globally, with higher thresholds for activity and analytics modules.
- `npm run lint`, application/OpenAPI startup validation, and `npm audit --audit-level=high` are part of CI. The audit reported zero vulnerabilities at review time.

## Residual risks and operational requirements

- Transactions require MongoDB 5.0+ on a replica set or sharded cluster. Run the controlled index-provisioning command before production rollout when automatic index creation is disabled.
- Analytics and reminder scans have unit/fake-model coverage but have not been load-tested against a production-sized database. Benchmark representative tenant sizes before setting production SLOs or increasing request concurrency.
- The default API rate limiter is process-local; multi-replica deployments should enforce an additional shared edge/API-gateway rate limit for abuse-sensitive routes if traffic warrants it.
- No third-party monitoring or deployment provider is selected. Use platform health probes and forward structured logs; add vendor integrations only after selecting the hosting/monitoring stack.
- No independent penetration test, live replica-set integration test, or staging restoration drill was performed in this change.
