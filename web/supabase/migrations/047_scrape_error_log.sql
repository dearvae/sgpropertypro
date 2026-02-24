-- 抓取失败/运行记录增加 error_log 列，存完整 traceback 供 debug

alter table public.scrape_failures add column if not exists error_log text;
comment on column public.scrape_failures.error_log is '完整异常堆栈，便于 debug';

alter table public.scrape_runs add column if not exists error_log text;
comment on column public.scrape_runs.error_log is '失败时的完整异常堆栈，便于 debug';

-- 更新 admin_get_scrape_failures 返回 error_log（需先 drop 才能改返回类型）
drop function if exists public.admin_get_scrape_failures();
create or replace function public.admin_get_scrape_failures()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  source_url text,
  error_message text,
  error_type text,
  error_log text,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and (is_admin = true or is_super_admin = true)
  ) then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    sf.id,
    sf.property_id,
    coalesce(p.title, '')::text,
    sf.source_url,
    sf.error_message,
    sf.error_type,
    sf.error_log,
    sf.created_at
  from public.scrape_failures sf
  left join public.properties p on p.id = sf.property_id
  order by sf.created_at desc
  limit 500;
end;
$$;

-- 更新 admin_get_scrape_runs 返回 error_log（需先 drop 才能改返回类型）
drop function if exists public.admin_get_scrape_runs();
create or replace function public.admin_get_scrape_runs()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  source_url text,
  scrape_type text,
  operator_id uuid,
  operator_display_name text,
  started_at timestamptz,
  duration_ms int,
  result text,
  error_message text,
  error_log text
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and (is_admin = true or is_super_admin = true)
  ) then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    sr.id,
    sr.property_id,
    coalesce(sr.property_title, p.title, '')::text,
    sr.source_url,
    sr.scrape_type,
    sr.operator_id,
    coalesce(nullif(trim(coalesce(op.family_name,'') || ' ' || coalesce(op.given_name,'')), ''), op.full_name, '')::text as operator_display_name,
    sr.started_at,
    sr.duration_ms,
    sr.result,
    sr.error_message,
    sr.error_log
  from public.scrape_runs sr
  left join public.properties p on p.id = sr.property_id
  left join public.profiles op on op.id = sr.operator_id
  order by sr.started_at desc
  limit 500;
end;
$$;
