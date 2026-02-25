/**
 * 代表卖家/房东的合并预约逻辑：同一房源、同一日期、多组潜在买家，且无其他预约穿插时合并为一块
 */
import type { Appointment, PartyRole, Property } from '@/types'

export type SellerMergedBlock = {
  property: Property
  partyRole: PartyRole
  appointments: Appointment[]
  /** 是否有其他预约穿插（若有则不应合并） */
  hasInterleaving: boolean
}

/** 一天内的展示项：合并块或单条预约 */
export type DayDisplayItem =
  | { type: 'merged'; block: SellerMergedBlock }
  | { type: 'single'; appointment: Appointment }

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * 将某天的预约列表处理为展示项：可合并的卖家/房东块 + 其余单条
 * 注意：list 必须为同一天的预约（由调用方按 date 分组后传入），只合并同一天内的预约
 */
export function buildDayDisplayItems(list: Appointment[]): DayDisplayItem[] {
  const sellerOrLandlord = list.filter(
    (a) => a.party_role === 'seller' || a.party_role === 'landlord'
  )
  const others = list.filter(
    (a) => a.party_role !== 'seller' && a.party_role !== 'landlord'
  )

  if (sellerOrLandlord.length === 0) {
    return others.map((a) => ({ type: 'single' as const, appointment: a }))
  }

  const items: DayDisplayItem[] = []

  // 按 property_id 分组
  const byProperty = new Map<string, Appointment[]>()
  for (const a of sellerOrLandlord) {
    const key = a.property_id
    if (!byProperty.has(key)) byProperty.set(key, [])
    byProperty.get(key)!.push(a)
  }

  for (const [, appts] of byProperty) {
    appts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const prop = appts[0].properties as Property | undefined
    if (!prop) {
      items.push(...appts.map((a) => ({ type: 'single' as const, appointment: a })))
      continue
    }

    const blockStart = new Date(appts[0].start_time).getTime()
    const blockEnd = Math.max(
      ...appts.map((a) => new Date(a.end_time).getTime())
    )

    // 检查是否有其他预约穿插：任意非本组的预约与 [blockStart, blockEnd] 重叠
    const sellerApptIds = new Set(appts.map((a) => a.id))
    const hasInterleaving = list.some((a) => {
      if (sellerApptIds.has(a.id)) return false
      const s = new Date(a.start_time).getTime()
      const e = new Date(a.end_time).getTime()
      return overlaps(blockStart, blockEnd, s, e)
    })

    const block: SellerMergedBlock = {
      property: prop,
      partyRole: appts[0].party_role as PartyRole,
      appointments: appts,
      hasInterleaving,
    }

    if (appts.length >= 2 && !hasInterleaving) {
      items.push({ type: 'merged', block })
    } else {
      items.push(...appts.map((a) => ({ type: 'single' as const, appointment: a })))
    }
  }

  // 加入 others（买家/租客）
  items.push(...others.map((a) => ({ type: 'single' as const, appointment: a })))

  // 按开始时间排序
  items.sort((x, y) => {
    const t1 = x.type === 'merged'
      ? new Date(x.block.appointments[0].start_time).getTime()
      : new Date(x.appointment.start_time).getTime()
    const t2 = y.type === 'merged'
      ? new Date(y.block.appointments[0].start_time).getTime()
      : new Date(y.appointment.start_time).getTime()
    return t1 - t2
  })

  return items
}

const STORAGE_KEY = 'seller-merged-card-variant'

export type SellerMergedCardVariant =
  | 'table'
  | 'timeline'
  | 'compact'
  | 'blocks'
  | 'minimal'

const DEFAULT_VARIANT: SellerMergedCardVariant = 'table' // 默认表格布局

export function getSavedSellerMergedVariant(): SellerMergedCardVariant {
  if (typeof window === 'undefined') return DEFAULT_VARIANT
  const v = localStorage.getItem(STORAGE_KEY)
  const valid: SellerMergedCardVariant[] = ['table', 'timeline', 'compact', 'blocks', 'minimal']
  return valid.includes(v as SellerMergedCardVariant) ? (v as SellerMergedCardVariant) : DEFAULT_VARIANT
}

export function setSavedSellerMergedVariant(v: SellerMergedCardVariant): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, v)
}
