-- 允许预约时间冲突共存（移除冲突检测触发器）
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- 或执行: psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -f RUN_016_MANUAL.sql

drop trigger if exists before_appointment_insert_update on public.appointments;
