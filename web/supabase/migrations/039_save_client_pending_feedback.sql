-- 客户提交待预约反馈：感兴趣 / 一般 / 不感兴趣
-- 通过 share_token 或 share_token_edit 验证权限，客户可随时修改
create or replace function public.save_client_pending_feedback(
  p_share_token text,
  p_pending_appointment_id uuid,
  p_feedback text  -- 'interested' | 'neutral' | 'not_interested'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select g.id into v_group_id
  from public.pending_appointments pa
  join public.customer_groups g on g.id = pa.customer_group_id
  where pa.id = p_pending_appointment_id
    and (g.share_token = p_share_token or g.share_token_edit = p_share_token)
  limit 1;

  if v_group_id is null then
    raise exception 'invalid_token_or_pending_appointment';
  end if;

  if p_feedback not in ('interested', 'neutral', 'not_interested') then
    raise exception 'invalid_feedback_value';
  end if;

  update public.pending_appointments
  set client_feedback = p_feedback, updated_at = now()
  where id = p_pending_appointment_id;
end;
$$;
grant execute on function public.save_client_pending_feedback(text, uuid, text) to anon;
grant execute on function public.save_client_pending_feedback(text, uuid, text) to authenticated;
