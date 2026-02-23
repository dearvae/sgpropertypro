-- 客户收藏：客户可将待预约/已预约房源打标为收藏
create table if not exists public.client_favorites (
  customer_group_id uuid not null references public.customer_groups(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_group_id, property_id)
);

create index if not exists idx_client_favorites_customer_group on public.client_favorites(customer_group_id);
create index if not exists idx_client_favorites_property on public.client_favorites(property_id);

alter table public.client_favorites enable row level security;

-- 通过 RPC 访问，禁止直接表操作
create policy "No direct access" on public.client_favorites
  for all using (false);

-- 切换收藏状态（需 share_token 校验）
create or replace function public.save_client_favorite(
  p_share_token text,
  p_property_id uuid,
  p_favorited boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id
  from public.customer_groups
  where share_token = p_share_token or share_token_edit = p_share_token
  limit 1;

  if v_group_id is null then
    raise exception 'invalid_token';
  end if;

  if p_favorited then
    insert into public.client_favorites (customer_group_id, property_id)
    values (v_group_id, p_property_id)
    on conflict (customer_group_id, property_id) do nothing;
  else
    delete from public.client_favorites
    where customer_group_id = v_group_id and property_id = p_property_id;
  end if;
end;
$$;

grant execute on function public.save_client_favorite(text, uuid, boolean) to anon;
grant execute on function public.save_client_favorite(text, uuid, boolean) to authenticated;

-- 更新 get_client_view：返回 favorited_property_ids
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
  v_favorited_ids json;
begin
  select id, name, agent_id,
    (share_token_edit = p_share_token or auth.uid() = agent_id),
    group_type, property_id
  into v_group_id, v_group_name, v_agent_id, v_can_edit, v_group_type, v_property_id
  from public.customer_groups
  where share_token = p_share_token or share_token_edit = p_share_token
  limit 1;

  if v_group_id is null then
    return json_build_object('error', 'invalid_token', 'group', null, 'appointments', '[]'::json, 'pending_appointments', '[]'::json, 'properties', '[]'::json, 'can_edit', false, 'favorited_property_ids', '[]'::json);
  end if;

  select coalesce(json_agg(cf.property_id::text), '[]'::json)
  into v_favorited_ids
  from public.client_favorites cf
  where cf.customer_group_id = v_group_id;

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
    'can_edit', v_can_edit,
    'favorited_property_ids', coalesce(v_favorited_ids, '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;
