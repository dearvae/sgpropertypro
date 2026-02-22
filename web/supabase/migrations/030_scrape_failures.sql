-- 抓取失败记录：异步抓取失败时写入，供管理员查看
-- 1. 新建 scrape_failures 表
create table public.scrape_failures (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_url text not null,
  error_message text not null,
  error_type text,
  created_at timestamptz not null default now()
);

comment on table public.scrape_failures is '房源异步抓取失败记录，供管理员排查';
comment on column public.scrape_failures.error_type is '可选：区分超时、选择器失败、网络错误等';

create index idx_scrape_failures_property on public.scrape_failures(property_id);
create index idx_scrape_failures_created on public.scrape_failures(created_at desc);

-- 2. RLS：无 permissive 策略则禁止直接访问，仅通过 admin RPC 或 service role 访问
alter table public.scrape_failures enable row level security;

-- 3. 管理员 RPC：获取抓取失败记录（仅 is_admin 或 is_super_admin 可调用）
create or replace function public.admin_get_scrape_failures()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  source_url text,
  error_message text,
  error_type text,
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
    sf.created_at
  from public.scrape_failures sf
  left join public.properties p on p.id = sf.property_id
  order by sf.created_at desc
  limit 500;
end;
$$;

grant execute on function public.admin_get_scrape_failures() to authenticated;
