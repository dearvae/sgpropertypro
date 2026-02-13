# Supabase 配置指南

## 1. 创建项目

1. 打开 [supabase.com](https://supabase.com) 并登录
2. 点击 "New Project"
3. 填写项目名称、数据库密码、区域
4. 创建完成后，进入 **Settings → API** 获取：
   - `Project URL`
   - `anon` `public` key

## 2. 执行迁移

在 Supabase Dashboard → **SQL Editor** 中，按顺序执行以下文件内容：

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_client_view_rpc.sql`
4. `supabase/migrations/004_appointment_conflict_check.sql`

或使用 Supabase CLI（若已安装）：

```bash
cd web
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 3. 启用 Realtime

在 Dashboard → **Database → Replication** 中，确认 `appointments` 表已加入 Realtime 的 publication。新项目通常所有表默认开启。

## 4. 前端环境变量

在 `web/frontend/.env.local` 中配置：

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 5. 测试 RPC

在 SQL Editor 中可测试客户视图：

```sql
-- 先创建测试数据（需先有 agent 用户），再：
select public.get_client_view('你的share_token');
```
