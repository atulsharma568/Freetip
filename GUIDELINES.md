# Freetip project guidelines

For anyone who picks this project up next, a person or any tool. Read this file first: it tells you what to read, where each kind of information lives, how to run and ship the project, and how the owner likes to work. It holds no secrets and no company details, and neither should anything you add.

## 1. What this project is

Freetip (`freetip.in`) is an Indian tipping and donation site for streamers and creators. A fan opens a creator's page `/<handle>`, pays by UPI or card through Razorpay, and the creator's OBS overlay shows an alert (name, amount, message, sound or a text-to-speech voice). Creators sign in with Google and use a dashboard. The owner has an owner console at `/admin`. Next.js (App Router, the version in `package.json`, which differs from what you may remember: read `node_modules/next/dist/docs/` before writing Next code), TypeScript, Tailwind, Postgres (Neon) through the `postgres` driver, deployed on Vercel.

## 2. Read in this order

1. This file.
2. `docs/next-steps.md`: the numbered "Next steps" list (newest on top, each item says what is built, what is off by default, which migration to run), the pre-launch checklist, the owner's direction and the competitor decisions.
3. `PROGRESS.md`: living status, newest entry first; every built feature has a paragraph saying what it does, where the code is, what was verified and, importantly, **what was not verified**. The `## Log` section at the bottom is chronological.
4. `OPERATIONS.md`: how to run everything from any computer: accounts, commands, deploy, database, environment variable names, cron jobs, setup of each integration, the owner console, common problems, secrets and safety.
5. `PRODUCT.md` (product decisions) and `DESIGN.md` (the design system; it wins over any generic design advice).
6. `docs/`: one file per big topic (see the table in section 3). `docs/owner-try-list.md` is the owner's running list of things only they can check.
7. `docs/status/`: dated "where we stopped" notes from early November; `PROGRESS.md` is newer.

Do not trust a status line in one file without checking the code or another file: these docs are updated by hand and one can lag. When two disagree, the code and `git log` win.

Generated files: `next dev` may write rule files named after coding tools into the project root. They are not part of this project. Do not commit them; list them in `.git/info/exclude` (a local file that is never pushed).

## 3. Where each kind of information is

| You need | Look here |
|---|---|
| What the owner wants next, what is blocked | `docs/next-steps.md`, the top of `PROGRESS.md` |
| Why a decision was made | `PROGRESS.md` (search the feature name), `docs/*-plan.md`, `docs/plans/`, `docs/specs/`, `PRODUCT.md` |
| How to set up or fix an integration | `OPERATIONS.md` sections 7 to 10 (cron, stream timestamps, Streamlabs, alert studio, owner console, common problems) |
| The list of paid features and their switches | `src/lib/plans.ts` (one entry per feature, `built` flag, group); owners switch them per creator in `/admin/creators/<id>` ("Paid features" box). All are OFF by default. No plan or price may appear on the public site. |
| Money rules (5% fee, 2.75% processing charge) | `src/lib/money.ts`; payout design `docs/payout-design.md`; legal reading `docs/rules-check.md` |
| Operator and legal details shown on policy pages | `src/lib/legal.ts` |
| Database schema | `db/migrations/*.sql` (run in number order; each is safe to re-run), base schemas in `db/schema.sql` and `db/schema-users.sql` |
| Alert (OBS overlay) logic | `src/lib/alert-extras.ts` (everything an alert carries, checked against each creator switch at play time), `src/app/api/overlay/[token]/route.ts`, `src/components/overlay/AlertStage.tsx` |
| Alert studio (text, motion, variations, layout) | `docs/alert-studio-plan.md`, `src/lib/alert-text.ts`, `alert-motion.ts`, `alert-variations.ts`, `alert-layout.ts`, dashboard pages under `src/app/dashboard/{text,motion,variations,layout}` |
| Competitors | `docs/competitor-findings.md` |
| Copy and Hindi wording | `docs/hindi-copy.md`; text-to-speech word lists in `src/lib/` |
| Environment variable names | `.env.example` and `OPERATIONS.md` section 6 (names only; values are never in the repo) |
| Tests | `test/*.spec.ts` (Playwright runner, also used for unit tests) |

