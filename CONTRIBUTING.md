# Contributing

## Required tools

- Node.js 20 or 22 and npm (use the committed `package-lock.json` with `npm ci`).
- MongoDB 5.0+ configured as a replica set for workflows that use transactions.
- Git. Optional: GitHub CLI (`gh`) for pull requests and checks.

## Local development

1. Fork/clone the repository and create a focused feature branch from `develop` (do not commit directly to `main` or `develop`).
2. Run `npm ci` and `cp .env.example .env`; adjust the local MongoDB URI and other settings.
3. Start the API with `npm run dev`. The server waits for its MongoDB connection before accepting API traffic.
4. Make small, reviewed changes following the existing routes/controller/service/model structure. Validate user input with Joi and keep tenant scoping in the service/query path.
5. Add/update unit and HTTP integration tests for behavior changes, including authorization and tenant boundaries.
6. Before opening a pull request, run `npm run lint`, `npm run test:coverage`, `npm audit --audit-level=high`, and `git diff --check`.
7. Submit a pull request to `develop`; explain behavior changes, security considerations, configuration/database changes, test evidence, and any migration or rollout requirements. Release changes from `develop` through a reviewed release pull request to `main`.

## Coding and security expectations

- Do not trust client-supplied roles, user IDs, organization filters, or project relationships.
- Do not log credentials, token contents, password data, or request bodies.
- Never commit `.env`, secrets, local database files, coverage output, or `node_modules`.
- Update OpenAPI and relevant root documentation when changing public behavior, schemas, configuration, or operational requirements.
- Database schema/index changes must be reviewed for compatibility, data migration, and deploy ordering.

## Tests and pull requests

The default Jest/Supertest suites use isolated model fakes and do not need a live database. Replica-set integration tests should use a separately provisioned, disposable database; do not point test commands at staging or production. CI runs on Node.js 20 and 22 and validates tests/coverage, lint, OpenAPI/application initialization, and dependency audit. See [TESTING.md](TESTING.md).
