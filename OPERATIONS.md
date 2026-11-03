# Freetip operations guide

How to run, change, check and fix Freetip from any computer (including a Windows PC), with no special tools and no Mac. Written 2026-11-01; **kept current until the project is done** (see "Keeping this file current" at the end). No secret values are in this file or anywhere in the repo: the repo is public.

Other docs: `README.md` (what the site is), `PROGRESS.md` (state and log), `GUIDELINES.md` (rules) and `docs/next-steps.md` (decisions and next steps), `PRODUCT.md`, `DESIGN.md`, `docs/` (payout design, rules check, copy).

## 1. Accounts: what lives where

| What | Where | Used for |
|---|---|---|
| Code | GitHub `atulsharma568/Freetip` (public), branch `main` | Source of truth. Pushing to `main` deploys. |
| Hosting | Vercel, project for `freetip.in` (region Singapore `sin1`) | Runs the site, cron jobs, holds all secrets (Settings > Environment Variables). |
| Database | Neon Postgres (AWS Singapore) | All data. Run migrations in Neon's SQL Editor. |
| Domain and DNS | Hostinger | `freetip.in`. `A @` to Vercel, `CNAME www` to the project's Vercel DNS name, a TXT record for Search Console. |
| Sign-in | Google Cloud Console (OAuth client, YouTube scope) | "Sign in with Google". Redirect URI: `https://freetip.in/api/auth/callback/google`. |
| Payments | Razorpay Dashboard | Keys, webhook, settlements. |
| Contact email | Resend | Emails the owner new contact messages. |
| Voice | Azure Speech (main), Amazon Polly (fallback, AWS IAM user) | Text-to-speech on alerts. |
| Sounds and alert media | Vercel Blob (public store, same `BLOB_READ_WRITE_TOKEN`) | Creator-uploaded sounds (`sounds/`) and GIF, picture and WebM files for the alert (`media/`). |
| Search | Google Search Console (Domain property `freetip.in`) | Sitemap `https://freetip.in/sitemap.xml`. |

Keep every login, and every secret value, in a password manager. If a value is lost, it is replaced in the provider's dashboard and then in Vercel (never read back from Vercel if marked sensitive).

## 2. Set up a new computer (Windows, from zero)

1. Install **Git**, **Node.js 20 or newer (LTS)** and **VS Code** (optional).
2. Open PowerShell:
   ```
   git clone https://github.com/atulsharma568/Freetip.git
   cd Freetip
   npm ci
   ```
