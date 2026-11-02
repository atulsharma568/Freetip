# Streamlabs bridge: build plan (approved and built 2026-11-02)

Status: the Streamlabs app is registered in **testing mode** (owner's account only, plus whitelisted accounts). Client ID is known and goes into Vercel as `STREAMLABS_CLIENT_ID`. The secret goes into Vercel as `STREAMLABS_CLIENT_SECRET`. Neither is committed. Nothing is built yet. Research: `docs/streamlabs-bridge-research.md`.

## What the creator sees

1. In the dashboard, a "Streamlabs" tile under Alert box (off for everyone until the owner ticks it).
2. "Connect Streamlabs" opens Streamlabs' authorise page. The creator approves two scopes: `alerts.create` and `donations.create`.
3. After approval, the tile shows "Connected as <name>", a "Send a test alert" button and "Disconnect".
4. Disconnect deletes the stored tokens at once.

## What a fan's tip does

- After capture, if connected: an alert is sent to the creator's Streamlabs alert box with the fan's name (or "Anonymous"), the amount and the message.
- Only tips whose message is approved and passes the creator's banned words carry the message. Otherwise the alert shows the name and amount only.
- The amount is sent in rupees (INR). Whether it displays correctly is unknown until one real test.
- Streamlabs wants a name of 2 to 25 characters. Longer names are cut to 25. A 1-character name is sent as "Anonymous" so the call isn't refused.

## Where it lives (files)

- `src/lib/streamlabs.ts`: builds the authorise URL, exchanges the code, refreshes tokens, posts the alert. Pure helpers are unit-tested.
- `src/lib/secret-box.ts` (existing): seals the access and refresh tokens, the same way the YouTube refresh token is kept.
- `src/app/api/streamlabs/connect/route.ts` and `.../callback/route.ts`: the OAuth start and finish. State is a random value in a cookie, checked on return (same pattern as `src/lib/yt-connect.ts`).
- `src/app/actions/streamlabs.ts`: disconnect and send a test alert (server actions, creator must be signed in and have the feature on).
- `src/app/dashboard/StreamlabsTile.tsx`: the tile.
- `src/lib/stream-send.ts` (or inside `afterCapture`): the send step.
- `src/lib/plans.ts`: a new switch `streamlabs`, built, group "Alert box", off by default.
- Migration `0041_streamlabs.sql`: table `streamlabs_connections` (creator_id unique, sealed access token, sealed refresh token, scopes, connected_at, expires_at, last_error, last_error_at), plus `streamlabs_outbox` (id, tip_order_id unique, state, attempts, next_attempt_at, last_error). Run BEFORE the deploy.
- A cron `/api/cron/streamlabs-outbox` every 2 minutes, which sends at most 2 alerts per creator per minute (Streamlabs' advised limit).
- `OPERATIONS.md`: the two variables, the redirect address, the migration, the cron and how to switch it on. No secret values.
- Privacy policy: new paragraph before any creator connects. It says what goes to Streamlabs (fan name, amount, message) and only when the creator connects.

## Safety rules

- Never blocks the books: the send runs in its own try, after the ledger step, like fan profiles.
- Tokens are never logged, never returned to the browser, and deleted when the account closes (`src/lib/account-close.ts` gets a line).
- A failed token refresh marks the connection "needs reconnect" and stops sending; it does not retry forever.
- Test mode money is never sent (same rule as the ledger).
- A send that fails after 5 tries is dropped and shown in the dashboard as "not sent to Streamlabs", with the tip still counted.

## Tests

- Unit: URL building, state check, token expiry arithmetic, the name and message rules, the outbox retry timing, the 2-per-minute spacing, sealed tokens round-trip and fail on tampering.
- Route: connect and callback redirect when signed out; callback rejects a wrong state.
- Browser: the tile is hidden when the switch is off; no Streamlabs text on the public site.
- Not testable here: a real Streamlabs sign-in and a real alert. The owner tests with the whitelisted YouTube account.

## Open questions for the owner

1. Should a fan's tip with no name still send an alert ("Anonymous")? Plan: yes.
2. Should a tip's message be sent when the creator has our approve-first mode on and the message is still waiting? Plan: no, only approved messages.
3. OK to add the privacy paragraph before the switch is ever turned on for anyone other than you?

## Effort

High for the build (tokens, retries, new policy text). No extra review, as you chose.

## As built (2026-11-02), and where it differs from the draft above

- **Permission asked:** only `alerts.create`. `donations.create` is not needed, because every alert goes out through `POST /alerts` with `type=donation`.
- **Message rule:** the same per-mode rule the OBS alert uses, decided when the alert is sent (Streamlabs takes one alert once). Instant mode sends the message unless it was rejected; split and approve mode wait for the creator's yes; a paid pinned message always waits. A banned word always removes the message. This is slightly looser than "only approved messages" for instant-mode creators, who chose to trust messages unreviewed on their own stream.
- **Waiting and dropping:** an alert more than an hour old (counted from the tip, or from the decision if later) is dropped, the same freshness rule as the OBS alert. After five failed tries it is dropped and the tip still counts.
- **Where the send happens:** straight after capture (inside the existing `after()` step, so Razorpay is never kept waiting), again right after the creator approves a message, and from `/api/cron/streamlabs-outbox` for the rest. Vercel's free plan only runs that cron daily, so an outside scheduler every 2 minutes is optional (OPERATIONS.md 7c).
- **Not built:** a Streamlabs revoke call on disconnect (their docs list none); tokens are deleted from our side only.
- **Files:** `src/lib/streamlabs.ts` (rules and client), `src/lib/streamlabs-outbox.ts` (queue, sending, connection), `src/app/api/streamlabs/{start,callback}`, `src/app/api/cron/streamlabs-outbox`, `src/app/actions/streamlabs.ts`, `src/app/dashboard/streamlabs/`, migration `0041_streamlabs.sql`, `test/streamlabs.spec.ts` (30 tests).
