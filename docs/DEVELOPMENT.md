# Development

## Current phase

Phase 1 creates structure and documentation only. The repository currently has
no initialized frontend, backend, firmware, simulator, or database project.

## Workspace boundaries

- `frontend/` — React dashboard implementation when approved.
- `backend/` — Node.js and Express API and server-side implementation when
  approved.
- `firmware/esp32/` — ESP32 firmware implementation when approved.
- `simulator/` — disconnected development simulation when approved.
- `database/` — database artifacts when approved.
- `docs/` — shared contracts, requirements, and decisions.

## Change workflow

1. Inspect the existing files and Git status.
2. Confirm the requested work belongs to the active phase.
3. Make a small, focused change in the responsible area.
4. Update the relevant documentation when a contract changes.
5. Run only the validation appropriate to the initialized tooling.
6. Review the diff for secrets, unrelated work, invented hardware details, and
   unsupported safety claims.

No dependencies are installed and no framework initialization is performed as
part of Phase 1.

## Local development principles

- Use synthetic or clearly disconnected data for development until approved
  data sources are available.
- Keep critical control testable without internet access.
- Treat network synchronization as recoverable and non-critical to local
  hardware behavior.
- Never commit `.env` files, credentials, private keys, or generated local
  secrets.

## Validation boundary

The approved thresholds, timing, wiring, pin map, power design, control rules,
and validation protocol must be documented before implementation claims can be
made. See [PENDING_DECISIONS.md](PENDING_DECISIONS.md).
