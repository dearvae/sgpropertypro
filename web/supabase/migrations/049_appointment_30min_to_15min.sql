-- 将时长 exactly 30 分钟的预约改为 15 分钟（与待确认转正式的新逻辑一致）
UPDATE public.appointments
SET end_time = start_time + interval '15 minutes'
WHERE end_time - start_time = interval '30 minutes'
  AND status != 'cancelled';
