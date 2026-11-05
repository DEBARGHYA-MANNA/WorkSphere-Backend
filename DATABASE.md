# WorkSphere Database Guide

## Supported deployment

Use MongoDB 5.0 or later. Transactional workflows require a replica set or sharded cluster; a local single-node replica set is adequate for development. Analytics uses `$dateTrunc`, available from MongoDB 5.0. A standalone `mongod` may support basic local exploration but cannot run the transactional workflows.

Configure `MONGODB_URI` in `.env` (never commit credentials). A typical local replica-set URI is:

```text
mongodb://127.0.0.1:27017/worksphere?replicaSet=rs0
```

For a managed cluster, use the TLS-enabled URI from the provider, a least-privilege application user, network access controls, and tested backups. Do not use production data for tests.

## Collections and relationships

| Collection / model | Main relationships and purpose |
| --- | --- |
| `User` | Globally unique normalized email; owns resources and participates in organizations. Password and one-time credential hashes are not serialized. |
| `Organization` | Created by a `User`; owns memberships, invitations, projects, and organization activity. |
| `OrganizationMember` | Join collection between `Organization` and `User`; stores active status and organization role. |
| `Project` | Belongs to an organization; records creator/updater and visibility/archive state. |
| `ProjectMember` | Join collection between organization, project, and user; stores project role and membership status. |
| `Task` | Belongs to both an organization and project; may refer to an assignee, parent task, and same-project dependency tasks. |
| `Comment` | Belongs to organization, project, and task; references author and mentioned users. Deletion is soft. |
| `Invitation` | Belongs to an organization; stores normalized invitee email, role, hashed token, lifecycle, and retention dates. |
| `RefreshToken` | References user and session/family IDs; stores only token hashes and rotation/revocation metadata. |
| `Notification` | Belongs to organization and recipient; may reference actor, project, and task. Unique dedupe keys make reminders idempotent. |
| `Activity` | Immutable organization/project/task timeline record referencing actor and target; stores safe event metadata, not request bodies or secrets. |

Organization-owned records intentionally include `organizationId`, even when a parent reference could imply it. Services use that field as a tenant boundary and also validate the parent relationship. References are logical Mongoose ObjectId references; MongoDB does not automatically enforce foreign keys.

## Indexes and provisioning

Schemas declare unique identity/relationship indexes, tenant-scoped listing and timeline indexes, workload/due-date indexes, notification deduplication, and TTL retention indexes for expiring invitations and refresh tokens. Review index changes for size and write cost before production rollout.

Development enables Mongoose auto-indexing by default. Production disables it by default. Provision declared indexes as a reviewed deployment operation:

```bash
npm run db:indexes
```

Run this using the production deployment's injected configuration before deploying code that depends on new indexes. See [docs/deployment.md](docs/deployment.md).

## Transactions and lifecycle

Operations that modify multiple collections use MongoDB sessions/transactions. These include organization create/delete, project/task lifecycle and membership cleanup, invitation acceptance/revocation, member role/removal changes, comment/notification/activity writes, and related audit records. If a deployment cannot provide transactions, those writes fail rather than silently becoming partially atomic. Test transaction and recovery behavior against a replica-set test database.

Activity rows are append-only by application design. TTL indexes asynchronously expire selected credential/invitation records; TTL cleanup is not immediate and must not be treated as an exact timer.

## Data safety

- Use a separate database name and dedicated credentials for local, CI, staging, and production.
- Back up and periodically rehearse restores, including indexes and replica-set configuration.
- Never store plaintext passwords, refresh tokens, invitation tokens, or verification/reset tokens.
- Never serialize internal token hashes or password hashes.
- Avoid placing personal data or secrets in activity metadata and logs.
- Apply retention and deletion requirements through reviewed database/application changes; do not manually delete tenant records without preserving transaction and reference invariants.
