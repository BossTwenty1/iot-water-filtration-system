# Project Overview

## Project

IoT Embedded Water Filtration System

## Purpose

The project combines a physical water filtration prototype with IoT monitoring,
data collection, research records, and a web-based dashboard.

The system monitors selected water-quality parameters before and after
filtration and provides records that can support the research team's analysis.

Embedded sensor readings are monitoring data and are not independent proof that
water is safe to drink.

The planned web system should support access through the public internet and
through a local network where practical. The local deployment method and exact
behavior when public internet or cloud services are unavailable remain `TBD`.

---

## Current Project Status

The research team has completed the initial/proposal defense and is currently
building the prototype for the final defense.

Hardware is currently under assembly.

Frontend development has progressed to an integrated Mosaic-style dashboard and
Express API authentication implementation on `integration/frontend-auth-mosaic`,
including responsive layouts, light/dark themes, and protected routes. Domain
telemetry and research records are requested through the authenticated Express
API, with no local mock-data fallback. This code-level integration is not proof
of real ESP32 data: API records may be seeded or simulated. End-to-end login,
domain-request, and authenticated-route verification require an approved
running backend and test account.

This software progress does not confirm physical ESP32 connectivity, laboratory
validation, finalized permissions, or completion of the prototype. The hardware
status and final-defense target below are retained as previously documented
project information, not newly verified by this frontend documentation update.

Target final defense provided by the client:

`October 10, 2026`

---

## Physical Process

Current planned water flow:

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
