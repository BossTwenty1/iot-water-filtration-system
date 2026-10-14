# Development

This document defines the development workflow for the IoT Embedded Water
Filtration System.

---

## 1. Team

Nash:
- Project Lead
- Frontend
- Integration
- Cross-component assistance

Alejandro:
- Backend
- Database
- API

Edgar:
- ESP32
- Firmware
- Hardware Integration

---

## 2. Repository Areas

```text
frontend/        React frontend
backend/         Node.js + Express backend
firmware/esp32/  ESP32 firmware
simulator/       synthetic device simulator
database/        migrations/schema artifacts
docs/            shared documentation
```

## 3. Frontend

The frontend uses React, TypeScript, Vite, Tailwind CSS, React Router, Recharts,
and Lucide React. The integrated Mosaic UI provides responsive layouts,
sidebar/mobile navigation, and shared light/dark themes. Pages consume typed
domain services, which now use authenticated Express REST requests for domain
reads and software-record/settings writes. Existing representative fixtures
are not used as a runtime fallback; failed API requests show an error. The
frontend does not connect directly to Supabase or control hardware.

```powershell
cd frontend
npm install
npm run dev
```

Before review, run:

```powershell
npm run build
npm run lint
```

`VITE_API_BASE_URL` is the public frontend environment variable for the Express
API base URL. Copy `frontend/.env.example` to a local `.env` when an approved API
is available. Do not place secrets, service-role credentials, or device
credentials in the frontend environment.

The example API base is `http://localhost:3000/api/v1`; include the API prefix.
Use HTTPS for production API requests. The build command includes TypeScript
checking; lint uses Oxlint. No frontend test script is currently configured.

### Authentication and route behavior

The login page probes the public `/api/v1/health` endpoint before enabling Sign in.
It shows a free-hosting wake-up notice, retries failed probes every five seconds,
and stops after 90 seconds. Users can enter credentials during startup or retry
the connection afterward without losing their inputs. Only health GETs are
retried; authentication requests and existing session/RBAC behavior are unchanged.
Cancellation clears the request and timers when the page is left. This is a
frontend usability improvement, not a keep-alive service or a cold-start removal.

History record inspection follows the existing 1050px stacked-layout breakpoint:
Inspect selects the row, scrolls to the inspector below the sticky header, and
moves focus into the inspector region. Back to records returns to the triggering
button. Desktop selection stays in place; reduced-motion scrolling is immediate.

`/login` is outside the protected shell. Dashboard, History, Alerts, Test Runs,
Calibration, Laboratory Validation, Maintenance, and Settings require a session.
The route guard waits for session restoration, then redirects unauthenticated
visitors to login while retaining their requested destination.

`useAuth` subscribes to the session state in `apiClient`. The client calls the
Express login/refresh/logout endpoints, retains access tokens and current-user
information in memory, and stores refresh tokens in tab-scoped `sessionStorage`.
This JavaScript-readable storage is not an HttpOnly-cookie session. Restoration
and scheduled refresh renew the session; `apiRequest` attaches Bearer tokens and
retries once after a 401 using refresh. Logout clears local credentials even
when server-side invalidation cannot be confirmed.

Header and Settings use the API-provided current user. There is no public signup
UI or implemented frontend multi-user administration. Authentication does not
finalize roles, authorize hardware actions, or prove that API telemetry comes
from live hardware. Backend authorization remains authoritative.

Live login, destination restoration, authenticated Header/Settings, session
restoration, token refresh, actual domain reads/writes, backend sign out, and protected
route responsive review require an approved backend/test account. Do not bypass
authentication or invent credentials for these checks.

### Theme behavior

`useTheme` and the pre-render initialization in `index.html` prefer a valid
explicit light/dark choice in `localStorage`. With no saved choice, they use the
OS preference (light fallback); the hook follows OS changes until the user makes
an explicit choice. Resolving the system preference does not persist it.

See the [frontend README](../frontend/README.md) for route paths and setup, and
the [backend API reference](../backend/docs/API_REFERENCE.md) for implemented
endpoints. Shared API/database draft status statements require separate team
reconciliation; this update does not approve new contracts or remove TBD items.

## 4. Render free-hosting preparation

