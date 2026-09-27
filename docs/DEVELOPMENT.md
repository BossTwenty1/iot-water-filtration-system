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
domain services, which currently use representative local development adapters;
live domain-service integration with the Express REST API is pending. The
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
finalize roles, authorize hardware actions, or make representative telemetry
live. Backend authorization remains authoritative.

Live login, destination restoration, authenticated Header/Settings, session
restoration, token refresh, actual API requests, backend sign out, and protected
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
