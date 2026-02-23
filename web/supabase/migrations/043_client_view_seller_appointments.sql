-- 修复：出售/出租客户的 ClientView 能看到已预约
-- 根因：seller/landlord 的 appointment 的 customer_group_id 为 null（业务约束），
-- 原 get_client_view 只查 customer_group_id = v_group_id，导致 listing 客户看不到自己的看房预约。
-- 修复：当 token 对应 listing 类型 group 时，额外返回该房源下 party_role in ('seller','landlord') 的预约。

create or replace function public.get_client_view(p_share_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_group_name text;
  v_agent_id uuid;
  v_can_edit boolean;
  v_group_type text;
  v_property_id uuid;
  v_result json;
begin
  select id, name, agent_id,
    (share_token_edit = p_share_token or auth.uid() = agent_id),
    group_type, property_id
  into v_group_id, v_group_name, v_agent_id, v_can_edit, v_group_type, v_property_id
  from public.customer_groups
  where share_token = p_share_token or share_token_edit = p_share_token
  limit 1;

  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'pending_appointments', '[]'::json, 'properties', '[]'::json, 'can_edit', false);
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
          )
        ) order by a.start_time
      ), '[]'::json)
      from public.appointments a
      join public.properties p on p.id = a.property_id
      left join public.client_appointment_notes can on can.appointment_id = a.id
      where a.status != 'cancelled'
        and (
          a.customer_group_id = v_group_id
          or (
            v_group_type = 'listing'
            and v_property_id is not null
            and a.party_role in ('seller', 'landlord')
            and a.property_id = v_property_id
          )
        )
    ),
    'pending_appointments', (
      select coalesce(json_agg(
        json_build_object(
          'id', pa.id,
          'client_feedback', pa.client_feedback,
          'status', pa.status,
          'notes', coalesce(pa.notes, ''),
          'client_note', coalesce(cpn.content, ''),
          'property', json_build_object(
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
          )
        ) order by pa.created_at desc
      ), '[]'::json)
      from public.pending_appointments pa
      join public.properties p on p.id = pa.property_id
      left join public.client_pending_notes cpn on cpn.pending_appointment_id = pa.id
      where pa.customer_group_id = v_group_id
    ),
    'properties', '[]'::json,
    'can_edit', v_can_edit
  ) into v_result;

  return v_result;
end;
$$;

-- 修复 save_client_appointment_note：允许 listing 客户对 seller/landlord 预约保存备注
create or replace function public.save_client_appointment_note(
  p_share_token text,
  p_appointment_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid;
  v_can_edit boolean;
begin
  select g.agent_id,
    (g.share_token_edit = p_share_token or auth.uid() = g.agent_id)
  into v_agent_id, v_can_edit
  from public.customer_groups g
  where (g.share_token = p_share_token or g.share_token_edit = p_share_token)
    and exists (
      select 1 from public.appointments a
      where a.id = p_appointment_id
        and (
          a.customer_group_id = g.id
          or (
            g.group_type = 'listing' and g.property_id is not null
            and a.party_role in ('seller', 'landlord')
            and a.property_id = g.property_id
          )
        )
    )
  limit 1;

  if v_agent_id is null then
    raise exception 'invalid_token_or_appointment';
  end if;

  if not v_can_edit and auth.uid() is distinct from v_agent_id then
    raise exception 'permission_denied';
  end if;

  insert into public.client_appointment_notes (appointment_id, content, updated_at)
  values (p_appointment_id, coalesce(p_content, ''), now())
  on conflict (appointment_id) do update set content = excluded.content, updated_at = now();
end;
$$;
