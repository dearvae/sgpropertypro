-- 扩展 profiles 表：姓名、中介号、手机号
-- 在 Supabase Dashboard → SQL Editor 中执行

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists agent_number text;
alter table public.profiles add column if not exists phone text;

-- 更新 handle_new_user：从 raw_user_meta_data 读取注册时填写的姓名、中介号、手机号
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, agent_number, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'agent_number',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;
