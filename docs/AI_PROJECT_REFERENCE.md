# PropertyAssistance 项目 - AI 可读功能参考文档

> 本文档面向 AI 助手，用于快速理解项目功能、数据模型与实现细节。格式为结构化 Markdown，便于解析。

---

## 1. 项目概述

**项目名称**: PropertyAssistance（房产看房预约管理系统）

**核心业务**: 房产中介的看房预约管理平台，支持：
- 中介管理客户分组、房源、预约日程
- 客户通过分享链接匿名查看自己的看房日程与房源详情
- 买房/租房、出售/出租双维度业务
- 房源信息从 Property Guru / Property Group / 99.co 自动抓取

**技术栈**:
- 前端: React + TypeScript + Ant Design + TanStack Query + react-i18next
- 后端: Supabase (Auth, PostgreSQL, RLS, Realtime)
- 抓取服务: FastAPI + Playwright
- 国际化: en.json, zh.json

---

## 2. 角色与权限

### 2.1 用户角色 (profiles.role)

| role 值 | 中文 | 说明 | 默认路由 |
|---------|------|------|----------|
| agent | 中介 | 房产经纪人 | /home/agent |
| client | 客户 | 购房/租房客户 | /home/user |

### 2.2 管理员标志 (profiles 表)

| 字段 | 说明 |
|------|------|
| is_admin | 可访问 /admin，查看邀请关系、抓取失败 |
| is_super_admin | 超级管理员，更高权限 |

### 2.3 客户分组类型 (customer_groups.group_type)

| group_type | intent 取值 | 说明 |
|------------|-------------|------|
| client | buy, rent | 买家/租客分组，关联多个待看房源 |
| listing | sale, rent | 中介自售/出租房源，一组对应一套房 |

### 2.4 预约角色 (appointments.party_role)

| party_role | 说明 | customer_group_id |
|------------|------|-------------------|
| buyer | 买房客户 | 必填 |
| tenant | 租房客户 | 必填 |
| seller | 卖方 | 可选 |
| landlord | 出租方 | 可选 |

---

## 3. 路由一览

| 路径 | 组件 | 权限要求 |
|------|------|----------|
| / | HomePage | 公开 |
| /login | Login | 公开 |
| /register | Register | 公开 |
| /invite | InvitePage | 需登录 |
| /admin | AdminPage | 需登录 + is_admin |
| /home/agent | AgentDashboard | 需登录 + role=agent |
| /home/user | ClientDashboard | 需登录 + role=client |
| /view/:token | ClientView | 公开（token 校验） |
| /agent/:inviteCode | AgentPublicPage | 公开 |
| /playground | Playground | 公开 |

---

## 4. API 接口

### 4.1 FastAPI 抓取服务 (web/backend/main.py)

**基础 URL**: 默认 http://localhost:8000（由 VITE_SCRAPE_API_URL 配置）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/scrape-property | 同步抓取单个 URL，返回房源信息（用于刷新按钮） |
| POST | /api/trigger-scrape | 异步抓取，传入 property_id + url，立即返回 202 |
| POST | /api/batch-scrape-properties | 批量添加待预约，传入 urls, agent_id, customer_group_id |
| POST | /api/add-agent-listing | 添加中介自售/出租房源，创建 property + customer_group (listing) |
| POST | /api/scrape-site-plan | 从 99.co 抓取公寓 site plan，传入 apartment_name |

**限流**:
- 同步抓取: 15 req/min per IP
- 异步触发: 30 req/min per IP
- 批量/添加房源: 3 req/min
- 同一 property 1 小时内已抓取过则静默跳过

**支持域名**: propertyguru.com, propertyguru.com.sg, propertygroup.com, propertygroup.com.sg, 99.co

### 4.2 Supabase RPC

| RPC 名称 | 参数 | 说明 |
|----------|------|------|
| get_client_view | p_share_token | 客户视图数据（group, appointments, pending, can_edit） |
| save_client_appointment_note | p_share_token, p_appointment_id, p_content | 保存客户预约备注 |
| save_client_pending_note | p_share_token, p_pending_id, p_content | 保存客户待预约备注 |
| save_client_pending_feedback | p_share_token, p_pending_id, p_feedback | 保存客户反馈 (interested/neutral/not_interested) |
| get_agent_listings | p_invite_code | 公开中介页数据（房源列表、中介信息） |
| reset_customer_group_tokens | p_group_id | 重新生成 share_token |
| insert_agent_feedback | ... | 创建产品反馈 |
| check_phone_available | p_phone | 注册时检查手机号唯一 |
| check_phone_available_for_update | p_phone, p_exclude_id | 更新资料时检查手机号 |
| admin_get_invite_relations | 无 | 管理员查看邀请关系图 |
| admin_get_scrape_failures | 无 | 管理员查看抓取失败记录 |
| ensure_my_invite_code | 无 | 确保当前用户有 invite_code |

---

## 5. 数据模型

### 5.1 profiles
- id (uuid, = auth.users.id)
- role: agent | client
- family_name, given_name, full_name
- phone (唯一), company, avatar_url, agent_number
- invite_code (6 位), invited_by_id
- is_admin, is_super_admin
- whatsapp_template_agent_sale, whatsapp_template_agent_rent, whatsapp_template_client_sale, whatsapp_template_client_rent
- verification_status, name_changed_at, created_at, updated_at

