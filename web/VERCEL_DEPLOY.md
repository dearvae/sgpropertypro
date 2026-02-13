# Vercel 部署指南

## 1. 连接 GitHub

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 "Add New Project"
3. 选择 `dearvae/sgpropertypro` 仓库（或你的仓库名）

## 2. 配置项目

在 "Configure Project" 步骤：

- **Root Directory**：点击 "Edit"，设置为 `web/frontend`
- **Framework Preset**：Vite（通常可自动识别）
- **Build Command**：`npm run build`（默认）
- **Output Directory**：`dist`（默认）

## 3. 环境变量

在 "Environment Variables" 中添加：

| 名称 | 值 |
| --- | --- |
| `VITE_SUPABASE_URL` | 你的 Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | 你的 Supabase anon public key |

两个环境都勾选（Production、Preview、Development）。

## 4. 部署

点击 "Deploy"。完成后会得到 `xxx.vercel.app` 的访问地址。

## 5. 自定义域名（可选）

在 Vercel 项目 Settings → Domains 中添加你的域名，按提示配置 DNS。
