# Requirements

This document defines the currently confirmed functional, research, hardware,
software, safety, and integration requirements for the IoT Embedded Water
Filtration System.

Requirements that have not yet been confirmed by the client, research team,
adviser, or hardware team must remain marked as `TBD`.

---

## 1. System Purpose

The system shall monitor an IoT-enabled water filtration prototype using an
ESP32-WROOM-32 and separate pre-filtration and post-filtration water-quality
sensor groups.

The software system shall:

- collect water-quality measurements,
- compare water conditions before and after filtration,
- record historical measurements,
- provide web-based monitoring,
- support research testing and validation,
- provide system and fault status information,
- and support integration with the physical filtration system.

The software must not treat embedded sensor readings alone as proof that water
is potable or safe to drink.

---

## 2. Water Filtration Flow

The currently confirmed physical process is:

```text
Water Source
-> Booster Pump
-> Pre-Filtration Sensors
-> Ultrafiltration
-> UV-C
-> Post-Filtration Sensors
-> LCD
-> Output / Collection Tank
```

The final electrical wiring, relay configuration, actuator control, and ESP32
pin assignments remain subject to hardware-team confirmation.

---

## 3. Sensor Monitoring Requirements

The system shall collect the following measurements:

- pH
- Turbidity
- Total Dissolved Solids (TDS)
- Temperature
- Flow rate

The system shall maintain separate measurements for:

- Pre-filtration sensor group
- Post-filtration sensor group

The system shall allow before-filtration and after-filtration values to be
compared for the same filtration test or experiment.

Measurements shall eventually be traceable to:

- device,
- test run,
- sensor position,
- measurement timestamp,
- sensor/calibration context.

---

## 4. Confirmed Hardware

### Microcontroller

- ESP32-WROOM-32

### pH

- Client-provided/confirmed project information: PH-4502C Liquid pH Sensor
- Quantity: 2

### TDS

- Client-provided documentation/reference: DFRobot TDS / SEN0244
- Quantity: 2
- Exact physical unit should be verified before final electrical integration

### Temperature

- Client-provided/confirmed project information: DS18B20
- Quantity: 2

### Flow

- Client-provided/confirmed project information: ZJ-S201C
- Quantity: 2

### Turbidity

- Quantity: 2
- Exact model: `TBD`

### Other Hardware

- Client-provided requirement: 4-channel relay module
- Integrated Ultrafiltration / UV-C filtration unit

The following remain `TBD`:

- booster pump specifications,
- UV-C electrical specifications,
- exact relay specifications,
- power supply specifications,
- LCD model,
- final wiring,
- final ESP32 pins,
- actuator wiring and switching method.

See [PENDING_DECISIONS.md](PENDING_DECISIONS.md).

---

## 5. Local ESP32 Operation

Critical physical control shall remain local to the ESP32.

The web application, backend, database, or internet connection shall not be
required for essential hardware operation to continue.

If internet connectivity is unavailable:

- the ESP32 shall continue approved local operation,
- the web application shall indicate that the ESP32 is offline,
- the latest available measurement may remain visible,
- stale data must not be presented as a current live reading.

The final offline-control behavior remains subject to the approved hardware
control rules.

---

## 6. Filtration Cycle Requirements

The adviser has proposed a maximum operating duration of one hour for a
filtration cycle.

The system is also expected to support filtration/testing based on processed
water volume.

The final relationship between:

- one-liter processing target,
- one-hour maximum operating time,
- automatic cycle completion,
- pump shutdown,
- UV-C operation,

remains `TBD` until formally confirmed.

---

## 7. Sensor Failure Behavior

The client has requested that water flow stop when a critical sensor fails or
disconnects.

The final implementation depends on confirmed:

- sensor-failure definitions,
- pump/valve control hardware,
- relay configuration,
- fail-safe behavior.

Until these are confirmed, the exact shutdown control logic shall remain `TBD`.

---

## 8. Real-Time Dashboard Requirements

The web application shall support a dashboard displaying:

- Pre-filtration pH
- Post-filtration pH
- Pre-filtration turbidity
- Post-filtration turbidity
- Pre-filtration TDS
- Post-filtration TDS
- Pre-filtration temperature
- Post-filtration temperature
- Pre-filtration flow rate
- Post-filtration flow rate
- Total processed water volume
- Pump status
- UV-C status
- Filtration status
- ESP32 online/offline status
- Last update time