Layout of the code: `src/app` (pages, route handlers in `api/`, server actions in `actions/`), `src/lib` (pure rules and server helpers, most with a matching spec), `src/components`, `db/migrations`, `tools/obs-clip-helper` (a separate small Node app a creator runs next to OBS), `scripts/`.

## 4. Accounts and infrastructure (names only)

GitHub repo (`main` deploys), Vercel (hosting, cron, Blob store, all secret values), Neon Postgres (Singapore), Hostinger (domain and DNS), Google Cloud (OAuth sign-in and the YouTube API key), Razorpay (payments), Azure Speech and Amazon Polly (voice), Resend (contact email), Streamlabs (an app registered in testing mode), Google Search Console. The table with exactly what each is used for is `OPERATIONS.md` section 1. **Secret values are in Vercel and the owner's password manager, never in the repo or in chat.** The git-ignored private files are kept by the owner (see section 8); if you need one, ask.

## 5. Run, check and ship

```
npm install
npm run dev                 # local site
npx tsc --noEmit            # type check
npm run lint
npm run build
npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts   # fast tests with no server or build (pure and database-in-memory specs)
npx playwright test --project=chromium-desktop test/<file>.spec.ts    # full config: builds the app and starts it on port 3300
```

- Browser specs need a Chromium: `npx playwright install chromium`. If that is not installed, run them against installed Chrome with a temporary copy of `playwright.config.ts` that adds `channel: "chrome"` to the desktop project, and delete the copy after. The unit config will show about 120 failures that are only browser specs needing a running site; that is expected.
- "Done" means type check, lint and `npm run build` pass. CI (`.github/workflows/ci.yml`) runs on every push.
- Database tests use an in-memory Postgres (`test/helpers/pg.ts`) that applies every migration, so a new migration is exercised by tests.
- Deploy: push to `main`, Vercel builds. **Run a new migration in Neon's SQL Editor BEFORE the deploy that needs it.** Roll back with Vercel > Deployments > Promote to Production.

## 6. How the owner likes to work

- **One decision at a time.** When a task hinges on a choice, ask that single question, put the recommended option first, and wait for the answer before going on. Do not batch several questions and do not assume the answer. Obvious details inside a step are yours to decide.
- **Care matches the step.** A typo or a one-file change is quick. Payments, security, data migrations and anything costly to get wrong get the most care and a second reader. Say which you are doing.
- **Record progress every time.** After every finished step, fix or decision, update `PROGRESS.md` (a paragraph: what, where in the code, what was verified, **what was not verified**, what the owner must do) in the same commit, and say where it was saved. Keep the "Next steps" list in `docs/next-steps.md` current, and `OPERATIONS.md` whenever a migration, variable, cron, admin page, account or procedure changes. Never put secret values in any of them.
- **The owner's try list.** Things only the owner can check (a real phone, a real login, Neon, real uploads, OBS) go into `docs/owner-try-list.md` as unticked `- [ ]` items in the same commit as the feature. Never tick one for the owner.
- **No budget for experts.** The owner has no money for an accountant or lawyer. When a tax or legal question blocks work, read official and public sources (CBIC, RBI and so on), write the decision with its reasoning and sources into `docs/rules-check.md`, and say plainly that it is a reading, not a professional sign-off. Give a cheap trigger to revisit (for example the ₹15 lakh GST trigger).
- **Commit and push.** When a change is finished and verified (lint, type check and build pass), commit and push to `main` without asking (standing instruction). Follow the checklist in section 10 exactly, every time. Never force-push (one exception: the owner approved a one-time rewrite of the whole history on 2026-11-05; do not repeat it) and never bypass hooks; if a hook or the push fails, stop and report.
- **Only the owner's name on the work.** Commit as the owner's GitHub no-reply identity (the name and email in `git log`), never a work email, and never add a co-author or attribution line to a commit or pull request description. Check with `git log -1 --format=%B | grep -ci co-authored` (it must print 0) before pushing. CI enforces it too: the `commit-messages` job in `.github/workflows/ci.yml` fails any push or pull request that has a `Co-Authored-By` line in a commit message.
- **Everything pushed is public.** No secrets, no personal data, no company details. `package-lock.json` must only reference `https://registry.npmjs.org/`; rewrite any private-mirror URL before committing.
- **Honesty.** Say plainly what was not verified. Much of the newest work (alert studio, Streamlabs bridge, recap, tip-page picks, page builder, effects and frames) has not been seen in a real signed-in browser or in real OBS; do not claim it works beyond what the tests show.
- **Public wording rules.** Never write "highlighted message" or "pinned message" on a public page (`test/pinned-guard.spec.ts` enforces it); no fabricated counts, testimonials or payout promises; no plan or price on the site until the owner decides; the site is flat, dark, one lime accent (`DESIGN.md`).
- **Money decisions.** The fee model and its history are in `PROGRESS.md`, `src/lib/money.ts` and `/admin/fees`; the code is the truth. Do not propose lowering rates to match competitors, do not add a withdraw button, and do not promise a payout day on the site.
- Match the surrounding code's style and comment density; the codebase prefers pure, tested rule files in `src/lib` shared by the page, the server action and the overlay.

