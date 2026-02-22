-- 将 pending_appointments 加入 Realtime，使 ClientView 在中介添加/删除待预约时自动刷新
-- 若 supabase_realtime 不存在或表已在 publication 中，可忽略错误，或在 Dashboard > Database > Replication 中手动添加
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pending_appointments') then
    execute 'alter publication supabase_realtime add table public.pending_appointments';
  end if;
exception when others then
  raise notice 'Realtime for pending_appointments: %', sqlerrm;
end $$;
