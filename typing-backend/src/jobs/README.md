# Notification outbox worker

Run `npm run jobs:outbox` as a separate supervised process after migrations.
It atomically claims at most 25 rows with MariaDB/MySQL `FOR UPDATE`, decrypts the
credential-bearing payload only in memory, sends it through the configured HTTPS
mail adapter, and records bounded retries. Never log the message object: it may
contain a short-lived verification or reset token.

Run `npm run jobs:cleanup` from a scheduler. Each run uses indexed, bounded
batches and retains refresh history beyond its usable lifetime so replay
detection is not weakened by premature deletion.