### 5.2 customer_groups
- id, agent_id, name, description
- group_type: client | listing
- intent: buy | rent | sale
- property_id (listing 时指向房源)
- share_token, share_token_edit
- is_active, created_at, updated_at

### 5.3 properties
- id, agent_id, title, link, source_url
- price, price_value, price_description
- size_sqft, bedrooms, bathrooms
- main_image_url, image_urls (jsonb), floor_plan_url, site_plan_url
- basic_info, listing_type (sale|rent)
- listing_agent_name, listing_agent_phone
- lease_tenure, top_year
- last_scraped_at, created_at, updated_at

### 5.4 appointments
- id, property_id, customer_group_id (buyer/tenant 必填)
- start_time, end_time
- status: scheduled | completed | cancelled
- party_role: buyer | seller | tenant | landlord
- customer_info, customer_phone, notes

### 5.5 pending_appointments
- id, property_id, customer_group_id
- status: not_scheduled | consulted | to_consult | awaiting_agent_reply
- client_feedback: interested | neutral | not_interested
- notes

### 5.6 notes (按房源)
- id, property_id, content
- visibility: client_visible | internal

### 5.7 client_appointment_notes
- appointment_id (PK), content, updated_at

### 5.8 client_pending_notes
- pending_appointment_id (PK), content, updated_at

### 5.9 agent_feedback / agent_feedback_votes
- 产品反馈与投票

### 5.10 scrape_failures
- id, property_id, source_url, error_message, error_type, created_at

---

## 6. 前端组件与 Hooks

### 6.1 页面组件 (src/pages/)
- AgentDashboard: 中介工作台
- ClientDashboard: 客户个人中心
- ClientView: 客户分享视图 (/view/:token)
- AgentPublicPage: 中介公开页 (/agent/:inviteCode)
- AdminPage: 管理后台
- InvitePage: 邀请页
- Login, Register, HomePage, Playground

### 6.2 可复用组件 (src/components/)
- UserMenu, CreateClientModal, AddListingModal, ProfileEditModal
- CompanySelect, MapViewModal, LanguageSwitcher, ErrorBoundary

### 6.3 Hooks (src/hooks/)
- useAuth: 认证
- useProfile: 资料
- useCustomerGroups, useProperties, useAppointments, usePendingAppointments
- useRealtimeAppointments, useClientSelfGroup
- useAgentFeedback

---

## 7. 第三方集成

### 7.1 WhatsApp
- lib/whatsapp.ts: normalizePhoneForWhatsApp, getWhatsAppChatUrl, getTelUrl
- lib/whatsappTemplate.ts: 按 agent/client × sale/rent 的模板
- profiles 表存储每用户自定义模板

### 7.2 地图
- lib/mapUtils.ts: getGoogleMapsSearchUrl, getGoogleMapsDirectionsUrl
- MapViewModal: Leaflet + Google Maps 链接

### 7.3 Supabase Realtime
- 订阅表: appointments, notes, properties, pending_appointments

---

## 8. 关键业务流程

### 8.1 客户视图 (/view/:token)
1. 前端调用 get_client_view(p_share_token)
2. RPC 校验 token，返回 group、appointments、pending_appointments、can_edit
3. share_token 只读；share_token_edit 可编辑客户备注
4. 编辑时调用 save_client_appointment_note / save_client_pending_note / save_client_pending_feedback

### 8.2 房源抓取
1. 中介添加 URL 或批量添加
2. 后端创建/复用 property，可选创建 pending_appointment
3. Playwright 抓取 Property Guru / Property Group / 99.co
4. 成功更新 properties；失败写入 scrape_failures

### 8.3 注册与邀请
1. 注册选择 role，填姓名、手机
2. 可选填邀请码关联 invited_by_id
3. 自动生成 invite_code，手机号唯一

---

## 9. 环境变量

### 9.1 项目根 .env
- SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY (可选)

### 9.2 前端 .env.local
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- VITE_SCRAPE_API_URL (默认 http://localhost:8000)

---

## 10. 关键文件路径

| 用途 | 路径 |
|------|------|
| 前端入口 | web/frontend/src/main.tsx |
| 路由 | web/frontend/src/App.tsx |
| 中介工作台 | web/frontend/src/pages/AgentDashboard.tsx |
| 客户视图 | web/frontend/src/pages/ClientView.tsx |
| 抓取 API | web/backend/main.py |
| Supabase 迁移 | web/supabase/migrations/ |
| 类型定义 | web/frontend/src/types/index.ts |
| 国际化 | web/frontend/src/locales/zh.json, en.json |

---

## 11. RLS 策略摘要

- profiles: 用户仅读写自己
- customer_groups, properties: 中介仅操作自己的
- appointments, notes, pending_appointments: 通过 property → agent_id 校验
- agent_feedback: 已登录可读可插；投票仅操作自己
- scrape_failures: 无 permissive 策略，仅 admin RPC 或 service role

---

*文档为 AI 参考用途，基于 2025 年 2 月代码库整理。*
