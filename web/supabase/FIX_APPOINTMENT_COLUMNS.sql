-- 修复 appointments 表缺失列（party_role, customer_info, customer_phone 等）
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- 1. party_role
alter table public.appointments add column if not exists party_role text not null default 'buyer';
do $$ begin
  alter table public.appointments add constraint chk_appointments_party_role
    check (party_role in ('buyer', 'seller', 'tenant', 'landlord'));
exception when duplicate_object then null;
end $$;

-- 2. customer_info
alter table public.appointments add column if not exists customer_info text;

-- 3. customer_phone
alter table public.appointments add column if not exists customer_phone text;

-- 4. customer_group_id 改为可空
alter table public.appointments alter column customer_group_id drop not null;

-- 5. 业务约束（若已存在则跳过）
do $$ begin
  alter table public.appointments add constraint chk_appointments_role_group
    check (
      (party_role in ('buyer', 'tenant') and customer_group_id is not null)
      or (party_role in ('seller', 'landlord') and customer_group_id is null)
    );
exception when duplicate_object then null;
end $$;
