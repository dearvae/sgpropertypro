-- 确保 invite_code 始终存在：任何 INSERT/UPDATE 时若为空则自动生成
-- 解决：useProfile 回退插入、迁移前老用户、或其它未设置 invite_code 的情况

create or replace function public.ensure_invite_code()
returns trigger as $$
begin
  if NEW.invite_code is null or NEW.invite_code = '' then
    NEW.invite_code := public.gen_invite_code();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists ensure_invite_code_trigger on public.profiles;
create trigger ensure_invite_code_trigger
  before insert or update on public.profiles
  for each row
  when (NEW.invite_code is null or NEW.invite_code = '')
  execute function public.ensure_invite_code();

-- 再次回填：为所有 invite_code 为空的 profile 生成（触发器会在 update 时自动填充）
update public.profiles
set updated_at = now()
where invite_code is null or invite_code = '';

-- RPC：前端可调用，确保当前用户的 invite_code 存在（邀请页加载时兜底，会触发上述触发器）
create or replace function public.ensure_my_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  update public.profiles set updated_at = now() where id = auth.uid();
  select invite_code into v_code from public.profiles where id = auth.uid();
  return coalesce(v_code, '');
end;
$$;
grant execute on function public.ensure_my_invite_code() to authenticated;
