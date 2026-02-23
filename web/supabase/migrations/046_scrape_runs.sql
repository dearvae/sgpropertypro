-- 抓取运行记录：记录每次抓取任务的开始时间、耗时、操作人、结果
-- 供管理员在 Admin 页面查看

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  source_url text not null,
  property_title text,
  scrape_type text not null default 'trigger',  -- 'sync' | 'trigger' | 'batch' | 'add_listing'
  operator_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  duration_ms int,
  result text not null check (result in ('success', 'failure')),
  error_message text
);

comment on table public.scrape_runs is '抓取脚本运行记录：开始时间、耗时、操作人、成功/失败';
comment on column public.scrape_runs.scrape_type is 'sync=同步刷新, trigger=异步触发, batch=批量添加, add_listing=添加自售房源';
create index idx_scrape_runs_started on public.scrape_runs(started_at desc);
create index idx_scrape_runs_operator on public.scrape_runs(operator_id);
create index idx_scrape_runs_result on public.scrape_runs(result);

alter table public.scrape_runs enable row level security;

-- 管理员 RPC：获取抓取运行记录
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
  error_message text
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
    sr.error_message
  from public.scrape_runs sr
  left join public.properties p on p.id = sr.property_id
  left join public.profiles op on op.id = sr.operator_id
  order by sr.started_at desc
  limit 500;
end;
$$;

grant execute on function public.admin_get_scrape_runs() to authenticated;
