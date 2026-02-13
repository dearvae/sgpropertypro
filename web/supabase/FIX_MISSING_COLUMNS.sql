-- 修复 "column p.bedrooms does not exist" 错误
-- 在 Supabase Dashboard → SQL Editor 中执行此文件

-- 1. 添加缺失的列（若不存在）
alter table public.properties add column if not exists bedrooms text;
alter table public.properties add column if not exists bathrooms text;
alter table public.properties add column if not exists image_urls jsonb default '[]';
