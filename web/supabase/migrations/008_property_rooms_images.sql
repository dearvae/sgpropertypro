-- 房源房间数、卫生间数、多图
alter table public.properties add column if not exists bedrooms text;
alter table public.properties add column if not exists bathrooms text;
alter table public.properties add column if not exists image_urls jsonb default '[]';

-- 更新 get_client_view：返回 bedrooms, bathrooms, image_urls
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
            'bedrooms', p.bedrooms,
            'bathrooms', p.bathrooms,
            'main_image_url', p.main_image_url,
            'image_urls', (coalesce(p.image_urls::jsonb, '[]'::jsonb))::json,
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
          p.price, p.size_sqft, p.bedrooms, p.bathrooms,
          p.main_image_url, (coalesce(p.image_urls::jsonb, '[]'::jsonb))::json as image_urls, p.floor_plan_url,
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