3. Tell git who you are for this repo only (the owner's GitHub no-reply identity from `git log`):
   ```
   git config user.name "Atul Sharma"
   git config user.email "91332290+atulsharma568@users.noreply.github.com"
   git config commit.gpgsign false
   ```
   Push needs a GitHub login (Git Credential Manager asks in a browser the first time).
4. Local secrets: copy `.env.example` to `.env.local` and fill it in. Easiest: `npm i -g vercel`, `vercel login`, `vercel link`, then `vercel env pull .env.local` (this copies Production values; **do not commit `.env.local`**, it is gitignored). Use a **separate Neon branch** for local work if you will test writes, never the production database.
5. Run: `npm run dev` then open http://localhost:3000.

Important: Next.js here is a newer version with breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before changing framework-level code.

## 3. Everyday commands

```
npm run dev                 # local site
npx tsc --noEmit            # type check
npm run lint                # eslint
npm run build               # production build
npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts   # fast tests, no browser or build
npm run test:e2e            # full tests; needs Chromium (npx playwright install chromium); CI runs these too
npm run emoji:refresh       # re-download Unicode's emoji names for the voice (see below)
```

**Refreshing the emoji names (about once a year, after Unicode's autumn release).** The voice reads every emoji: our own funny Hindi and plain English names are in `src/lib/emoji-names.ts` (edit a line there to change one, no command needed), and every other emoji falls back to Unicode's official name in `src/lib/emoji-names-cldr.ts`. That second file is generated, never edited by hand. To pick up new emoji: run `npm run emoji:refresh` (needs internet), look at `git diff` (only new emoji should be added), run the type check and the tests, then commit and push. It downloads the files itself and never overwrites a name from `emoji-names.ts`. It also writes `CLDR_GROUPED_NAMES` in the same file: official names for the second and later emoji of each shared group, so look-alikes (😂 🤣 😆) are not read as the same word; a test (`test/emoji-names.spec.ts`) fails if two emoji ever share a spoken name, so if a refresh adds one, give it its own line in the `DISTINCT` list in `emoji-names.ts`. **This also runs by itself** every 20 October (`.github/workflows/emoji-names.yml`, plain GitHub, no key needed): if Unicode changed anything it opens a pull request titled "Refresh the emoji names from Unicode"; you read it and press Merge. One-time setting for that: on GitHub, Settings, Actions, General, Workflow permissions, tick "Allow GitHub Actions to create and approve pull requests". To try it now: Actions tab, "Refresh emoji names", Run workflow (it says nothing to do when nothing changed). Note: a pull request opened this way does not start the CI checks by itself; close and reopen it to start them.

A change is "done" when type check, lint and build pass. CI (`.github/workflows/ci.yml`) runs on every push to `main`; check the Actions tab on GitHub.

## 4. Change something and ship it

1. Edit the code, run the checks above.
2. `git add -A`, `git commit -m "what and why"`, `git push origin main` (never force-push).
3. Vercel builds and deploys by itself (Vercel > Deployments shows progress and logs).
4. If the change adds a file in `db/migrations/`, run it in Neon **before** the deploy (see section 5).
5. Roll back: Vercel > Deployments > pick the last good one > **Promote to Production** (instant, no code change).

## 5. Database (Neon)

- Open the Neon console > project > **SQL Editor**, paste the whole migration file, run. Migrations are safe to re-run. Files are in `db/migrations/` (0001 to 0047 so far), run in number order. Base schemas: `db/schema.sql` (waitlist), `db/schema-users.sql` (users).
- Status as of 2026-11-01: all run through 0026 (0027 and 0028, the goal bar, were run 2026-11-01; 0029, the male or female voice, and 0030, the one-time handle change, and 0031, handle change requests, are new: run all three BEFORE the deploy; without 0030 claiming a handle fails, without 0031 the request form fails; **0032, stream timestamps, 0033, its extras (automatic moments, public pages, editor link), and 0034, the OBS clip helper token, are new: run all three BEFORE the deploy, in number order**, without 0032 the Timestamps page says so and the chat command answers that it is not working, without 0033 or 0034 only that section says so, nothing else breaks) **0036, tables for custom alert media and alert rules (run 2026-11-01; custom alert media and alert rules both use it), is new: run it BEFORE the deploy, after 0035.** **0037, the card style and font columns for overlay themes (run 2026-11-01), is new: run it BEFORE the deploy, after 0036; without it the Style page opens on the defaults, saving says it could not save, and alerts play in the plain style.** **0038, fan identity (fan profiles, counted tips, the birthday greeting and the birthday on a tip; run 2026-11-01), is new: run it BEFORE the deploy, after 0037; without it fan levels, the fan list and the birthday message do nothing (the tip, the alert and the books are not affected) and the Fans page says it could not read.** **0039, the regional language column for regional voices, is new: run it BEFORE the deploy, after 0038; without it the Regional language picker cannot save (the settings say so) and alerts keep reading as Hindi or English.** **0040, paid highlighted messages (the pin minimum and time on creators, the pin flag and end time on tips), is new: run it BEFORE the deploy, after 0039; without it the Pinned page opens empty and saving says it could not save, the tip page does not offer a pin, and nothing else breaks (tips, alerts and approvals work as before).** **0041, the Streamlabs bridge (the sealed connection per creator and the queue of alerts waiting to be sent), is new: run it BEFORE the deploy, after 0040; without it the Streamlabs page says so, connecting fails, and tips are not queued for Streamlabs (nothing else breaks: tips, alerts and the books are not affected).** **0042, the "stay on screen" column for alert rules (a rule from ₹1,000 up can keep the alert up to 5 minutes), is new: run it BEFORE the deploy, after 0041; without it saving a rule fails and rules stop applying until it is run.** **0043, fan-picked alert rules (a column on tips) and the site settings table, is new: run it BEFORE the deploy, after 0042; without it a creator's pick on the tip page is refused ("not available") and the owner's voice minimum cannot be saved (it stays at ₹50), nothing else breaks.** **0044, the alert text and colours column (`users.alert_text`), is new: run it BEFORE the deploy, after 0043; without it the Text page opens on the normal card, saving says it could not save, and alerts play with the normal text (nothing else breaks).** **0045, the alert motion column (`users.alert_motion`; the owner has run 0044 already), is new: run it BEFORE the deploy, after 0044; without it the Motion page opens on the normal card, saving says it could not save, and alerts play the normal wipe and length (nothing else breaks).** **0046, the table for alert variations by tip size (`alert_variations`), is new: run it BEFORE the deploy, after 0045 (0045, the alert motion column, is also still to be run if you have not); without it the Variations page opens empty, saving says it could not save, and alerts play without variations (nothing else breaks).** **0047, the alert volume and layout column (`users.alert_layout`), is new: run it BEFORE the deploy, after 0046; without it the Layout page opens on the normal alert, saving says it could not save, and alerts play at normal volume with the picture above the card (nothing else breaks).** **0035, the per-creator paid switches, is new: run it BEFORE the deploy.** It switches stream timestamps and the OBS clip helper OFF for every creator (they were open to everyone before); without 0035 those pages and the admin Paid features box say so and nothing else breaks. Except 0022 (parked) and 0025 (unused); verify with Neon's table list if unsure.
- Connection string: Neon > Connection details > the **pooled** one (host contains `-pooler`). Goes in Vercel as `DATABASE_URL`.
- Reset a leaked password: Neon > Roles > reset password, update `DATABASE_URL` in Vercel, redeploy.
- Waitlist export (contains personal data; delete the file after use): in PowerShell `$env:DATABASE_URL="..."; npm run export:waitlist`.

## 6. Environment variables (names only; values in Vercel)

Set in Vercel > Settings > Environment Variables (Production), then **redeploy** for a change to apply.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string. |
| `WAITLIST_SALT`, `CRON_SECRET` | Random strings (`openssl rand -hex 32`, or any 64-character random value). `CRON_SECRET` protects the cron endpoints. `WAITLIST_SALT` (at least 16 characters) is also the key that scrambles fan names into fan codes: **never change it** after fan levels or the fan list are in use, or every fan becomes a new fan; if it is missing, fan levels and the fan list count nothing. |
| `AUTH_SECRET`, `AUTH_URL` (`https://freetip.in`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Sign-in. |
| `NEXT_PUBLIC_SITE_URL` (`https://freetip.in`) | Lets search engines in, turns on redirects and schema. |
| `OWNER_GOOGLE_IDS` | Comma-separated Google account IDs allowed into `/admin`. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments and webhook check. |
| `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`, `CONTACT_FROM_EMAIL` (optional) | Contact-form email to the owner. |
| `BLOB_READ_WRITE_TOKEN` | Sound uploads (Vercel Blob store). |
| `TTS_ENABLED` (`true`) | Owner switch for voice on the whole site; off by default. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Main voice engine. |
| `POLLY_ACCESS_KEY_ID`, `POLLY_SECRET_ACCESS_KEY`, `POLLY_REGION` (optional) | Fallback voice. |
| `YT_DATA_API_KEY` | Stream timestamps: a Google Cloud API key restricted to the YouTube Data API v3 (looks up a stream's start time, title and owner). |
| `YT_TOKEN_KEY` | Stream timestamps: 32 random bytes as base64 (`openssl rand -base64 32`). Encrypts each creator's YouTube permission and Discord address. If lost or changed, creators just connect again; keep a copy somewhere safe. |
| `STREAMLABS_CLIENT_ID`, `STREAMLABS_CLIENT_SECRET` | Streamlabs bridge: from the app registered at streamlabs.com (see 7c). The secret is shown once on Streamlabs; never paste it in chat, a commit or an email. Needs `YT_TOKEN_KEY` too (it encrypts each creator's Streamlabs sign-in). |
| `NEXT_PUBLIC_GA_ID` | Switches on Google Analytics and its consent banner. Not set yet. |
| `TTS_AUTOLEARN`, `ANTHROPIC_API_KEY` | **Parked by the owner; do not set.** |

## 7. Daily cron jobs (`vercel.json`)

Vercel calls each with `CRON_SECRET`. Times are UTC.

| Path | When | Does |
|---|---|---|
| `/api/cron/waitlist-purge` | 03:17 | Clears old waitlist/rate-limit rows. |
| `/api/cron/sound-orphans` | 03:41 | Removes sound files nobody uses. |
| `/api/cron/tts-cache-purge` | 03:53 | Clears old voice clips. |
| `/api/cron/tts-learn` | 04:13 | Voice auto-learning (does nothing while parked). |
| `/api/cron/accrual-sweep` | 04:29 | Posts missed tips to the ledger. |
| `/api/cron/goal-periods` | 18:40 (00:10 India) | Records the finished day, week or month of each repeating goal bar (in its own timezone) in `goal_history`, with any carried-over shortfall. The bars reset by themselves; this only keeps the history. |
| `/api/cron/tip-text-purge` | 04:47 | Blanks fan names and messages older than 90 days; deletes handled contact messages older than 12 months; deletes stream timestamps older than 90 days; deletes fan profiles with no tip for 12 months (and the birthday typed with a tip after 90 days). Reply: `{"cleared":N,"contactDeleted":N,"timestampsDeleted":N,"fansDeleted":N}`. |
| `/api/cron/stream-timestamps` | 05:23 | Posts one comment with the saved timestamps on each stream that has ended, from the creator's own YouTube account. Reply: `{"configured":true,"checked":N,"posted":N,"skipped":N,"waiting":N,"failed":N,...}`; `{"configured":false}` while `YT_DATA_API_KEY` or `YT_TOKEN_KEY` is missing. **Daily is too slow for this** (a stream's comment would wait up to a day): Vercel's free plan only allows daily crons, so a GitHub Actions workflow (`.github/workflows/stream-timestamps.yml`) calls it every 10 minutes (needs the `CRON_SECRET` repository secret, see section 7b step 5); any other scheduler that sends `Authorization: Bearer <CRON_SECRET>` works too. It is safe to call as often as you like. |
| `/api/cron/streamlabs-outbox` | 05:11 | Sends Streamlabs alerts still waiting (a message waiting for approval, an alert held back to stay under about 2 a minute, or one due a retry). Each tip is also sent straight after it is paid, and a waiting one is sent as soon as the creator approves it, so the daily run is only a safety net; for waiting alerts to go out on time also point a free scheduler at `https://freetip.in/api/cron/streamlabs-outbox` every 2 minutes with the header `Authorization: Bearer <CRON_SECRET>` (same as the timestamps one). An alert more than an hour old is dropped, so a slow scheduler loses alerts, not money. Reply: `{"configured":true,"sent":N,"dropped":N,"waiting":N,"retried":N}`; `{"configured":false}` while the Streamlabs variables or `YT_TOKEN_KEY` are missing. |

Run one by hand: Vercel > Settings > Cron Jobs > **Run**. Or from PowerShell:
```
$s = Read-Host -AsSecureString "CRON_SECRET"
$t = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
curl.exe -H "Authorization: Bearer $t" https://freetip.in/api/cron/tip-text-purge
```
`Unauthorized` means the wrong or missing secret; `Not set up` means `DATABASE_URL` is missing.

## 7b. Stream timestamps (set up once)

Creators type `!ts` in YouTube live chat (through Nightbot or similar), Freetip saves the moment, and after the stream a comment with all the times is posted from the creator's own channel; each moment can also go to their Discord. Creator page: `/dashboard/timestamps`.

Owner setup, in order:
1. Run migration `0032_stream_timestamps.sql` in Neon.
2. Google Cloud (the project that holds your OAuth client): enable **YouTube Data API v3**; create an **API key** restricted to that API and set it as `YT_DATA_API_KEY`. Generate `YT_TOKEN_KEY` (`openssl rand -base64 32`) and set it. Redeploy.
3. Same OAuth client: add `https://freetip.in/api/yt-connect/callback` under Authorised redirect URIs.
4. OAuth consent screen: add the scope `https://www.googleapis.com/auth/youtube.force-ssl` to the app and include it in the verification request (reason: posts one comment on the creator's own live stream, only when the creator turns the feature on; the demo video should show the Connect YouTube step and the posted comment). Until Google verifies the app, Google ends each creator's permission after about 7 days and limits the app to 100 test users; the page then asks the creator to connect again.
5. The every-10-minutes scheduler for `/api/cron/stream-timestamps` is a GitHub Actions workflow (`.github/workflows/stream-timestamps.yml`). One step for you: GitHub repository > Settings > Secrets and variables > Actions > New repository secret, name `CRON_SECRET`, value the same as in Vercel. Check it in the Actions tab ("Post stream timestamps"); a green run prints the summary. GitHub can start runs a few minutes late and pauses schedules after 60 days with no repository activity (open the workflow and press Enable).
6. Quota: posting a comment costs about 50 units of the project's 10,000 daily; that is about 200 comments a day for all creators together. Apply for more under Google Cloud > APIs > YouTube Data API > Quotas when it matters.

Phase 2 (migration 0033), all switched on by the creator on `/dashboard/timestamps`: **automatic moments** (a tip at or above their chosen amount, and every completed goal, add a moment when the alert plays on the stream; needs YouTube connected so we can find the live stream; the label is only the amount or the goal title, never a fan's name); **public highlights pages** at `freetip.in/<handle>/highlights/<videoId>` (off until the creator turns them on; times and labels only; indexed by search engines only when a stream has 3 or more moments); the **editor link** `freetip.in/editor/<secret>` (private, read only, no sign-in, shows the most-marked moments first, a CSV and the moments as YouTube chapters; the creator can make a new link, which cancels the old one, or remove it). The handle `editor` is reserved.

Phase 3 (migration 0034), the **OBS clip helper**: a small Node program in `tools/obs-clip-helper/` that a creator runs on their own PC next to OBS. YouTube gives no way to cut a clip from a stream, so it cuts the clip out of the creator's own OBS recording. It asks `GET /api/ts-helper/<token>/events?since=<id>` (its own secret token, shown once on `/dashboard/timestamps` under "Video clips from your own recording"; making a new one stops the old helper; the page says whether the helper was seen in the last 90 seconds), waits until each moment is 12 seconds old, saves OBS's replay buffer through OBS's built-in WebSocket server, cuts 20 seconds before and 10 after with the bundled ffmpeg, squeezes it under `maxUploadMb` (default 10) and uploads it to the Discord webhook the creator typed into the helper's own `config.json`. The video and that webhook address never reach Freetip, and the feed carries no viewer names. Nothing to set on the server beyond migration 0034. Instructions for creators: `tools/obs-clip-helper/README.md` (the Timestamps page links to it on GitHub). It is **run from source, not a packaged download**: a creator needs Node 22 and runs `npm install`; a signed installer or single-file build (needs a Windows machine to prove) is a later step. A helper long-polls for up to 20 seconds, so each running helper holds one short function call open at a time, only while they stream. A creator's problems: "does not recognise this helper token" (they made a new one or removed it), "replay buffer is not running" or "older than the replay buffer" (OBS settings, see the README).

A creator's problems: the comment never appears (check the stream row on their Timestamps page for the reason); "YouTube is not connected" (they must press Connect YouTube); Nightbot says "Could not tell which stream this is" (the stream is not live, or YouTube is slow; try again). Closing a creator's account erases their saved moments and secrets.

## 7c. Streamlabs bridge (set up once)

A creator connects their own Streamlabs account and each paid tip also shows as an alert in their Streamlabs alert box (name, amount and, by the same rules as the OBS alert, the message). Creator page: `/dashboard/streamlabs`. Off for everyone until you tick **Streamlabs alerts** in `/admin/creators/<id>` or `/admin/features`. Design, limits and open questions: `docs/streamlabs-bridge-research.md` and `docs/streamlabs-bridge-plan.md`.

Owner setup, in order:
1. Run migrations `0041_streamlabs.sql` and `0042_alert_rule_stay.sql` in Neon, in that order.
2. The Streamlabs app is registered (2026-11-02) in **testing mode**: only accounts on its whitelist (up to 10) can connect. Its client ID is on the app's page in your Streamlabs dashboard (streamlabs.com > API settings). The redirect address registered with it must be exactly `https://freetip.in/api/streamlabs/callback`.
3. In Vercel set `STREAMLABS_CLIENT_ID` and `STREAMLABS_CLIENT_SECRET` (the secret is on the same Streamlabs page) and make sure `YT_TOKEN_KEY` is set. Redeploy.
4. Tick **Streamlabs alerts** for your own creator account, open `/dashboard/streamlabs`, press **Connect Streamlabs**, approve, then **Send a test alert**. Have a Streamlabs alert box open in OBS or its preview to see it.
5. Optional: the every-2-minutes scheduler for `/api/cron/streamlabs-outbox` (see section 7).
6. Before any creator other than your whitelisted accounts can connect, Streamlabs has to approve the app for full access (apply from the app's page; their process is not documented). The privacy page already describes the bridge.

What the creator sees go wrong: "Streamlabs needs you to sign in again" (the sign-in was refused; they press Connect again); "Last problem" lines on the page; "not sent" counts (alerts older than an hour, refused by Streamlabs, or Streamlabs unreachable five times). A creator who has both the Freetip alert and a Streamlabs alert box in OBS sees each tip twice. Closing a creator's account, or pressing Disconnect, deletes their stored Streamlabs sign-in. Not yet proven with a real Streamlabs account: that the alert shows with the right look and the amount in rupees, and which alert type shows best.

## 7d. Alert studio (set up once)

Four paid switches in the "Alert box" group change how the OBS alert looks and sounds. Each is OFF for everyone until you tick it for a creator in `/admin/creators/<id>` ("Paid features" box); there is no plan or price on the site. Each one has its own creator page, shown in the dashboard menu only while its switch is on:

| Switch | Creator page | What the creator sets | Migration |
|---|---|---|---|
| Alert text and colours | `/dashboard/text` | The headline (`{name} tipped {amount}`), card, text and amount colours, text size and weight. Colours that are hard to read are refused. | 0044 |
| Alert animations and timing | `/dashboard/motion` | How the card comes in and leaves (wipe, fade, slide, zoom, bounce), how long it stays (5 to 30 s, never shorter than the voice, sound or video needs), a pause before the next alert. | 0045 |
| Alert variations by tip size | `/dashboard/variations` | "From this tip size up": a picture, a sound, wording and colours, and a longer stay (from ₹1,000, up to 5 minutes). Up to 10, one per size. A fan's own choice always wins (a tip that picked an alert rule gets no variation; a soundboard sound the fan picked replaces the variation's sound; a voice tip plays no sound). Its media needs "Custom alert media" and its wording and colours need "Alert text and colours". | 0046 |
| Alert volume and layout | `/dashboard/layout` | A master volume for alert sounds and the voice (only quieter than normal) and the picture left or right of the card (landscape only; media needs "Custom alert media"). | 0047 |

Owner setup, in order:

1. Run `0045_alert_motion.sql`, `0046_alert_variations.sql` and `0047_alert_layout.sql` in Neon (SQL Editor) BEFORE the deploy. (0044 is already run.) Without a migration only that page says it could not save and the alert plays normally; nothing else breaks.
2. Deploy, then in `/admin/creators/<id>` tick the four switches (plus **Custom alert media** for pictures) for a test creator, Save.
3. As that creator open each page, change something, Save, and send a real test tip or the dashboard **Test alert** button with the OBS source open. Changes need no OBS reload.

If something looks wrong: the alert always falls back to the normal card (bad stored values are dropped, a switch turned off shows the normal alert at once, a missing migration drops only that piece). A picture that does not show needs "Custom alert media" ticked and a playable file on `/dashboard/media`. Nothing in the studio has been seen in real OBS yet; the previews on the dashboard pages run the real card but do not play sound. Plan and decisions: `docs/alert-studio-plan.md`.

## 8. The owner console (`/admin`)

Sign in with the Google account whose ID is in `OWNER_GOOGLE_IDS`. Pages: Overview; Finance (balances, creators, payments, settlements); Reconciliation (**Sync** button posts missed tips to the books); Audit log; Creators (accent reset, suspend; click a name for the detail page, where the **Paid features** box turns each paid feature on or off for that one creator, for whoever pays you: tick, Save, or "Turn on everything that exists" / "Turn all off"; every change is in the Audit log as `creator.features_changed`; features not built yet are listed greyed out); Features (`/admin/features`: a grid of who has which paid feature on, with counts, a search box, and below it a list where you tick a creator's features and press Save without opening their page); Health (`/admin/health`: the cron routes and a checklist of which settings are present, names only; last-run times are "not recorded yet" until a `cron_runs` table is added); Messages (contact form; mark handled); Sounds (remove a creator's sound); Alert media (`/admin/media`: every GIF, picture or WebM a creator uploads plays at once (changed 2026-11-02: no first-upload hold; the creator is responsible, the terms say so), and you look them over here afterwards; a file still marked waiting is from before the change, press **Approve** on it; **Take down** erases a file and leaves a "taken down" note the creator can delete; both go in the Audit log; the feature must first be ticked in the creator's Paid features box, "Custom alert media"). Overview now lists what needs you today (pending creators, payout setups to review, new messages, handle requests) and the nav shows the counts. Suspend, reject, close account, sound removal, media approval and take-down, handle approval and "Turn all off" ask twice (closing an account asks you to type the handle) and can take a reason that goes into the Audit log; the Audit page now shows the log with filters; Voice words (`/admin/tts-words`, edit the Hinglish dictionary and download the unknown-word log); Site settings (`/admin/settings`, added 2026-11-02: **the voice minimum**, the smallest tip that can be read aloud for every creator, ₹50 until you change it, 0 for none; a creator can set a higher amount, never lower; saved changes go in the Audit log as `site.tts_floor_changed`; needs migration 0043). Money numbers: `src/lib/money.ts` (5% fee plus 2.75% processing charge) and `src/lib/balances.ts` (payout minimum, holds).

Voice word suggestions (optional, offline, on one computer only): `docs/indicxlit.md`. Setup once per computer, run when `/admin/tts-words` has new words.

## 9. How the pieces connect

- Fan tip page `/<handle>` creates an order, Razorpay takes the payment, Razorpay calls `/api/webhooks/razorpay`, the tip is marked captured and posted to the ledger.
- Creator dashboard `/dashboard` (settings, QR, OBS link, goal bar, messages to approve, tips list, earnings estimate).
- OBS alert: the creator's overlay link `/api/overlay/<token>` is added in OBS as a browser source; the token is shown only when created. Every extra on the alert (sound, media, theme, text, motion, layout, variations, fan level, birthday) is read together at play time in `src/lib/alert-extras.ts` and each piece is checked against its own creator switch then, so a switch turned off shows the normal alert at once.
- Legal pages read operator details from `src/lib/legal.ts`; `LEGAL_DRAFT` controls the draft banner and indexing.
- Site name, host and sample creator: `src/lib/site.ts`.
- Redirects: `src/lib/redirects.ts` (`www` and the old `tipsite.vercel.app` go to `freetip.in`).

## 10. Common problems

| Symptom | First checks |
|---|---|
| Google sign-in fails | Vercel function logs after choosing the account; `DATABASE_URL`; OAuth app in Testing mode needs your Gmail under Audience > Test users; the redirect URI must match exactly. |
| Site shows old behaviour after a setting change | Environment variables only apply after a redeploy. |
| A page 500s after a push | Vercel > Deployments > Logs; run the missing migration in Neon; or roll back (section 4). |
| A creator says a pinned message does not show | The "Paid highlighted messages" box is ticked for them in `/admin/creators/<id>`; they set a minimum tip on `/dashboard/pinned`; the fan ticked the pin and the tip was at least the minimum; the creator approved the message (it waits in "Messages to approve" on the overview in every alert mode); the OBS Browser source is their alert link with `/pinned` on the end. The card clears by itself when the time set on `/dashboard/pinned` ends, or at once with "Take down now". |
| No voice on alerts | `TTS_ENABLED=true`, Azure or Polly keys set, creator has voice turned on, a tip uses a sound or the voice, never both. A message in Tamil, Telugu or another regional script is read only when "Regional language voices" is ticked for that creator in `/admin/creators/<id>`, they picked that language in their settings, and Azure (not only Polly) is configured. |
| Contact emails not arriving | `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`; messages are always in `/admin/messages`. |
| Webhook not firing | Razorpay Dashboard > Webhooks: URL `https://freetip.in/api/webhooks/razorpay`, secret equals `RAZORPAY_WEBHOOK_SECRET`; use Reconciliation > Sync to catch up. |
| Cron returns 401 | `CRON_SECRET` differs between your call and Vercel. |
| Vercel emails that Function Storage (10 GB, free plan) is full | Every push to `main` makes a Production deployment and Vercel keeps each one with its own copy of the server code; about 40 a day adds up. Fix: Vercel > project > Settings > Build & Deployment > **Deployment Retention** (it was 30 days; the shortest is 1 day; suggested 1 day for canceled, errored and pre-production, and 7 days or 1 day for production; rollback can only go back that far). Delete old ones now with `npx vercel ls`, then `npx vercel remove <full deployment address> --safe` (several addresses at once are fine). **Never give the project name to `vercel remove`: it removes every deployment, including the live one.** Fewer, bigger commits also help. Check the team's Usage page a day later. Noted 2026-11-02; the retention values the owner saved are not recorded here. |

## 11. Secrets and safety

- Never commit `.env.local`, keys, connection strings or exports of personal data. If a secret is ever committed, rotate it at the provider first, then update Vercel and redeploy.
- Never force-push; never skip hooks. Keep company details and work email out of commits.
- `package-lock.json` must only reference `https://registry.npmjs.org/`.
- **Files that are deliberately not in the public repo (back them up to a private place, for example Google Drive):** `.env.local` (and any other `.env*`; the real values also live in Vercel), `tools/obs-clip-helper/config.json` (helper token and Discord webhook) and any `waitlist-*.csv` or `voice-words*.csv` export. All are listed in `.gitignore`. Do not upload `node_modules`, `.next`, `.vercel` or `test-results` (they can be rebuilt). Also keep a copy of the secrets themselves (Razorpay, Azure, Polly, Google, Streamlabs keys, `YT_TOKEN_KEY`, `AUTH_SECRET`) in a password manager; a Drive folder is not a safe place for them unless the folder is private to you and two-step sign-in is on.
- Git history is permanent: removing a file from the repo does not remove it from old commits. The only secrets ever committed were local-only placeholder values in `.env.local` (a passwordless local database and made-up salts, commit `ea688dc`, 2026-10-26), which is why nothing had to be rotated.

## 12. Picking the project up on another computer

Nothing in the project depends on one person or one machine. Whoever helps should read `GUIDELINES.md`, `PROGRESS.md` and this file first; the rules for working on the project are in `GUIDELINES.md`.

## 13. Not decided or not done yet (so you do not trip on it)

Payouts to creators are not automated; the manual payout sheet is blocked until the legal and provider questions are answered (`docs/payout-design.md`, `docs/rules-check.md`). Real legal review of the pages, GST on the 2.75% charge, and the operator details in `src/lib/legal.ts` are the owner's. Google OAuth verification and Google Analytics are pending. See `docs/next-steps.md` "Next steps" for the live list.

## Keeping this file current

When something here changes (a new migration, variable, cron, admin page, account or procedure), update this file in the same commit. Last updated: 2026-11-01 (paid highlighted messages).
