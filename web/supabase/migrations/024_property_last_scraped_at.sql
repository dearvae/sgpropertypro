-- 房源最后抓取时间：用于 1 小时冷却限流
alter table public.properties add column if not exists last_scraped_at timestamptz;
