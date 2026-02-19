-- 修复 customer_groups 表缺失 is_active 列
-- 若出现 "Could not find the 'is_active' column of 'customer_groups' in the schema cache"
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- 添加 is_active 列（若已存在则跳过，不覆盖）
alter table public.customer_groups
  add column if not exists is_active boolean not null default true;

comment on column public.customer_groups.is_active is '是否活跃。false 表示已成交等，从筛选列表中排除；设为 active 后可恢复显示';

create index if not exists idx_customer_groups_is_active on public.customer_groups(agent_id, is_active);