## 7. Where things stand

The state moves quickly, so it lives in two places and not here: the newest "Current state" entry at the top of `PROGRESS.md`, and the numbered list in `docs/next-steps.md` (newest first). In short, as of 2026-11-05: the tip page, creator dashboard, OBS overlays, alert studio, paid-feature switches, page builder, Pressure meter, photo frames and banner effects, plan passes and by-hand payouts are all built; PayU (plan payments) rejected the business, so paid plans are parked; the payout aggregation question is accepted by the owner as a known risk (`docs/rules-check.md`); migrations are numbered in `db/migrations/` and the list of ones still to run before a deploy is in `docs/next-steps.md` and `OPERATIONS.md`. Confirm with the owner what has been run in Neon before relying on a table or column.

## 8. Private files that are not in the repo

The repo is public, so these are git-ignored (see `.gitignore`) and kept by the owner in private storage: `.env.local` and any other `.env*` (the real values also live in Vercel), `tools/obs-clip-helper/config.json` (a helper token and a Discord webhook address), local scratch and design reference folders, and any CSV export of waitlist or voice words. If the owner has not given them to you, ask; everything you need to work is in the tracked files. Do not recreate secrets from memory or guess values.

## 9. Gotchas that cost time before

- This shell was zsh: an unquoted `grep --include=*.ts` fails ("no matches found"); quote it or leave `--include` out. A shell pattern that matches no file also aborts a whole `&&` chain.
- A sound or voice tip never plays both a sound and the voice; a fan's own pick (an alert rule, a soundboard sound) always beats an automatic variation.
- A switch turned off at play time must show the normal alert; each piece of an alert is read in its own `try`, so a missing migration only drops that piece and never the alert. Keep that property when adding anything to `src/lib/alert-extras.ts`.
- Test-mode Razorpay money is never posted to the books; only `rzp_live_` keys count.
- Never regenerate `YT_TOKEN_KEY` if it exists (it encrypts stored sign-ins); never paste a secret into chat, a commit or an email.
- Next.js here is a newer version than most training data: check the docs in `node_modules/next/dist/docs/` for any API you are unsure of.

## 10. How to commit and push (do every step, in order, every time)

Nothing is committed until every step below is true. If a step fails, **stop and report the exact output to the owner**; do not work around it, do not skip a check, do not force anything.

**A. Before you touch git: is the change finished?**
1. The work matches what the owner asked and the decisions in `docs/next-steps.md` and `PROGRESS.md`; you asked the single decision it hinged on (section 6) unless the instruction was tiny.
2. Any new rule lives in a pure file in `src/lib` with a spec in `test/`; a new table or column has a numbered migration in `db/migrations/` (next free number, safe to re-run), and the code survives that migration being missing (its own `try`, so only that piece drops).
3. A new owner-visible switch is an entry in `FEATURES` in `src/lib/plans.ts` and is OFF by default; no plan or price appears on the public site; public pages never say "highlighted message" or "pinned message".

