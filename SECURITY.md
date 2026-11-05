# Security Policy

## Supported versions

The current `main` release line is the supported line. Apply security updates promptly; deployments should use a reviewed release and current supported Node.js/MongoDB patch versions.

## Reporting a vulnerability

Do not report exploitable vulnerabilities in a public issue. Use GitHub's private vulnerability reporting/security advisory feature for this repository. Include affected version/commit, impact, reproduction steps, and any suggested mitigation. Do not include live credentials or another person's personal data. If private reporting is unavailable, contact the repository maintainers through a private channel listed in the repository's GitHub profile.

Please allow maintainers reasonable time to investigate and coordinate a fix before public disclosure. This project does not promise a specific response-time SLA.

## Security controls and deployment responsibilities

- Production startup requires an explicitly configured unique `JWT_ACCESS_SECRET` of at least 32 characters, non-wildcard `CORS_ORIGIN` values, and a non-local `MONGODB_URI`. Configuration errors stop startup.
- Access tokens are signed JWTs; refresh, invitation, email-verification, and password-reset tokens are generated randomly and stored only as hashes. Passwords use bcrypt.
- Authentication, rate limiting, strict request validation, unsafe-key rejection, server-side authorization, project visibility checks, organization scoping, and recipient scoping are enforced by the API.
- Security headers, explicit CORS allowlists, bounded request bodies, structured logs without request bodies/credentials, and graceful shutdown are enabled.
- Deployers must supply TLS, secure secret storage/rotation, database network controls and least-privilege users, backups/restore tests, log access/retention controls, and a real production mail transport. Do not run production with the development secret or a wildcard CORS origin.
- MongoDB transactions require a replica set or sharded cluster. Keep database server and Node.js runtimes patched; review dependency audit findings.

See [docs/security-review.md](docs/security-review.md) for the implementation checklist and [docs/deployment.md](docs/deployment.md) for deployment controls. Security claims depend on correct configuration and do not replace a threat model or independent penetration test.
