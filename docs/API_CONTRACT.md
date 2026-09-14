# API Contract

## Status

This is a Phase 1 contract boundary, not an implemented API. Endpoint names,
authentication, payload schemas, retry behavior, and versioning require team
approval before implementation.

## Transport and direction

- Device-to-backend communication is planned to use HTTPS REST.
- The ESP32 must not depend on a successful request to continue critical local
  hardware control.
- The Node.js and Express backend is the boundary for validating and persisting
  synchronized data.
- The dashboard consumes backend data through Express; it does not directly
  query the database or control critical hardware.
- The normal persistence path is `client -> Express API -> Supabase
  PostgreSQL`.

## Candidate interface areas

The following areas are intentionally provisional and are not routes yet:

| Area | Purpose | Status |
| --- | --- | --- |
| Health/status | Report service availability | TBD |
| Device readings | Submit pre- and post-filtration measurements | TBD |
| Test runs | Start, observe, and retrieve a test run record | TBD |
| Alerts | Retrieve and acknowledge approved alert records | TBD |
| Calibration | Record and retrieve calibration events | TBD |
| Laboratory validation | Record externally produced validation results | TBD |
| CSV export | Export approved historical records | TBD |

## Data contract principles

Each synchronized reading should eventually include enough context to identify
the device, sensor category, sensor position, measurement time, unit, and
calibration context. The exact field names, units, identifiers, and validation
rules are `TBD`.

The API must distinguish:

- unavailable data from a measured value;
- a device/network error from a water-quality alert;
- a sensor reading from a laboratory validation result; and
- an alert condition from a claim that water is safe to drink.

## Deferred decisions

Authentication, device identity, authorization, endpoint version, rate limits,
batch size, retry/idempotency rules, timestamp format, error format, and CSV
column order are all `TBD`.
