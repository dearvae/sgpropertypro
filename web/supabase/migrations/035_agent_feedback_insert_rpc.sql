-- 通过 RPC 插入 agent_feedback，绕过 RLS（适用于 JWT 角色边缘情况）
-- 仅允许已认证用户插入，在函数内校验 auth.uid()

create or replace function public.insert_agent_feedback(
  p_content text,
  p_is_anonymous boolean default false,
  p_visibility text default 'all'
)
returns public.agent_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_author_display text;
  v_row public.agent_feedback;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'must be logged in to submit feedback' using errcode = 'P0001';
  end if;

  if p_content is null or trim(p_content) = '' then
    raise exception 'content is required' using errcode = 'P0001';
  end if;

  if p_visibility not in ('all', 'developer_only') then
    p_visibility := 'all';
  end if;

  if not p_is_anonymous then
    select coalesce(
      nullif(trim(trim(coalesce(family_name,'')) || ' ' || trim(coalesce(given_name,''))), ''),
      full_name
    ) into v_author_display
    from public.profiles where id = v_uid limit 1;
    if v_author_display is null or v_author_display = '' then
      select email into v_author_display from auth.users where id = v_uid limit 1;
    end if;
  else
    v_author_display := null;
  end if;

  insert into public.agent_feedback (author_id, author_display, content, visibility)
  values (
    case when p_is_anonymous then null else v_uid end,
    v_author_display,
    trim(p_content),
    p_visibility
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- 允许 authenticated 和 anon 调用（函数内会校验 auth.uid()）
grant execute on function public.insert_agent_feedback(text, boolean, text) to authenticated;
grant execute on function public.insert_agent_feedback(text, boolean, text) to anon;