Use separate services from `BossTwenty1/iot-water-filtration-system`, branch
`feature/user-management-rbac`: a Static Site for the frontend and a Free Node
Web Service for the backend. Keep Auto-Deploy **Off** and PR previews disabled.
Creating either service triggers its initial deployment, so obtain explicit
approval before clicking Create. Do not reuse services belonging to other apps.

| Setting | Frontend Static Site | Backend Web Service |
| --- | --- | --- |
| Root directory | `frontend` | `backend` |
| Build command | `npx --yes pnpm@9.15.9 install --frozen-lockfile --prod=false && npm run build` | `npx --yes pnpm@9.15.9 install --frozen-lockfile --prod=false && npm run build` |
| Publish directory | `dist` | Not applicable |
| Start command | Not applicable | `npm start` |
| Health check | Not applicable | `/api/v1/health` |

Set `NODE_VERSION=24.21.0` for both services. The build command explicitly uses
pnpm 9.15.9, compatible with the existing version-9 lockfiles, rather than relying
on Render's package-manager default or an undocumented version environment
variable. npm only executes the existing build/start scripts; it does not install
application dependencies. Include dev dependencies during builds because
TypeScript and Vite are build tools. The backend has no npm lockfile, so do not
use `npm ci` there. The remote Linux dependency installation remains Not Confirmed
until an approved initial deploy; no dependency build-script policy was changed
on the local machine.

The frontend needs only the public API setting
`VITE_API_BASE_URL=https://<approved-backend-host>/api/v1`. Vite embeds this at
build time; changing it requires a new approved build. Add a Static Site rewrite
from `/*` to `/index.html` (Rewrite, not Redirect) for React Router refreshes.
Never add backend credentials or a Supabase service-role key to this site.

The backend needs private `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`DEVICE_INGEST_KEY` values, `SUPABASE_URL=https://hxqshgajtithvuftnizo.supabase.co`,
`CORS_ORIGIN=https://<approved-frontend-host>` (exact origin, no path or trailing
slash), and `NODE_ENV=production`. Render supplies `PORT`; the backend prefers
it over the local `BACKEND_PORT` fallback. The existing listener accepts external
connections; do not use `vite preview` as a hosted server. `DATABASE_URL` is not
used by the running API and is not required for this service. Keep migration,
seed, simulation, and bootstrap commands out of build/start/pre-deploy commands.

Optional timing settings retain their existing defaults:
`SSE_POLL_INTERVAL_MS=3000`, `DEVICE_WATCHDOG_INTERVAL_MS=10000`,
`DEVICE_OFFLINE_TIMEOUT_MS=30000`, and `RETENTION_JOB_INTERVAL_MS=86400000`.
Background jobs are disabled by default. Only `BACKGROUND_JOBS_ENABLED=true`
starts the device watchdog and immediately checks retention; keep it disabled
for the Render development demo. Retention can delete old readings if a policy
is configured. Review
these existing data-writing jobs before authorizing hosted startup. Do not start
a second API instance against the same database without coordinating the jobs.

Do not connect or deploy this RBAC backend to hosted Supabase before separate
approval of the migration and rollout. The safe sequence is recovery checkpoint,
reviewed RBAC migration, separately authorized initial Super Administrator
bootstrap, compatible backend, frontend, then approved hosted smoke checks.
Existing Administrators must not be silently promoted. Service-role credentials
must be entered privately in the backend service only after that approval.

Render provides public HTTPS URLs. The hosted frontend must use the backend's
public HTTPS URL, not localhost or Render's private-network hostname. Hosted
login, CORS, deep-link refresh, and Supabase connectivity remain Not Confirmed
until the services are approved and deployed.

Free web services sleep after 15 minutes without inbound traffic and can take
about a minute to wake up; the Static Site does not sleep. Open the API health
page before the defense and allow it to warm up. Free hosting is suitable for
the capstone demo, not an always-on telemetry collector or durable scheduler.
Monthly free instance hours are shared across the workspace's Free web services;
existing services also consume that allowance. No Render database is needed.

## Temperature-only ESP32 preparation

The isolated `codex/esp32-temperature-integration` branch starts from deployed
`feature/user-management-rbac` at `99e43bc`. It selects only Edgar's PR #5 DS18B20
work plus a gated adapter to the existing readings endpoint; other branches are
not merged. Setup and focused build/mock-test commands are in the
[firmware README](../firmware/esp32/README.md). Transmission defaults to disabled.
Real ingestion, flashing, deployment and registry changes require a later task.
