# Backend Test Access Report

**Prepared:** September 25, 2026
**Branch:** `feature/backend-local-telemetry-proof`
**Commit SHA:** `ad2cad7bcac2a80a26466b7148fa4740c6cbdf85`

This report gives whoever is testing the backend everything needed to start
hitting the API right now: the base URL, a working test account, and live
verification that auth and the database connection actually work (not just
"should work").

---

## 1. Backend base URL

```
http://localhost:3000/api/v1
```

Start it locally from `backend/` with:

```
npx supabase start   # starts local Supabase (Postgres, Auth, Studio)
npm run dev           # starts the API on port 3000
npm run seed           # (re)creates the test account below + sample data
```

`npm run dev` logged `API listening on http://localhost:3000/api/v1` and the
server responded to requests during this verification pass.

---

## 2. Test user account

Created via `npm run seed` (`backend/scripts/seedTestData.ts`), which is safe
to re-run — it deletes and recreates this exact user every time, so these
credentials are always valid after a seed run:

| Field | Value |
|---|---|
| Email | `seed-admin@aquasense.test` |
| Password | `SeedTest123!` |
| Role | Administrator |

---

## 3. Auth endpoint confirmation

All four endpoints were exercised live against the running local backend
today, in sequence (login → me → refresh → logout), not just read from code:

| Endpoint | Result | Notes |
|---|---|---|
| `POST /api/v1/auth/login` | ✅ `200 OK` | Returned `token`, `refreshToken`, `expiresIn`, and the user profile. |
| `GET /api/v1/auth/me` | ✅ `200 OK` | Returned the correct profile (id, name, email, role, status) for the bearer token. |
| `POST /api/v1/auth/refresh` | ✅ `200 OK` | Exchanged the refresh token for a new access token + new refresh token. |
| `POST /api/v1/auth/logout` | ✅ `204 No Content` | Call succeeds for an authenticated request. |

**One behavior worth knowing before you test logout flows:** in this local
environment, the access token returned right before logout still worked on
`GET /auth/me` afterward, and the paired refresh token was still able to mint
a new session. Supabase access tokens are self-verified JWTs with a short
lifetime (1 hour here) — `signOut()` deauthorizes the *session* on Supabase's
side, but an already-issued access token isn't force-revoked before its
natural expiry. If your test plan assumes "token stops working the instant
logout is called," that assumption doesn't hold today — flagging it now so
it isn't mistaken for a bug found later.

---

## 4. Local Supabase connection — confirmed

- `npx supabase status` shows the local stack running at
  `http://127.0.0.1:54321` (API), matching `SUPABASE_URL` in `backend/.env`.
- The backend is using the local instance, not a hosted/staging project —
  `.env` points at `127.0.0.1`, and `DATABASE_URL` points at
  `127.0.0.1:54322`.
- Verified independently of the API layer: after seeding, the test user was
  queried directly from Supabase's REST endpoint
  (`/rest/v1/profiles?email=eq.seed-admin@aquasense.test`) using the service
  role key, and it returned the same user the API layer authenticates —
  confirming the backend is reading/writing the real local database, not a
  mock.

---

## 5. Commit SHA

```
ad2cad7bcac2a80a26466b7148fa4740c6cbdf85
```

Branch: `feature/backend-local-telemetry-proof` — this is the current tip of
the branch as of this report; everything above was verified against exactly
this commit.
