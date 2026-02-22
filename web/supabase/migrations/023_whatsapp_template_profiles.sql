-- profiles: 公司名 + WhatsApp 模板（中介版 / 非中介版）
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists whatsapp_template_agent text;
alter table public.profiles add column if not exists whatsapp_template_client text;

comment on column public.profiles.company is '公司名，如 Propnex，用于 WhatsApp 模板';
comment on column public.profiles.whatsapp_template_agent is '中介版 WhatsApp 预填消息模板，null 时用系统默认';
comment on column public.profiles.whatsapp_template_client is '非中介版 WhatsApp 预填消息模板，null 时用系统默认';

-- 更新 handle_new_user：从 raw_user_meta_data 读取 company
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, agent_number, phone, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'agent_number',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company'
  );
  return new;
end;
$$ language plpgsql security definer;
