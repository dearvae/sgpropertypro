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
| `VITE_SCRAPE_API_URL` | 抓取 API 地址（若后端已部署到 Render，填写 `https://xxx.onrender.com`） |

两个环境都勾选（Production、Preview、Development）。

> **注意**：若你使用「添加自售/出租房源」「批量添加」等功能，会调用抓取 API。该 API 部署在 Render 时，需在 **Render** 的环境变量中配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`（见 `RENDER_DEPLOY.md`），与 Vercel 的前端变量是分开的。

## 4. 部署前本地检查（可选）

发布前在 `web/frontend` 目录执行：

```bash
npm run check:routes
```

会自动 build 并访问每个页面路径，检查是否有控制台错误或白屏。若失败会阻止继续。也可集成到 CI（如 GitHub Actions）。

## 5. 部署

点击 "Deploy"。完成后会得到 `xxx.vercel.app` 的访问地址。

## 6. 自定义域名（可选）

在 Vercel 项目 Settings → Domains 中添加你的域名，按提示配置 DNS。
