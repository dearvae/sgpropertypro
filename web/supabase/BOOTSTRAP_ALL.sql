-- 一次性执行：创建所有表和配置
-- 在 Supabase Dashboard → SQL Editor 中粘贴并运行

-- ========== 1. 初始 Schema ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('agent', 'client')),
  full_name text,
  agent_number text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists agent_number text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists name_changed_at timestamptz;

create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  intent text check (intent in ('buy', 'rent')),
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 若表已存在（旧版无 description/intent），补充列
alter table public.customer_groups add column if not exists description text;
alter table public.customer_groups add column if not exists intent text check (intent in ('buy', 'rent'));

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  link text,
  basic_info text,
  source_url text,
  price text,
  size_sqft text,
  main_image_url text,
  floor_plan_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.properties add column if not exists bedrooms text;
alter table public.properties add column if not exists bathrooms text;
alter table public.properties add column if not exists image_urls jsonb default '[]';
alter table public.properties add column if not exists listing_agent_name text;
alter table public.properties add column if not exists listing_agent_phone text;
alter table public.properties add column if not exists listing_type text check (listing_type in ('sale', 'rent'));
alter table public.properties add column if not exists lease_tenure text;
create unique index if not exists idx_properties_agent_source_url on public.properties(agent_id, source_url) where source_url is not null;

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

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  content text not null,
  visibility text not null default 'internal' check (visibility in ('client_visible', 'internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_groups_agent on public.customer_groups(agent_id);
create index if not exists idx_customer_groups_share_token on public.customer_groups(share_token);
create index if not exists idx_properties_agent on public.properties(agent_id);
create index if not exists idx_appointments_property on public.appointments(property_id);
create index if not exists idx_appointments_customer_group on public.appointments(customer_group_id);
create index if not exists idx_appointments_start_time on public.appointments(start_time);
create index if not exists idx_appointments_client_view on public.appointments(customer_group_id, start_time) where status != 'cancelled';
create index if not exists idx_notes_property on public.notes(property_id);

create table if not exists public.client_appointment_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, agent_number, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'agent_number',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== 2. RLS 策略 ==========
alter table public.profiles enable row level security;
alter table public.customer_groups enable row level security;
alter table public.properties enable row level security;
alter table public.appointments enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Agents can manage own groups" on public.customer_groups;
create policy "Agents can manage own groups" on public.customer_groups for all using (auth.uid() = agent_id);

drop policy if exists "Agents can manage own properties" on public.properties;
create policy "Agents can manage own properties" on public.properties for all using (auth.uid() = agent_id);

drop policy if exists "Agents can manage appointments" on public.appointments;
create policy "Agents can manage appointments" on public.appointments for all using (
  exists (select 1 from public.properties p where p.id = appointments.property_id and p.agent_id = auth.uid())
);

drop policy if exists "Agents can manage notes" on public.notes;
create policy "Agents can manage notes" on public.notes for all using (
  exists (select 1 from public.properties p where p.id = notes.property_id and p.agent_id = auth.uid())
);

-- ========== 3. 客户视图 RPC ==========
create or replace function public.get_client_view(p_share_token text)
returns json language plpgsql security definer set search_path = public as $$
declare v_group_id uuid; v_group_name text; v_result json;
begin
  select id, name into v_group_id, v_group_name from public.customer_groups where share_token = p_share_token limit 1;
  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'properties', '[]'::json);
  end if;
  select json_build_object(
    'group', json_build_object('id', v_group_id, 'name', v_group_name),
    'appointments', (
      select coalesce(json_agg(
        json_build_object('id', a.id, 'start_time', a.start_time, 'end_time', a.end_time, 'status', a.status, 'client_note', coalesce(can.content, ''),
          'property', json_build_object('id', p.id, 'title', p.title, 'link', p.link, 'basic_info', p.basic_info, 'price', p.price, 'size_sqft', p.size_sqft, 'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms, 'main_image_url', p.main_image_url,
            'image_urls', (select coalesce(json_agg(elem order by ord), '[]'::json) from (select elem, ord from jsonb_array_elements_text(coalesce(p.image_urls, '[]'::jsonb)) with ordinality as t(elem, ord) limit 8) sub),
            'floor_plan_url', p.floor_plan_url))
        order by a.start_time), '[]'::json)
      from public.appointments a join public.properties p on p.id = a.property_id left join public.client_appointment_notes can on can.appointment_id = a.id
      where a.customer_group_id = v_group_id and a.status != 'cancelled'),
    'properties', '[]'::json
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function public.get_client_view(text) to anon;
grant execute on function public.get_client_view(text) to authenticated;

create or replace function public.save_client_appointment_note(p_share_token text, p_appointment_id uuid, p_content text)
returns void language plpgsql security definer set search_path = public as $$
declare v_valid boolean;
begin
  select exists (select 1 from public.appointments a join public.customer_groups g on g.id = a.customer_group_id where a.id = p_appointment_id and g.share_token = p_share_token) into v_valid;
  if not v_valid then raise exception 'invalid_token_or_appointment'; end if;
  insert into public.client_appointment_notes (appointment_id, content, updated_at) values (p_appointment_id, coalesce(p_content, ''), now())
  on conflict (appointment_id) do update set content = excluded.content, updated_at = now();
end;
$$;
grant execute on function public.save_client_appointment_note(text, uuid, text) to anon;
grant execute on function public.save_client_appointment_note(text, uuid, text) to authenticated;

-- ========== 4. 预约冲突 ==========
-- 允许同一时段存在多个预约，前端展示红色「时间冲突」标签
-- （旧版冲突检测触发器已移除，见 016_allow_appointment_conflicts）

-- ========== 5. 中介建议/反馈 ==========
create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_display text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_feedback_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.agent_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(feedback_id, user_id)
);

create index if not exists idx_agent_feedback_created_at on public.agent_feedback(created_at desc);
create index if not exists idx_agent_feedback_votes_feedback on public.agent_feedback_votes(feedback_id);

alter table public.agent_feedback enable row level security;
alter table public.agent_feedback_votes enable row level security;

drop policy if exists "Authenticated can insert feedback" on public.agent_feedback;
create policy "Authenticated can insert feedback" on public.agent_feedback for insert to authenticated with check (true);
drop policy if exists "Authenticated can read feedback" on public.agent_feedback;
create policy "Authenticated can read feedback" on public.agent_feedback for select to authenticated using (true);

drop policy if exists "Authenticated can insert vote" on public.agent_feedback_votes;
create policy "Authenticated can insert vote" on public.agent_feedback_votes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authenticated can delete own vote" on public.agent_feedback_votes;
create policy "Authenticated can delete own vote" on public.agent_feedback_votes for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Authenticated can read votes" on public.agent_feedback_votes;
create policy "Authenticated can read votes" on public.agent_feedback_votes for select to authenticated using (true);
