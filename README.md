# AI Resume Analyzer

Tailor an existing resume to a job description **without inventing experience**. Upload a PDF/DOCX, paste a job
description, get an explainable ATS keyword analysis, and generate a validated LaTeX + PDF resume.
Full spec: [prd.txt](prd.txt).

Stack: Next.js (App Router) · Supabase (Auth, Postgres + RLS, private Storage) · OpenAI · Razorpay · Netlify.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in values; never commit .env.local
npm run check-env -- --phase=7 # shows what is still missing
npx supabase db push --db-url "$SUPABASE_DB_URL"   # apply supabase/migrations
npm run dev
```

Supabase → Auth → URL Configuration: add `http://localhost:3000/auth/callback` (and preview/production URLs).
Razorpay: create the webhook at `<site>/api/razorpay-webhook` (events: `subscription.*`) using the value of
`RAZORPAY_WEBHOOK_SECRET`, and put the two plan IDs in env.

## How it works

| Step                                               | Where                                                      |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Upload + validation (extension, size, magic bytes) | `src/components/resume/resume-uploader.tsx`                |
| Text extraction (unpdf / mammoth)                  | `POST /api/extract-resume`                                 |
| JD requirements + ATS score + evidence map         | `POST /api/analyze-ats` → `src/lib/server/ats.ts`          |
| Generation pipeline                                | `POST /api/generate-resume` → `src/lib/server/generate.ts` |
| System prompts (owner-supplied)                    | `src/lib/server/prompts.ts`                                |
| LaTeX validation + fact enforcement + sanitizing   | `src/lib/server/latex-check.ts`                            |
| PDF compile (multipart `pdflatex`)                 | `src/lib/server/compile.ts`                                |
| Checkout + subscription creation                   | `POST /api/create-checkout`                                |
| Payment confirmation (browser, signature-verified) | `POST /api/verify-payment`                                 |
| Payment confirmation (webhook, reconciliation)     | `POST /api/razorpay-webhook`                               |
| Cancel subscription                                | `POST /api/cancel-subscription`                            |
| Signed downloads (LaTeX = Pro)                     | `GET /api/download`                                        |
| Deletion                                           | `DELETE /api/account`, `DELETE /api/resumes/[resumeId]`    |

### Prompts and anti-fabrication design

Both AI steps use the owner-supplied system prompts verbatim (`src/lib/server/prompts.ts`): the ATS analyzer (JSON output)
and the LaTeX resume writer. The resume prompt demands exactly 8 bullets with real metrics per company, extra JD tools
and the JD's city, which would force fabrication, so a **TRUTHFULNESS OVERRIDE** block is appended that supersedes
those rules (per PRD section 12). The model's output is then checked by `checkLatex`:

- structure: starts/ends correctly, no fences, preamble identical to the template, allow-listed commands/environments only,
  balanced environments, sections in order, escaped special characters, https/mailto links that exist in the resume;
- facts: name, email, phone, location, employers, titles, dates, schools, degrees and project names must appear in the
  resume; unsupported bullets (invented figures), skills and certifications are removed and reported as warnings;
- one automatic retry with the failure reasons; otherwise the version fails with a safe message and is not charged.
  ATS "matched" skills are verified against the resume text; unverified ones are shown as "related but unproven".

### Payment confirmation: browser-verified, not webhook-only

Checkout uses Razorpay subscriptions. On success, Checkout.js hands the browser a payment id, subscription id and a
**signature** — an HMAC-SHA256 of `payment_id|subscription_id` that only Razorpay's servers can produce with our key
secret. `POST /api/verify-payment` (`src/app/api/verify-payment/route.ts`) verifies that signature server-side, then
re-fetches the payment and subscription from Razorpay's API before activating Pro. This is the same trust model as
the webhook (a cryptographic proof, not a client claim) but resolves instantly on the checkout redirect instead of
waiting for an async webhook delivery. It is idempotent (shares the `payment_events` table/uniqueness with the
webhook) and rate-limited; a transient failure (e.g. Razorpay briefly unreachable) is retried rather than treated as
a false success. The **webhook stays in place** as the durable reconciliation path — it is what the PRD requires for
delayed events, renewals, halts and cancellations, and it re-activates a subscription even if the browser tab closed
before `/api/verify-payment` ran. Live security checks: `npm run test:verify-payment` (forged/wrong-secret signatures
rejected, cross-user ownership enforced, a merely well-formed-but-fake payment id never activates anything).

