import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRealtimeClientView } from '@/hooks/useRealtimeAppointments'

type PropertyData = {
  id: string
  title: string
  link: string | null
  basic_info: string | null
  price: string | null
  size_sqft: string | null
  bedrooms: string | null
  bathrooms: string | null
  main_image_url: string | null
  image_urls: string[]
  floor_plan_url: string | null
  listing_type: 'sale' | 'rent' | null
}

type AppointmentItem = {
  id: string
  start_time: string
  end_time: string
  status: string
  client_note: string
  property: PropertyData
}

type ClientViewData = {
  group: { id: string; name: string } | null
  appointments: AppointmentItem[]
  error?: string
}

export default function ClientView() {
  const { token } = useParams<{ token: string }>()
  const qc = useQueryClient()
  useRealtimeClientView(token)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['client-view', token],
    queryFn: async (): Promise<ClientViewData> => {
      const { data: result, error: rpcError } = await supabase.rpc('get_client_view', {
        p_share_token: token,
      })
      if (rpcError) throw rpcError
      return result as ClientViewData
    },
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
        </div>
        <p className="text-slate-500 text-sm">正在加载看房日程...</p>
      </div>
    )
  }

  if (error || !data || data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center">
          <p className="text-stone-600">链接无效或已过期</p>
          <p className="text-stone-400 text-sm mt-2">请向中介索取正确的看房日程链接</p>
        </div>
      </div>
    )
  }

  const { group, appointments } = data
  const now = new Date()
  const upcoming = appointments.filter((a) => new Date(a.start_time) >= now)
  const history = appointments.filter((a) => new Date(a.start_time) < now)

  const historyByDate = history.reduce<Record<string, typeof history>>((acc, a) => {
    const d = new Date(a.start_time).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(a)
    return acc
  }, {})
  const historyDates = Object.keys(historyByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ appointmentId: string; content: string } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null)
        setNoteModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const open = !!lightboxImage || !!noteModal
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxImage, noteModal])

  const toggleDate = (d: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const displayImages = (p: PropertyData): string[] => {
    const urls = Array.isArray(p.image_urls) ? p.image_urls : []
    if (urls.length >= 2) return urls.slice(0, 2)
    if (urls.length === 1 && p.main_image_url && urls[0] !== p.main_image_url) return [urls[0], p.main_image_url]
    if (urls.length === 1) return urls
    if (p.main_image_url) return [p.main_image_url]
    return []
  }

  const handleSaveNote = async () => {
    if (!token || !noteModal) return
    try {
      const { error: rpcError } = await supabase.rpc('save_client_appointment_note', {
        p_share_token: token,
        p_appointment_id: noteModal.appointmentId,
        p_content: noteModal.content,
      })
      if (rpcError) throw rpcError
      qc.invalidateQueries({ queryKey: ['client-view', token] })
      setNoteModal(null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const renderAppointmentCard = (
    a: AppointmentItem,
    inHistory = false
  ) => {
    const imgs = displayImages(a.property)
    const hasNote = !!a.client_note?.trim()
    return (
      <div
        key={a.id}
        className={`bg-white overflow-hidden hover:shadow-md transition-shadow ${inHistory ? 'p-4' : 'rounded-xl shadow-sm border border-slate-100'}`}
      >
        <div className="flex">
          <div className="flex flex-col w-28 sm:w-32 flex-shrink-0 gap-0.5 p-2 bg-slate-50">
            {imgs[0] ? (
              <button type="button" onClick={() => setLightboxImage(imgs[0])} className="block w-full h-20 rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left">
                <img src={imgs[0]} alt={a.property.title} className="w-full h-20 object-cover" />
              </button>
            ) : (
              <div className="w-full h-20 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 text-xs">无图</div>
            )}
            {imgs[1] ? (
              <button type="button" onClick={() => setLightboxImage(imgs[1])} className="block w-full h-20 rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left">
                <img src={imgs[1]} alt={a.property.title} className="w-full h-20 object-cover" />
              </button>
            ) : imgs[0] ? null : (
              <div className="w-full h-20 rounded-lg bg-slate-200" />
            )}
          </div>
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold text-base leading-tight ${inHistory ? 'text-slate-700' : 'text-slate-900'}`}>{a.property.title}</p>
              {a.property.listing_type && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.property.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {a.property.listing_type === 'rent' ? '出租' : '出售'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-slate-600">
              {a.property.price && <span className="font-medium text-emerald-700">{a.property.price}</span>}
              {a.property.bedrooms && <span>{a.property.bedrooms}</span>}
              {a.property.bathrooms && <span>{a.property.bathrooms}</span>}
              {(a.property.size_sqft || a.property.basic_info) && (
                <span>{(a.property.size_sqft || a.property.basic_info)}</span>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-2">
              {new Date(a.start_time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            {a.property.link && (
              <a href={a.property.link} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm mt-2 hover:underline font-medium">
                查看房源 →
              </a>
            )}
            <button
              type="button"
              onClick={() => setNoteModal({ appointmentId: a.id, content: a.client_note || '' })}
              className={`mt-2 text-left text-sm w-full px-3 py-2 rounded-lg border transition-colors ${
                hasNote
                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-600'
              }`}
            >
              {hasNote ? a.client_note : '点击添加备注'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {isFetching && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/80 animate-pulse z-10" title="正在更新..." />
      )}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold text-slate-900">看房日程</h1>
          {group && <p className="text-slate-500 text-sm mt-1">{group.name}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        <section>
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'upcoming' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              准备看的{upcoming.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({upcoming.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              历史记录{history.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({history.length})</span>}
            </button>
          </div>

          {activeTab === 'upcoming' && (
            <>
              {upcoming.length === 0 ? (
                <p className="text-slate-500 text-sm">暂无即将看房的安排</p>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((a) => renderAppointmentCard(a))}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm">暂无历史记录</p>
              ) : (
                <div className="space-y-2">
                  {historyDates.map((dateStr) => {
                    const list = historyByDate[dateStr]
                    const isCollapsed = collapsedDates.has(dateStr)
                    const dateLabel = new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
                    return (
                      <div key={dateStr} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => toggleDate(dateStr)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <span className="font-medium text-slate-800">{dateLabel}</span>
                          <span className="text-slate-500 text-sm">{list.length} 套房源</span>
                          <span className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
                        </button>
                        {!isCollapsed && (
                          <div className="divide-y divide-slate-100">
                            {list.map((a) => renderAppointmentCard(a, true))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {noteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="编辑备注"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900 mb-3">添加备注</h3>
            <textarea
              value={noteModal.content}
              onChange={(e) => setNoteModal((m) => m && { ...m, content: e.target.value })}
              placeholder="记录您的看房心得..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
              >
                确定
              </button>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="放大图片"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
            aria-label="关闭"
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt="放大查看"
            className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
