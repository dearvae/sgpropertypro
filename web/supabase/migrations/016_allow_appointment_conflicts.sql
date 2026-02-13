-- 允许预约时间冲突共存
-- 移除之前的冲突检测触发器，允许同一时段存在多个预约
-- 前端会展示红色「时间冲突」标签提示

drop trigger if exists before_appointment_insert_update on public.appointments;
