# Sensor log display fix — 17 November 2026

The browser's live telemetry API response included post-filtration temperature-only cycles (for example, after.temperature = 25.12). The dashboard/history tables did not include temperature, making those records appear empty.

Both tables now include before/after temperature in degrees C, originating device labels and full Philippine dates. History details and CSV exports include temperature; CSV exports also preserve flow and device UUID. Missing TDS uses the same dash formatting as other missing readings. Existing research.export permission checks are retained.

Each row remains one device/test/timestamp cycle. Two boards are not silently merged. A dash means the API has no numeric value for that field; zero remains a numeric reading. This display fix cannot reconstruct missing pH, turbidity, TDS or flow measurements. Inspect firmware upload response skipped entries and saved reading statuses to diagnose those separately.

Validation: frontend build (including TypeScript), lint and node scripts/check-telemetry-display.mjs from frontend. The regression script renders the actual page table JSX with service/child stubs for temperature-only records, numeric zero and missing values. No database, ingestion contract, hardware configuration or safety thresholds change.


## Independent board comparison — 17 November 2026

Dashboard and history now show the latest before/after cycles side by side in a separate table. Each column identifies its device and exact Philippine timestamp. The difference in recording times is shown explicitly. Refresh readings re-fetches both stages. This does not pair historical rows, carry older sensor values forward, or claim a synchronized or experimentally matched sample. Raw history and exports retain original device/timestamp cycles. The view chooses the latest record for each filtering stage; it assumes this installation's one active before board and one active after board. If more boards per stage are introduced, a device selector is needed before treating the comparison as a designated pair.

The frontend queries existing GET /telemetry?stage=before&limit=10 and stage=after independently; a busy board cannot crowd the other out of the global history limit. No API contract or database schema changes.

Read-only production checks found typical within-board intervals of roughly 60–61 seconds, with gaps and non-overlapping activity. At one check the latest before cycle was 21:12:57 and latest after cycle 20:45:47 Philippine time. These are observations, not a synchronization guarantee or an approved experimental pairing window.

The after device cb06c51a-83db-4940-b6cc-19f6d52fcde7 had only temperature registered. Added missing post_filtration metadata for ph (pH), tds (ppm), turbidity (NTU), and flow_rate (L/min), retaining the original temperature registration. No readings, calibration, thresholds, pins or hardware specifications were created or modified. Registration allows future correctly formed payload entries to be accepted; it cannot recover previously skipped readings or make faulty sensors valid. The before board's latest stored TDS/turbidity statuses were fault with null values.

Validation: frontend build/TypeScript, lint, scripts/check-board-readings.mjs and scripts/check-telemetry-display.mjs. Coverage includes independent stage requests, preserved timestamps, time-gap calculation, both columns in one rendered table, zero/missing readings, no carry-forward/mutation, missing-board/error/loading states.
