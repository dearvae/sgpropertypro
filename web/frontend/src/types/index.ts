export type CustomerGroup = {
  id: string
  agent_id: string
  name: string
  description: string | null
  intent: 'buy' | 'rent' | 'sale' | null  // 买房/租房(client)；出售/出租(listing)
  share_token: string
  share_token_edit?: string  // 可编辑链接专用 token，与 share_token 独立
  is_active?: boolean  // 是否活跃；false 表示已成交等，从各 filter 排除。默认 true
  group_type?: 'client' | 'listing'  // client=买家/租客，listing=出售/出租房源
  property_id?: string | null  // 仅 listing 时设置，指向 agent 的房源
  created_at: string
  updated_at: string
}

export type Property = {
  id: string
  agent_id: string
  title: string
  link: string | null
  basic_info: string | null
  source_url: string | null
  price: string | null
  last_scraped_at?: string | null
  price_value: string | null  // 价格纯数字，如 1888000
  price_description: string | null  // 价格描述，如 Negotiable、Starting from
  size_sqft: string | null
  bedrooms: string | null
  bathrooms: string | null
  main_image_url: string | null
  image_urls: string[] | null
  floor_plan_url: string | null
  listing_agent_name: string | null
  listing_agent_phone: string | null
  listing_type: 'sale' | 'rent' | null  // 出售 | 出租（爬虫识别）
  lease_tenure: string | null  // 地契：99年地契、999年地契、永久地契（买卖时展示）
  top_year: string | null  // TOP 年份（入伙年份），如 2020
  site_plan_url: string | null  // 公寓小区平面图，从 99.co 抓取
  created_at: string
  updated_at: string
}

/** 格式化价格展示：price_value 格式化为 S$ 1,888,000 + price_description，兼容旧的 price */
export function formatPriceDisplay(p: {
  price_value?: string | null
  price_description?: string | null
  price?: string | null
} | null | undefined): string {
  if (p == null) return ''
  const val = p.price_value ?? p.price
  const desc = p.price_description
  if (!val) return ''
  // price_value 为纯数字时，格式化为 S$ 1,888,000
  const num = /^\d+$/.test(val) ? Number(val).toLocaleString('en-SG') : val
  const display = num.includes('$') ? num : `S$ ${num}`
  if (!desc) return display
  return `${display} ${desc}`
}

/** 预约角色：买家 | 卖家 | 租客 | 房东 */
export type PartyRole = 'buyer' | 'seller' | 'tenant' | 'landlord'

export type Appointment = {
  id: string
  property_id: string
  customer_group_id: string | null
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  party_role: PartyRole
  customer_info?: string | null
  customer_phone?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  properties?: Property
  customer_groups?: CustomerGroup | null
}

/** 待预约状态 */
export type PendingAppointmentStatus =
  | 'not_scheduled'  // 还未预约
  | 'consulted'      // 已咨询
  | 'to_consult'     // 待咨询
  | 'awaiting_agent_reply' // 待对方中介回复正在确认时间

export type PendingAppointment = {
  id: string
  property_id: string
  customer_group_id: string
  status: PendingAppointmentStatus
  notes?: string | null
  created_at: string
  updated_at: string
  properties?: Property
  customer_groups?: CustomerGroup
}

export type Note = {
  id: string
  property_id: string
  content: string
  visibility: 'client_visible' | 'internal'
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  role: string
  full_name: string | null
  family_name: string | null
  given_name: string | null
  agent_number: string | null
  phone: string | null
  avatar_url: string | null
  name_changed_at: string | null
  company: string | null
  whatsapp_template_agent: string | null
  whatsapp_template_client: string | null
  whatsapp_template_agent_sale?: string | null
  whatsapp_template_agent_rent?: string | null
  whatsapp_template_client_sale?: string | null
  whatsapp_template_client_rent?: string | null
  invite_code: string | null
  invited_by_id: string | null
  verification_status: string
  is_admin: boolean
  is_super_admin: boolean
  created_at: string
  updated_at: string
}

/** 右上角等处展示：family_name + given_name，兼容旧 full_name */
export function getDisplayName(profile: { family_name?: string | null; given_name?: string | null; full_name?: string | null } | null | undefined): string {
  if (!profile) return ''
  const fn = profile.family_name?.trim()
  const gn = profile.given_name?.trim()
  if (fn || gn) return [fn, gn].filter(Boolean).join(' ')
  return profile.full_name?.trim() ?? ''
}

/** 模板 my_name 仅使用 given_name */
export function getGivenName(profile: { given_name?: string | null; full_name?: string | null } | null | undefined): string {
  if (!profile) return ''
  const gn = profile.given_name?.trim()
  if (gn) return gn
  return profile.full_name?.trim() ?? ''
}

export type AgentFeedbackVisibility = 'all' | 'developer_only'

export type AgentFeedback = {
  id: string
  author_id: string | null
  author_display: string | null
  content: string
  visibility: AgentFeedbackVisibility
  created_at: string
  vote_count?: number
  has_voted?: boolean
}

export type AgentFeedbackVote = {
  id: string
  feedback_id: string
  user_id: string
  created_at: string
}
