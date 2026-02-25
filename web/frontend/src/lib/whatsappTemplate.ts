/**
 * WhatsApp 预填消息模板：中介版 / 非中介版 × 买房 / 租房
 * 变量：{agent_name}, {my_name}, {my_company}, {buyer_or_tenant}, {listing_type}, {property_title}, {bedrooms}, {price}, {agent_line}, {link}
 */
import { formatPriceDisplay, getGivenName } from '@/types'

/** 中介 - 租房默认模板 */
export const DEFAULT_WHATSAPP_AGENT_RENT = `Hi {agent_name},
I am {my_name} from {my_company}, I have tenant interested in:
{listing_type} - {property_title}
{bedrooms} / {price}

{link}

Thanks`

/** 中介 - 买房默认模板 */
export const DEFAULT_WHATSAPP_AGENT_SALE = `Hi {agent_name},
I am {my_name} from {my_company}, I have buyer interested in:
{listing_type} - {property_title}
{bedrooms} / {price}
Please advise the comm% and available viewing slots. Hope to close with you.
{link}

Thanks`

/** 非中介 - 租房默认模板 */
export const DEFAULT_WHATSAPP_CLIENT_RENT = `Hi {agent_name},
I am {my_name} interested in:
{listing_type} - {property_title}
{bedrooms} / {price}

{link}

Thanks`

/** 非中介 - 买房默认模板 */
export const DEFAULT_WHATSAPP_CLIENT_SALE = `Hi {agent_name},
I am {my_name}, I am interested in:
{listing_type} - {property_title}
{bedrooms} / {price}
{link}

Thanks`

/** @deprecated 兼容旧代码，等同 agent rent */
export const DEFAULT_WHATSAPP_TEMPLATE_AGENT = DEFAULT_WHATSAPP_AGENT_RENT
/** @deprecated 兼容旧代码，等同 client rent */
export const DEFAULT_WHATSAPP_TEMPLATE_CLIENT = DEFAULT_WHATSAPP_CLIENT_RENT

export const AGENT_LINE = 'Please advise the comm% and available viewing slots. Hope to close with you.'

/** 根据是否中介 + 房源类型获取默认模板 */
export function getDefaultWhatsAppTemplate(
  isAgent: boolean,
  listingType: 'sale' | 'rent'
): string {
  if (isAgent) {
    return listingType === 'sale' ? DEFAULT_WHATSAPP_AGENT_SALE : DEFAULT_WHATSAPP_AGENT_RENT
  }
  return listingType === 'sale' ? DEFAULT_WHATSAPP_CLIENT_SALE : DEFAULT_WHATSAPP_CLIENT_RENT
}

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

/** 提取小区/项目名用于去重：同一小区只展示一次。优先取 "at/in XXX"、"- XXX" 部分 */
export function extractProjectOrLocation(fullTitle: string | null | undefined): string {
  if (!fullTitle?.trim()) return ''
  const t = fullTitle.trim()
  const at = t.match(/\s+at\s+(.+)$/i)
  if (at) return at[1].trim()
  const inMatch = t.match(/\s+in\s+(.+)$/i)
  if (inMatch) return inMatch[1].trim()
  const afterDash = t.match(/\s*[-–—]\s+(.+)$/)
  if (afterDash) return afterDash[1].trim()
  const beforeDash = t.match(/^(.+?)\s*[-–—]\s+/)
  if (beforeDash) return beforeDash[1].trim()
  return t
}

/**
 * 根据 property 和 profile 构建模板变量
 */
export function buildTemplateVars(
  property: { title?: string | null; bedrooms?: string | null; price_value?: string | null; price_description?: string | null; price?: string | null; listing_type?: 'sale' | 'rent' | null; link?: string | null; listing_agent_name?: string | null },
  profile: { family_name?: string | null; given_name?: string | null; full_name?: string | null; company?: string | null },
  isAgent: boolean
): WhatsAppTemplateVars {
  const listingType = property.listing_type ?? 'sale'
  const buyerOrTenant = listingType === 'sale' ? 'a buyer' : 'a tenant'
  const listingTypeLabel = listingType === 'sale' ? 'SALE' : 'RENT'
  const priceDisplay = formatPriceDisplay(property)

  return {
    agent_name: property.listing_agent_name?.trim() || 'Agent',
    my_name: getGivenName(profile) || 'Guest',
    my_company: profile?.company?.trim() || '',
    buyer_or_tenant: buyerOrTenant,
    listing_type: listingTypeLabel,
    property_title: extractPropertyTitle(property.title ?? ''),
    bedrooms: property.bedrooms?.trim() || '',
    price: priceDisplay || (property.price_value ?? property.price)?.trim() || '',
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
