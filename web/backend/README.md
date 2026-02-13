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

- **POST** `/api/scrape-property`
- **请求体**: `{ "url": "https://www.propertyguru.com.sg/listing/for-sale-xxx-12345" }`
- **响应**: `{ title, link, price, size_sqft, main_image_url, floor_plan_url, basic_info }`

## 环境变量

前端需配置 `VITE_SCRAPE_API_URL` 指向此服务（如 `http://localhost:8000`），生产环境替换为实际部署地址。
