# S.A.F.E Frontend

React, TypeScript, Vite, Tailwind CSS, React Router, Recharts, and Lucide React
implementation of the IoT Embedded Water Filtration System research console.

## UI and routes

The Mosaic-style UI includes a responsive shell, desktop sidebar, mobile drawer,
header, card/grid layouts, and Recharts visual integration. Mobile navigation
supports focus containment, Escape dismissal, and focus restoration.

`/login`, `/forgot-password`, and `/reset-password` sit outside the protected application shell. The protected routes are
`/dashboard`, `/history`, `/alerts`, `/test-runs`, `/calibration`,
`/laboratory-validation`, `/maintenance`, and `/settings`. Unauthenticated
visitors are redirected to login with the requested destination retained;
successful sign-in returns to an accepted local destination or `/dashboard`.

Before sign-in, the login page wakes the API through the public `/health` route.
It allows credential entry while showing a server-starting notice, but blocks
submission until the API returns `{ "status": "ok" }`. Failed health checks retry
after five seconds, with one overall 90-second deadline (including slow requests).
An unavailable server shows a separate connection error and **Retry connection**;
retry preserves the entered fields and never resubmits credentials automatically.
Leaving the page cancels the probe and timers. This accommodates free-hosting
cold starts; it does not prevent server sleep or guarantee continuous availability.

On History's stacked layout (1050px and below), **Inspect** brings the selected
Record Inspector into view and moves focus there. **Back to records** returns
to the same Inspect button; reduced-motion preferences use immediate scrolling.
The desktop side-by-side inspector, API data, exports, and permissions are unchanged.

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

## User-facing wording

Use everyday English in page headings, buttons, descriptions, status labels,
loading messages, and accessible labels. For example, use "sensor readings"
instead of "telemetry", "View details" instead of "Inspect", "before/after
filtering" instead of "pre/post-filtration", and explain where readings came
from instead of using "provenance". Keep scientific names, sensor models, units,
and the meaning of research and safety warnings.

The UI calls calibration records "Sensor checks" and laboratory validation
records "Lab records". These headings do not confirm that a method is approved,
a lab report has been checked, or water is safe to drink. Device records are
still described as saved status, rather than proof of a current connection.

`formatStatusLabel` changes displayed words only: `Acknowledged` appears as
"Pending", with "Mark as pending" as its action. `Resolved` appears as
"Resolved", with "Mark as resolved" as its action. API values, status filters,
record links, and saved research text remain unchanged.

Pages show API-supplied readable IDs such as `Test 0001`, `Device 0001`, and
`Alert 0001`. The database assigns each number permanently. The UI keeps UUIDs
for React keys, selection, API requests, and record relationships. It never
generates IDs from table order, shortened UUIDs, or browser storage. Missing
numbers show "Not assigned"; absent relationships retain their empty state.
CSV downloads keep existing UUID columns and append readable-number columns.
External sample references are preserved exactly. The disabled lab page uses
test choices displaying readable IDs while retaining UUID values internally.

On Sensor history, Alerts, Tests,
and Maintenance, "View details" opens the selected
record in the existing shared dialog. Details are no longer placed beside the
record table. The dialog supports its close buttons, Escape, keyboard focus
containment, and focus returning to the control that opened it. Server-provided
messages are shown as received; frontend connection and sign-in messages use
simple wording.

The header does not show the extra saved-records badge or the unused profile
icon. Alert navigation, theme switching, the signed-in name, and sign out remain
available.

In General Settings, System name and Device display name edit their saved
settings through the existing Save Settings action. Reset Changes reloads the
saved settings. The client's fixed date/time preferences are applied by
`dateTimeSettings`: `Asia/Manila (UTC+08:00)`, `MMM DD, YYYY`, and
`12-hour (AM/PM)`. Loading settings displays these approved preferences even if
the server has empty or older format values. Save Settings stores them through
the existing API alongside the other settings; loading does not write anything.

Shared formatters use Philippine time and US English date/month names, for
example `Oct 27, 2026, 10:57 AM`. Tables, detail dialogs, and chart ticks/tooltips
use these helpers. Reading and alert logs retain seconds in AM/PM time so
readings in the same minute can be distinguished. UTC timestamps and CSV export
fields remain unchanged. These are fixed client-approved display preferences,
not controls for choosing other timezones or formats.

Lab records are temporarily turned off. The menu and dashboard link are hidden,
and `/laboratory-validation` shows an unavailable message without loading or
writing lab records. The original page component, backend endpoints, and saved
records are kept. Re-enabling it requires restoring the menu/link and routing
to `LaboratoryValidationPage` instead of `LaboratoryValidationUnavailablePage`.

Sensor checks are also temporarily turned off. The menu item is hidden, and
`/calibration` shows an unavailable message without loading or writing sensor
check records. Its original component, backend endpoints, and saved records
are kept. Re-enabling it requires restoring the menu item and routing to
`CalibrationPage` instead of `CalibrationUnavailablePage`.

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
node scripts/check-date-time.mjs
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
Oxlint. The date/time check covers Philippine midnight/year changes, AM/PM,
seconds in logs, and invalid timestamps without contacting the API. There is no
general frontend test framework configured. Build/lint do not
prove live authentication or domain connectivity: real login, destination
restoration, authenticated Header/Settings rendering, reload restoration,
refresh, domain reads/writes, sign out, and protected-route responsive review
remain end-to-end verification items. The local backend was not running when
this code-level integration was prepared.

See the [backend API reference](../backend/docs/API_REFERENCE.md) for implemented
endpoints. Authentication is not proof of live hardware telemetry, ESP32 connectivity,
approved authorization policy, laboratory validation, or water potability.

## Client revisions and password recovery

Plain GET requests reuse successful responses in page memory for up to ten
seconds and share requests already in progress. This reduces repeated loads
while navigating and duplicate requests from dashboard sections. User/account
management and auth reads are never cached. Writes, sign-out, account/role
changes, and explicit resource reloads clear the cache. Reloading the browser
also clears it. No data is persisted by this cache; failed requests are not
cached. This does not remove Render Free's wake-up delay after inactivity.

Readable IDs, simple English, detail modals, Manila date/time formatting, and
editable system names are supported. Lab and sensor-check pages are temporarily
unavailable. Existing Super Administrator permissions and Users & Access stay
enabled. Public `/forgot-password` and `/reset-password` pages use the existing
API recovery routes; see [password recovery setup](../docs/PASSWORD_RECOVERY.md).