The dashboard should also support a visual representation of the water route
and component state where practical.

Example states may include:

- Active
- Inactive
- Stable
- Fault
- Offline

Exact state names shall be finalized during implementation.

---

## 9. Before-and-After Comparison

The system shall support comparison of pre-filtration and post-filtration
measurements.

For applicable parameters, the software may calculate differences such as:

- absolute difference,
- percentage change,
- percentage reduction.

The calculation method must be documented before research results are produced.

No calculated improvement value shall automatically be interpreted as proof of
potability.

---

## 10. Historical Data

The web application shall support historical sensor records.

Historical records shall support:

- timestamped measurements,
- filtering by date/time where practical,
- filtering by test run,
- pre-filtration and post-filtration distinction,
- graphical visualization,
- tabular visualization.

Historical data shall be exportable in CSV format.

---

## 11. Graphs and Visualization

The application shall provide charts for applicable monitored values,
including:

- pH
- turbidity
- TDS
- temperature
- flow rate

Charts should support comparison of pre-filtration and post-filtration
measurements.

---

## 12. Test Run / Experiment Management

The application shall support identifiable test runs or experiments.

A test run should eventually be able to contain:

- Test Run / Experiment ID
- start time
- end time
- water source or sample information
- notes
- associated telemetry
- before-filtration measurements
- after-filtration measurements
- laboratory records
- calibration context

Final required fields remain subject to research-team confirmation.

---

## 13. Calibration Records

The application shall support sensor calibration records.

Calibration records should be capable of storing:

- sensor type,
- sensor/device reference,
- calibration date,
- reference value,
- measured/raw value where applicable,
- calibration parameters,
- notes.

Calibration formulas shall not be invented.

Firmware and software shall use only approved calibration procedures.

---

## 14. Laboratory Validation

The application shall support laboratory validation records.

Laboratory validation shall remain separate from embedded sensor status.

Recommended laboratory validation states are:

- Pending
- Passed
- Failed

The application shall support comparison between:

- sensor measurements,
- corresponding laboratory measurements.

Where required by the research methodology, the system shall support
percentage-error calculations.

The exact validation criteria and formulas must match the approved research
methodology.

---

## 15. Potability and Scientific Boundary

Embedded measurements of:

- pH,
- turbidity,
- TDS,
- temperature,
- flow rate,

must not independently produce statements such as:

- "Safe to drink"
- "Potable"
- "Drinking water approved"

unless supported by the approved laboratory validation process.

For sensor-based dashboard status, wording such as the following is preferred:

`Monitored parameters within configured limits`

This status is distinct from laboratory potability validation.

---

## 16. Power Consumption Records

The software shall support research-related power-consumption records.

The final source of:

- voltage,
- current,
- power,
- operating duration,

remains `TBD`.

Calculated electrical power shall use the research-approved method once the
measurement source is confirmed.

---

## 17. Alerts and Fault Monitoring

The system shall support alerts or warnings for applicable conditions,
including:

- ESP32 offline
- Sensor disconnected/error
- No water flow
- Abnormal pH
- High turbidity
- High TDS
- Temperature warning
- Pump problem
- UV-C problem
- Filter clogged
- Other approved system faults

Final thresholds must not be invented.

Approved values for:

- pH,
- turbidity,
- TDS,
- temperature,
- flow rate,

remain `TBD`.

---

## 18. Fault Diagnostics

The system shall provide understandable fault or diagnostic information where
possible.

Fault records should eventually support:

- fault type,
- timestamp,
- affected component,
- status,
- description,
- acknowledgment/resolution where applicable.

The software shall distinguish between:

- sensor fault,
- communication fault,
- device offline state,
- hardware/control fault,
- warning threshold condition.

---

## 19. Authentication and User Roles

The client requested:

- user login,
- administrator account,
- multiple user roles.

The final permission model remains `TBD`.

Authentication is planned to use Supabase Auth unless an approved architecture
change is made.

Sensitive administrative credentials must never be included in frontend code,
ESP32 firmware, or committed source files.

---

## 20. Remote Manual Control

The client requested remote manual-control capability.

Remote control shall only be implemented for hardware functions that are
explicitly confirmed as remotely controllable.

Remote commands must not bypass ESP32 local safety rules.

The following remain `TBD`:

