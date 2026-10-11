# GENESIS Campus Connect

Unified campus e-governance portal (Team STORMBREAKER): clubs submit event requests, the Events Section and the Office of Student Affairs (OSA) review and approve them, and students discover and register for published events. Amrita brand theme, a chat assistant for every role, server-enforced roles and rules.

This is the **clean, deployable version**: a separate frontend and backend, a small shared package, one database (PostgreSQL on Neon in production, SQLite for local work and tests).

```
frontend/   React 18 + Vite + Tailwind. Static site: deploy to Vercel, Netlify or any static host.
backend/    Node 20 + Express + Knex. A normal Node service: deploy to Render, Railway, Fly, a VPS...
shared/     The approval workflow engine, permissions, sample data and per-portal views, used by both.
e2e/        Playwright journeys that drive a real browser against the real backend.
docs/       Architecture and deployment notes.
```

## Run it locally (SQLite, nothing to install)

```bash
npm install
cp backend/.env.example backend/.env      # then set JWT_SECRET to a long random string
npm run db:reset                          # creates backend/data/dev.sqlite with the sample data
npm run dev                               # backend :4000 and frontend :5173
```

Open http://localhost:5173. Demo accounts (the sign-in screen has a **Fill** button):

| Role           | Path               | User ID      | Password     |
| -------------- | ------------------ | ------------ | ------------ |
| Student        | Student            | `STU2026001` | `student123` |
| Club Authority | Club Authority     | `CLUB001`    | `club123`    |
| OSA            | Administrator, OSA | `OSA001`     | `osa123`     |
| Events Section | Administrator      | `EVT001`     | `events123`  |

## Use PostgreSQL (Neon)

In `backend/.env`:

```
DATABASE_CLIENT=pg
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
```

Then `npm run db:migrate` (creates the tables) and `npm run db:seed` (sample clubs, events and demo accounts). The server also runs pending migrations every time it starts. Do not use `db:reset` (it only works on local SQLite). **Never commit `.env`.**

## Commands

| Command                          | What it does                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Backend and frontend together                                                                       |
| `npm test`                       | Shared, backend and frontend tests (SQLite, in memory)                                              |
| `npm run test:pg`                | Backend tests on PostgreSQL: set `TEST_DATABASE_URL` to a SEPARATE throwaway database (it is wiped) |
| `npm run test:e2e`               | Playwright journeys in Chrome against a fresh seeded stack                                          |
| `npm run build`                  | Production build of the frontend (`frontend/dist`)                                                  |
| `npm run db:migrate` / `db:seed` | Create or update the tables / load the sample data                                                  |
| `npm run lint`                   | ESLint and Prettier check                                                                           |

## How it fits together

- **Login** is our own: bcrypt passwords, a signed access token (2 hours) and an httpOnly refresh cookie. Each account belongs to one portal (student, club, OSA, Events Section).
- **Rules** (who may review, approve, publish) live in `shared/src/gov`. The browser runs them for instant feedback; the backend runs the same code as the authority, checks your role, and saves the result in one database transaction.
- **Data** is stored as JSON documents in `gov_docs` plus `gov_registrations` (seats), `gov_user_state`, `gov_files` (posters) and the auth tables. Posters are stored in the database, so the backend needs no persistent disk.
- **Chat** calls Claude from the backend only (`ANTHROPIC_API_KEY`). Without a key it answers portal questions and small talk with built-in rules.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) to put it online and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Known limits

- The sample data uses a fixed demo date (10 October 2026) so deadlines stay meaningful.
- Uploaded documents are recorded by name and size only; posters are stored as images.
- Rate limits and the login lockout are kept in memory: run one backend instance, or move them to Redis before scaling out.
- Demo accounts are created only when `SEED_DEMO_PORTAL=true` and never in production; their passwords are shown on the sign-in screen by design. Set `SEED_DEMO_PORTAL=false` and create real accounts for a real launch.
