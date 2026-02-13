-- 允许用户插入自己的 profile（当 trigger 未创建时的补救）
-- 解决 PGRST116: "Cannot coerce the result to a single JSON object"（0 rows）
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
