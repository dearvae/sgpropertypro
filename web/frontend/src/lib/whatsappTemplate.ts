/**
 * WhatsApp 预填消息模板：中介版 / 非中介版
 * 变量：{agent_name}, {my_name}, {my_company}, {buyer_or_tenant}, {listing_type}, {property_title}, {bedrooms}, {price}, {agent_line}, {link}
 */

export const DEFAULT_WHATSAPP_TEMPLATE_AGENT = `Hi {agent_name},
I am {my_name} from {my_company}, I have {buyer_or_tenant} interested in:
{listing_type} - {property_title}
{bedrooms} / {price}

Please advise the comm% and available viewing slots. Hope to close with you now.

{link}

Thanks`

export const DEFAULT_WHATSAPP_TEMPLATE_CLIENT = `Hi {agent_name},
I am {my_name}, I have {buyer_or_tenant} interested in:
{listing_type} - {property_title}
{bedrooms} / {price}

{link}

Thanks`

export const AGENT_LINE = 'Please advise the comm% and available viewing slots. Hope to close with you now.'

export type WhatsAppTemplateVars = {
  agent_name: string
  my_name: string
  my_company: string
  buyer_or_tenant: string
  listing_type: string
  property_title: string
  bedrooms: string
  price: string
  agent_line: string
  link: string
}

/** 从 property.title 提取小区/项目名（如 Hillington Green） */
export function extractPropertyTitle(fullTitle: string): string {
  if (!fullTitle?.trim()) return ''
  const t = fullTitle.trim()
  const m1 = t.match(/^(.+?)\s*[-–—]\s+/)
  if (m1) return m1[1].trim()
  const m2 = t.match(/\s+at\s+(.+)$/i)
  if (m2) return m2[1].trim()
  return t
}

/**
 * 根据 property 和 profile 构建模板变量
 */
export function buildTemplateVars(
  property: { title?: string | null; bedrooms?: string | null; price_value?: string | null; price?: string | null; listing_type?: 'sale' | 'rent' | null; link?: string | null; listing_agent_name?: string | null },
  profile: { given_name?: string | null; full_name?: string | null; company?: string | null },
  isAgent: boolean
): WhatsAppTemplateVars {
  const listingType = property.listing_type ?? 'sale'
  const buyerOrTenant = listingType === 'sale' ? 'a buyer' : 'a tenant'
  const listingTypeLabel = listingType === 'sale' ? 'SALE' : 'RENT'

  return {
    agent_name: property.listing_agent_name?.trim() || 'Agent',
    my_name: (profile?.given_name?.trim() || profile?.full_name?.trim()) || 'Guest',
    my_company: profile?.company?.trim() || '',
    buyer_or_tenant: buyerOrTenant,
    listing_type: listingTypeLabel,
    property_title: extractPropertyTitle(property.title ?? ''),
    bedrooms: property.bedrooms?.trim() || '',
    price: (property.price_value ?? property.price)?.trim() || '',
    agent_line: isAgent ? AGENT_LINE : '',
    link: property.link?.trim() || '',
  }
}

/**
 * 替换模板中的变量占位符
 */
export function applyTemplate(template: string, vars: WhatsAppTemplateVars): string {
  let out = template
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val ?? '')
  }
  return out.trim()
}
