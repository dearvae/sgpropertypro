# 看房预约管理 Web 应用

## 前置要求

- Node.js 18+
- npm 或 pnpm

## 快速开始

### 1. 配置 Supabase

参考 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 创建项目并执行迁移。

### 2. 安装依赖并启动

```bash
cd web/frontend
cp .env.example .env.local
# 编辑 .env.local 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

访问 http://localhost:5173

### 3. 构建

```bash
npm run build
```

### 4. 部署到 Vercel

参考 [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

## 目录结构

- `frontend/` - React + Vite 前端
- `supabase/migrations/` - 数据库迁移 SQL

## UI 主题

Zen Muji 日式简约：留白、浅灰、细边框、小圆角。
