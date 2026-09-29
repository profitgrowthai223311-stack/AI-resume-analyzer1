@AGENTS.md

# AI Resume Analyzer — project memory

Full product spec: [prd.txt](prd.txt). Build/architecture/testing details: [README.md](README.md). This file is
project instructions and a live status list; session-by-session history goes in [LOG.md](LOG.md), not here.

## Session logging — do this every session

At the end of a working session (or whenever asked to "wrap up", "log progress", or similar), append a new entry to
the **top** of the entries list in `LOG.md` (newest first, right after the title — never delete or rewrite older
entries). Use today's real date; include a time only if you actually know it (e.g. from a system reminder or
something the user shared). Format:

```
## YYYY-MM-DD[, HH:MM] — <short title>

- Bullet points of what changed: files/areas touched, decisions made (and why), tests run and their results,
  anything left open for next time. Write for a teammate picking this up cold, not a transcript of tool calls.
```

Also keep the **Remaining work** list below current: check items off (or delete them) when finished, and add new
ones as they come up, instead of only recording them in the log.

## Secrets

Real credentials live only in `.env.local` (git-ignored). `.env.example` stays blank. Verified clean: no secret has
ever been committed to git (checked with `git log -p --all -S"<secret>"` across the whole history). Several keys were
pasted into chat during development (OpenAI, Razorpay secret, Supabase service-role key, DB password) — rotate them
before a real launch; this is still outstanding as of the last log entry.

## Testing

```bash
npm run test:guardrails                      # unit, no server needed
./scripts/dev-test-server.sh                 # build + start on :3111 first
npm run test:rls && npm run test:extract && npm run test:ats \
  && npm run test:generate && npm run test:adversarial && npm run test:verify-payment \
  && npm run test:upload-limit && npm run test:retry && npm run test:billing && npm run test:pages
```

All of these hit the real configured Supabase project and Razorpay test-mode account (they create and clean up
temporary users/data). Run the relevant ones after any change that could affect them, not just typecheck/lint.

## Remaining work

Not done yet, roughly in the order it likely matters:

- **No GitHub remote yet.** The repo is local-only (`git remote -v` is empty). The PRD's branching/PR workflow
  (feature branches, branch protection, PR/issue templates — already scaffolded under `.github/`) hasn't been used
  for real yet.
- **Not deployed.** `netlify.toml` exists but nothing has been connected/deployed. Still needed: connect the GitHub
  repo once it exists, set every env var from `.env.example` in Netlify (mark server secrets as secret), set
  `NEXT_PUBLIC_SITE_URL` to the real domain, add `<domain>/auth/callback` to Supabase Auth's redirect URLs, and point
  the Razorpay webhook at `<domain>/api/razorpay-webhook`.
- **Razorpay is in Test Mode.** Going live needs Razorpay account activation/KYC, live API keys and live plan IDs,
  and re-confirming which payment methods are actually enabled for Subscriptions in Live Mode (Test Mode toggles
  don't necessarily carry over — verify in the live dashboard).
- **Rotate pasted secrets** (see Secrets section above) — the user said they'd do this "later"; not yet confirmed done.
- **Full manual browser walkthrough never done.** Everything has been verified via automated API-level e2e tests and
  screenshots, not a human clicking through sign-up → upload → tailor → generate → pay → download in a real browser.
  Do this once before calling the product done. In particular, the full Razorpay checkout UI (real card entry) was
  never automated end-to-end — Razorpay's bot detection served an hCaptcha challenge to headless Chrome, which was
  correctly left alone rather than defeated. See README's "Payment confirmation" section for the recurring-payment
  test card numbers to use for that manual test.
- **Observability is partial.** `logEvent(...)` calls exist for the key steps (extraction, analysis, generation,
  webhook, checkout, deletion, rate limits), but the PRD's full list (PRD §17: sign-up completed, upload
  accepted/rejected, download events, free-to-Pro conversion, etc.) hasn't been audited item-by-item, and there's no
  dashboard/alerting on top of the logs.
- **No admin/operator view.** The PRD names an "Admin/operator" persona that monitors generation failures, webhook
  delivery, storage use and abuse indicators. Not built (wasn't in MVP scope, but the PRD lists the persona).
- **Rate limiting is in-memory per server instance** (`src/lib/server/rate-limit.ts`). Fine for one instance; needs a
  shared store (e.g. Upstash Redis) before running on more than one.
- **Production email deliverability.** Supabase's default auth email sender has production rate limits; configure a
  real SMTP provider in the Supabase dashboard before relying on sign-up/reset emails at any real volume.
- **No Terms of Service page**, only [Privacy](src/app/privacy/page.tsx). Not required by the PRD, but worth having
  before charging real money.
