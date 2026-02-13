-- 客户分组增加描述字段（预算范围、备注等）
alter table public.customer_groups
  add column if not exists description text;