**B. Verify (all must pass; CI runs the first four on GitHub)**
```
npm run lint
npx next typegen && npx tsc --noEmit
npm run build
npx playwright test -c playwright.unit.config.ts test/<the specs you touched or could affect>.spec.ts
```
Run the whole unit config before a big change (`npx playwright test -c playwright.unit.config.ts`): about 120 failures are expected and are only browser specs that need a running site. For anything that changes the overlay or a page, also run the matching browser specs (section 5). Say in your report exactly what you ran and what you could not run.

**C. Docs, in the same commit**
4. `PROGRESS.md`: a new entry at the top (what, where in the code, what was verified, **what was not verified**, what the owner must do) and a line in the `## Log` for a milestone.
5. `docs/next-steps.md`: tick off or rewrite the item in "Next steps".
6. `OPERATIONS.md`: update whenever a migration, variable, cron, admin page, account or procedure changed (including the "0001 to 00NN so far" migration count); list the migration under "run BEFORE the deploy".
7. Update `docs/*-plan.md` for the feature if one exists, and `docs/owner-try-list.md` for anything only the owner can check.
8. No secret value in any file.

**D. Check what you are about to publish (the repo was public)**
```
git status --short                    # only files you meant to change; nothing from .env*, config.json, *.csv, *.key
git diff --check                      # no whitespace errors
git add -A && git diff --cached --stat   # read the file list
grep "resolved" package-lock.json | grep -v "registry.npmjs.org"   # must print nothing; if it does, rewrite those URLs to https://registry.npmjs.org/
git grep -n -I -E "(sk_live|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE|ghp_[A-Za-z0-9]{20,}|xox[bp]-)" -- . ':!package-lock.json' ':!GUIDELINES.md'   # must show nothing (this guide is excluded because it quotes the pattern)
git grep -n -I -E "postgres(ql)?://[^ ]*:[^ ]+@" -- . ':!package-lock.json' ':!GUIDELINES.md'   # a real connection string with a password must never show
```
(The words `rzp_live_` in code and docs are fine; a real key is not.) No company or employer names, no work email, no personal phone, address or fan data, no private file. If something sensitive slipped in, remove it before committing. If it is already committed or pushed, tell the owner: rotate the secret at the provider first; history is permanent and force-pushing is not allowed.

**E. Commit (identity and signing are set per command if the config does not have them)**
Commit **unsigned**, as the owner's GitHub no-reply identity (the same name and email as the existing commits in `git log`, never a work email). If `commit.gpgsign` is on or the config has no name and email, pass them for the one command:
```
git -c commit.gpgsign=false -c "user.name=<name from git log>" -c "user.email=<no-reply email from git log>" commit -F <message file>
```
The message: a short summary line in plain words; a few lines on why, what is behind a switch, which migration must be run before the deploy, and anything not verified. No co-author or attribution lines. There are no commit hooks; if one is ever added and fails, stop and report, and never use `--no-verify`. One commit per finished change; do not mix unrelated work.

**F. Push, then confirm**
```
git push origin main          # plain push; never --force, never --force-with-lease
gh run list --limit 1         # the CI run for your commit; wait for it (gh run watch) and report the result
```
If the push is rejected, `git pull --rebase origin main`, redo section B, then push again. Never rewrite published history (the owner's one-time exception of 2026-11-05 is done). After CI is green, Vercel deploys by itself: **a migration must already be run in Neon before that deploy**, so remind the owner in your final message when one is pending. If the deploy breaks the live site, roll back in Vercel (Deployments > the last good one > Promote to Production) and report; do not force-push.

**G. Your final message to the owner**
Say in plain words: what changed, the commit hash, what you verified (commands and results), what you did **not** verify, the owner's to-do (migrations first).

**If the GitHub repository does not exist any more, or is a new one**
Create a **private** repository to start (everything pushed to a public one is public): `gh repo create <name> --private --source=. --remote=origin`, then `git push -u origin main`. Reconnect Vercel to it (Vercel > Project > Settings > Git), confirm the `main` deploy works, and update `OPERATIONS.md` section 1. Do not copy the private files (section 8) into it.
