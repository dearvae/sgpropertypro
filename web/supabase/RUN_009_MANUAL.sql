-- 在 Supabase SQL Editor 中执行此文件，创建 save_client_appointment_note 函数

-- 1. 创建表（如不存在）
create table if not exists public.client_appointment_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- 2. 创建函数
create or replace function public.save_client_appointment_note(
  p_share_token text,
  p_appointment_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  select exists (
    select 1 from public.appointments a
    join public.customer_groups g on g.id = a.customer_group_id
    where a.id = p_appointment_id and g.share_token = p_share_token
  ) into v_valid;
  if not v_valid then
    raise exception 'invalid_token_or_appointment';
  end if;
  insert into public.client_appointment_notes (appointment_id, content, updated_at)
  values (p_appointment_id, coalesce(p_content, ''), now())
  on conflict (appointment_id) do update set content = excluded.content, updated_at = now();
end;
$$;

-- 3. 授权
grant execute on function public.save_client_appointment_note(text, uuid, text) to anon;
grant execute on function public.save_client_appointment_note(text, uuid, text) to authenticated;
