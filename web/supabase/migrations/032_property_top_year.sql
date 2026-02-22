-- 房源 TOP 年份（入伙年份）：Temporary Occupation Permit
-- 如：2020、2021

alter table public.properties add column if not exists top_year text;
