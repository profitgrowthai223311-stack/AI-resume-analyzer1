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

| Step                                               | Where                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Upload + validation (extension, size, magic bytes) | `src/components/resume/resume-uploader.tsx`                                 |
| Text extraction (unpdf / mammoth)                  | `POST /api/extract-resume`                                                  |
| JD requirements + ATS score + evidence map         | `POST /api/analyze-ats`                                                     |
| Generation pipeline                                | `POST /api/generate-resume` → `src/lib/server/generate.ts`                  |
| Fact enforcement + LaTeX validation                | `src/lib/server/validate.ts`                                                |
| Deterministic LaTeX template                       | `src/lib/server/latex.ts`                                                   |
| PDF compile (multipart `pdflatex`)                 | `src/lib/server/compile.ts`                                                 |
| Billing                                            | `/api/create-checkout`, `/api/razorpay-webhook`, `/api/cancel-subscription` |
| Signed downloads (LaTeX = Pro)                     | `GET /api/download`                                                         |
| Deletion                                           | `DELETE /api/account`                                                       |

### Anti-fabrication design

The model returns **structured JSON**, each bullet with a verbatim `evidence` quote from the source resume.
`enforceFacts` removes anything it cannot trace (unknown employers/schools/certs/skills, invented metrics, bad
dates, unsupported bullets) and records a visible warning. LaTeX is then **rendered by our own template** (all text
escaped), so the output is always well-formed, on an allow-list of packages, and free of dangerous commands.
`validateLatex` re-checks the final document before compiling.

### Deviation from the PRD

The PRD names Supabase Edge Functions. Deploying those needs a Supabase access token, so the same contracts are
implemented as Next.js API routes (server-only secrets, same behaviour). They can be moved into Edge Functions
later with little change; the logic lives in `src/lib/server/*`.
Generation runs in the background via `after()` and the client polls the version row.
`maxDuration` is set on the routes; check your Netlify plan's function time limit.

## Tests (need `.env.local` and a running server)

```bash
npm run test:guardrails                      # unit: fact + LaTeX validators (no server)
./scripts/dev-test-server.sh                 # build + start on :3111
npm run test:rls && npm run test:extract && npm run test:ats \
  && npm run test:generate && npm run test:billing && npm run test:pages
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
- The course's strict LaTeX system prompt was not provided; `src/lib/server/prompts.ts` holds our own versioned prompt.
