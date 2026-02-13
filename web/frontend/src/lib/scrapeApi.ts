/**
 * 房源抓取 API 客户端
 */
const SCRAPE_API_URL = import.meta.env.VITE_SCRAPE_API_URL || 'http://localhost:8000'

export type ScrapeResult = {
  title: string
  link: string
  price?: string
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
