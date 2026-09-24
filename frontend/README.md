# AquaSense Frontend

React, TypeScript, Vite, and Tailwind CSS implementation of the approved IoT
Embedded Water Filtration System research console.

Pages and components consume typed domain services. Those services currently
use local development adapters and are prepared to switch to the planned
Express REST API without changing page-level data access. The frontend does not
connect directly to Supabase and does not control physical hardware.

Authentication uses the Express API (`/auth/login`, `/auth/refresh`, and
`/auth/logout`). Dashboard routes require a signed-in session. The access token
is kept in memory; a refresh token is kept in this tab's `sessionStorage` to
restore the session after a reload. This is a browser-JavaScript storage
tradeoff, not an HttpOnly-cookie session. Domain pages still use their local
development data; signing in does not make their telemetry live.

## Local setup

```powershell
cd frontend
npm install
npm run dev
```

## Verification

```powershell
npm run build
npm run lint
```

Copy `.env.example` to a local `.env` when connecting an approved Express API,
then set `VITE_API_BASE_URL` to that API's public base URL. No secrets belong in
frontend environment variables.

An existing backend test account and a running local/test backend are required
to verify login at runtime. The UI does not provide public signup.
