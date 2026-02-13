-- 启用 Realtime 用于 appointments 表
-- Supabase 默认对 public 表启用 realtime，需在 Dashboard 中确认
-- 如需仅对 appointments 启用，可在 Dashboard > Database > Replication 中配置

-- 若无 supabase_realtime 的 publication，可创建：
--（Supabase 云项目通常已预配置，本地开发可忽略）
-- alter publication supabase_realtime add table public.appointments;

-- 表已存在，Realtime 在 Supabase 项目中默认通过 Dashboard 启用
