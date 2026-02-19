export type CustomerGroup = {
  id: string
  agent_id: string
  name: string
  description: string | null
  intent: 'buy' | 'rent' | null  // 买房 | 租房，必选
  share_token: string
  share_token_edit?: string  // 可编辑链接专用 token，与 share_token 独立
  is_active?: boolean  // 是否活跃；false 表示已成交等，从各 filter 排除。默认 true
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
  price_value: string | null  // 价格数值，如 S$1,500,000
  price_description: string | null  // 价格描述，如 negotiable、Starting from
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
  site_plan_url: string | null  // 公寓小区平面图，从 99.co 抓取
  created_at: string
  updated_at: string
}

/** 格式化价格展示：price_value + 空格 + price_description，兼容旧的 price */
export function formatPriceDisplay(p: {
  price_value?: string | null
  price_description?: string | null
  price?: string | null
}): string {
  const val = p.price_value ?? p.price
  const desc = p.price_description
  if (!val) return ''
  if (!desc) return val
  return `${val} ${desc}`
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
  agent_number: string | null
  phone: string | null
  avatar_url: string | null
  name_changed_at: string | null
  created_at: string
  updated_at: string
}

export type AgentFeedback = {
  id: string
  author_id: string | null
  author_display: string | null
  content: string
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
