-- 待预约：新增客户反馈字段（感兴趣/一般/不感兴趣）
alter table public.pending_appointments
  add column if not exists client_feedback text
  check (client_feedback is null or client_feedback in ('interested', 'neutral', 'not_interested'));

create index if not exists idx_pending_appointments_client_feedback
  on public.pending_appointments(client_feedback);
