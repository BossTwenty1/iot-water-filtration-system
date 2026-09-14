
# Database

The planned database platform is Supabase PostgreSQL.

This document describes the proposed logical schema. The database is not yet
implemented.

---

## 1. Principles

The database must:

- preserve pre/post measurement identity,
- preserve device identity,
- preserve timestamps,
- preserve test-run context,
- separate sensor data from laboratory data,
- distinguish simulated from real records,
- preserve calibration context,
- support historical analysis,
- support CSV export,
- support audit-relevant fault and maintenance records.

---

## 2. Normal Data Path

Device/simulator write path:

```text
ESP32 / Simulator
       ↓
Express API
       ↓
Supabase PostgreSQL
```

Frontend request path:

```text
React
  ↓
Express API
  ↓
Supabase PostgreSQL
```

---

## 3. Logical Record Domains

The logical database design should support, subject to final schema approval:

- users and authorization references,
- devices,
- telemetry with explicit pre-filtration/post-filtration sensor position,
- test runs,
- alerts,
- calibration records,
- laboratory tests, and
- maintenance records.

Telemetry should also preserve device identity, test-run context, measurement
timestamp, calibration context, and a source identity distinguishing real
hardware from simulator data. Exact table names, fields, relationships, and
constraints remain `TBD`.
