# GENESIS Campus Connect

Unified campus e-governance portal (Team STORMBREAKER): clubs submit event requests, the Events Section and the Office of Student Affairs (OSA) review and approve them, and students discover and register for published events. Amrita brand theme, a club-aware chat assistant, server-enforced roles and rules.

```
frontend/   React 18 + Vite + Tailwind. A static site: deploy to Vercel, Netlify or any static host.
backend/    Node 20 + Express + Knex on PostgreSQL (Neon). A normal Node service: Render, Railway, Fly, a VPS...
shared/     The approval workflow engine, permissions, club knowledge and per-portal views, used by both.
e2e/        Playwright journeys that drive a real browser against the real backend.
docs/       Architecture, deployment and the original project spec.
```

## Run it locally

You need Node 20+ and a PostgreSQL database. A free [Neon](https://neon.tech) project works: copy its connection string.

```bash
npm install
cp backend/.env.example backend/.env     # then fill in DATABASE_URL and a long random JWT_SECRET
npm run db:migrate                       # creates the tables
npm run db:seed                          # sample clubs, events, requests and demo accounts
npm run dev                              # backend :4000 and frontend :5173
```

Open http://localhost:5173. Demo accounts (the sign-in screen has a **Fill** button):

| Role           | Path               | User ID      | Password     |
| -------------- | ------------------ | ------------ | ------------ |
| Student        | Student            | `STU2026001` | `student123` |
| Club Authority | Club Authority     | `CLUB001`    | `club123`    |
| OSA            | Administrator, OSA | `OSA001`     | `osa123`     |
| Events Section | Administrator      | `EVT001`     | `events123`  |

The server also applies pending migrations every time it starts. **Never commit `backend/.env`.**

### Chat assistant (optional AI)

Without a key the chat answers with built-in rules. For model-written answers set one key in `backend/.env`:

```
GROQ_API_KEY=...        # Groq, default model openai/gpt-oss-120b
# ANTHROPIC_API_KEY=... # or Claude
```

The chat is limited to clubs, events and how the portal works: it explains what each club is for, suggests clubs for an interest, lists events and deadlines and explains registration and approvals. Anything else is refused before a model is called.

## Commands

| Command                          | What it does                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                    | Backend and frontend together                                                    |
| `npm test`                       | Shared, backend and frontend tests (the backend tests use an in-memory database) |
| `npm run test:e2e`               | Playwright journeys in Chrome against a throwaway database (never your real one) |
| `npm run build`                  | Production build of the frontend (`frontend/dist`)                               |
| `npm run db:migrate` / `db:seed` | Create or update the tables / load the sample data                               |
| `npm run lint`                   | ESLint and Prettier check                                                        |

SQLite appears only in `backend` dev dependencies: the automated tests and the end-to-end run use a throwaway in-memory or file database so they can never touch Neon. The running service refuses SQLite in production.

## How it fits together

- **Login** is our own: bcrypt passwords, a signed access token (2 hours) and an httpOnly refresh cookie. Each account belongs to one portal (student, club, OSA, Events Section).
- **Rules** (who may review, approve, publish) live in `shared/src/gov`. The browser runs them for instant feedback; the backend runs the same code as the authority, checks your role, and saves the result in one database transaction.
- **Data** is stored as JSON documents in `gov_docs` plus `gov_registrations` (seats), `gov_user_state`, `gov_files` (posters) and the auth tables. Posters live in the database, so the backend needs no persistent disk.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) to put it online and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Known limits

- The sample data uses a fixed demo date (10 October 2026) so deadlines stay meaningful.
- Uploaded documents are recorded by name and size only; posters are stored as images.
- Rate limits and the login lockout are kept in memory: run one backend instance, or move them to Redis before scaling out.
- Demo accounts are created only when `SEED_DEMO_PORTAL=true` and never in production. Set it to `false` and create real accounts for a real launch.