- pump remote control,
- UV-C remote control,
- other actuator control,
- permissions,
- command acknowledgment,
- fail-safe behavior.

---

## 21. Maintenance Requirements

The web application shall support maintenance-related records.

Requested functionality includes:

- maintenance records,
- filter replacement reminder,
- UV-C operating-hours record.

The exact maintenance intervals and replacement thresholds remain `TBD`.

---

## 22. SMS Notifications

The client requested SMS notifications for fault/error diagnostic alerts.

The SMS provider and final notification rules remain `TBD`.

SMS functionality shall not be considered a critical dependency for local
filtration safety.

---

## 23. Communication Requirements

The ESP32 shall communicate with the backend over Wi-Fi when connectivity is
available.

The planned device-to-server communication method is:

- HTTPS
- REST API
- JSON

The ESP32 shall not contain database administrative credentials.

The planned data path is:

\`\`\`text
Sensors
-> ESP32
-> HTTPS REST API
-> Backend
-> PostgreSQL / Supabase
-> Web Dashboard
\`\`\`

---

## 24. Data Recording Frequency

The client initially selected a database/data recording target of approximately
30 seconds.

However, the final timing configuration remains subject to testing.

The system shall distinguish between:

- sensor sampling frequency,
- backend transmission frequency,
- database persistence frequency,
- dashboard update frequency.

These values shall not automatically be assumed to be identical.

Final frequencies remain `TBD`.

---

## 25. Database Requirements

The proposed database shall support records for:

- users
- devices
- telemetry
- test runs
- alerts
- calibrations
- laboratory tests
- maintenance records

Additional tables may be introduced when justified by implementation needs.

The database schema shall preserve the distinction between pre-filtration and
post-filtration measurements.

See [DATABASE.md](DATABASE.md).

---

## 26. Security Requirements

- Secrets must remain outside committed source and documentation.
- `.env` files must not be committed.
- `.env.example` may contain only non-sensitive placeholders.
- Database administrative/service-role credentials must never be exposed to
  the frontend.
- Database administrative/service-role credentials must not be embedded in
  ESP32 firmware.
- Device communication shall use appropriate authentication before final
  deployment.
- User passwords shall not be stored directly by application code.

---

## 27. Development and Testing Data

Synthetic or clearly identified simulated data shall be used during early
development before real hardware data is available.

Simulated data must never be presented as actual:

- experimental results,
- sensor-validation results,
- laboratory results,
- research findings.

Once real hardware integration begins, simulated and real data must remain
clearly distinguishable.

---

## 28. Availability and Deployment

The client requested access through:

- public internet,
- local-network operation where practical.

Planned cloud deployment is:

- Frontend: Vercel
- Backend: Render
- Database: Supabase

These hosting choices may be changed only through an approved architecture
decision.

The local physical system shall not depend on cloud availability for essential
hardware control.

---

## 29. Team Scope

### IT / Software Team

Responsible for:

- frontend development,
- backend development,
- database development,
- ESP32 software integration,
- ESP32-to-server communication,
- data logging,
- visualization,
- software alerts,
- research software records,
- data export,
- deployment,
- software testing,
- debugging,
- system integration support.

### Hardware / Research Team

Responsible for:

- physical filtration construction,
- sensor installation,
- electrical wiring,
- pump hardware,
- relay hardware,
- valve hardware where applicable,
- UV-C hardware,
- power supply,
- physical component testing,
- component replacement,
- laboratory testing,
- approved research criteria,
- approved water-quality thresholds.

Hardware and software teams shall cooperate during final integration.

---

## 30. Deferred / Pending Decisions

The following are intentionally not finalized:

- exact turbidity sensor model,
- booster pump model/specifications,
- UV-C specifications,
- relay specifications,
- power supply,
- LCD model,
- final wiring,
- final ESP32 pin assignments,
- approved pH threshold,
- approved turbidity threshold,
- approved TDS threshold,
- approved temperature threshold,
- approved flow requirement,
- pump control behavior,
- UV-C control behavior,
- sensor-failure shutdown implementation,
- sampling interval,
- API transmission interval,
- database persistence interval,
- dashboard refresh interval,
- final one-liter / one-hour cycle logic,
- remote-control permissions,
- maintenance thresholds,
- SMS provider.

These items are maintained in
[PENDING_DECISIONS.md](PENDING_DECISIONS.md).

No implementation shall silently invent values for these items.
