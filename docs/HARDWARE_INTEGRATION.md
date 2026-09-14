# Hardware Integration

## Confirmed hardware context

- Controller: ESP32-WROOM-32
- Sensor groups: pre-filtration and post-filtration
- Sensor categories: pH, turbidity, TDS, temperature, and flow rate

The exact turbidity sensor model and all actuator/electrical specifications
remain `TBD`.

## Integration boundary

The ESP32 is the local authority for critical hardware behavior. It must be
able to continue the approved local control behavior without an internet
connection. The backend and dashboard may synchronize and display records, but
they must not be required for the local safety/control loop.

## Measurement handling

Firmware should preserve sensor position, sensor category, measurement time,
unit, device identity, and calibration context when the final contract is
approved. Invalid, unavailable, or stale readings must be distinguishable from
valid measurements. Exact validation behavior is `TBD`.

## Wiring and control

Do not implement or document final GPIO assignments until the wiring plan is
approved. Pump, UV-C, relay, and power behavior must be designed around the
confirmed electrical specifications and approved control rules.

## Connectivity loss

Loss of internet connectivity must not stop critical local control. Firmware
may queue or discard synchronization data only according to an approved data
retention policy; this policy is `TBD`.

## Safety and validation boundary

Sensor measurements are monitoring signals. They are not laboratory proof that
water is safe to drink. Laboratory validation remains a separate record and
process, with its protocol and relationship to dashboard messaging still
`TBD`.
