# MariaDB/MySQL authentication migration

The existing MariaDB/MySQL provider and its two committed migration scripts are
retained. The new `20261104000000_mariadb_auth_hardening` migration is
forward-only: it extends the current schema in place and preserves users,
Argon2id password hashes, refresh-token verifiers, password-reset verifiers,
and typing history.

## Before deployment

1. Confirm the production database has successfully applied the existing
   `20261017000000_init` and `20261017020816_add_authentication` migrations.
2. Back up the database and restore that backup in a staging MariaDB/MySQL
   instance.
3. Run `npm run db:deploy` against staging first. Review the migrated user,
   role, session, refresh-token, reset-token, and typing-session counts.
4. Check for duplicate `LOWER(TRIM(email))` values before deployment. The new
   unique normalized-email index deliberately stops rather than silently
   changing ambiguous account data.

## What the migration does

- Preserves the existing `User`, `RefreshToken`, `PasswordResetToken`, and
  `TestSession` rows.
- Maps legacy `USER`/`ADMIN` values into the new authoritative role tables.
- Maps verified users to `ACTIVE`; legacy users without a verification timestamp
  become `PENDING_VERIFICATION`.
- Creates one stable session per existing refresh-token family and keeps usable
  legacy refresh verifiers valid. Rotated/revoked history is made explicit for
  replay detection.
- Renames reset-token `usedAt` to `consumedAt` without changing verifier values.
- Adds verification tokens, audit events, encrypted notification outbox, account
  status, lockout, session-version, and security-version fields.

## Release sequence

1. Put the API into a short maintenance window or otherwise stop concurrent
   authentication writes.
2. Run `npm run db:deploy` with a least-privileged migration identity.
3. Start the API with a `mysql://` `DATABASE_URL`, a bounded
   `DB_CONNECTION_LIMIT`, Redis, external PS256 keys, CSRF secret, and outbox
   encryption key.
4. Start `npm run jobs:outbox` and schedule `npm run jobs:cleanup`.
5. Verify readiness, a password sign-in, refresh rotation, session list,
   verification delivery, password reset, and typing history.

## Rollback

Do not run `db:reset` or delete the added tables/columns in production. If the
application rollout must be rolled back, restore the pre-migration backup or
deploy a reviewed compatibility release that understands the expanded schema.
The migration intentionally does not modify existing password hashes or raw
refresh-token values, so a backup restore is deterministic.
