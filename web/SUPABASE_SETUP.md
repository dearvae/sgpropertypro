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
11. `supabase/migrations/024_property_last_scraped_at.sql`（房源抓取 1 小时冷却限流）
12. `supabase/migrations/025_reset_customer_group_tokens.sql`（客户分组链接重置 RPC）
13. `supabase/migrations/026_agent_feedback_visibility.sql`（反馈可见性：所有人 / 仅开发者可见）
14. `supabase/migrations/028_invite_system_verification.sql`（邀请码、验证状态、is_admin）
15. `supabase/migrations/029_is_super_admin.sql`（超级管理员 is_super_admin）
16. `supabase/migrations/036_agent_feedback_admin_visibility_delete.sql`（仅开发者可见→仅管理员可见，管理员可删除建议）
17. `supabase/migrations/037_agent_listings.sql`（**自售/出租房源**：group_type、property_id）
18. `supabase/migrations/032_property_top_year.sql`（房源 TOP 年份/入伙年份）
19. `supabase/migrations/033_client_view_top_year.sql`（get_client_view 返回 top_year）

**「仅开发者可见」反馈**：仅管理员和超级管理员可见，并可删除任意建议。授予管理员权限见下方。

**超级管理员权限**：授予某邮箱超级管理员权限（可访问 /admin，未来可管理其他管理员）：
```bash
# 在 SQL Editor 中执行 supabase/scripts/grant_super_admin.sql
# 或手动执行：update public.profiles set is_admin = true, is_super_admin = true where id = (select id from auth.users where email = '邮箱');
```

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

**若出现 "Could not find the 'is_active' column of 'customer_groups'"**：说明 020 迁移未执行。在 SQL Editor 中执行 `supabase/FIX_IS_ACTIVE_COLUMN.sql`，或运行 `cd propertyassistance/web && python3 run-migration-020.py` 即可修复。

**若出现 "Could not find the 'last_scraped_at' column of 'properties'"**：说明 024 迁移未执行。在 SQL Editor 中执行 `supabase/migrations/024_property_last_scraped_at.sql` 即可修复。

**若出现 "Could not find the 'price_description' column of 'properties'"**：说明 022 迁移未执行。在 SQL Editor 中执行 `supabase/migrations/022_price_value_description.sql` 即可修复。

**若出现 "Could not find the 'group_type' column of 'customer_groups'"**：说明 037 迁移未执行。在 SQL Editor 中执行 `supabase/migrations/037_agent_listings.sql`。该迁移添加自售/出租房源所需的 group_type、property_id 列。

**若出现 "Could not find the 'top_year' column of 'properties' in the schema cache"**：说明 032/033 迁移未执行，或 PostgREST schema cache 未刷新。运行 `cd propertyassistance/web && python3 run-migration-032-033.py`（需在 .env 中配置 SUPABASE_PROJECT_REF、SUPABASE_DB_PASSWORD）；或手动在 SQL Editor 依次执行 `032_property_top_year.sql`、`033_client_view_top_year.sql`，再执行 `NOTIFY pgrst, 'reload schema';` 刷新 schema 缓存。

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
