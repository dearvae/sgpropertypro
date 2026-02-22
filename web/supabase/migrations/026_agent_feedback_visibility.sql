-- 反馈可见性：all = 所有人可见，developer_only = 仅开发者可见
alter table public.agent_feedback add column if not exists visibility text not null default 'all'
  check (visibility in ('all', 'developer_only'));

-- profiles: 开发者标记，用于查看 developer_only 反馈（需在 SQL 中手动设置具体用户）
alter table public.profiles add column if not exists is_developer boolean not null default false;

-- 更新 RLS：仅当 visibility='all' 或（visibility='developer_only' 且当前用户为开发者）时可读
drop policy if exists "Authenticated can read feedback" on public.agent_feedback;
create policy "Authenticated can read feedback" on public.agent_feedback
  for select to authenticated using (
    visibility = 'all'
    or (visibility = 'developer_only' and exists (
      select 1 from public.profiles where id = auth.uid() and is_developer = true
    ))
  );
