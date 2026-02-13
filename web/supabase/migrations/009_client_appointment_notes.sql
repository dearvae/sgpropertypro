-- 客户看房备注（客户自己在看房卡片上添加的备注）
create table if not exists public.client_appointment_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- 允许通过 share_token 验证后保存（security definer RPC）
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
  v_valid boolean;
begin
  select exists (
    select 1 from public.appointments a
    join public.customer_groups g on g.id = a.customer_group_id
    where a.id = p_appointment_id and g.share_token = p_share_token
  ) into v_valid;
  if not v_valid then
    raise exception 'invalid_token_or_appointment';
  end if;
  insert into public.client_appointment_notes (appointment_id, content, updated_at)
  values (p_appointment_id, coalesce(p_content, ''), now())
  on conflict (appointment_id) do update set content = excluded.content, updated_at = now();
end;
$$;
grant execute on function public.save_client_appointment_note(text, uuid, text) to anon;
grant execute on function public.save_client_appointment_note(text, uuid, text) to authenticated;

-- 更新 get_client_view：每个 appointment 包含 client_note
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
            'image_urls', (coalesce(p.image_urls::jsonb, '[]'::jsonb))::json,
            'floor_plan_url', p.floor_plan_url
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
