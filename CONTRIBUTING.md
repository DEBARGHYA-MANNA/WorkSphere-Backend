# Contributing

## Development workflow

- Use the active Arena feature branch for this session; do not develop directly on `main`.
- Keep changes focused and use Conventional Commit messages.
- Add or update Jest/Supertest coverage for behavior changes.
- Run `npm test` and `npm run lint` before proposing changes.
- Never commit `.env` files, credentials, or generated coverage output.

## Local setup

1. Install Node.js 20 or later and MongoDB Community Server.
2. Copy `.env.example` to `.env` and configure `MONGODB_URI`.
3. Run `npm install`, then `npm run dev`.

The current foundation starts the API after MongoDB connects. MongoDB transactions in later phases require a replica-set deployment (including a single-node local replica set); standalone MongoDB does not support multi-document transactions.
