# Sensor log display fix — 17 November 2026

The browser's live telemetry API response included post-filtration temperature-only cycles (for example, after.temperature = 25.12). The dashboard/history tables did not include temperature, making those records appear empty.

Both tables now include before/after temperature in degrees C, originating device labels and full Philippine dates. History details and CSV exports include temperature; CSV exports also preserve flow and device UUID. Missing TDS uses the same dash formatting as other missing readings. Existing research.export permission checks are retained.

Each row remains one device/test/timestamp cycle. Two boards are not silently merged. A dash means the API has no numeric value for that field; zero remains a numeric reading. This display fix cannot reconstruct missing pH, turbidity, TDS or flow measurements. Inspect firmware upload response skipped entries and saved reading statuses to diagnose those separately.

Validation: frontend build (including TypeScript), lint and node scripts/check-telemetry-display.mjs from frontend. The regression script renders the actual page table JSX with service/child stubs for temperature-only records, numeric zero and missing values. No database, ingestion contract, hardware configuration or safety thresholds change.
