/**
 * 房源抓取 API 客户端
 */
const SCRAPE_API_URL = import.meta.env.VITE_SCRAPE_API_URL || 'http://localhost:8000'

export type ScrapeResult = {
  title: string
  link: string
  price?: string
  price_value?: string
  price_description?: string
  size_sqft?: string
  bedrooms?: string
  bathrooms?: string
  main_image_url?: string
  image_urls?: string[]
  floor_plan_url?: string
  basic_info?: string
  listing_agent_name?: string
  listing_agent_phone?: string
  listing_type?: 'sale' | 'rent'  // 出售 vs 出租（爬虫识别）
  lease_tenure?: string  // 地契：99年地契、999年地契、永久地契（买卖时展示）
  site_plan_url?: string  // 公寓小区平面图，从 99.co 抓取
}

export async function scrapeProperty(url: string): Promise<ScrapeResult> {
  const res = await fetch(`${SCRAPE_API_URL}/api/scrape-property`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '抓取失败')
  }
  return res.json()
}

/** 支持的抓取域名 */
export const SUPPORTED_SCRAPE_DOMAINS = ['propertyguru.com', 'propertygroup.com']

export function isSupportedScrapeUrl(url: string): boolean {
  return SUPPORTED_SCRAPE_DOMAINS.some((d) => url.includes(d))
}

export function normalizeSourceUrl(url: string): string {
  let u = url.trim()
  if (!u.startsWith('http')) u = 'https://' + u
  return u.replace(/\/$/, '')
}

/**
 * 异步触发抓取：立即返回 202，后台抓取完成后会更新数据库。
 * 用于提交新链接时，用户无需等待抓取完成。
 */
export async function triggerScrapeAsync(propertyId: string, url: string): Promise<void> {
  const res = await fetch(`${SCRAPE_API_URL}/api/trigger-scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: propertyId, url: url.trim() }),
  })
  if (!res.ok && res.status !== 202) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || '触发抓取失败')
  }
}

