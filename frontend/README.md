# S.A.F.E Frontend

React, TypeScript, Vite, Tailwind CSS, React Router, Recharts, and Lucide React
implementation of the IoT Embedded Water Filtration System research console.

## UI and routes

The Mosaic-style UI includes a responsive shell, desktop sidebar, mobile drawer,
header, card/grid layouts, and Recharts visual integration. Mobile navigation
supports focus containment, Escape dismissal, and focus restoration.

`/login` sits outside the protected application shell. The protected routes are
`/dashboard`, `/history`, `/alerts`, `/test-runs`, `/calibration`,
`/laboratory-validation`, `/maintenance`, and `/settings`. Unauthenticated
visitors are redirected to login with the requested destination retained;
successful sign-in returns to an accepted local destination or `/dashboard`.

Login and application pages share light/dark themes. An explicit choice is
persisted in `localStorage`; without a valid saved choice, the UI follows the
operating-system preference and its changes, falling back to light if unavailable.
Only an explicit choice is saved. If storage is blocked, that choice still works
for the current session.

## Data and authentication boundaries

Pages and components consume typed domain services. Those services now make
authenticated Express REST requests for telemetry, alerts, test runs,
calibration, laboratory associations, maintenance, device status, settings,
and users. There is no local mock fallback when the API is unavailable: the UI
shows loading, empty, or error states. Existing mock fixtures remain in the
repository but are not imported by active domain services. The frontend does
not connect directly to Supabase or control physical hardware.

Authentication uses the Express API (`/auth/login`, `/auth/refresh`, and
`/auth/logout`). Dashboard routes require a signed-in session. The access token
is kept in memory; a refresh token is kept in this tab's `sessionStorage` to
restore the session after a reload. This is a browser-JavaScript storage
tradeoff, not an HttpOnly-cookie session. Signing in enables API requests; it
does not prove that returned records came from live ESP32 hardware. Seeded or
simulated data is not real experimental evidence.

The session layer restores through refresh, schedules refresh before expiry,
and provides Bearer-authenticated `apiRequest` calls with one refresh/retry after
a 401 response. Invalid or unavailable refresh clears the session. Sign out
calls the backend and clears local credentials even if the request fails; in
that case server-side invalidation is not confirmed. Header and Settings display
the API-provided current user, not mock account identities. Multi-user
administration and role editing are not implemented; Settings changes now use
the backend settings endpoint. Final role and hardware permissions remain
unresolved. Software-record writes do not issue hardware commands.

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

The example value is `http://localhost:3000/api/v1` and includes the API prefix.
Use `http://localhost:5173` to open the Vite app with the backend's example
`CORS_ORIGIN`. Opening the app at `http://127.0.0.1:5173` instead requires the
backend's local `CORS_ORIGIN` to match that exact origin; these hostnames are
not interchangeable for browser CORS.
Production requests should use HTTPS. Never place Supabase service-role keys,
device credentials, or account passwords in frontend configuration.

An existing backend test account and a running local/test backend are required
to verify login at runtime. The UI does not provide public signup.

`npm run build` includes TypeScript checking before the Vite build; lint uses
Oxlint. There is no frontend test script currently configured. Build/lint do not
prove live authentication or domain connectivity: real login, destination
restoration, authenticated Header/Settings rendering, reload restoration,
refresh, domain reads/writes, sign out, and protected-route responsive review
remain end-to-end verification items. The local backend was not running when
this code-level integration was prepared.

See the [backend API reference](../backend/docs/API_REFERENCE.md) for implemented
endpoints. Authentication is not proof of live hardware telemetry, ESP32 connectivity,
approved authorization policy, laboratory validation, or water potability.
