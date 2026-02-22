-- WhatsApp 模板拆分为买房 / 租房（中介和非中介各 2 个可编辑模板）
alter table public.profiles add column if not exists whatsapp_template_agent_sale text;
alter table public.profiles add column if not exists whatsapp_template_agent_rent text;
alter table public.profiles add column if not exists whatsapp_template_client_sale text;
alter table public.profiles add column if not exists whatsapp_template_client_rent text;

comment on column public.profiles.whatsapp_template_agent_sale is '中介版 WhatsApp 预填消息模板 - 买房，null 时用系统默认';
comment on column public.profiles.whatsapp_template_agent_rent is '中介版 WhatsApp 预填消息模板 - 租房，null 时用系统默认';
comment on column public.profiles.whatsapp_template_client_sale is '非中介版 WhatsApp 预填消息模板 - 买房，null 时用系统默认';
comment on column public.profiles.whatsapp_template_client_rent is '非中介版 WhatsApp 预填消息模板 - 租房，null 时用系统默认';
