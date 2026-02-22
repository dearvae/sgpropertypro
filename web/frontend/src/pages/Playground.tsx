/**
 * Playground：展示官网与地图可实现的技巧，便于选型决策
 * 访问 /playground 查看
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapViewModal } from '@/components/MapViewModal'
import { getGoogleMapsSearchUrl, getGoogleMapsDirectionsUrl } from '@/lib/mapUtils'

// 示例房源，用于地图演示
const DEMO_PROPERTIES = [
  { id: '1', title: 'Marina Bay Residences' },
  { id: '2', title: 'Orchard Road' },
  { id: '3', title: 'Sentosa Cove' },
]

export default function Playground() {
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const titles = DEMO_PROPERTIES.map((p) => p.title)

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      {/* 顶部说明 */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-stone-900">官网技巧 Playground</h1>
          <Link to="/" className="text-sm text-stone-500 hover:text-stone-700">← 返回首页</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* ========== 一、地图展示方式 ========== */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">一、地图展示方式</h2>
          <p className="text-stone-500 text-sm mb-8">
            客户需要在地图上查看多个预约房源。以下是可选方案对比，便于选择适合官网/客户入口的集成方式。
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* A. Google Maps Directions URL */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">A</span>
                <h3 className="font-semibold text-stone-900">Google Maps 路线链接</h3>
              </div>
              <p className="text-sm text-stone-600 mb-4">
                无需 API key，纯前端。点击后在 Google 地图新标签打开，显示起点→途经点→终点的驾驶路线。桌面端约 9 个途经点，移动端约 3 个。
              </p>
              <a
                href={getGoogleMapsDirectionsUrl(titles)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                在 Google Maps 中打开 →
              </a>
            </div>

            {/* B. Google Maps 单点搜索 */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700 font-bold text-sm">B</span>
                <h3 className="font-semibold text-stone-900">Google Maps 单点搜索</h3>
              </div>
              <p className="text-sm text-stone-600 mb-4">
                每个房源单独打开搜索。实现简单，但需多次点击，体验一般。适合「单个房源卡片」内的小链接。
              </p>
              <div className="flex flex-wrap gap-2">
                {titles.slice(0, 2).map((t) => (
                  <a
                    key={t}
                    href={getGoogleMapsSearchUrl(t)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100"
                  >
                    {t}
                  </a>
                ))}
              </div>
            </div>

            {/* C. Leaflet + OpenStreetMap 内嵌 */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">C</span>
                <h3 className="font-semibold text-stone-900">Leaflet + OpenStreetMap 内嵌地图</h3>
              </div>
              <p className="text-sm text-stone-600 mb-4">
                在页面内弹窗/ Tab 中显示地图，使用 Nominatim 免费地理编码。无需 Google API key，交互体验好，可多标记。
              </p>
              <button
                type="button"
                onClick={() => setMapModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                打开内嵌地图弹窗
              </button>
            </div>

            {/* D. Google Maps 内嵌（需 API key） */}
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6 md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-stone-200 text-stone-600 font-bold text-sm">D</span>
                <h3 className="font-semibold text-stone-700">Google Maps 内嵌（进阶）</h3>
              </div>
              <p className="text-sm text-stone-500 mb-4">
                使用 <code className="rounded bg-stone-200 px-1">@react-google-maps/api</code> 在页面内嵌 Google 地图。
                需要配置 Google Cloud API key，启用 Maps JavaScript API 和 Geocoding API，有配额与计费。
              </p>
              <p className="text-xs text-stone-400">若用户量上升且追求最佳体验，可考虑此方案。</p>
            </div>
          </div>
        </section>

        {/* ========== 二、官网设计风格 ========== */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">二、官网设计风格</h2>
          <p className="text-stone-500 text-sm mb-8">
            以下为可选的首页 / Landing 视觉风格，供选型参考。
          </p>

          <div className="space-y-12">
            {/* 风格 1：深色现代（当前 HomePage） */}
            <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-lg">
              <div className="bg-stone-800 px-4 py-2 text-stone-300 text-sm font-medium">风格 1：深色现代</div>
              <div className="p-8 bg-[#0a0a0a]">
                <div className="max-w-2xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-4">
                    完全免费
                  </span>
                  <h3 className="text-3xl font-semibold text-white tracking-tight">智能看房预约管理，为每一个人。</h3>
                  <p className="mt-3 text-white/60 text-sm">中介管理客户与预约，客户跟踪自己的日程。一个工具，两种体验。</p>
                  <div className="mt-6 flex gap-3">
                    <span className="inline-flex px-4 py-2 rounded-full bg-white text-black text-sm font-medium">免费注册</span>
                    <span className="inline-flex px-4 py-2 rounded-full border border-white/20 text-white text-sm">了解更多</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 风格 2：浅色简洁 */}
            <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-lg">
              <div className="bg-stone-200 px-4 py-2 text-stone-600 text-sm font-medium">风格 2：浅色简洁</div>
              <div className="p-8 bg-stone-50">
                <div className="max-w-2xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-stone-200 text-stone-600 text-xs font-medium mb-4">
                    完全免费
                  </span>
                  <h3 className="text-3xl font-semibold text-stone-900 tracking-tight">智能看房预约管理，为每一个人。</h3>
                  <p className="mt-3 text-stone-500 text-sm">中介管理客户与预约，客户跟踪自己的日程。一个工具，两种体验。</p>
                  <div className="mt-6 flex gap-3">
                    <span className="inline-flex px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium">免费注册</span>
                    <span className="inline-flex px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm">了解更多</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 风格 3：渐变/品牌色 */}
            <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-lg">
              <div className="bg-indigo-100 px-4 py-2 text-indigo-700 text-sm font-medium">风格 3：渐变品牌色</div>
              <div className="p-8 bg-gradient-to-br from-indigo-50 to-amber-50">
                <div className="max-w-2xl">
                  <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium mb-4">
                    完全免费
                  </span>
                  <h3 className="text-3xl font-semibold text-stone-900 tracking-tight">智能看房预约管理，为每一个人。</h3>
                  <p className="mt-3 text-stone-600 text-sm">中介管理客户与预约，客户跟踪自己的日程。一个工具，两种体验。</p>
                  <div className="mt-6 flex gap-3">
                    <span className="inline-flex px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-lg shadow-indigo-200">免费注册</span>
                    <span className="inline-flex px-4 py-2 rounded-lg border border-indigo-300 text-indigo-700 text-sm">了解更多</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 三、组件样式变体 ========== */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">三、组件样式变体</h2>
          <p className="text-stone-500 text-sm mb-8">
            卡片、按钮、标签等可复用的视觉变体。
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: '圆角卡片 + hover', cls: 'rounded-2xl border border-stone-200 bg-white p-4 hover:shadow-lg hover:border-indigo-200 transition-all' },
              { name: '直角简约', cls: 'rounded-sm border border-stone-300 bg-white p-4' },
              { name: '玻璃拟态', cls: 'rounded-xl border border-white/20 bg-white/60 backdrop-blur-md p-4 shadow-lg' },
            ].map(({ name, cls }) => (
              <div key={name} className={cls}>
                <p className="text-sm font-medium text-stone-700">{name}</p>
                <p className="mt-1 text-xs text-stone-500">示例卡片内容</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">标签 A</span>
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">标签 B</span>
            <span className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">标签 C</span>
            <span className="px-3 py-1.5 rounded-full bg-stone-200 text-stone-600 text-xs font-medium">中性标签</span>
          </div>
        </section>

        {/* 推荐实施顺序 */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">推荐实施顺序</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-stone-600">
            <li><strong>地图</strong>：先用方案 A（Google Maps Directions URL），无 API 成本，快速上线</li>
            <li><strong>地图进阶</strong>：已有方案 C（Leaflet 内嵌）实现，可按需在 ClientView 中启用</li>
            <li><strong>官网风格</strong>：当前 HomePage 已采用深色现代风，可保持或按本 Playground 切换风格</li>
          </ol>
        </section>
      </main>

      {mapModalOpen && (
        <MapViewModal
          properties={DEMO_PROPERTIES}
          onClose={() => setMapModalOpen(false)}
          title="内嵌地图示例（Leaflet + OpenStreetMap）"
        />
      )}
    </div>
  )
}
