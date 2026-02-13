-- 公寓 site plan 图片（从 99.co 抓取，添加/刷新房源时获取）
alter table public.properties add column if not exists site_plan_url text;

comment on column public.properties.site_plan_url is '公寓小区平面图 URL，来自 99.co，添加或刷新房源时抓取';

-- 更新 get_client_view：property 中返回 site_plan_url（在 20250214_appointment_notes 基础上添加）
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
          'notes', coalesce(a.notes, ''),
          'client_note', coalesce(can.content, ''),
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
            'image_urls', (
              select coalesce(json_agg(elem order by ord), '[]'::json)
              from (
                select elem, ord
                from jsonb_array_elements_text(coalesce(p.image_urls, '[]'::jsonb))
                with ordinality as t(elem, ord)
                limit 8
              ) sub
            ),
            'floor_plan_url', p.floor_plan_url,
            'site_plan_url', p.site_plan_url,
            'listing_type', p.listing_type,
            'listing_agent_name', p.listing_agent_name,
            'listing_agent_phone', p.listing_agent_phone,
            'lease_tenure', p.lease_tenure
          )
        ) order by a.start_time
      ), '[]'::json)
      from public.appointments a
      join public.properties p on p.id = a.property_id
      left join public.client_appointment_notes can on can.appointment_id = a.id
      where a.customer_group_id = v_group_id and a.status != 'cancelled'
    ),
    'properties', '[]'::json
  ) into v_result;

  return v_result;
end;
$$;
