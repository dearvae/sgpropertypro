-- 房产看房预约管理系统 - 初始 schema
-- 在 Supabase SQL Editor 中执行，或使用 supabase db push

-- 1. profiles 扩展表（关联 auth.users）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('agent', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 客户分组
create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 房源
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  link text,
  basic_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. 看房预约
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  customer_group_id uuid not null references public.customer_groups(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_time_range check (end_time > start_time)
);

-- 5. 备注（分层可见性）
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  content text not null,
  visibility text not null default 'internal' check (visibility in ('client_visible', 'internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 索引
create index if not exists idx_customer_groups_agent on public.customer_groups(agent_id);
create index if not exists idx_customer_groups_share_token on public.customer_groups(share_token);
create index if not exists idx_properties_agent on public.properties(agent_id);
create index if not exists idx_appointments_property on public.appointments(property_id);
create index if not exists idx_appointments_customer_group on public.appointments(customer_group_id);
create index if not exists idx_appointments_start_time on public.appointments(start_time);
create index if not exists idx_notes_property on public.notes(property_id);

-- 自动创建 profile（当 auth.users 新增时）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'agent'));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
