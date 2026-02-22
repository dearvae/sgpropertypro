-- 邀请码系统、验证状态、邮箱/手机查重
-- 1. profiles 新增字段
alter table public.profiles add column if not exists invite_code text unique;
alter table public.profiles add column if not exists invited_by_id uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending', 'verified'));
alter table public.profiles add column if not exists is_admin boolean not null default false;

comment on column public.profiles.invite_code is '邀请码，6位字母数字，用于分享给好友';
comment on column public.profiles.invited_by_id is '邀请人 user id';
comment on column public.profiles.verification_status is '验证状态：pending 待验证，verified 已验证；目前所有账号待验证仍可正常使用';
comment on column public.profiles.is_admin is '是否管理员，可访问 /admin。需在 SQL 中手动设置：update profiles set is_admin = true where id = ''用户uuid'';';

-- 2. 手机号唯一约束（非空时）
create unique index if not exists idx_profiles_phone_unique on public.profiles(phone) where phone is not null;

-- 3. 为已有用户生成 invite_code（无 code 的随机生成）
do $$
declare r record;
begin
  for r in select id from public.profiles where invite_code is null
  loop
    update public.profiles set invite_code = upper(substring(md5(gen_random_uuid()::text) from 1 for 6))
    where id = r.id and invite_code is null;
  end loop;
end $$;

-- 4. 新增用户默认生成 invite_code
create or replace function public.gen_invite_code() returns text as $$
declare
  code text;
  done boolean := false;
begin
  while not done loop
    code := upper(substring(md5(gen_random_uuid()::text || clock_timestamp()::text) from 1 for 6));
    if not exists (select 1 from public.profiles where invite_code = code) then
      done := true;
    end if;
  end loop;
  return code;
end;
$$ language plpgsql;

-- 5. 检查手机号是否可用（注册前调用，anon 可调用）
create or replace function public.check_phone_available(p_phone text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where phone = p_phone and phone is not null);
$$;
grant execute on function public.check_phone_available(text) to anon;
grant execute on function public.check_phone_available(text) to authenticated;

-- 检查手机号是否可用于更新（排除指定用户，用于个人资料修改）
create or replace function public.check_phone_available_for_update(p_phone text, p_exclude_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where phone = p_phone and phone is not null and id != p_exclude_id);
$$;
grant execute on function public.check_phone_available_for_update(text, uuid) to authenticated;

-- 6. 检查邮箱是否已存在（需查询 auth.users，仅服务端可调用；客户端通过 signUp 错误判断）
-- 暂不创建，客户端捕获 signUp 的 email_exists / user_already_exists 即可

-- 7. 更新 handle_new_user：生成 invite_code，支持 invited_by
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_invite_code text;
  v_invited_by_id uuid;
begin
  v_invite_code := public.gen_invite_code();
  if (new.raw_user_meta_data->>'invited_by_code') is not null then
    select id into v_invited_by_id from public.profiles
    where invite_code = (new.raw_user_meta_data->>'invited_by_code') limit 1;
  end if;

  insert into public.profiles (id, role, family_name, given_name, full_name, agent_number, phone, company, invite_code, invited_by_id, verification_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'agent_number',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company',
    v_invite_code,
    v_invited_by_id,
    'pending'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 8. 管理员 RPC：获取所有用户及邀请关系（仅 is_admin 可调用）
create or replace function public.admin_get_invite_relations()
returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  invite_code text,
  invited_by_id uuid,
  inviter_display_name text,
  inviter_email text,
  verification_status text,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and is_admin = true) then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    p.id,
    u.email::text,
    coalesce(
      trim(coalesce(p.family_name,'') || ' ' || coalesce(p.given_name,'')),
      p.full_name,
      ''
    ),
    p.phone,
    p.invite_code,
    p.invited_by_id,
    coalesce(
      trim(coalesce(inv.family_name,'') || ' ' || coalesce(inv.given_name,'')),
      inv.full_name,
      ''
    ),
    inv_u.email::text,
    p.verification_status,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profiles inv on inv.id = p.invited_by_id
  left join auth.users inv_u on inv_u.id = p.invited_by_id
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_get_invite_relations() to authenticated;
