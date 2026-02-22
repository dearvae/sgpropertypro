# 地图标注功能：在地图上查看所有预约房源

## 一、功能目标

客户希望能在 Google 地图上一键查看所有预约房源的位置，便于规划看房路线和比较地理分布。

---

## 二、放置位置建议（客户视角）

客户入口在 `web/frontend/src/pages/ClientView.tsx`（路由 `/view/:token`）。

**推荐**：在「准备看的」与「历史记录」两个 Tab 的**上方**，放置一个固定的「在地图上查看全部」按钮。仅当存在预约且至少 1 个房源有可用的地址/标题时显示。

```
┌─────────────────────────────────────────────────────┐
│ 看房日程                          [在地图上查看全部]  │
│ 客户组名称                                            │
├─────────────────────────────────────────────────────┤
│ [准备看的 (3)]  [历史记录]                            │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

**备选**：放在每个 Tab 内容区顶部，或 header 右侧与语言切换并列。

**不推荐**：仅在单个房源卡片内提供地图入口，因为用户需要一次性查看全部，而不是每个房源单独跳转。

---

## 三、数据现状

当前 `PropertyData` 和数据库 schema：

- **有**：`title`（如 "Marina Bay Residences - 2 Bedroom"）
- **无**：`address`、`lat`、`lng`

可用 `property.title` 作为 Google Maps 搜索关键词（例如通过 `getGoogleMapsSearchUrl(p.title)`）。

---

## 四、实施方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **A. Google Maps Directions URL** | 无需 API key，纯前端 | 以路线为主，waypoints 有数量限制（桌面 9 个，移动端 3 个） | 快速实现 |
| **B. 页面内嵌 Google Maps** | 多标记、交互好 | 需要 API key，计费 | 长期体验优先 |
| **C. 多个单点搜索链接** | 实现简单 | 需多次点击，体验差 | 不推荐 |

---

## 五、方案 A：Google Maps Directions URL（推荐起步）

**思路**：利用 Directions URL，将各房源作为 `origin`、`destination`、`waypoints`，在 Google Maps 中一次展示多地点。

**URL 格式**：

```
https://www.google.com/maps/dir/?api=1
  &origin={房源1}
  &destination={房源N}
  &waypoints={房源2}|{房源3}|...
  &travelmode=driving
```

**实现步骤**：

1. 在 `web/frontend/src/lib/mapUtils.ts` 新增：

```ts
/** 生成 Google Maps 路线 URL，展示多个地点 */
export function getGoogleMapsDirectionsUrl(locations: string[]): string {
  if (locations.length === 0) return 'https://www.google.com/maps'
  if (locations.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`
  }
  const [origin, ...rest] = locations
  const destination = rest.pop() || origin
  const waypoints = rest.length > 0 ? rest.join('|') : undefined
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
```

2. 在 `ClientView` 中，从 `upcoming`（或 `upcoming + history`）提取 `property.title`，去重后传入上述函数
3. 在 header 或 Tab 上方增加按钮，用 `target="_blank"` 打开该 URL

**限制**：waypoints 数量（桌面约 9 个，移动端约 3 个），房源过多时需截断或分批。

---

## 六、方案 B：页面内嵌 Google Maps（进阶）

**思路**：在 ClientView 中增加「地图」Tab 或弹窗，使用 `@react-google-maps/api`，对每个 `property.title` 做地理编码后在地图上打点。

**实现步骤**：

1. 安装：`npm install @react-google-maps/api`
2. 配置 Google Cloud 项目，启用 Maps JavaScript API 和 Geocoding API
3. 在 `.env.local` 增加 `VITE_GOOGLE_MAPS_API_KEY`
4. 新建 `MapView` 组件，接收 `properties: { id, title }[]`，对每个 title 调用 Geocoding API 获取坐标，渲染 Marker
5. 在 ClientView 增加「地图」Tab 或「在地图上查看」弹窗，传入当前可见的预约房源

**依赖**：API key、配额管理、可能的计费。

---

## 七、推荐实施顺序

1. **第一步**：实现方案 A（Directions URL），在 ClientView header 或 Tab 上方增加「在地图上查看全部」按钮
2. **可选**：若用户量上升且需要更好体验，再考虑方案 B（内嵌地图）

---

## 八、多语言文案

在 `web/frontend/src/locales/zh.json` 和 `en.json` 中增加：

| Key | zh | en |
|-----|----|----|
| `clientView.viewAllOnMap` | 在地图上查看全部 | View all on map |
| `clientView.viewAllOnMapTitle` | 在 Google 地图中查看所有预约房源位置 | View all appointment locations on Google Maps |
