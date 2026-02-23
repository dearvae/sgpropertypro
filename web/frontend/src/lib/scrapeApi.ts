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
  top_year?: string  // TOP 年份（入伙年份），如 2020
  site_plan_url?: string  // 公寓小区平面图，从 99.co 抓取
}

/** 429 时返回的限流提示 */
export const RATE_LIMIT_MSG = '你点得太快了，请稍后再点'
export const RATE_LIMIT_MSG_GENERAL = '请求过于频繁，请稍后再试'

export async function scrapeProperty(
  url: string,
  options?: { propertyId?: string; operatorId?: string }
): Promise<ScrapeResult> {
  const body: { url: string; property_id?: string; operator_id?: string } = { url: url.trim() }
  if (options?.propertyId) body.property_id = options.propertyId
  if (options?.operatorId) body.operator_id = options.operatorId
  const res = await fetch(`${SCRAPE_API_URL}/api/scrape-property`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail || '抓取失败'
    if (res.status === 429) {
      throw new Error(msg.includes('点得太快') ? RATE_LIMIT_MSG : RATE_LIMIT_MSG_GENERAL)
    }
    throw new Error(msg)
  }
  return res.json()
}

/** 批量添加待预约响应：202 表示已接受，正在后台抓取 */
export type BatchScrapeResponse = { added: number; message: string }

/**
 * 批量添加待预约：传入多个链接、agent_id、customer_group_id。
 * 后端先创建 property+pending，立即返回（200/202）；抓取在后台异步执行。
 */
export async function batchScrapeProperties(p: {
  urls: string[]
  agent_id: string
  customer_group_id: string
  notes?: string | null
}): Promise<BatchScrapeResponse> {
  const trimmed = p.urls.map((u) => u.trim()).filter(Boolean)
  if (trimmed.length === 0) throw new Error('请提供至少一个链接')
  if (!p.agent_id || !p.customer_group_id) throw new Error('缺少 agent_id 或 customer_group_id')
  const res = await fetch(`${SCRAPE_API_URL}/api/batch-scrape-properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: trimmed,
      agent_id: p.agent_id,
      customer_group_id: p.customer_group_id,
      notes: p.notes ?? null,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail || '批量添加失败'
    if (res.status === 429) {
      throw new Error(msg.includes('频繁') ? RATE_LIMIT_MSG_GENERAL : msg)
    }
    throw new Error(msg)
  }
  return res.json()
}

/** 添加 agent 自售/出租房源响应 */
export type AddAgentListingResponse = {
  added: number
  group_id: string
  property_id: string
  message: string
}

/**
 * 添加 agent 自售/出租房源：创建 property + customer_group (listing)，立即返回 202，爬虫在后台异步执行。
 * 必填：房源链接；选填：客户名称。
 */
export async function addAgentListing(p: {
  url: string
  agent_id: string
  client_name?: string
  listing_type: 'sale' | 'rent'
}): Promise<AddAgentListingResponse> {
  const url = p.url.trim()
  if (!url) throw new Error('请提供房源链接')
  if (!p.agent_id) throw new Error('缺少 agent_id')
  const res = await fetch(`${SCRAPE_API_URL}/api/add-agent-listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      agent_id: p.agent_id,
      client_name: p.client_name?.trim() || null,
      listing_type: p.listing_type,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail || '添加失败'
    if (res.status === 429) {
      throw new Error(msg.includes('频繁') ? RATE_LIMIT_MSG_GENERAL : msg)
    }
    throw new Error(msg)
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
export type TriggerScrapeResult = { ok: true; skipped?: boolean }

/**
 * 异步触发抓取：立即返回 202，后台抓取完成后会更新数据库。
 * skipped=true 表示 1 小时内已抓过，未实际执行（仍返回成功）。
 * operatorId 可选，用于记录操作人到 scrape_runs 供管理员查看。
 */
export async function triggerScrapeAsync(
  propertyId: string,
  url: string,
  operatorId?: string | null
): Promise<TriggerScrapeResult> {
  const body: { property_id: string; url: string; operator_id?: string } = {
    property_id: propertyId,
    url: url.trim(),
  }
  if (operatorId) body.operator_id = operatorId
  const res = await fetch(`${SCRAPE_API_URL}/api/trigger-scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok && res.status !== 202) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = err.detail || '触发抓取失败'
    if (res.status === 429) {
      throw new Error(msg.includes('点得太快') ? RATE_LIMIT_MSG : RATE_LIMIT_MSG_GENERAL)
    }
    throw new Error(msg)
  }
  return { ok: true }
}

