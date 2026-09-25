// Loaded before every test file (vitest.config.ts `setupFiles`).
//
// src/config/env.ts throws at import time if any of these are missing, so
// anything that transitively imports it — including modules whose Supabase
// client is mocked and never actually makes a network call — needs them
// defined. Real values from backend/.env (if present, e.g. for integration
// tests against a running local Supabase) take precedence; unit tests that
// never touch the network fall back to harmless dummy values.
import 'dotenv/config'

process.env.SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.DEVICE_INGEST_KEY ??= 'test-device-key'
