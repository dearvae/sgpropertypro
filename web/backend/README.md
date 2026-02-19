# 房源抓取 API

基于 FastAPI + Playwright 的 Property Guru 房源信息抓取服务。

## 启动

```bash
# 从 propertyassistance 项目根目录
cd web/backend
pip install -r ../../requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000
```

## 接口

- **POST** `/api/scrape-property`（同步，用于刷新按钮）
  - 请求体: `{ "url": "https://www.propertyguru.com.sg/listing/for-sale-xxx-12345" }`
  - 响应: `{ title, link, price, size_sqft, main_image_url, floor_plan_url, basic_info }`

- **POST** `/api/trigger-scrape`（异步，用于新增链接时后台抓取）
  - 请求体: `{ "property_id": "uuid", "url": "https://..." }`
  - 响应: 202 Accepted，后台抓取完成后写入 Supabase

## 环境变量

- 前端: `VITE_SCRAPE_API_URL` 指向此服务（如 `http://localhost:8000`）
- 后端异步写入: 在项目根 `.env` 中配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（与前端 URL 相同；Service Role Key 在 Supabase Dashboard → Settings → API）
