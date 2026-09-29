# Project log

Session-by-session history of work done on this project. Newest entry at the top. See [CLAUDE.md](CLAUDE.md) for the
logging convention and the current "remaining work" list.

## 2026-09-29 — Project status review; set up CLAUDE.md and LOG.md

- Reviewed the whole project against the PRD to answer "what's left"; compiled it into a living checklist in
  `CLAUDE.md` instead of a one-off answer, so it stays current.
- Verified no secret was ever committed to git, by searching the full commit history for each real secret value
  (`git log -p --all -S"<secret>"` for the Razorpay key secret, Supabase service-role key, OpenAI key, and Razorpay
  webhook secret) — zero hits in all four. Confirmed there is still no GitHub remote configured.
- Set up this log file and added a standing instruction in `CLAUDE.md` for every future session to append an entry
  here (date/time header + bullet points), so work done across conversations stays traceable.

## 2026-09-29 — Corrected payment-methods guidance; recurring test card numbers

- User hit "This card is not eligible for recurring payments" while testing checkout, and shared a screenshot of
  their Razorpay Dashboard (Subscriptions → Settings → Payment Methods) showing Card/UPI/eMandate toggles.
- That corrected something stated in the previous session: enabling payment methods for Subscriptions is a
  **self-service dashboard toggle**, not something requiring a Razorpay support ticket as their written docs implied.
  Updated `README.md` to say so.
- Looked up and documented the three actual Razorpay test card numbers that work for recurring/subscription payments
  in Test Mode (a generic one-time test card like `4111 1111 1111 1111` does not): a domestic Visa credit card, an
  international Mastercard credit card, and an international Mastercard debit card — see README for the numbers.
- Tagged `v0.4.2`.

## 2026-09-29 — Signature-verified browser payment confirmation; gpt-4.1-mini

- User asked to confirm Razorpay payments via the browser instead of only the webhook, and to switch the OpenAI model
  to `gpt-4.1-mini` (confirmed reachable with the configured API key).
- Implemented `POST /api/verify-payment`: on Checkout.js success, verifies the HMAC signature Razorpay returns
  (`payment_id|subscription_id` signed with the key secret) — the same cryptographic trust level as the webhook, just
  delivered synchronously instead of async — then re-fetches the payment and subscription from Razorpay's API before
  activating Pro. The webhook stays in place as the durable reconciliation path (per the PRD's own requirement for
  delayed-webhook handling).
- Found and fixed a real idempotency bug during testing: a verification attempt that failed partway (e.g. Razorpay
  briefly unreachable) could be replayed and short-circuit into a false "success" instead of actually retrying.
- Attempted a full Puppeteer browser test using Razorpay's real checkout UI and official test card. Razorpay served
  an hCaptcha/bot-detection challenge to the headless browser; did not attempt to bypass it (that's a fraud-prevention
  boundary, not a bug). Verified the endpoint's security properties directly against the live Razorpay API instead
  (`scripts/e2e-verify-payment.mjs`, 10 checks: forged signatures rejected, wrong-secret signatures rejected, a
  well-formed-but-fake payment id never activates anything, cross-user ownership enforced, rate-limited).
- Full suite re-run after the change: 116 checks across all `test:*` scripts, all passing. Tagged `v0.4.0`, then
  `v0.4.1` for a payment-failure UX follow-up (a `payment.failed` handler in `CheckoutButton` shows a specific message
  instead of leaving the user on a silent button after a decline).

## 2026-09-24 — Owner-supplied prompts wired in; stricter LaTeX guardrails (v0.3.0)

- User supplied the actual ATS-analysis and resume-generation system prompts to use (from their existing n8n
  workflow). Wired both in verbatim in `src/lib/server/prompts.ts`.
- The resume prompt's "exactly 8 bullets with real metrics per company", "add JD tools if plausible", and "set the
  header city to the JD's city" rules would force fabrication. Per the PRD (and the user's earlier explicit
  confirmation that truthfulness wins over the 8-bullet rule), appended a **TRUTHFULNESS OVERRIDE** block to the
  prompt that takes priority over those specific rules.
- Rewrote the LaTeX checker from scratch (`src/lib/server/latex-check.ts`) to match the owner's specific template:
  preamble must match byte-for-byte, only an allow-listed set of commands/environments, every fact (name, email,
  phone, location, employer, title, dates, school, degree, project name) must be traceable to the source resume text,
  and unsupported bullets/skills/certifications are stripped out with a warning rather than silently kept or hard-
  failing the whole generation. One automatic retry with the failure reason before giving up.
- Added a live adversarial test (`scripts/e2e-adversarial.mjs`): a job description that tries prompt-injection to add
  a fake AWS certification, fake years of experience, fake metrics ("87% at Google"), and a `\input` LaTeX injection.
  None of it made it into the output. Tagged `v0.3.0`.

## 2026-09-24 — Full SaaS redesign: colorful theme, sidebar, analytics dashboards (v0.2.0)

- User asked for a complete SaaS look: colorful, React-based, a sidebar with sections, and real analytics dashboards.
- New design system: gradient theme tokens (light + dark, via `next-themes`), colorful button/badge/progress variants.
- New app shell: dark gradient sidebar (Overview/Workspace/Account sections), top bar with page title, New Resume
  button, theme toggle, and a user menu.
- New Dashboard and Analytics pages built on `recharts`: ATS score trend, keyword-coverage donut, weekly activity,
  score histogram, top matched keywords, top gaps, version-status breakdown.
