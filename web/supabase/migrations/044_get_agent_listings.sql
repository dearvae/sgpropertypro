-- 中介公开房源主页：通过 invite_code 匿名获取中介公开信息及出售/出租房源
-- 供 /agent/:inviteCode 页面使用，anon 可调用

create or replace function public.get_agent_listings(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid;
  v_agent json;
  v_properties json;
begin
  -- 通过 invite_code 找到中介（统一大写匹配）
  select id into v_agent_id
  from public.profiles
  where upper(trim(coalesce(p_invite_code, ''))) = upper(trim(coalesce(invite_code, '')))
    and role = 'agent'
  limit 1;

  if v_agent_id is null then
    return json_build_object('error', 'not_found', 'agent', null, 'properties', '[]'::json);
  end if;

  -- 中介公开信息
  select json_build_object(
    'id', id,
    'family_name', family_name,
    'given_name', given_name,
    'company', company,
    'avatar_url', avatar_url,
    'phone', phone
  ) into v_agent
  from public.profiles
  where id = v_agent_id;

  -- 仅展示「我的客户」中 listing 型分组关联的房源（中介自售/自租），不含帮客户预约的其他房源
  select coalesce(json_agg(
    json_build_object(
      'id', p.id,
      'title', p.title,
      'link', p.link,
      'basic_info', p.basic_info,
      'price', p.price,
      'price_value', p.price_value,
      'price_description', p.price_description,
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
      'lease_tenure', p.lease_tenure,
      'top_year', p.top_year
    ) order by p.created_at desc
  ), '[]'::json) into v_properties
  from public.properties p
  where p.id in (
    select g.property_id from public.customer_groups g
    where g.agent_id = v_agent_id
      and g.group_type = 'listing'
      and coalesce(g.is_active, true) = true
      and g.property_id is not null
  )
  and p.listing_type in ('sale', 'rent');

  return json_build_object('agent', v_agent, 'properties', v_properties);
end;
$$;

comment on function public.get_agent_listings(text) is '匿名获取中介公开主页：通过 invite_code 返回中介信息及出售/出租房源';

grant execute on function public.get_agent_listings(text) to anon;
grant execute on function public.get_agent_listings(text) to authenticated;
