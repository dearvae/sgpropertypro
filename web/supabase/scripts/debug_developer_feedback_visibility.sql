-- 诊断「管理员看不到仅开发者可见评论」问题
-- 在 Supabase Dashboard → SQL Editor 中执行（需用 Service Role 或具有相应权限的账户）

-- 1. 查看当前 agent_feedback 的 RLS 策略定义（判断 036 迁移是否已生效）
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'agent_feedback' AND policyname = 'Authenticated can read feedback';

-- 2. 查看你的 profiles 中 is_admin、is_super_admin、is_developer 的值
-- 请将 '你的邮箱' 替换为你的实际邮箱
SELECT p.id, u.email, p.is_admin, p.is_super_admin, p.is_developer
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = '你的邮箱';

-- 3. 若 036 未生效（qual 里含 is_developer 而非 is_admin），执行下方修复脚本：
/*
-- 修复：应用 036 迁移（仅管理员/超级管理员可见 developer_only）
-- 复制下方内容到新查询窗口执行

DROP POLICY IF EXISTS "Authenticated can read feedback" ON public.agent_feedback;
CREATE POLICY "Authenticated can read feedback" ON public.agent_feedback
  FOR SELECT TO authenticated USING (
    visibility = 'all'
    OR (visibility = 'developer_only' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true)
    ))
  );

CREATE POLICY "Admin can delete feedback" ON public.agent_feedback
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR is_super_admin = true))
  );
*/
