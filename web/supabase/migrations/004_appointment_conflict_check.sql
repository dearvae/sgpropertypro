-- 预约时间冲突检测
-- 同一 agent 下，新预约与已有预约时间段不得重叠（排除自身和已取消的）

create or replace function public.check_appointment_conflict()
returns trigger as $$
declare
  v_agent_id uuid;
  v_conflict_count int;
begin
  -- 取该房源所属 agent
  select agent_id into v_agent_id from public.properties where id = new.property_id;

  -- 查找同一 agent 下是否有重叠的预约（排除当前编辑的预约、已取消的）
  select count(*) into v_conflict_count
  from public.appointments a
  join public.properties p on p.id = a.property_id
  where p.agent_id = v_agent_id
    and a.id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and a.status != 'cancelled'
    and (a.start_time, a.end_time) overlaps (new.start_time, new.end_time);

  if v_conflict_count > 0 then
    raise exception 'APPOINTMENT_CONFLICT: 与已有预约时间冲突，请调整时段'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

create or replace trigger before_appointment_insert_update
  before insert or update on public.appointments
  for each row execute procedure public.check_appointment_conflict();
