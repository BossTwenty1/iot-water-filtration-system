# Agent Instructions

These rules apply to all work in this repository.

## Project Context

This repository contains the software for the IoT Embedded Water Filtration System.

Team responsibilities:

- Nash — Project Lead, Frontend, System Integration
- Alejandro — Backend, Database, API
- Edgar — ESP32 Firmware and Hardware Integration

Primary system architecture:

Sensors -> ESP32 -> HTTPS / JSON -> Node.js + Express API -> Supabase PostgreSQL -> React Dashboard

The system contains separate pre-filtration and post-filtration sensor groups.

Critical physical control must remain local to the ESP32 and must continue operating safely when internet or cloud services are unavailable.

---

## Repository Workflow

- Inspect existing files, documentation, Git status, and repository structure before modifying anything.
- Understand the requested task and its scope before coding.
- Make small, focused, maintainable changes.
- Preserve the existing architecture unless explicitly authorized to change it.
- Keep frontend, backend, firmware, simulator, database, and documentation concerns separated.
- Follow conventions already established in the repository.
- Avoid unrelated refactoring while completing a focused task.
- Do not delete or rename major project files without explicit approval.
- Do not start adjacent phases or features unless explicitly requested.
- Update relevant documentation whenever approved behavior or architecture changes.

---

## Git Rules

- Never force-push.
- Never rewrite Git history without explicit approval.
- Never delete branches without explicit approval.
- Do not commit or push unless the current task explicitly authorizes it.
- Before committing, inspect the Git diff and confirm only intended files are included.
- Do not commit generated files, build artifacts, secrets, temporary files, or local environment configuration.
- Keep the working tree understandable and avoid mixing unrelated work in one commit.

---

## Architecture and Contract Discipline

- Preserve documented frontend/backend/firmware/database boundaries.
- Treat documented API contracts as shared interfaces between team members.
- Do not silently change request payloads, response formats, database fields, or device message formats.
- If an API, database, telemetry, or hardware contract must change, update the corresponding documentation.
- Prefer backward-compatible changes where practical.
- Mark proposed but unapproved architecture changes as `TBD` or document them for review rather than implementing them silently.

---

## Dependencies and Configuration

- Do not add a new dependency unless it is necessary for the requested task.
- Prefer existing dependencies and platform capabilities over adding unnecessary packages.
- Do not replace major frameworks, libraries, database systems, or deployment platforms without explicit approval.
- Never expose secrets, tokens, passwords, private keys, service-role keys, or credentials.
- Never commit `.env`.
- Use `.env.example` only for non-sensitive placeholders.
- Never place administrative database credentials or service-role secrets in frontend code or ESP32 firmware.

---

## Hardware and Firmware Boundaries

- Do not invent hardware specifications.
- Do not invent sensor models.
- Do not invent final ESP32 pin assignments.
- Do not hardcode final ESP32 pins until confirmed by the hardware team.
- Do not assume AI-generated diagrams are final wiring diagrams.
- Do not assume relay, pump, UV-C, valve, sensor, voltage, or power specifications that have not been confirmed.
- Mark unresolved hardware, control, timing, wiring, and validation choices as `TBD`.
- Critical hardware control must not depend on the cloud, web application, or remote server.
- Internet failure must not prevent essential local ESP32 operation.
- Remote-control functionality must not bypass required local safety logic.
- Firmware should fail safely when critical sensors or control components report invalid states, subject to the approved hardware design.

---

## Sensor and Research Boundaries

- Do not invent water-quality thresholds.
- Use only thresholds approved by the research team/adviser when implementing final alert logic.
- Clearly distinguish:
  - sensor measurements,
  - configured limits,
  - laboratory results,
  - calculated research metrics.
- Sensor readings must not be presented as laboratory proof that water is safe to drink.
- Do not claim potability solely from pH, turbidity, TDS, temperature, or flow readings.
- Laboratory validation must remain separate from embedded sensor status.
- Appropriate laboratory validation states include:
  - Pending
  - Passed
  - Failed
- Do not claim laboratory validation, potable-water safety, regulatory compliance, or production readiness without appropriate evidence and approval.

---

## Data Handling

- Use synthetic or clearly identified simulated data for development until approved real data sources are available.
- Never disguise simulated data as real experimental or laboratory data.
- Preserve timestamps and measurement context where relevant.
- Keep pre-filtration and post-filtration measurements distinguishable.
- Avoid destructive database operations unless explicitly requested.
- Do not delete research records, telemetry, calibration records, or laboratory results without explicit approval.

---

## Testing and Verification

- Run relevant tests, builds, type checks, lint checks, or firmware checks before declaring a task complete.
- Do not report a feature as working unless it has been reasonably verified.
- If a check cannot be run, state that clearly.
- Fix errors introduced by the current task before declaring completion.
- Do not silently ignore failing tests or validation errors.

For frontend work, verify applicable:
- build
- TypeScript checks
- lint
- relevant tests

For backend work, verify applicable:
- TypeScript/build
- lint
- API tests
- relevant unit/integration tests

For firmware work, verify applicable:
- PlatformIO build
- compiler errors/warnings
- configuration consistency

---

## Code Quality

- Prefer clear, maintainable code over unnecessarily clever implementations.
- Use descriptive names.
- Avoid unnecessary duplication.
- Keep modules focused on a clear responsibility.
- Add comments where hardware behavior, safety logic, formulas, or non-obvious decisions require explanation.
- Do not over-engineer simple requirements.
- Follow established TypeScript, React, Node.js, C++, and project conventions.

---

## Documentation

Keep these documents aligned with implementation when applicable:

- `docs/PROJECT_OVERVIEW.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATABASE.md`
- `docs/DEVELOPMENT.md`
- `docs/HARDWARE_INTEGRATION.md`
- `docs/PENDING_DECISIONS.md`

When a previously `TBD` decision becomes confirmed:
1. update the relevant documentation,
2. remove or update it in `PENDING_DECISIONS.md`,
3. then implement the approved decision.

---

## Task Completion

At the end of substantial tasks, report:

1. What was changed
2. Files created or modified
3. Tests/checks performed
4. Results of those checks
5. Remaining `TBD` items or blockers
6. Any assumptions made
7. Recommended next step

Do not claim completion when known blocking errors remain.

---

## Change Discipline

- Respect the current phase boundary.
- Ask for approval before making major architectural changes.
- Ask for approval before replacing major technology choices.
- Ask for approval before implementing previously unresolved hardware behavior.
- Do not silently expand the requested scope.
