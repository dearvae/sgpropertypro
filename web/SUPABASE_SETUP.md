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
5. `supabase/migrations/005_realtime.sql`
6. `supabase/migrations/006_customer_group_description.sql`
7. `supabase/migrations/007_property_scraping_fields.sql`（房源抓取字段）
8. `supabase/migrations/015_pending_appointments.sql`（待预约功能）
9. `supabase/migrations/016_allow_appointment_conflicts.sql`（**必做**：允许时间冲突的预约共存，否则无法保存冲突时段）
10. `supabase/migrations/020_customer_group_is_active.sql`（客户 inactive 打标，已成交客户可从筛选排除）

或使用 Supabase CLI 执行迁移：

```bash
cd web
# 方式一：链接后 push（需先 supabase login）
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# 方式二：直接用数据库连接（免登录）
# 在项目根 .env 中设置 SUPABASE_PROJECT_REF（项目 ID）、SUPABASE_DB_PASSWORD，或：
SUPABASE_PROJECT_REF=你的项目ID SUPABASE_DB_PASSWORD=你的数据库密码 ./run-migration.sh
# 项目 ID 在 Dashboard 的 URL 中可见；数据库密码在 Settings → Database
```

**若出现 "column p.bedrooms does not exist"**：在项目根 .env 中添加 `SUPABASE_DB_PASSWORD=你的密码`，然后执行：
```bash
cd web && python3 run-fix-columns.py
```

**若出现 "Could not find the 'customer_info' column"**：说明预约相关迁移（018、019）未执行。在 SQL Editor 中执行 `supabase/FIX_APPOINTMENT_COLUMNS.sql` 即可修复。

**若出现 "Could not find the table in the schema cache"**：说明数据库表尚未创建。

- **最快方式**：在 SQL Editor 中打开并执行 `supabase/BOOTSTRAP_ALL.sql`（一次性创建全部表）
- 或按顺序执行 001～006 的 migration 文件

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