A full automated browser test (real Razorpay Checkout UI + test card `4111 1111 1111 1111`) was attempted with
Puppeteer; Razorpay's checkout responded to the headless browser by loading an hCaptcha/bot-detection challenge, which
was not bypassed. The endpoint's logic is instead verified directly against the live Razorpay API (above). Recommend
a manual click-through with a test card before going live.

#### "This card is not eligible for recurring payments"

Razorpay Subscriptions only accepts payment instruments capable of a recurring mandate — not every card qualifies,
and this is a real-world limitation your customers will hit too, not just a test-mode quirk. **Which methods are
offered for Subscriptions (UPI Autopay, additional card networks, eNACH, …) is an account-level setting that only
Razorpay Support can change — it is not exposed in the Dashboard or any API**, so this can't be fixed from the
codebase. To get more methods enabled, open a ticket with Razorpay support and ask them to enable UPI Autopay (and
any other recurring-capable methods you want) for Subscriptions on your account. In the meantime:

- `CheckoutButton` (`src/components/billing/checkout-button.tsx`) listens for Razorpay's `payment.failed` event and
  shows a specific, actionable message in the app (not just Razorpay's own in-modal banner) when a card is rejected
  for this reason.
- Whatever methods Razorpay _does_ enable for your account show up automatically in the checkout modal — the code
  never restricts `method` — so once support enables more, no code change is needed here.

### AI model

`OPENAI_MODEL` defaults to `gpt-4.1-mini` for both the ATS analysis and the resume-generation steps. Override it in
`.env.local` to use a different model.

### Deviation from the PRD

The PRD names Supabase Edge Functions. Deploying those needs a Supabase access token, so the same contracts are
implemented as Next.js API routes (server-only secrets, same behaviour). They can be moved into Edge Functions
later with little change; the logic lives in `src/lib/server/*`.
Generation runs in the background via `after()` and the client polls the version row.
`maxDuration` is set on the routes; check your Netlify plan's function time limit.

## Tests (need `.env.local` and a running server)

```bash
npm run test:guardrails                      # unit: LaTeX validator + fact checks (no server)
./scripts/dev-test-server.sh                 # build + start on :3111
npm run test:rls && npm run test:extract && npm run test:ats \
  && npm run test:generate && npm run test:adversarial && npm run test:verify-payment \
  && npm run test:billing && npm run test:pages
```

The e2e scripts create temporary users in the configured Supabase project and delete them afterwards.

## Netlify deployment checklist

- [ ] Connect the GitHub repo; build command `npm run build` (see `netlify.toml`).
- [ ] Add env vars listed in `netlify.toml` (mark server secrets as secret). `NEXT_PUBLIC_*` are inlined at build time.
- [ ] `NEXT_PUBLIC_SITE_URL` = production URL; add `<url>/auth/callback` to Supabase redirect URLs.
- [ ] Razorpay webhook → `<url>/api/razorpay-webhook`; switch to live keys + live plan IDs for production.
- [ ] Test signed PDF download and a test-mode payment on a deploy preview.
- [ ] **Rotate every key that was ever pasted into chat or shared** (OpenAI, Razorpay, Supabase service role, DB password).

## Known limitations / next steps

- Rate limiting is in-memory per instance; use a shared store (e.g. Upstash) for multi-instance production.
- Free-plan **upload** cap (2) is not enforced yet; generation quota is.
- `SUPABASE_DB_URL` is for CLI migrations only; the app never uses it.
- `prompts.ts` holds the owner-supplied prompts plus the truthfulness override; bump the version constants when editing.
