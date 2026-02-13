-- 待预约：时间待定，状态可跟踪（还未预约、已咨询、待咨询、待对方中介回复等）
create table if not exists public.pending_appointments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  customer_group_id uuid not null references public.customer_groups(id) on delete cascade,
  status text not null default 'not_scheduled' check (status in (
    'not_scheduled',
    'consulted',
    'to_consult',
    'awaiting_agent_reply'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pending_appointments_customer_group on public.pending_appointments(customer_group_id);
create index if not exists idx_pending_appointments_property on public.pending_appointments(property_id);
create index if not exists idx_pending_appointments_status on public.pending_appointments(status);

alter table public.pending_appointments enable row level security;

-- 中介只能管理自己 agent 下的（通过 property -> agent_id）
create policy "Agents can manage pending appointments" on public.pending_appointments
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = pending_appointments.property_id and p.agent_id = auth.uid()
    )
  );
