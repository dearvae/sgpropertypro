-- 超级管理员：可管理其他管理员
-- 1. profiles 新增 is_super_admin
alter table public.profiles add column if not exists is_super_admin boolean not null default false;

comment on column public.profiles.is_super_admin is '是否超级管理员。超级管理员拥有 is_admin 权限，且未来可管理其他管理员。需在 SQL 中手动设置。';

-- 2. admin_get_invite_relations：允许 is_admin 或 is_super_admin 调用
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
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and (is_admin = true or is_super_admin = true)
  ) then
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
