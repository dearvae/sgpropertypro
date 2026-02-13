-- 客户分组：必选买房或租房
-- 房源：出售 vs 出租（爬虫识别并记录）

-- 1. customer_groups.intent: 'buy' | 'rent'，新建分组时必须选择
alter table public.customer_groups
  add column if not exists intent text check (intent in ('buy', 'rent'));

-- 对已有记录设置默认值，新记录将必填（通过应用层校验）
update public.customer_groups set intent = 'buy' where intent is null;

-- 2. properties.listing_type: 'sale' | 'rent'，爬虫根据 URL/页面识别
alter table public.properties
  add column if not exists listing_type text check (listing_type in ('sale', 'rent'));

-- 对已有房源保持 nullable，新爬取的会带值
create index if not exists idx_customer_groups_intent on public.customer_groups(intent);
create index if not exists idx_properties_listing_type on public.properties(listing_type);

-- 3. 更新 get_client_view：property 中返回 listing_type
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
            'listing_type', p.listing_type
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
