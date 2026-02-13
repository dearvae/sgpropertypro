# Render 后端部署指南

本指南详细说明如何将 Property Guru 房源抓取 API（FastAPI + Playwright）部署到 Render。

## 重要说明：为何必须使用 Docker

你的后端使用 **Playwright** 进行网页抓取，需要安装 Chromium 浏览器及系统依赖。Render 的原生 Python 环境**不包含**这些，直接 `pip install playwright && playwright install chromium` 通常会失败。

**推荐方案**：使用 Docker 容器部署，在镜像中预装 Playwright 和 Chromium。

---

## 一、部署前准备

项目中已包含以下文件（可直接使用）：

- `web/backend/Dockerfile`：基于官方 Playwright Python 镜像，已包含 Chromium
- `web/backend/requirements.txt`：后端专用精简依赖

> 说明：Dockerfile 中的 `COPY` 路径（`web/backend/...`）是相对于**仓库根目录**的，因为 Render 的 Docker 构建上下文为仓库根。若构建报错找不到文件，请在 Render 中检查 Root Directory 是否为仓库根。

### 3. 创建 .dockerignore（可选，减小构建上下文）

在 `web/backend/` 下创建 `.dockerignore`：

```
__pycache__
*.pyc
.git
.env
*.md
```

---

## 二、在 Render 控制台创建 Web Service

### 步骤 1：连接代码仓库

1. 登录 [render.com](https://render.com)
2. 点击 **New** → **Web Service**
3. 连接 GitHub/GitLab/Bitbucket，选择 `propertyassistance` 仓库

### 步骤 2：基础配置

| 配置项 | 值 |
|--------|-----|
| **Name** | `property-scrape-api`（或你喜欢的名称） |
| **Region** | 选择离用户最近的区域（如 Singapore） |
| **Branch** | `main`（或你的主分支） |

### 步骤 3：环境类型选择 Docker

| 配置项 | 值 |
|--------|-----|
| **Environment** | **Docker** |
| **Dockerfile Path** | `web/backend/Dockerfile` |

> 因为 Dockerfile 在子目录，必须填写 `web/backend/Dockerfile`，不能留空。

### 步骤 4：实例规格

| 配置项 | 建议 |
|--------|------|
| **Instance Type** | Free 或 Starter（Playwright + Chromium 内存需求较高，Free 可能较慢或超时） |

> 若 Free 层经常超时或 OOM，建议升级到 Starter（$7/月）。

### 步骤 5：环境变量（可选）

当前后端 `main.py` 无需环境变量。若将来需要，在 **Environment** 中添加：

| Key | Value | 说明 |
|-----|-------|------|
| `PORT` | （由 Render 自动注入，无需手动填） | 服务监听端口 |

### 步骤 6：高级设置（可选）

- **Health Check Path**：可填 `/docs`（FastAPI 自带文档页），用于 Render 健康检查
- **Docker Command**：通常留空，使用 Dockerfile 中的 `CMD`

---

## 三、部署与验证

### 1. 部署

点击 **Create Web Service**。Render 会：

1. 克隆仓库
2. 在 `web/backend/` 下根据 Dockerfile 构建镜像
3. 启动容器并对外提供服务

首次构建约 3–5 分钟（拉取 Playwright 镜像较大）。

### 2. 获取服务地址

部署成功后，Render 会分配一个 URL，例如：

```
https://property-scrape-api-xxxx.onrender.com
```

### 3. 验证接口

```bash
# 健康检查（FastAPI 文档）
curl https://property-scrape-api-xxxx.onrender.com/docs

# 测试抓取接口
curl -X POST https://property-scrape-api-xxxx.onrender.com/api/scrape-property \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.propertyguru.com.sg/listing/for-sale-xxx-12345"}'
```

---

## 四、配置前端调用

### 1. Vercel 环境变量

在 Vercel 项目 **Settings** → **Environment Variables** 中添加：

| 名称 | 值 |
|------|-----|
| `VITE_SCRAPE_API_URL` | `https://property-scrape-api-xxxx.onrender.com` |

两个环境都勾选（Production、Preview、Development）。

### 2. 重新部署前端

修改环境变量后，在 Vercel 中重新部署前端，使 `VITE_SCRAPE_API_URL` 生效。

---

## 五、常见问题

### 1. Free 实例冷启动慢

Render Free 实例一段时间无请求会进入休眠，首次请求可能等待 30–60 秒。如需稳定响应，可：

- 使用付费 Starter 实例
- 或配置外部定时 ping 保持活跃（需注意 Render ToS）

### 2. 抓取超时（504）

Property Guru 加载较慢时，可能触发超时。可考虑：

- 在 `main.py` 中适当增大 `timeout=30000`
- 升级到更高规格实例
- 增加重试逻辑

### 3. Chromium 启动失败

若日志出现 `Executable doesn't exist`，请确认：

- Dockerfile 使用 `mcr.microsoft.com/playwright/python:v1.58.0-noble` 等官方镜像
- 未在容器内再执行 `playwright install`（基础镜像已包含）

### 4. CORS 问题

`main.py` 已配置 `allow_origins=["*"]`，前端域名可跨域请求。若部署后有 CORS 报错，可改为显式列出前端域名：

```python
allow_origins=[
    "https://your-frontend.vercel.app",
    "http://localhost:5173"
]
```

---

## 六、目录结构检查清单

部署前确认仓库结构如下：

```
propertyassistance/
├── web/
│   ├── backend/
│   │   ├── Dockerfile          ← 需创建
│   │   ├── requirements.txt    ← 需创建（精简版）
│   │   ├── .dockerignore       ← 可选
│   │   └── main.py             ← 已有
│   └── frontend/
│       └── ...
└── ...
```

---

## 七、使用 render.yaml（Infrastructure as Code，可选）

在项目根目录创建 `render.yaml`，可通过 Render Blueprint 一键部署：

```yaml
services:
  - type: web
    name: property-scrape-api
    runtime: docker
    dockerfilePath: ./web/backend/Dockerfile
    region: singapore
```

然后在 Render Dashboard 选择 **New** → **Blueprint**，连接仓库并选择 `render.yaml` 即可。

---

完成上述步骤后，后端会部署在 Render，前端通过 `VITE_SCRAPE_API_URL` 调用抓取接口。
