export type CustomerGroup = {
  id: string
  agent_id: string
  name: string
  description: string | null
  intent: 'buy' | 'rent' | null  // 买房 | 租房，必选
  share_token: string
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
  size_sqft: string | null
  bedrooms: string | null
  bathrooms: string | null
  main_image_url: string | null
  image_urls: string[] | null
  floor_plan_url: string | null
  listing_agent_name: string | null
  listing_agent_phone: string | null
  listing_type: 'sale' | 'rent' | null  // 出售 | 出租（爬虫识别）
  created_at: string
  updated_at: string
}

export type Appointment = {
  id: string
  property_id: string
  customer_group_id: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string | null
  created_at: string
  updated_at: string
  properties?: Property
  customer_groups?: CustomerGroup
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
