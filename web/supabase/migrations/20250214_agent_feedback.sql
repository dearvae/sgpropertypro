-- 中介建议/反馈功能
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ========== 1. 表结构 ==========
create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_display text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_feedback_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.agent_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(feedback_id, user_id)
);

create index if not exists idx_agent_feedback_created_at on public.agent_feedback(created_at desc);
create index if not exists idx_agent_feedback_votes_feedback on public.agent_feedback_votes(feedback_id);

-- ========== 2. RLS ==========
alter table public.agent_feedback enable row level security;
alter table public.agent_feedback_votes enable row level security;

-- 已登录用户可插入反馈（支持匿名，author_id 可为 null）
drop policy if exists "Authenticated can insert feedback" on public.agent_feedback;
create policy "Authenticated can insert feedback" on public.agent_feedback
  for insert to authenticated with check (true);

-- 已登录用户可查看所有反馈
drop policy if exists "Authenticated can read feedback" on public.agent_feedback;
create policy "Authenticated can read feedback" on public.agent_feedback
  for select to authenticated using (true);

-- 投票：已登录可插入/删除自己的投票
drop policy if exists "Authenticated can insert vote" on public.agent_feedback_votes;
create policy "Authenticated can insert vote" on public.agent_feedback_votes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Authenticated can delete own vote" on public.agent_feedback_votes;
create policy "Authenticated can delete own vote" on public.agent_feedback_votes
  for delete to authenticated using (auth.uid() = user_id);

-- 已登录可查看所有投票
drop policy if exists "Authenticated can read votes" on public.agent_feedback_votes;
create policy "Authenticated can read votes" on public.agent_feedback_votes
  for select to authenticated using (true);
