-- 授予 lovevae7@gmail.com 超级管理员权限
-- 在 Supabase Dashboard → SQL Editor 中执行
-- 注意：该用户需已注册，否则无 profiles 记录

update public.profiles
set is_admin = true, is_super_admin = true, updated_at = now()
where id = (select id from auth.users where email = 'lovevae7@gmail.com' limit 1);

-- 验证（可选）：查看是否有更新
select p.id, u.email, p.is_admin, p.is_super_admin
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'lovevae7@gmail.com';
