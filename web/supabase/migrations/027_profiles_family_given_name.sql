-- profiles: 姓（family_name）和名（given_name）分开存储
-- 右上角展示：family_name + given_name
-- 模板 my_name：仅 given_name
alter table public.profiles add column if not exists family_name text;
alter table public.profiles add column if not exists given_name text;

comment on column public.profiles.family_name is '姓，用于与 given_name 合并在右上角等处展示';
comment on column public.profiles.given_name is '名，模板 my_name 仅使用 given_name';

-- 更新 handle_new_user：从 raw_user_meta_data 读取 family_name, given_name
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, family_name, given_name, full_name, agent_number, phone, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'agent_number',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company'
  );
  return new;
end;
$$ language plpgsql security definer;
