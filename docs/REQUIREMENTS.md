# Requirements

This document records confirmed requirements and boundaries. An item not
confirmed by the team remains `TBD`.

## Functional requirements

1. The system shall collect pH, turbidity, TDS, temperature, and flow-rate
   measurements.
2. Measurements shall be distinguishable by pre-filtration and post-filtration
   sensor position.
3. The ESP32 shall retain critical hardware control locally and shall not
   require internet connectivity for that control to continue.
4. The system shall support a web dashboard for current and historical
   monitoring data.
5. The system shall support alerts, test runs, calibration records, laboratory
   validation records, and CSV export.
6. The ESP32 shall be able to synchronize device measurements with the backend
   through an HTTPS REST API when connectivity is available.

## Quality and safety boundaries

- Secrets must remain outside committed source and documentation.
- Sensor readings must be traceable to device, sensor position, measurement
  time, and calibration context once implementation begins.
- A dashboard status or sensor value must not be described as laboratory proof
  that water is safe to drink.
- Final alert and control behavior must use team-approved thresholds and rules;
  no thresholds are defined in Phase 1.
- The system should tolerate temporary network loss without transferring
  critical control to the cloud.

## Confirmed hardware

- ESP32-WROOM-32
- Pre-filtration sensor set
- Post-filtration sensor set
- pH sensor
- Turbidity sensor
- TDS sensor
- Temperature sensor
- Flow-rate sensor

## Explicitly deferred requirements

The exact component models, electrical design, control rules, timing, and
validation criteria are listed in [PENDING_DECISIONS.md](PENDING_DECISIONS.md)
and must remain `TBD` until approved.
