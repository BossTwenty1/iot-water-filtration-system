# Deployment (branch `deploy/two-board-telemetry`)

This branch has everything needed to run the system:

| Part | Folder | Hosted as |
|---|---|---|
| Backend API (Express) | `backend/` | Render web service `safe-water-api` |
| Dashboard (React/Vite) | `frontend/` | Render static site `safe-water-dashboard` |
| Firmware for both boards | `firmware/esp32/FF/` | flashed over USB (see `firmware/esp32/README.md`) |
| Database | Supabase (cloud) | already set up, see step 0 |

It includes the two-board history (before and after readings on one row), the
dashboard cards for the two real boards only, and the ESP32 firmware that
uploads to `POST /api/v1/devices/<uuid>/readings`.

This is a development demo deployment. It is not production-ready, and the
readings are not laboratory proof that the water is safe to drink.

## 0. Database (already done)

The cloud Supabase project already has every migration in
`backend/supabase/migrations/`, including `devices.installation_id`. Both real
boards already exist as devices (Device 0001 and Device 0005). Nothing to do
unless you move to a new Supabase project. In that case, apply the migrations
in order and create the two devices with the UUIDs listed in
`firmware/esp32/FF/secrets.example.h`.

## 1. Host the backend and dashboard on Render

### Option A: services already exist (simplest)

For **each** existing Render service (API and dashboard): open **Settings →
Build & Deploy → Branch**, choose `deploy/two-board-telemetry`, save, and run
**Manual Deploy → Deploy latest commit**. Keep the existing environment
variables.

### Option B: create them from the Blueprint

1. Render dashboard → **New → Blueprint** → choose this repository and the
   branch `deploy/two-board-telemetry`. Render reads `render.yaml`.
2. Fill in the values it asks for:

   | Variable | Service | Value |
   |---|---|---|
   | `SUPABASE_URL` | API | Supabase → Project Settings → API |
   | `SUPABASE_ANON_KEY` | API | same page (anon / publishable key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | API | same page (service role / secret key). Never put it in the frontend |
   | `DEVICE_INGEST_KEY` | API | any long random string. The boards must send the same value |
   | `CORS_ORIGIN` | API | the dashboard URL, e.g. `https://safe-water-dashboard.onrender.com` |
   | `VITE_API_BASE_URL` | dashboard | the API URL + `/api/v1`, e.g. `https://safe-water-api.onrender.com/api/v1` |

   If you don't know the final URLs yet, enter a placeholder. After the first
   deploy, copy the real URLs, fix `CORS_ORIGIN` and `VITE_API_BASE_URL`, then
   redeploy both. The dashboard reads `VITE_API_BASE_URL` at **build** time, so
   it must be rebuilt after any change.
3. In Supabase → **Authentication → URL Configuration**, add
   `<dashboard URL>/reset-password` to the Redirect URLs. Password reset
   emails need this.

### Check

- `https://<api-host>/api/v1/health` returns `{"status":"ok"}`.
- `https://<api-host>/api/v1/health/cloud` reaches Supabase.
- The dashboard loads and you can sign in.

## 2. Point the firmware at the host

Follow `firmware/esp32/README.md`. The short version:

1. `cp firmware/esp32/FF/secrets.example.h firmware/esp32/FF/secrets.h`
2. In `secrets.h`: set `API_DEVICE_KEY` to the backend's `DEVICE_INGEST_KEY`.
   If the API URL is not `https://safe-water-api.onrender.com`, also change
   `API_BASE_URL`.
3. Flash the DevKit V1 as **ESP32 Dev Module** (before filtration) and the S3
   as **ESP32S3 Dev Module** (after filtration).
4. Look for `HTTP 201` in each board's Serial Monitor.

If the API is not on `*.onrender.com`, check that `API_ROOT_CA_PEM` still
matches the host's certificate chain. The command is in `secrets.example.h`.

## 3. Check end to end

1. Power both boards and let them run for a few minutes **at the same time**.
2. Dashboard → **Sensor history**: rows show Device 0001 / Device 0005 with
   before and after values side by side. A row says "Before only" or "After
   only" when the other board had no reading within 30 seconds.

## Things that are still open (`TBD`)

- Device authentication is one shared key (`DEVICE_INGEST_KEY`) for every
  board. The final per-device scheme is in docs/PENDING_DECISIONS.md.
- The 30-second pairing window is provisional (docs/TWO_BOARD_SYNC_AND_MERGE.md).
- Final ESP32 pins, library and core versions, and sampling and upload
  intervals are not confirmed.
- Free Render services sleep when idle. The first upload after a sleep may get
  a 503 or time out, and the next one succeeds.
