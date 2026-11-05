# Testing Guide

## Requirements and commands

Use Node.js 20 or 22 and install from the committed lockfile:

```bash
npm ci
npm test
npm run test:coverage
npm run lint
npm audit --audit-level=high
```

Jest runs serially by default. Integration suites use Supertest against the Express app and isolated model/service fakes; they do not require a live MongoDB instance. Tests cover auth lifecycle and validation, organization/member/RBAC access, project/task APIs, collaboration, notifications, activity, analytics, configuration, and health responses.

## Quality gates

`npm run test:coverage` enforces the repository's global coverage thresholds in `jest.config.js`. CI runs the suite and coverage, lint, application/OpenAPI initialization, and dependency audit on Node.js 20 and 22. For a pull request also run:

```bash
git diff --check
node -e "const app=require('./src/app'); const spec=require('./src/config/swagger'); if (!app || !spec.paths['/organizations/{organizationId}/analytics']) process.exit(1)"
```

Add regression tests for every discovered integration issue. Public route changes must update `src/config/swagger.js`; authorization changes need negative tests for unauthorized roles, cross-organization IDs, private project boundaries, and recipient isolation.

## Optional live MongoDB verification

The standard suite is not a database integration test. To validate transactions and indexes locally, provision a disposable MongoDB 5.0+ replica set and use a test-only database/credential in a private `.env`. Verify connection/readiness, transaction commit/rollback, uniqueness/index behavior, and cleanup. `npm run db:indexes` creates indexes and must only point at an intentionally selected database. Never run destructive integration tests or index provisioning against production or shared staging data.

## Release verification record

Before a release, record Node.js/npm/MongoDB versions and the exact test/audit commands/results in the release pull request. Also verify production environment validation, mail delivery, replica-set transactions, index provisioning, health probes, shutdown behavior, backup recovery, and API/OpenAPI consistency in an isolated target-like environment. This workspace verification does not substitute for a live MongoDB or production deployment test.
