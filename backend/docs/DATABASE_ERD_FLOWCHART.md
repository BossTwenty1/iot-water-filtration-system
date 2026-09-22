# Database ERD (flowchart / elbow-connector version)

Mermaid's `erDiagram` type has no orthogonal/elbow line-routing option — its
config schema exposes only padding, spacing, colors, font size, and layout
direction, nothing for connector shape. `flowchart` diagrams do support it
(`curve: 'step'`), so this is the same relationships as
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)'s `erDiagram`, redrawn as a
`flowchart` for right-angle connectors in Typora's preview.

**Trade-off, read before treating this as authoritative:** flowchart has no
native crow's-foot cardinality notation or entity/attribute boxes, so:

- Cardinality is written as a plain `1:N` label on each edge instead of
  Mermaid's `||--o{` notation.
- Each node lists only its primary key plus 1–2 identifying columns, not
  every column — full column-by-column detail (types, nullability, `TBD`
  notes) lives in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) §§1–15. Treat
  that document as the source of truth for anything beyond "what connects
  to what."

If this diagram and `DATABASE_SCHEMA.md`'s `erDiagram` ever disagree on
relationships, `DATABASE_SCHEMA.md` wins — this file exists purely for a
cleaner visual in Typora, not as a second schema definition.

```mermaid
%%{init: {'flowchart': {'curve': 'step'}}}%%
flowchart TB
    DEVICES["<b>devices</b><br/>id PK<br/>device_identifier<br/>connection_state"]
    SENSORS["<b>sensors</b><br/>id PK<br/>category<br/>position"]
    SENSOR_READINGS["<b>sensor_readings</b><br/>id PK<br/>value<br/>measured_at"]
    TEST_RUNS["<b>test_runs</b><br/>id PK<br/>status"]
    ALERTS["<b>alerts</b><br/>id PK<br/>severity<br/>status"]
    ALERT_STATE_CHANGES["<b>alert_state_changes</b><br/>id PK<br/>from_status<br/>to_status"]
    CALIBRATION_RECORDS["<b>calibration_records</b><br/>id PK<br/>parameters"]
    LABORATORY_VALIDATION_RECORDS["<b>laboratory_validation_records</b><br/>id PK<br/>percentage_error"]
    PROFILES["<b>profiles</b><br/>id PK<br/>role<br/>status"]
    MAINTENANCE_RECORDS["<b>maintenance_records</b><br/>id PK<br/>component<br/>status"]

    DEVICES -->|"1:N has"| SENSORS
    DEVICES -->|"1:N reports"| SENSOR_READINGS
    DEVICES -->|"1:N runs"| TEST_RUNS
    DEVICES -->|"1:N raises"| ALERTS

    SENSORS -->|"1:N produces"| SENSOR_READINGS
    SENSORS -->|"1:N calibrated via"| CALIBRATION_RECORDS

    TEST_RUNS -->|"1:N contains"| SENSOR_READINGS
    TEST_RUNS -->|"1:N validated by"| LABORATORY_VALIDATION_RECORDS
    TEST_RUNS -->|"1:N context for"| ALERTS

    CALIBRATION_RECORDS -->|"1:N context for"| SENSOR_READINGS

    SENSOR_READINGS -->|"1:N triggers"| ALERTS

    ALERTS -->|"1:N transitions"| ALERT_STATE_CHANGES

    PROFILES -->|"1:N acknowledges"| ALERTS
    PROFILES -->|"1:N changes"| ALERT_STATE_CHANGES
    PROFILES -->|"1:N performs"| CALIBRATION_RECORDS
    PROFILES -->|"1:N performs"| MAINTENANCE_RECORDS

    subgraph STANDALONE["Standalone / config tables (no FK relationships)"]
        MAINTENANCE_REMINDERS["<b>maintenance_reminders</b><br/>id PK<br/>label<br/>status"]
        APP_SETTINGS["<b>app_settings</b><br/>id PK (=1)<br/>system_name"]
        THRESHOLDS["<b>thresholds</b><br/>id PK<br/>parameter<br/>stage"]
        NOTIFICATION_PROVIDERS["<b>notification_providers</b><br/>id PK<br/>provider<br/>enabled"]
        DATA_RETENTION_POLICY["<b>data_retention_policy</b><br/>id PK (=1)<br/>retention_days"]
    end
```
