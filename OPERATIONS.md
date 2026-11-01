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
| Sounds | Vercel Blob (public store) | Creator-uploaded sounds. |
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
```

A change is "done" when type check, lint and build pass. CI (`.github/workflows/ci.yml`) runs on every push to `main`; check the Actions tab on GitHub.

## 4. Change something and ship it

1. Edit the code, run the checks above.
2. `git add -A`, `git commit -m "what and why"`, `git push origin main` (never force-push).
3. Vercel builds and deploys by itself (Vercel > Deployments shows progress and logs).
4. If the change adds a file in `db/migrations/`, run it in Neon **before** the deploy (see section 5).
5. Roll back: Vercel > Deployments > pick the last good one > **Promote to Production** (instant, no code change).

## 5. Database (Neon)

- Open the Neon console > project > **SQL Editor**, paste the whole migration file, run. Migrations are safe to re-run. Files are in `db/migrations/` (0001 to 0029 so far), run in number order. Base schemas: `db/schema.sql` (waitlist), `db/schema-users.sql` (users).
- Status as of 2026-11-01: all run through 0026 (0027 and 0028, the goal bar, were run 2026-11-01; 0029, the male or female voice, is new: run it BEFORE the deploy) except 0022 (parked) and 0025 (unused); verify with Neon's table list if unsure.
- Connection string: Neon > Connection details > the **pooled** one (host contains `-pooler`). Goes in Vercel as `DATABASE_URL`.
- Reset a leaked password: Neon > Roles > reset password, update `DATABASE_URL` in Vercel, redeploy.
- Waitlist export (contains personal data; delete the file after use): in PowerShell `$env:DATABASE_URL="..."; npm run export:waitlist`.

## 6. Environment variables (names only; values in Vercel)

Set in Vercel > Settings > Environment Variables (Production), then **redeploy** for a change to apply.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string. |
| `WAITLIST_SALT`, `CRON_SECRET` | Random strings (`openssl rand -hex 32`, or any 64-character random value). `CRON_SECRET` protects the cron endpoints. |
| `AUTH_SECRET`, `AUTH_URL` (`https://freetip.in`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Sign-in. |
| `NEXT_PUBLIC_SITE_URL` (`https://freetip.in`) | Lets search engines in, turns on redirects and schema. |
| `OWNER_GOOGLE_IDS` | Comma-separated Google account IDs allowed into `/admin`. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments and webhook check. |
| `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`, `CONTACT_FROM_EMAIL` (optional) | Contact-form email to the owner. |
| `BLOB_READ_WRITE_TOKEN` | Sound uploads (Vercel Blob store). |
| `TTS_ENABLED` (`true`) | Owner switch for voice on the whole site; off by default. |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Main voice engine. |
| `POLLY_ACCESS_KEY_ID`, `POLLY_SECRET_ACCESS_KEY`, `POLLY_REGION` (optional) | Fallback voice. |
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
| `/api/cron/tip-text-purge` | 04:47 | Blanks fan names and messages older than 90 days; deletes handled contact messages older than 12 months. Reply: `{"cleared":N,"contactDeleted":N}`. |

Run one by hand: Vercel > Settings > Cron Jobs > **Run**. Or from PowerShell:
```
$s = Read-Host -AsSecureString "CRON_SECRET"
$t = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
curl.exe -H "Authorization: Bearer $t" https://freetip.in/api/cron/tip-text-purge
```
`Unauthorized` means the wrong or missing secret; `Not set up` means `DATABASE_URL` is missing.

## 8. The owner console (`/admin`)

Sign in with the Google account whose ID is in `OWNER_GOOGLE_IDS`. Pages: Overview; Finance (balances, creators, payments, settlements); Reconciliation (**Sync** button posts missed tips to the books); Audit log; Creators (accent reset, suspend); Messages (contact form; mark handled); Sounds (remove a creator's sound); Voice words (`/admin/tts-words`, edit the Hinglish dictionary and download the unknown-word log). Money numbers: `src/lib/money.ts` (5% fee plus 2.75% processing charge) and `src/lib/balances.ts` (payout minimum, holds).

Voice word suggestions (optional, offline, on one computer only): `docs/indicxlit.md`. Setup once per computer, run when `/admin/tts-words` has new words.

## 9. How the pieces connect

- Fan tip page `/<handle>` creates an order, Razorpay takes the payment, Razorpay calls `/api/webhooks/razorpay`, the tip is marked captured and posted to the ledger.
- Creator dashboard `/dashboard` (settings, QR, OBS link, goal bar, messages to approve, tips list, earnings estimate).
- OBS alert: the creator's overlay link `/api/overlay/<token>` is added in OBS as a browser source; the token is shown only when created.
- Legal pages read operator details from `src/lib/legal.ts`; `LEGAL_DRAFT` controls the draft banner and indexing.
- Site name, host and sample creator: `src/lib/site.ts`.
- Redirects: `src/lib/redirects.ts` (`www` and the old `tipsite.vercel.app` go to `freetip.in`).

## 10. Common problems

| Symptom | First checks |
|---|---|
| Google sign-in fails | Vercel function logs after choosing the account; `DATABASE_URL`; OAuth app in Testing mode needs your Gmail under Audience > Test users; the redirect URI must match exactly. |
| Site shows old behaviour after a setting change | Environment variables only apply after a redeploy. |
| A page 500s after a push | Vercel > Deployments > Logs; run the missing migration in Neon; or roll back (section 4). |
| No voice on alerts | `TTS_ENABLED=true`, Azure or Polly keys set, creator has voice turned on, a tip uses a sound or the voice, never both. |
| Contact emails not arriving | `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`; messages are always in `/admin/messages`. |
| Webhook not firing | Razorpay Dashboard > Webhooks: URL `https://freetip.in/api/webhooks/razorpay`, secret equals `RAZORPAY_WEBHOOK_SECRET`; use Reconciliation > Sync to catch up. |
| Cron returns 401 | `CRON_SECRET` differs between your call and Vercel. |

## 11. Secrets and safety

- Never commit `.env.local`, keys, connection strings or exports of personal data. If a secret is ever committed, rotate it at the provider first, then update Vercel and redeploy.
- Never force-push; never skip hooks. Keep company details and work email out of commits.
- `package-lock.json` must only reference `https://registry.npmjs.org/`.

## 12. Picking the project up on another computer

Nothing in the project depends on one person or one machine. Whoever helps should read `GUIDELINES.md`, `PROGRESS.md` and this file first; the rules for working on the project are in `GUIDELINES.md`.

## 13. Not decided or not done yet (so you do not trip on it)

Payouts to creators are not automated; the manual payout sheet is blocked until the legal and provider questions are answered (`docs/payout-design.md`, `docs/rules-check.md`). Real legal review of the pages, GST on the 2.75% charge, and the operator details in `src/lib/legal.ts` are the owner's. Google OAuth verification and Google Analytics are pending. See `docs/next-steps.md` "Next steps" for the live list.

## Keeping this file current

When something here changes (a new migration, variable, cron, admin page, account or procedure), update this file in the same commit. Last updated: 2026-11-01.
