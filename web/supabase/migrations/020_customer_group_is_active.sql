-- 客户 inactive 打标：已成交客户可设为 inactive，从各 filter 中排除
-- is_active = false 时：不出现于客户分组筛选、预约筛选、待预约、时间表等

alter table public.customer_groups
  add column if not exists is_active boolean not null default true;

comment on column public.customer_groups.is_active is '是否活跃。false 表示已成交等，从筛选列表中排除；设为 active 后可恢复显示';

create index if not exists idx_customer_groups_is_active on public.customer_groups(agent_id, is_active);
