-- 恢复 get_client_view 完整功能：021 的双 Token + can_edit 被 022 覆盖导致备注不可见、编辑链接失效
-- 合并 021（双 token、can_edit、site_plan_url、lease_tenure）+ 022（price_value、price_description）
-- 确保：中介备注(notes)、客户备注(client_note) 均正确返回；编辑链接可访问；只读链接可查看但不可改

-- 1. 若 021 未执行过，确保 share_token_edit 列存在
alter table public.customer_groups
  add column if not exists share_token_edit text unique
  default encode(gen_random_bytes(16), 'hex');

update public.customer_groups
set share_token_edit = encode(gen_random_bytes(16), 'hex')
where share_token_edit is null;

create unique index if not exists idx_customer_groups_share_token_edit
  on public.customer_groups(share_token_edit)
  where share_token_edit is not null;

-- 2. 恢复 get_client_view
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
  v_result json;
begin
  select id, name, agent_id,
    (share_token_edit = p_share_token or auth.uid() = agent_id)
  into v_group_id, v_group_name, v_agent_id, v_can_edit
  from public.customer_groups
  where share_token = p_share_token or share_token_edit = p_share_token
  limit 1;

  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'properties', '[]'::json, 'can_edit', false);
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
            'lease_tenure', p.lease_tenure
          )
        ) order by a.start_time
      ), '[]'::json)
      from public.appointments a
      join public.properties p on p.id = a.property_id
      left join public.client_appointment_notes can on can.appointment_id = a.id
      where a.customer_group_id = v_group_id and a.status != 'cancelled'
    ),
    'properties', '[]'::json,
    'can_edit', v_can_edit
  ) into v_result;

  return v_result;
end;
$$;
