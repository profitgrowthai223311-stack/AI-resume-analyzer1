-- Enforces the Free plan's "2 total resume uploads" limit (PRD section 6) at the database level,
-- so it cannot be bypassed by calling the Supabase client directly instead of going through the app.
-- Pro users (an active subscription, or a cancelled one still inside its paid period — mirrors
-- getPlan() in src/lib/server/plan.ts) are unlimited. Keep FREE_TOTAL_UPLOAD_LIMIT here in sync with
-- FREE_TOTAL_UPLOADS in .env.example if you change it.
create function public.enforce_resume_upload_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  free_total_upload_limit constant integer := 2;
  sub record;
  is_pro boolean;
  existing_count integer;
begin
  select status, current_period_end into sub
  from public.subscriptions
  where user_id = new.user_id;

  is_pro := sub.status = 'active'
    or (sub.status = 'cancelled' and sub.current_period_end is not null and sub.current_period_end > now());

  if is_pro then
    return new;
  end if;

  select count(*) into existing_count from public.resumes where user_id = new.user_id;
  if existing_count >= free_total_upload_limit then
    raise exception 'FREE_UPLOAD_LIMIT_REACHED: Free plan allows % resume uploads total', free_total_upload_limit
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger resumes_enforce_upload_limit
  before insert on public.resumes
  for each row execute function public.enforce_resume_upload_limit();
