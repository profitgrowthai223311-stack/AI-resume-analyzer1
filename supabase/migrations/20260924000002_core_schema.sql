-- Core schema (PRD section 9) + RLS (section 10).

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  original_file_path text,
  original_file_type text check (original_file_type in ('pdf', 'docx')),
  original_file_size bigint,
  extracted_text text,
  structured_content jsonb,
  extraction_status text not null default 'uploaded'
    check (extraction_status in ('uploaded', 'processing', 'complete', 'failed')),
  extraction_error text,
  parser_name text,
  parser_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  company_name text,
  location text,
  raw_text text not null,
  normalized_text text,
  extracted_requirements jsonb,
  created_at timestamptz not null default now()
);

create table public.ats_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  matched_keywords jsonb,
  missing_keywords jsonb,
  evidence_map jsonb,
  recommendations jsonb,
  model_metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  job_description_id uuid references public.job_descriptions (id) on delete set null,
  analysis_id uuid references public.ats_analyses (id) on delete set null,
  version_number integer not null,
  label text,
  status text not null default 'queued'
    check (status in ('queued', 'generating', 'validating', 'compiling', 'ready', 'failed')),
  source_snapshot text,
  job_description_snapshot text,
  latex_content text,
  latex_storage_path text,
  pdf_storage_path text,
  validation_result jsonb,
  generation_metadata jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (resume_id, version_number)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan_code text,
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_customer_id text,
  razorpay_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in ('resume_generation')),
  resume_version_id uuid,
  occurred_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz,
  processing_error text
);

create index on public.resumes (user_id, created_at desc);
create index on public.job_descriptions (user_id, created_at desc);
create index on public.ats_analyses (resume_id, job_description_id);
create index on public.resume_versions (user_id, created_at desc);
create index on public.usage_events (user_id, occurred_at desc);

create trigger resumes_set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------
alter table public.resumes enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.ats_analyses enable row level security;
alter table public.resume_versions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.payment_events enable row level security; -- no policies: service role only

-- Users fully manage their own resumes and job descriptions.
create policy resumes_own on public.resumes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy job_descriptions_own on public.job_descriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Analyses and versions are written by Edge Functions (service role);
-- users can read and delete their own.
create policy ats_analyses_select_own on public.ats_analyses
  for select using (user_id = auth.uid());
create policy ats_analyses_delete_own on public.ats_analyses
  for delete using (user_id = auth.uid());
create policy resume_versions_select_own on public.resume_versions
  for select using (user_id = auth.uid());
create policy resume_versions_delete_own on public.resume_versions
  for delete using (user_id = auth.uid());

-- Billing and usage are read-only for clients.
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());
create policy usage_events_select_own on public.usage_events
  for select using (user_id = auth.uid());

-- Storage (private buckets) -------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('original-resumes', 'original-resumes', false, 10485760,
    array['application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('generated-latex', 'generated-latex', false, 1048576, null),
  ('generated-pdfs', 'generated-pdfs', false, 10485760, array['application/pdf']);

-- Path convention: {user_id}/... so the first folder must equal auth.uid().
create policy original_resumes_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'original-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy original_resumes_select_own on storage.objects for select to authenticated
  using (bucket_id = 'original-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy original_resumes_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'original-resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Generated files are written by Edge Functions only; users may read/delete their own.
create policy generated_latex_select_own on storage.objects for select to authenticated
  using (bucket_id = 'generated-latex' and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_latex_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'generated-latex' and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_pdfs_select_own on storage.objects for select to authenticated
  using (bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy generated_pdfs_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
