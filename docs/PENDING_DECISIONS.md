# Pending Decisions

Every item below remains `TBD`. Do not replace these markers with guesses or
implement final behavior until the project team approves the decision.

## Hardware and electrical design

- exact turbidity sensor model — `TBD`
- pump specifications — `TBD`
- UV-C specifications — `TBD`
- relay specifications — `TBD`
- power supply — `TBD`
- final wiring — `TBD`
- final ESP32 pins — `TBD`

## Control and water-quality policy

- approved thresholds — `TBD`
- pump control rules — `TBD`
- UV-C control rules — `TBD`

## Timing and experiment protocol

- sampling interval — `TBD`
- database save interval — `TBD`
- final 1-liter / 1-hour cycle logic — `TBD`

## Integrations

- SMS provider — `TBD`

## Additional implementation decisions to approve

The following related contract details also remain open and must be resolved
before implementation: device authentication, API versioning, retry and
offline queue behavior, database schema and retention, user authorization,
alert acknowledgment behavior, CSV column order, calibration workflow, and the
laboratory-validation workflow. Database migration strategy also remains
`TBD`.

## Decision rule

Until a decision is recorded and approved, code and documentation must use
neutral placeholders and must not imply a final component, threshold, pin,
control rule, timing value, or safety conclusion.
