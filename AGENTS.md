# Agent Instructions

These rules apply to all work in this repository.

## Repository workflow

- inspect existing files before modifying
- make small focused changes
- keep frontend, backend, firmware, simulator, and database separated
- never force-push
- never rewrite Git history without approval

## Hardware and scientific boundaries

- do not invent hardware details
- do not invent water-quality thresholds
- do not hardcode final ESP32 pins until confirmed
- critical hardware control must not depend on the cloud
- sensor readings must not be presented as laboratory proof that water is safe
  to drink
- Mark unresolved hardware, control, timing, and validation choices as `TBD`.

## Security and data handling

- never expose secrets
- never commit `.env`
- Use synthetic or clearly disconnected example data in documentation and tests
  until approved data sources exist.

## Change discipline

- Respect the current phase boundary and ask for approval before starting
  adjacent implementation work.
- Update the relevant documentation when an approved decision changes the
  architecture, API, database, or hardware contract.
- Do not claim laboratory validation, potable-water safety, or production
  readiness without appropriate evidence and approval.
