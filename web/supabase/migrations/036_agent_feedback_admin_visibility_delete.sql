-- 反馈可见性：developer_only 仅管理员和超级管理员可见（原 is_developer 改为 is_admin or is_super_admin）
-- 管理员和超级管理员可删除任意建议

-- 更新 RLS：仅当 visibility='all' 或（visibility='developer_only' 且当前用户为管理员/超级管理员）时可读
drop policy if exists "Authenticated can read feedback" on public.agent_feedback;
create policy "Authenticated can read feedback" on public.agent_feedback
  for select to authenticated using (
    visibility = 'all'
    or (visibility = 'developer_only' and exists (
      select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_super_admin = true)
    ))
  );

-- 管理员和超级管理员可删除任意反馈
create policy "Admin can delete feedback" on public.agent_feedback
  for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_super_admin = true))
  );
