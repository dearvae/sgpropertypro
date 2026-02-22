-- 重置客户分组 share_token 与 share_token_edit，仅分组所属中介可调用
create or replace function public.reset_customer_group_tokens(p_group_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid;
  v_new_share text;
  v_new_edit text;
begin
  select agent_id into v_agent_id from public.customer_groups where id = p_group_id;
  if v_agent_id is null or v_agent_id != auth.uid() then
    raise exception 'permission_denied';
  end if;
  v_new_share := encode(gen_random_bytes(16), 'hex');
  v_new_edit := encode(gen_random_bytes(16), 'hex');
  update public.customer_groups
  set share_token = v_new_share, share_token_edit = v_new_edit, updated_at = now()
  where id = p_group_id;
  return json_build_object('share_token', v_new_share, 'share_token_edit', v_new_edit);
end;
$$;

grant execute on function public.reset_customer_group_tokens(uuid) to authenticated;
