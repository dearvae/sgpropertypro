-- Row Level Security (RLS) 策略

alter table public.profiles enable row level security;
alter table public.customer_groups enable row level security;
alter table public.properties enable row level security;
alter table public.appointments enable row level security;
alter table public.notes enable row level security;

-- profiles: 用户只能读写自己的
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- customer_groups: 中介只能操作自己的分组（客户通过 RPC get_client_view 访问）
create policy "Agents can manage own groups" on public.customer_groups
  for all using (auth.uid() = agent_id);

-- properties: 中介只能操作自己的房源
create policy "Agents can manage own properties" on public.properties
  for all using (auth.uid() = agent_id);

-- properties: 客户通过 customer_group 关联的 appointments 间接看到房源
-- 房源需与 appointments 联表，客户只看有预约的房源；RLS 在 appointment 层控制

-- appointments: 中介管理自己 agent 下的（通过 property -> agent_id）
create policy "Agents can manage appointments" on public.appointments
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = appointments.property_id and p.agent_id = auth.uid()
    )
  );

-- notes: 中介管理自己 agent 下的
create policy "Agents can manage notes" on public.notes
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = notes.property_id and p.agent_id = auth.uid()
    )
  );

-- notes: 无匿名直读；客户通过 RPC get_client_view 获取 client_visible 备注
