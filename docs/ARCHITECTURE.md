# Architecture

## System boundary

```text
Pre-filtration sensors ─┐
                        ├─> ESP32-WROOM-32 ──HTTPS / JSON──> Node.js + Express API
Post-filtration sensors ┘                                  │
                                                           v
                                                   Supabase PostgreSQL
                                                           │
                                                           v
                                                     React Dashboard
```

The normal frontend path is:

`React Dashboard -> Express API -> Supabase PostgreSQL`

The simulator is a separate development aid. It must not be treated as a
replacement for hardware measurements or laboratory validation.

## Responsibility boundaries

### ESP32 firmware

- Read the confirmed sensor categories from the pre- and post-filtration
  positions.
- Perform the local control and safety behavior required by the hardware.
- Continue critical control during internet loss.
- Queue or otherwise handle synchronization according to an approved offline
  strategy.

Final pins, control rules, sampling, and local storage behavior are `TBD`.

### Node.js + Express API

- Authenticate and validate device/API input once implemented.
- Normalize and persist device readings and operational records.
- Provide dashboard-facing data and export behavior.
- Keep cloud availability separate from local hardware control.

No backend framework or endpoint implementation is created in Phase 1.

### Supabase PostgreSQL

- Store the approved historical data model and audit-relevant records.
- Support test runs, readings, alerts, calibration records, and laboratory
  validation records after the schema is approved.

No Supabase project, migration, or schema is created in Phase 1.

### React dashboard

- Present current and historical measurements with clear sensor-position
  context.
- Present alerts and test-run records without overstating safety conclusions.
- Support CSV export through the approved backend contract.

No React application is initialized in Phase 1.

## Offline-first control principle

The cloud is an optional synchronization and reporting path. It must never be
the only place where critical pump, UV-C, relay, or other hardware-control
decisions can be made. The exact safe behavior and control rules remain `TBD`.
