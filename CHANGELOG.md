# Changelog

Notable changes for WorkSphere Backend are documented here. Dates use ISO 8601.

## [2.0.0] - 2026-11-05

### Added

- Multi-tenant organizations, memberships, invitations, centralized RBAC, and organization-scoped access controls.
- Project and task workflows, private project membership, task assignment/dependencies/subtasks, and task comments/mentions.
- Recipient-scoped notifications, deduplicated due-date reminders, immutable activity history, and organization/project analytics.
- Production-oriented configuration validation, health/readiness endpoints, structured request logging, graceful shutdown, controlled index provisioning, OpenAPI 3 documentation, and Node.js 20/22 CI.
- Architecture, database, API, contributing, security, testing, changelog, and deployment documentation.

### Security

- Hashed one-time and refresh credentials; bcrypt password hashing; strict validation, rate limits, tenant authorization, unsafe-key rejection, and production secret/CORS/database checks.

### Compatibility and operations

- Requires Node.js 20 or newer and MongoDB 5.0 or newer. Multi-document transactions require a replica set or sharded cluster. Analytics uses MongoDB 5.0 aggregation features.
- Production index creation is a controlled operation via `npm run db:indexes`; production auto-indexing is disabled by default.
- Production email delivery requires a configured mail transport adapter. No mail vendor or production database provisioning is bundled.

### Verification

- `npm run test:coverage`: 37 suites, 131 tests passed; global coverage gates passed.
- `npm run lint`: passed.
- `npm audit --audit-level=high`: zero vulnerabilities reported.
- App/OpenAPI module initialization: passed.
- Live MongoDB replica-set, provider mail delivery, production load, backup recovery, and deployment verification were not run as part of this release preparation.
