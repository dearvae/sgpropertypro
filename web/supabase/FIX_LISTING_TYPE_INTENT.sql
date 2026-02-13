-- 添加 listing_type 和 intent 列（修复 schema cache 报错）
-- 在 Supabase SQL Editor 中执行

alter table public.properties
  add column if not exists listing_type text check (listing_type in ('sale', 'rent'));

alter table public.customer_groups
  add column if not exists intent text check (intent in ('buy', 'rent'));

update public.customer_groups set intent = 'buy' where intent is null;

create index if not exists idx_properties_listing_type on public.properties(listing_type);
create index if not exists idx_customer_groups_intent on public.customer_groups(intent);
