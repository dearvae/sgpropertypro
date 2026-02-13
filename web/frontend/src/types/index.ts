export type CustomerGroup = {
  id: string
  agent_id: string
  name: string
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
