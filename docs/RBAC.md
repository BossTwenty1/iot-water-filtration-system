# S.A.F.E user management and authorization

Approved software policy (2026-10-11). This feature preserves Supabase Auth and the Express API; roles come exclusively from current `public.profiles` rows, never Auth metadata. Deploy the reviewed migration before this backend. No hosted migration or account promotion is implied by this document.

| Action | Viewer | Researcher | Administrator | Super Administrator |
| --- | --- | --- | --- | --- |
| Read dashboard, telemetry, alerts, research records; own `/auth/me` | Yes | Yes | Yes | Yes |
| Create/update existing research records and export | No | Yes | Yes | Yes |
| Acknowledge/resolve alerts; approved `/settings`; register software devices | No | No | Yes | Yes |
| List/manage Researcher and Viewer accounts | No | No | Yes | Yes |
| Create/manage Administrator accounts | No | No | No | Yes |
| Read account audit history | No | No | No | Yes |
| Public Super Administrator promotion, self-management, hardware controls, safety overrides, thresholds, final scientific approval | No | No | No | No |

`PUT /devices/:id/config` is withheld because it mixes hardware/safety flags with opaque configuration. Notification-provider credentials and retention-policy writes are also withheld until separately approved; no credentials are returned to browsers. Unknown protected routes deny by default. Existing device-key ingestion is unchanged. Existing laboratory/calibration entries are recordkeeping, not final scientific approval.

## Account lifecycle

Inactive, missing or unknown-role profiles cannot log in, refresh, or use existing tokens through Express. Every request re-verifies Auth and the database profile. Open SSE streams recheck before every poll/send and close on invalidation. Auth may issue a token before the profile check, but it is never returned to an inactive user and grants no direct database access: retain deny-default RLS for anon/authenticated.

Administrator listings contain only Researcher/Viewer profiles. Super Administrators can inspect all profiles but cannot manage Super Administrators or themselves through ordinary user APIs. Role/status inputs are validated both in Express and transactional database functions. Database locking/guards protect the last active Super Administrator, including direct profile changes and Auth cascades. Audit rows contain actor/target IDs, action, old/new role/status and timestamps, never passwords or tokens; RLS prevents client access.

Account deletion first transactionally reserves the profile as inactive/pending deletion, audits the request, then calls Supabase Admin Auth deletion. Pending profiles cannot be reactivated/promoted. The cascade records successful deletion. If Auth deletion fails, the account remains blocked; a permitted manager may retry deletion, not silently reactivate it. Research records remain intact (existing performer references become null). No cross-service atomicity is claimed.

## Provisioning and Super Administrator bootstrap

No public registration or bootstrap endpoint. New managed accounts are created inactive with a Viewer role, then an audited server-only function assigns the permitted role and activates them. If finalization fails, the new account remains inactive for administrator inspection/retry; do not claim success.

The UI supports administrator-supplied temporary passwords (minimum 12 characters), exchanged privately with the intended recipient; no invitation/SMTP delivery is claimed. Supabase email confirmation is recorded by the provisioning administrator, not proven by email delivery. Production invitation, recovery callback and mandatory initial-password-change policy require separate review before production deployment.

After migration review and separate approval to apply it, create and email-confirm the client-designated Auth account privately in Supabase Auth. Leave its profile inactive: the secured bootstrap activates only that explicitly designated account. From `backend`, using private backend environment variables:

```
npx ts-node scripts/bootstrapSuperAdmin.ts --email designated@example.com --reason "Client-approved initial administrator" --dry-run
npx ts-node scripts/bootstrapSuperAdmin.ts --email designated@example.com --reason "Client-approved initial administrator" --apply
```

The script validates identity/email confirmation, requires an explicit email/reason/apply flag and does not create accounts or set passwords. It refuses initial promotion if another active Super Administrator exists. Repeating the same successful designation is idempotent. For subsequent provisioning/transfer, supply `--authorizer <existing-active-super-admin-uuid>` with client approval, provision the replacement first, then use the separate private database-admin procedure to demote/deactivate the old account; never public role selection. Keep at least one active Super Administrator. Service-role access is the security boundary of this offline procedure; restrict operator access and retain audit/reason. Do not run it against hosted accounts without separate approval.

## Compatibility and review

Existing auth envelopes and ordinary domain payloads are unchanged. New roles extend the existing role union. `/users` remains an array with limit/offset pagination, adds server-side search/role/status filters; only managers can use it. `/users/audit` returns paginated audit records to Super Administrators. No hardware, threshold, telemetry calculation or firmware behavior changes. Review migration locking, signup policy and deletion failure recovery with Alejandro before deployment. Hosted migration, real-account provisioning/login and production mail delivery remain **Not Confirmed** until separately tested/approved.
