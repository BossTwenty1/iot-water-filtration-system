# Project Overview

## Purpose

The IoT Water Filtration System is a research and monitoring platform for
observing water-quality measurements before and after filtration. It combines
local ESP32 control with a Node.js and Express API, Supabase PostgreSQL, and a
web-based record of measurements, test runs, alerts, calibration records,
laboratory validation, and CSV export.

The system is not a substitute for laboratory testing, regulatory approval, or
professional advice about drinking-water safety.

## Confirmed scope

- Controller: ESP32-WROOM-32
- Sensor positions: pre-filtration and post-filtration
- Measurements: pH, turbidity, TDS, temperature, and flow rate
- User-facing capability: web dashboard
- Records: historical data, alerts, test runs, calibration records, and
  laboratory validation
- Export: CSV

## Planned architecture

`ESP32 -> HTTPS / JSON -> Node.js + Express API -> Supabase PostgreSQL`

`React Dashboard -> Express API -> Supabase PostgreSQL`

The ESP32 owns critical hardware control and must continue operating safely
without internet access. Internet connectivity is for synchronization and
remote records, not for the minimum local control loop.

## Team

- Nash — Project Lead, Frontend, Integration
- Alejandro — Backend, Database, API
- Edgar — ESP32, Firmware, Hardware Integration

## Phase 1 deliverable

Phase 1 establishes repository structure and shared documentation. It does not
initialize application frameworks, install dependencies, create a Supabase
project, or implement device behavior.
