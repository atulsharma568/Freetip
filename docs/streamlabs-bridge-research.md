# Streamlabs bridge: research (2026-11-02)

Read from Streamlabs' public developer docs (`dev.streamlabs.com`) on 2026-11-02. Nothing was tried with a real app or token. Re-check the pages before building; they are short and not versioned.

## What a bridge would do

After a tip is captured (and its message is approved), Freetip would send it to the creator's own Streamlabs account so it shows in their Streamlabs alert box, event list and goals. Only useful for a creator who runs their stream on Streamlabs and wants Freetip tips to appear there. It does not replace our own OBS alert, and our extras (voice, sounds, rules by tip size, themes, fan levels, pinned messages) do not travel through it.

## What the API allows

| Need | Endpoint and scope | Facts from the docs |
|---|---|---|
| Show an alert | `POST /api/v2.0/alerts`, scope `alerts.create` | `type` is required (follow, subscription, donation, host). Optional: `image_href`, `sound_href`, `message`, `user_message`, `duration` (ms), `special_text_color`. Returns `{"success": true}` or a 400 with `error` and `message`. |
| Record a donation | `POST /api/v2.0/donations`, scope `donations.create` | Takes `name` (2 to 25 characters), `message` (under 255), `identifier` (email-style donor id), `amount`, `currency`. |
| Sign in | OAuth 2, bearer header only (no token in the query string) | Authorization codes last 5 minutes and work once. Two doc pages disagree on token life (60 minutes with a refresh token, or never expires), so refresh must be handled. |

Both calls carry a **recommended limit of 2 per minute per user**, worded as advice, not a hard cap. A busy stream (more than 2 tips a minute) would be throttled or dropped without a queue and retry.

## The blocker: app approval

Streamlabs says: "When the App is not in approved state, only whitelist users can authorize the App", and "You may add up to 10 whitelist users." The docs do not say how an app gets approved, what they check, or how long it takes. So:

- **Without approval:** the owner plus up to 9 whitelisted creators can connect. Enough to try it for real.
- **For every creator:** needs Streamlabs approval, with an unknown process and outcome.

The owner must register the app themselves (log in at streamlabs.com, register a new OAuth application, get a client id and secret, set a redirect address such as `https://freetip.in/api/streamlabs/callback`). Redirect rules are not in the v2 docs; confirm them on the registration page.

## Not known (do not assume)

- Whether `POST /donations` also pops the creator's alert box, or only adds a row to the donation list and stats. The docs do not say. `POST /alerts` with `type=donation` is the documented way to show an alert.
- Whether `currency=INR` is accepted and shown correctly.
- Message length limits and image or sound URL rules for `/alerts` are not given.
- Streamlabs' terms for API apps were not read. Read https://streamlabs.com/terms before building.
- A fan could see two alerts if the creator keeps both our overlay and the Streamlabs alert box on. The page would need to say so.

## If built (design sketch, needs the owner's go-ahead)

- Its own switch in `src/lib/plans.ts`, off for everyone, ticked per creator in the admin.
- A migration for one row per creator: encrypted access and refresh tokens (the YouTube connection in `src/lib/yt-connect.ts` and `src/lib/secret-box.ts` is the pattern to copy), scopes and connected time.
- Connect and disconnect on the dashboard; disconnecting deletes the tokens. Closing an account deletes them too.
- A send step in `afterCapture` in its own try, like fan profiles, so it can never hold up the books. Failures go to a small retry queue worked by a cron, spaced to stay under 2 per minute.
- Send only tips whose message is approved and passes the creator's banned words; an anonymous tip is sent as "Anonymous" (the name must be 2 to 25 characters; trim longer names).
- Privacy policy text first (owner's rule): Streamlabs would receive the fan's name, amount and message, only when the creator has connected it.
- A "send a test alert" button to the creator's Streamlabs, and a TEST marker in the message.
- Owner to set the client id and secret as Vercel variables; add them to `OPERATIONS.md` in the same commit.

Effort when built: high (third-party tokens, a queue, new policy text). No extra review needed.

## Recommendation

Worth building only if creators ask for it. Do not build blind: first the owner registers the app and whitelists their own Streamlabs account, so one real alert can prove the `/alerts` call and the INR amount. If that works, build the sketch above for the whitelist; apply for approval only once more than a few creators want it. StreamElements was not researched.
