# Deployment

Three parts: the database (Neon), the backend (a Node service) and the frontend (a static site).

## 1. Database: Neon

1. Create a Neon project and copy the connection string (`postgresql://...?sslmode=require`).
2. Keep it secret: it goes only into the backend's environment variables, never into git or the frontend.
3. Create the tables and sample data once, from your machine or the host's shell:
   ```bash
   cd backend
   DATABASE_CLIENT=pg DATABASE_URL="<your string>" npm run db:migrate
   DATABASE_CLIENT=pg DATABASE_URL="<your string>" npm run db:seed
   ```
   The backend also applies pending migrations on every start.
4. Rotate the database password if the string was ever pasted somewhere public.

## 2. Backend (Render, Railway, Fly.io, a VPS...)

- Root directory: repository root. Build: `npm install --omit=dev` (SQLite is a dev dependency and is not needed). Start: `npm start -w backend` (or `node backend/src/server.js`).
- Environment variables:

| Variable            | Value                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                                                                                                        |
| `DATABASE_CLIENT`   | `pg`                                                                                                                                                |
| `DATABASE_URL`      | the Neon connection string                                                                                                                          |
| `JWT_SECRET`        | a random string of 32+ characters (the server refuses to start in production without one)                                                           |
| `WEB_URL`           | the frontend URL, e.g. `https://campus.example.vercel.app` (several allowed, comma separated)                                                       |
| `API_URL`           | the public URL of this backend, e.g. `https://campus-api.onrender.com`                                                                              |
| `AUTO_VERIFY_EMAIL` | `false` in production (the server refuses `true`), and set `SMTP_*` for real email                                                                  |
| `SEED_DEMO_PORTAL`  | `false` (the demo accounts are never created in production anyway)                                                                                  |
| `GROQ_API_KEY`      | optional: turns on model-written chat answers (Groq, default model `openai/gpt-oss-120b`). `ANTHROPIC_API_KEY` works too; Groq wins if both are set |
| `LLM_MODEL`         | optional: override the model name                                                                                                                   |

- Health check URL: `/api/v1/health`.
- The refresh cookie uses `SameSite=None; Secure` in production so it works when the frontend and backend are on different domains. Both must be served over HTTPS.

## 3. Frontend (Vercel, Netlify, Cloudflare Pages...)

- Root directory: `frontend`. Build: `npm run build`. Output: `dist`.
- Environment variable at build time: `VITE_API_URL` = the backend's public URL (no trailing slash).
- `vercel.json` sends every path to `index.html` (single-page app) and forwards `/api/*` to the deployed backend (`campus-api-oq8k.onrender.com`), so the browser sees one origin and `VITE_API_URL` can stay empty. Change the destination if the backend moves. `public/_redirects` is the Netlify equivalent.

## 4. Real accounts

The demo accounts exist only for demos. For a launch, create users with `POST /api/v1/auth/signup` (students) or insert admin users directly, and keep `SEED_DEMO_PORTAL=false`.

## Checklist

- [ ] `JWT_SECRET` set, long and random
- [ ] `DATABASE_URL` set on the backend only
- [ ] `WEB_URL` equals the frontend origin exactly (scheme and host, no trailing slash)
- [ ] `VITE_API_URL` equals the backend URL
- [ ] HTTPS on both
- [ ] `/api/v1/health` answers `ok`