- Redesigned My Resumes (cards with delete), resume detail (tabbed: text/versions/details), the tailor flow (3-step
  progress bar + animated score ring + color-coded keyword chips), the version page (live progress checklist + PDF
  preview alongside downloads), history (searchable/filterable table), the landing page, pricing, billing, and
  settings (tabbed).
- Caught and fixed a real bug via visual QA: a broken font CSS variable was rendering the whole app in a serif font.
  Found it using `scripts/screenshots.mjs`, which seeds a demo user with realistic data and screenshots key pages
  (light/dark/mobile) with headless Chrome. Full test suite re-run clean after the fix. Tagged `v0.2.0`.

## 2026-09-24 — Phases 3 through 8: full working pipeline end to end (v0.1.0)

- Supabase Edge Functions need a Supabase CLI access token we don't have, so implemented the PRD's Edge Function
  contracts as Next.js API routes instead (same server-only-secrets behavior); documented as an intentional deviation
  in `README.md`.
- **Phase 3 (extraction):** `POST /api/extract-resume` using `unpdf` (PDF) and `mammoth` (DOCX), an extraction review
  editor with a paste-text fallback for failed extractions.
- **Phase 4 (ATS analysis):** `POST /api/analyze-ats` — weighted keyword scoring (required/tools/preferred) against
  the resume text, with every match backed by a quoted line from the resume, and gaps classified as "related but
  unproven" vs "not in your resume".
- **Phase 5–6 (generation + PDF):** `POST /api/generate-resume` pipeline — structured JSON from the model, an
  `enforceFacts()` filter that strips anything not traceable to the source resume (with warnings, not silent
  failure), a deterministic LaTeX renderer/escaper, structural LaTeX validation, and compilation via
  latex.ytotech.com with the PDF stored in private Supabase Storage.
- **Phase 7 (billing):** Razorpay checkout, a signature-verified webhook with idempotent event storage, server-side
  free-plan quota enforcement (failed generations don't count against it), billing and pricing pages.
- **Phase 8 (production readiness):** account/resume data deletion (removes storage files too), per-user rate
  limiting, a privacy/AI-data-handling page, security headers, `netlify.toml`, and the initial `README.md`.
- Added live e2e test suites hitting the real Supabase project and Razorpay test account: extraction, ATS analysis,
  generation (including the free-quota block on the 3rd attempt), billing (webhook event types, idempotent replay,
  Pro-gated LaTeX download), and pages (every authenticated route rendered with a real session cookie, checked for
  leaked secrets, then data/account deletion verified). All passing. Rendered a sample PDF and visually checked it.
  Tagged `v0.1.0`.

## 2026-09-24 — Env setup and Phase 2: schema, storage, uploads

- User supplied real Supabase, OpenAI and Razorpay credentials directly in chat; saved to `.env.local` (confirmed
  git-ignored) rather than the tracked `.env.example`. Flagged that anything pasted into chat should be rotated
  before launch (still outstanding — see `CLAUDE.md`).
- Created two Razorpay test-mode plans via the API (monthly ₹199, yearly ₹1,499) and saved their plan IDs.
- Applied both Supabase migrations (the `profiles` table + the full core schema/RLS/storage-bucket migration) to the
  live Supabase project via `supabase db push`, using the DB connection string the user provided (the Supabase MCP
  connector couldn't reach this specific project, so used the CLI directly).
- Built the resume upload UI (drag/drop-free at this point) with client-side validation (extension, size limit,
  magic-byte sniffing) and the resume detail page.
- Wrote `scripts/e2e-rls.mjs`: a live test creating two real temporary Supabase users to prove row-level security and
  storage policies actually isolate users from each other (15 checks — upload, read, update, delete, signed URLs,
  billing tables) — all passing against the real project.

## 2026-09-24 — Project kickoff: PRD review, Phase 0 scaffold, Phase 1 auth

- Read `prd.txt` in full (an "AI Resume Analyzer & Auto-Update SaaS" course project spec) and asked clarifying
  questions before building: Next.js version, which auth methods, the LaTeX system prompt, how to handle the PRD's
  own internal contradiction (its supplied prompt demands exactly 8 bullets + real metrics per company, which the PRD
  text itself flags as something that would force fabrication), which PDF/DOCX parser to use, which AI model, and
  Razorpay/Supabase credentials.
- User's answers: use the latest Next.js, drop OAuth entirely (email/password + magic link + reset only), confirmed
  truthfulness wins over the 8-bullet rule, asked to compare parser options and pick the better one, said they'd
  provide the model/Razorpay/Supabase details separately.
- Scaffolded the app: Next.js 16 (App Router, TypeScript, `src/`), Tailwind 4, shadcn/ui, a `supabase/` directory with
  migration/function-stub structure, `.env.example`, Prettier, and `git init` on `main`.
- Compared `unpdf` vs `pdf-parse` vs `mammoth` for text extraction; picked `unpdf` (PDF) + `mammoth` (DOCX) for
  Edge/serverless compatibility and active maintenance.
- Built Phase 1: Supabase Auth (email/password, magic link, password reset — no OAuth), a session-refreshing
  proxy/middleware, a protected `(app)` layout, a dashboard shell, and the `profiles` migration with RLS and an
  auto-create-on-signup trigger. Verified route behavior with a production build using placeholder Supabase values.
