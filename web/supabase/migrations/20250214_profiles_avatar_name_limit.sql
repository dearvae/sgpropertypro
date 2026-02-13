-- profiles: 头像、姓名修改时间（每年限改一次）
-- 在 Supabase Dashboard → SQL Editor 中执行

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists name_changed_at timestamptz;
