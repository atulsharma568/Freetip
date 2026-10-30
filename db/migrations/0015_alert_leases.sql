-- Reliable OBS alert delivery. Safe to re-run.
--
-- The overlay used to mark an alert shown the moment it handed it out, so an OBS
-- reload between the hand-out and the card appearing lost that alert. Now the
-- hand-out only leases the alert for a short time; the overlay confirms
-- (POST /api/overlay/<token>/ack) once the card is on screen, and only then is
-- *_shown_at set. A lease that is never confirmed runs out and the alert is
-- handed out again.
--
-- tip_orders.alert_lease_until   — the alert card is out with an overlay until then.
-- tip_orders.message_lease_until — the same for the message card (or the message
--                                  riding along with the alert card).

alter table tip_orders
  add column if not exists alert_lease_until timestamptz,
  add column if not exists message_lease_until timestamptz;
