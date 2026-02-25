import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ScheduleCustomEvent } from '@/lib/scheduleCustomEvents'

export type AddCustomEventModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (event: Omit<ScheduleCustomEvent, 'id'>) => void
  /** 编辑时传入已有事件，用于预填表单 */
  initialEvent?: ScheduleCustomEvent
  /** 初始日期 YYYY-MM-DD（仅在新建时生效） */
  initialDate?: string
}

function toLocalDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 将 dateStr + timeStr 转为 ISO 字符串（本地时区） */
function toISO(dateStr: string, timeStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ''
  const parts = timeStr.split(':').map(Number)
  const h = Number.isFinite(parts[0]) ? parts[0] : 0
  const m = Number.isFinite(parts[1]) ? parts[1] : 0
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function toLocalTimeStr(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function AddCustomEventModal({ open, onClose, onSubmit, initialEvent, initialDate }: AddCustomEventModalProps) {
  const { t } = useTranslation()
  const today = toLocalDateStr(new Date())
  const isEdit = !!initialEvent
  const [name, setName] = useState('')
  const [date, setDate] = useState(initialDate ?? today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [location, setLocation] = useState('')

  useEffect(() => {
    if (open) {
      if (initialEvent) {
        setName(initialEvent.name)
        setDate(toLocalDateStr(new Date(initialEvent.startTime)))
        setStartTime(toLocalTimeStr(initialEvent.startTime))
        setEndTime(toLocalTimeStr(initialEvent.endTime))
        setLocation(initialEvent.location)
      } else {
        setName('')
        setDate(initialDate ?? toLocalDateStr(new Date()))
        setStartTime('09:00')
        setEndTime('10:00')
        setLocation('')
      }
    }
  }, [open, initialEvent, initialDate])

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const startISO = toISO(date, startTime)
    const endISO = toISO(date, endTime)
    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) return
    onSubmit({
      name: trimmedName,
      startTime: startISO,
      endTime: endISO,
      location: location.trim(),
    })
    onClose()
  }

  const startISO = toISO(date, startTime)
  const endISO = toISO(date, endTime)
  const canSubmit =
    name.trim().length > 0 &&
    !!startISO &&
    !!endISO &&
    new Date(endISO) > new Date(startISO)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay" onClick={onClose}>
      <div
        className="glass-modal rounded-xl p-6 w-full max-w-md mx-4 micro-btn"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[#2b5843] mb-4">
          {isEdit ? t('scheduleSection.editEvent') : t('scheduleSection.addEvent')}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#2b5843]/80">
              {t('scheduleSection.eventName')} <span className="text-[#53868e]">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('scheduleSection.eventNamePlaceholder')}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('scheduleSection.eventDate')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#2b5843]/80">{t('scheduleSection.eventStartTime')}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#2b5843]/80">{t('scheduleSection.eventEndTime')}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('scheduleSection.eventLocation')}</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('scheduleSection.eventLocationPlaceholder')}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="micro-btn px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
          >
            {isEdit ? t('common.save') : t('common.create')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
