-- 客户视图 RPC：通过 share_token 匿名获取日程与房源（仅返回该分组数据）
-- 使用 security definer 绕过 RLS，仅当 token 有效时返回数据

create or replace function public.get_client_view(p_share_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_group_name text;
  v_result json;
begin
  -- 校验 token 并取分组
  select id, name into v_group_id, v_group_name
  from public.customer_groups
  where share_token = p_share_token
  limit 1;

  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'properties', '[]'::json);
  end if;

  -- 返回：分组信息 + 预约（含房源）+ 房源列表 + 客户可见备注
  select json_build_object(
    'group', json_build_object('id', v_group_id, 'name', v_group_name),
    'appointments', (
      select coalesce(json_agg(
        json_build_object(
          'id', a.id,
          'start_time', a.start_time,
          'end_time', a.end_time,
          'status', a.status,
          'property', json_build_object(
            'id', p.id,
            'title', p.title,
            'link', p.link,
            'basic_info', p.basic_info
          )
        ) order by a.start_time
      ), '[]'::json)
      from public.appointments a
      join public.properties p on p.id = a.property_id
      where a.customer_group_id = v_group_id and a.status != 'cancelled'
    ),
    'properties', (
      select coalesce(json_agg(row_to_json(pr)), '[]'::json)
      from (
        select distinct on (p.id) p.id, p.title, p.link, p.basic_info,
          (select coalesce(json_agg(n.content), '[]'::json) from public.notes n where n.property_id = p.id and n.visibility = 'client_visible') as notes
        from public.appointments a
        join public.properties p on p.id = a.property_id
        where a.customer_group_id = v_group_id and a.status != 'cancelled'
        order by p.id
      ) pr
    )
  ) into v_result;

  return v_result;
end;
$$;

-- 允许 anon 调用（客户链接无需登录）
grant execute on function public.get_client_view(text) to anon;
grant execute on function public.get_client_view(text) to authenticated;
