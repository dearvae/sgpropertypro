-- 卖家中介（房源中介）姓名和电话，用于中介仪表盘显示及 WhatsApp 联系
alter table public.properties add column if not exists listing_agent_name text;
alter table public.properties add column if not exists listing_agent_phone text;
