-- 房源抓取字段：用于 Property Guru 链接抓取后的存储
-- source_url 用于去重，同一 agent 下相同链接只存一次

alter table public.properties add column if not exists source_url text;
alter table public.properties add column if not exists price text;
alter table public.properties add column if not exists size_sqft text;
alter table public.properties add column if not exists main_image_url text;
alter table public.properties add column if not exists floor_plan_url text;

create unique index if not exists idx_properties_agent_source_url
  on public.properties(agent_id, source_url)
  where source_url is not null;

-- 更新 get_client_view：在 property 中返回新字段
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
  select id, name into v_group_id, v_group_name
  from public.customer_groups
  where share_token = p_share_token
  limit 1;

  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'properties', '[]'::json);
  end if;

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
            'basic_info', p.basic_info,
            'price', p.price,
            'size_sqft', p.size_sqft,
            'main_image_url', p.main_image_url,
            'floor_plan_url', p.floor_plan_url
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
          p.price, p.size_sqft, p.main_image_url, p.floor_plan_url,
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
