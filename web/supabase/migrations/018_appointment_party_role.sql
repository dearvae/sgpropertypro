-- 预约创建：卖房租房模式与角色标签
-- 4 种角色：买家、卖家、租客、房东。代表卖家/房东时无需客户分组，可选填客户信息

-- 1. 新增 party_role：买家 | 卖家 | 租客 | 房东
alter table public.appointments add column if not exists party_role text not null default 'buyer';
alter table public.appointments add constraint chk_appointments_party_role
  check (party_role in ('buyer', 'seller', 'tenant', 'landlord'));

-- 2. 新增 customer_info：代表卖家/房东时的可选客户信息
alter table public.appointments add column if not exists customer_info text;

-- 3. customer_group_id 改为可空（代表卖家/房东时为空）
alter table public.appointments alter column customer_group_id drop not null;

-- 4. 业务约束：买家/租客必填 customer_group_id；卖家/房东必为空
-- 使用 check 会与既有数据冲突，改用 trigger 或应用层校验。这里用 check：
-- (party_role in ('buyer','tenant') and customer_group_id is not null) or (party_role in ('seller','landlord') and customer_group_id is null)
alter table public.appointments add constraint chk_appointments_role_group
  check (
    (party_role in ('buyer', 'tenant') and customer_group_id is not null)
    or (party_role in ('seller', 'landlord') and customer_group_id is null)
  );
