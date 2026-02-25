/**
 * 时间表自定义事件：用户手动添加的事件，存储在 localStorage，按 agent/client 隔离
 */
export type ScheduleCustomEvent = {
  id: string
  name: string
  /** ISO 日期时间 */
  startTime: string
  /** ISO 日期时间 */
  endTime: string
  location: string
}

const STORAGE_PREFIX = 'schedule-custom-events'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function getCustomEvents(userId: string): ScheduleCustomEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is ScheduleCustomEvent =>
        e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.startTime === 'string' && typeof e.endTime === 'string' && typeof e.location === 'string'
    )
  } catch {
    return []
  }
}

export function saveCustomEvents(userId: string, events: ScheduleCustomEvent[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(events))
}

export function addCustomEvent(userId: string, event: Omit<ScheduleCustomEvent, 'id'>): ScheduleCustomEvent {
  const events = getCustomEvents(userId)
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const newEvent: ScheduleCustomEvent = { ...event, id }
  events.push(newEvent)
  saveCustomEvents(userId, events)
  return newEvent
}

export function updateCustomEvent(
  userId: string,
  eventId: string,
  updates: Partial<Omit<ScheduleCustomEvent, 'id'>>
): void {
  const events = getCustomEvents(userId).map((e) =>
    e.id === eventId ? { ...e, ...updates } : e
  )
  saveCustomEvents(userId, events)
}

export function deleteCustomEvent(userId: string, eventId: string): void {
  const events = getCustomEvents(userId).filter((e) => e.id !== eventId)
  saveCustomEvents(userId, events)
}
