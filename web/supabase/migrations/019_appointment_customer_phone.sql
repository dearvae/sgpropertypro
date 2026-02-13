-- 代表卖家/房东的预约：潜在买家/租客的手机号（可点击跳转 WhatsApp）
alter table public.appointments add column if not exists customer_phone text;
