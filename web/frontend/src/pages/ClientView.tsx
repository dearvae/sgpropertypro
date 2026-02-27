import { useState, useEffect, useRef } from 'react'
import { message } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRealtimeClientView } from '@/hooks/useRealtimeAppointments'
import { useAuth } from '@/hooks/useAuth'
import { getWhatsAppChatUrl, getTelUrl } from '@/lib/whatsapp'
import { getGoogleMapsSearchUrl } from '@/lib/mapUtils'
import { MapViewModal } from '@/components/MapViewModal'
import { ViewPageSkeleton } from '@/components/Skeleton'
import { triggerScrapeAsync, isSupportedScrapeUrl, normalizeSourceUrl } from '@/lib/scrapeApi'
import { formatPriceDisplay } from '@/types'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

type PropertyData = {
  id: string
  title: string
  link: string | null
  basic_info: string | null
  price: string | null
  price_value: string | null
  price_description: string | null
  size_sqft: string | null
  bedrooms: string | null
  bathrooms: string | null
  main_image_url: string | null
  image_urls: string[]
  floor_plan_url: string | null
  site_plan_url: string | null
  listing_type: 'sale' | 'rent' | null
  listing_agent_name: string | null
  listing_agent_phone: string | null
  lease_tenure: string | null
  top_year: string | null
}

type AppointmentItem = {
  id: string
  start_time: string
  end_time: string
  status: string
  notes: string
  client_note: string
  party_role?: string
  customer_info?: string | null
  customer_phone?: string | null
  property: PropertyData
}

type PendingItem = {
  id: string
  client_feedback: 'interested' | 'neutral' | 'not_interested' | null
  status: string
  notes: string
  client_note?: string
  property: PropertyData
}

type ClientViewData = {
  group: { id: string; name: string; group_type?: string; property_id?: string | null } | null
  appointments: AppointmentItem[]
  pending_appointments?: PendingItem[]
  can_edit?: boolean
  favorited_property_ids?: string[]
  listing_property?: PropertyData | null
  error?: string
}

function CopyIcon({ onClick, title, t }: { onClick: () => void; title?: string; t: (k: string) => string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center justify-center p-1 rounded hover:bg-[#53868e]/10 text-[#2b5843]/70 hover:text-[#2b5843] transition-colors"
      title={title ?? t('common.copy')}
      aria-label={title ?? t('common.copy')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  )
}

export default function ClientView() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const isAgent = !!(user && (user.user_metadata?.role as string) === 'agent')
  const [showContactNumbers, setShowContactNumbers] = useState(false)
  const qc = useQueryClient()
  useRealtimeClientView(token)

  const [activeTab, setActiveTab] = useState<'pending' | 'upcoming' | 'history' | 'favorites'>('upcoming')
  const initialTabSet = useRef(false)
  const [archiveCollapsed, setArchiveCollapsed] = useState(true)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const [pendingSortOrder, setPendingSortOrder] = useState<'default' | 'price_asc' | 'price_desc'>('default')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ appointmentId?: string; pendingId?: string; content: string } | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null)
        setNoteModal(null)
        setShowMapModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const open = !!lightboxImage || !!noteModal || showMapModal
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxImage, noteModal, showMapModal])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['client-view', token],
    queryFn: async (): Promise<ClientViewData> => {
      const { data: result, error: rpcError } = await supabase.rpc('get_client_view', {
        p_share_token: token,
      })
      if (rpcError) throw rpcError
      // Supabase RPC 可能返回原始值或数组包装，统一为对象
      const resolved = Array.isArray(result) && result.length > 0 ? result[0] : result
      if (import.meta.env.DEV) {
        console.log('[ClientView] RPC 返回:', { raw: result, resolved })
      }
      return resolved as ClientViewData
    },
    enabled: !!token,
    // Realtime 对匿名用户受 RLS 限制无法推送，用轮询保证待预约同步
    refetchInterval: 20_000, // 每 20 秒轮询
    refetchOnWindowFocus: true, // 切回标签页时刷新
  })

  // 页面初次加载时，优先展示已预约；无已预约则展示待预约
  useEffect(() => {
    if (initialTabSet.current || isLoading || error || !data) return
    const appointments = Array.isArray(data.appointments) ? data.appointments : []
    const pendingItems = Array.isArray(data.pending_appointments) ? data.pending_appointments : []
    const pendingMain = pendingItems.filter((p: PendingItem) => p.client_feedback !== 'not_interested')
    const now = new Date()
    const upcoming = appointments.filter((a: AppointmentItem) => new Date(a.start_time) >= now)
    if (upcoming.length > 0) {
      setActiveTab('upcoming')
    } else if (pendingMain.length > 0) {
      setActiveTab('pending')
    }
    initialTabSet.current = true
  }, [data, isLoading, error])

  if (isLoading) {
    return <ViewPageSkeleton message={t('clientView.loadingSchedule')} />
  }

  if (error || !data || data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="text-center">
          <p className="text-[#2b5843]/90">{t('clientView.invalidLink')}</p>
          <p className="text-[#2b5843]/60 text-sm mt-2">{t('clientView.invalidLinkHint')}</p>
        </div>
      </div>
    )
  }

  const { group, appointments: rawAppointments, pending_appointments: rawPending = [], can_edit: canEdit = false, favorited_property_ids: rawFavorited = [], listing_property: rawListingProperty } = data
  const isListingView = !!(group?.group_type === 'listing' && group?.property_id)
  const listingProperty = isListingView
    ? (rawListingProperty ?? (appointments.length > 0 ? appointments[0].property : null))
    : null
  const favoritedIds = new Set(Array.isArray(rawFavorited) ? rawFavorited : [])
  const appointments = Array.isArray(rawAppointments) ? rawAppointments : []
  const pendingItems = Array.isArray(rawPending) ? rawPending : []
  const getPriceNumber = (p: PropertyData): number => {
    const val = p?.price_value ?? p?.price
    if (!val) return Infinity
    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''))
    return Number.isNaN(num) ? Infinity : num
  }
  const sortByPrice = <T extends { property: PropertyData }>(arr: T[], asc: boolean): T[] => {
    return [...arr].sort((a, b) => {
      const na = getPriceNumber(a.property)
      const nb = getPriceNumber(b.property)
      if (na !== nb) return asc ? na - nb : nb - na
      return 0
    })
  }
  const pendingMain = pendingItems.filter((p) => p.client_feedback !== 'not_interested')
  const pendingArchive = pendingItems.filter((p) => p.client_feedback === 'not_interested')
  const pendingMainSorted =
    pendingSortOrder === 'default' ? pendingMain : sortByPrice(pendingMain, pendingSortOrder === 'price_asc')
  const pendingArchiveSorted =
    pendingSortOrder === 'default' ? pendingArchive : sortByPrice(pendingArchive, pendingSortOrder === 'price_asc')
  const now = new Date()
  const upcoming = appointments.filter((a) => new Date(a.start_time) >= now)
  const history = appointments.filter((a) => new Date(a.start_time) < now)

  const favoritedItems = [...new Map([
    ...pendingMain.filter((i) => favoritedIds.has(i.property.id)).map((i) => [i.property.id, { property: i.property }] as const),
    ...pendingArchive.filter((i) => favoritedIds.has(i.property.id)).map((i) => [i.property.id, { property: i.property }] as const),
    ...upcoming.filter((a) => favoritedIds.has(a.property.id)).map((a) => [a.property.id, { property: a.property }] as const),
    ...history.filter((a) => favoritedIds.has(a.property.id)).map((a) => [a.property.id, { property: a.property }] as const),
  ]).values()]

  const historyByDate = history.reduce<Record<string, typeof history>>((acc, a) => {
    const d = new Date(a.start_time).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(a)
    return acc
  }, {})
  const historyDates = Object.keys(historyByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  // 提取所有预约房源的 title 用于地图展示（去重）
  const mapProperties = [...new Map(
    [...upcoming, ...history]
      .filter((a) => a?.property?.title?.trim())
      .map((a) => [a.property.title.trim(), { id: a.property.id, title: a.property.title.trim() } as const])
  ).values()]

  const toggleDate = (d: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const displayImages = (p: PropertyData): string[] => {
    if (!p) return []
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
      if (noteModal.appointmentId) {
        const { error: rpcError } = await supabase.rpc('save_client_appointment_note', {
          p_share_token: token,
          p_appointment_id: noteModal.appointmentId,
          p_content: noteModal.content,
        })
        if (rpcError) throw rpcError
      } else if (noteModal.pendingId) {
        const { error: rpcError } = await supabase.rpc('save_client_pending_note', {
          p_share_token: token,
          p_pending_appointment_id: noteModal.pendingId,
          p_content: noteModal.content,
        })
        if (rpcError) throw rpcError
      }
      qc.invalidateQueries({ queryKey: ['client-view', token] })
      setNoteModal(null)
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => message.success(t('clientView.copied')))
  }

  const handleToggleFavorite = async (propertyId: string) => {
    if (!token) return
    const isFavorited = favoritedIds.has(propertyId)
    try {
      const { error: rpcError } = await supabase.rpc('save_client_favorite', {
        p_share_token: token,
        p_property_id: propertyId,
        p_favorited: !isFavorited,
      })
      if (rpcError) throw rpcError
      qc.invalidateQueries({ queryKey: ['client-view', token] })
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const handleSaveFeedback = async (pendingId: string, feedback: 'interested' | 'neutral' | 'not_interested') => {
    if (!token) return
    try {
      const { error: rpcError } = await supabase.rpc('save_client_pending_feedback', {
        p_share_token: token,
        p_pending_appointment_id: pendingId,
        p_feedback: feedback,
      })
      if (rpcError) throw rpcError
      qc.invalidateQueries({ queryKey: ['client-view', token] })
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const handleRefreshProperty = async (p: PropertyData) => {
    const url = p.link
    if (!url || !isSupportedScrapeUrl(url)) {
      message.info(t('clientView.noRefreshSupport'))
      return
    }
    setRefreshingPropertyId(p.id)
    try {
      await triggerScrapeAsync(p.id, normalizeSourceUrl(url), user?.id)
      message.info(t('common.asyncScrapeHint'), 5)
      // 备份：20 秒后强制刷新一次（以防 Realtime 未配置 properties 表）
      if (token) {
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['client-view', token] })
        }, 20000)
      }
    } catch (e) {
      message.error((e as Error).message || t('clientView.refreshFailed'))
    } finally {
      setRefreshingPropertyId(null)
    }
  }

  const renderAppointmentCard = (
    a: AppointmentItem,
    inHistory = false
  ) => {
    if (!a?.property) return null
    const imgs = displayImages(a.property)
    const hasNote = !!a.client_note?.trim()
    const p = a.property
    const canShowPhones = isAgent && showContactNumbers
    const hasAgentInfo = canShowPhones && (p.listing_agent_name || p.listing_agent_phone)
    const agentWhatsAppUrl = p.listing_agent_phone ? getWhatsAppChatUrl(p.listing_agent_phone) : null
    return (
      <div
        key={a.id}
        className={`overflow-hidden hover:shadow-md transition-shadow ${inHistory ? 'p-4' : 'rounded-xl shadow-sm border border-[#53868e]/20'}`}
        style={{ background: inHistory ? undefined : 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
      >
        <div className="flex flex-col sm:flex-row">
          <div className={`flex flex-col w-full sm:w-[166px] flex-shrink-0 gap-0.5 p-2 order-1 sm:order-none ${imgs.length <= 1 ? 'justify-center' : ''}`} style={{ background: 'rgba(83,134,142,0.08)' }}>
            {imgs[0] ? (
              <button
                type="button"
                onClick={() => setLightboxImage(imgs[0])}
                className={`block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left ${imgs.length >= 2 ? 'h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3]' : 'h-40 sm:h-auto sm:w-[150px] sm:aspect-[4/3]'}`}
              >
                <img src={imgs[0]} alt={a.property.title} className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-full h-20 rounded-lg flex items-center justify-center text-[#2b5843]/50 text-xs" style={{ background: 'rgba(83,134,142,0.15)' }}>{t('common.noImage')}</div>
            )}
            {imgs[1] && (
              <button type="button" onClick={() => setLightboxImage(imgs[1])} className="block w-full h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left">
                <img src={imgs[1]} alt={a.property.title} className="w-full h-full object-cover" />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-center order-2 sm:order-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(a.property.id) }}
                  className="shrink-0 p-0.5 -ml-0.5 rounded hover:bg-[#53868e]/10 text-[#53868e]/70 hover:text-amber-500 transition-colors"
                  title={favoritedIds.has(a.property.id) ? t('clientView.unfavorite') : t('clientView.favorite')}
                  aria-label={favoritedIds.has(a.property.id) ? t('clientView.unfavorite') : t('clientView.favorite')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={favoritedIds.has(a.property.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                <p className={`font-semibold text-base leading-tight break-words ${inHistory ? 'text-[#2b5843]/90' : 'text-[#2b5843]'}`}>{a.property.title}</p>
                {a.property.listing_type && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${a.property.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {a.property.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                  </span>
                )}
              </div>
              {formatPriceDisplay(a.property) && (
                <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(a.property)}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
              {a.property.bedrooms && <span>{a.property.bedrooms}</span>}
              {a.property.bathrooms && <span>{a.property.bathrooms}</span>}
              {(a.property.size_sqft || a.property.basic_info) && (
                <span>{(a.property.size_sqft || a.property.basic_info)}</span>
              )}
              {a.property.listing_type === 'sale' && a.property.lease_tenure && (
                <span className="text-[#2b5843]/70">{a.property.lease_tenure}</span>
              )}
              {a.property.top_year && (
                <span className="text-[#2b5843]/70">{a.property.top_year}</span>
              )}
            </div>
            <p className="text-[#2b5843]/70 text-sm mt-2">
              {new Date(a.start_time).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            {a.notes && (
              <p className="text-[#2b5843]/80 text-sm mt-2 px-3 py-2 rounded-lg border border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>
                {t('clientView.agentNote')}：{a.notes}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
              {a.property.site_plan_url && (
                <button type="button" onClick={() => setLightboxImage(a.property.site_plan_url!)} className="text-emerald-600 hover:underline font-medium">
                  {t('clientView.sitePlan')}
                </button>
              )}
              {a.property.link && (
                <a href={a.property.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">
                  {t('clientView.viewProperty')}
                </a>
              )}
              <a
                href={getGoogleMapsSearchUrl(p.title)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 text-sm hover:underline font-medium"
                title={t('clientView.mapNavTitle')}
                aria-label={t('clientView.mapNavTitle')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('clientView.mapNav')}
              </a>
              {a.property.link && isSupportedScrapeUrl(a.property.link) && (
                <button
                  type="button"
                  onClick={() => handleRefreshProperty(a.property)}
                  disabled={refreshingPropertyId === a.property.id}
                  className="text-xs text-[#2b5843]/60 hover:text-[#2b5843] disabled:opacity-50 flex items-center gap-1"
                  title={t('clientView.refreshTitle')}
                >
                  {refreshingPropertyId === a.property.id ? (
                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" /></svg>
                  )}
                  {t('common.refresh')}
                </button>
              )}
            </div>
            {hasAgentInfo && (
              <div className="mt-2 px-3 py-2 rounded-lg border border-[#53868e]/20 space-y-1.5" style={{ background: 'rgba(83,134,142,0.08)' }}>
                <p className="text-xs text-[#2b5843]/70">{t('clientView.listingAgent')}</p>
                {(p.listing_agent_name || p.listing_agent_phone) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.listing_agent_name && <span className="text-sm font-medium text-[#2b5843]/90">{p.listing_agent_name}</span>}
                    {p.listing_agent_phone && (
                      <span className="inline-flex items-center gap-0.5">
                        <a href={getTelUrl(p.listing_agent_phone)} className="text-sm text-[#53868e] hover:text-[#2b5843]">
                          {p.listing_agent_phone}
                        </a>
                        <CopyIcon onClick={() => copyPhone(p.listing_agent_phone!)} title={t('clientView.copyNumber')} t={t} />
                      </span>
                    )}
                    {agentWhatsAppUrl && (
                      <a
                        href={agentWhatsAppUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-[#25D366] text-white hover:bg-[#20BD5A]"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            {canEdit ? (
              <button
                type="button"
                onClick={() => setNoteModal({ appointmentId: a.id, content: a.client_note ?? '' })}
                className={`mt-2 text-left text-sm w-full px-3 py-2 rounded-lg border transition-colors ${
                  hasNote
                    ? 'border-[#53868e]/30 bg-[#53868e]/10 text-[#2b5843]/90 hover:bg-[#53868e]/15'
                    : 'border-dashed border-[#53868e]/30 text-[#2b5843]/70 hover:border-[#53868e] hover:text-[#2b5843]/80'
                }`}
              >
                {hasNote ? a.client_note : t('clientView.addNote')}
              </button>
            ) : hasNote ? (
              <p className="mt-2 text-sm text-[#2b5843]/80 px-3 py-2 rounded-lg border border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>{t('clientView.noteLabel')}：{a.client_note}</p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const pendingStatusLabels: Record<string, string> = {
    not_scheduled: t('pendingStatus.not_scheduled'),
    to_consult: t('pendingStatus.to_consult'),
    consulted: t('pendingStatus.consulted'),
    awaiting_agent_reply: t('pendingStatus.awaiting_agent_reply'),
  }

  const renderPendingCard = (item: PendingItem, inArchive = false) => {
    if (!item?.property) return null
    const p = item.property
    const imgs = displayImages(p)
    const fb = item.client_feedback
    return (
      <div
        key={item.id}
        className={`overflow-hidden rounded-xl shadow-sm border border-[#53868e]/20 hover:shadow-md transition-shadow ${inArchive ? 'bg-slate-50' : ''}`}
        style={inArchive ? undefined : { background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
      >
        <div className="flex flex-col sm:flex-row">
          <div className={`flex flex-col w-full sm:w-[166px] flex-shrink-0 gap-0.5 p-2 order-1 sm:order-none ${imgs.length <= 1 ? 'justify-center' : ''}`} style={{ background: 'rgba(83,134,142,0.08)' }}>
            {imgs[0] ? (
              <button type="button" onClick={() => setLightboxImage(imgs[0])} className="block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left h-40 sm:h-auto sm:w-[150px] sm:aspect-[4/3]">
                <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-full h-20 rounded-lg flex items-center justify-center text-[#2b5843]/50 text-xs" style={{ background: 'rgba(83,134,142,0.15)' }}>{t('common.noImage')}</div>
            )}
            {imgs[1] && (
              <button type="button" onClick={() => setLightboxImage(imgs[1])} className="block w-full h-[100px] sm:h-auto sm:w-[150px] sm:aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left mt-0.5">
                <img src={imgs[1]} alt={p.title} className="w-full h-full object-cover" />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-center order-2 sm:order-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(p.id) }}
                  className="shrink-0 p-0.5 -ml-0.5 rounded hover:bg-[#53868e]/10 text-[#53868e]/70 hover:text-amber-500 transition-colors"
                  title={favoritedIds.has(p.id) ? t('clientView.unfavorite') : t('clientView.favorite')}
                  aria-label={favoritedIds.has(p.id) ? t('clientView.unfavorite') : t('clientView.favorite')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={favoritedIds.has(p.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                <p className="font-semibold text-base leading-tight break-words text-[#2b5843]">{p.title}</p>
                {p.listing_type && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${p.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {p.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                  </span>
                )}
              </div>
              {formatPriceDisplay(p) && <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(p)}</span>}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
              {p.bedrooms && <span>{p.bedrooms}</span>}
              {p.bathrooms && <span>{p.bathrooms}</span>}
              {(p.size_sqft || p.basic_info) && <span>{(p.size_sqft || p.basic_info)}</span>}
              {p.listing_type === 'sale' && p.lease_tenure && <span className="text-[#2b5843]/70">{p.lease_tenure}</span>}
              {p.top_year && <span className="text-[#2b5843]/70">{p.top_year}</span>}
            </div>
            {item.status && (
              <p className="text-[#2b5843]/70 text-xs mt-1">{pendingStatusLabels[item.status] ?? item.status}</p>
            )}
            {item.notes && (
              <p className="text-[#2b5843]/80 text-sm mt-2 px-3 py-2 rounded-lg border border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>
                {t('clientView.agentNote')}：{item.notes}
              </p>
            )}
            {canEdit ? (
              <button
                type="button"
                onClick={() => setNoteModal({ pendingId: item.id, content: item.client_note || '' })}
                className={`mt-2 text-left text-sm w-full px-3 py-2 rounded-lg border transition-colors ${
                  item.client_note?.trim()
                    ? 'border-[#53868e]/30 bg-[#53868e]/10 text-[#2b5843]/90 hover:bg-[#53868e]/15'
                    : 'border-dashed border-[#53868e]/30 text-[#2b5843]/70 hover:border-[#53868e] hover:text-[#2b5843]/80'
                }`}
              >
                {item.client_note?.trim() ? item.client_note : t('clientView.addNote')}
              </button>
            ) : (item.client_note?.trim() ? (
              <p className="mt-2 text-sm text-[#2b5843]/80 px-3 py-2 rounded-lg border border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>{t('clientView.noteLabel')}：{item.client_note}</p>
            ) : null)}
            {canEdit && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(['interested', 'neutral', 'not_interested'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleSaveFeedback(item.id, f)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      fb === f
                        ? f === 'interested'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : f === 'neutral'
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-slate-200 border-slate-300 text-slate-700'
                        : 'border-[#53868e]/25 text-[#2b5843]/80 hover:bg-[#53868e]/10'
                    }`}
                  >
                    {t(`clientFeedback.${f}`)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
              {p.site_plan_url && (
                <button type="button" onClick={() => setLightboxImage(p.site_plan_url!)} className="text-emerald-600 hover:underline font-medium">{t('clientView.sitePlan')}</button>
              )}
              {p.link && (
                <a href={p.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">{t('clientView.viewProperty')}</a>
              )}
              <a href={getGoogleMapsSearchUrl(p.title)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 text-sm hover:underline font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {t('clientView.mapNav')}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      {isFetching && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/80 animate-pulse z-10" title={t('clientView.updating')} />
      )}
      <header className="border-b border-[#53868e]/20 rounded-b-2xl mx-2 sm:mx-4 mt-2 shadow-sm" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #ebece8 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-[#2b5843]">{t('clientView.scheduleTitle')}</h1>
              {group && <p className="text-[#2b5843]/70 text-sm mt-1">{group.name}</p>}
            </div>
            {isAgent && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/home/agent')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#53868e] hover:text-[#2b5843] border border-[#53868e]/30 rounded-lg hover:bg-[#53868e]/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  {t('clientView.backToAgent')}
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-[#2b5843]/80">{t('clientView.showContactNumbers')}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showContactNumbers}
                    onClick={() => setShowContactNumbers((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                      showContactNumbers ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                        showContactNumbers ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </label>
              </div>
            )}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-1.5 rounded-lg text-[#2b5843]/70 hover:text-[#2b5843] hover:bg-[#53868e]/10 disabled:opacity-50 transition-colors"
                title={t('clientView.refreshList')}
                aria-label={t('clientView.refreshList')}
              >
                <svg className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {isListingView && listingProperty ? (
          <section className="space-y-6">
            <div
              className="overflow-hidden rounded-xl shadow-sm border border-amber-200 bg-[#fffbeb]"
              style={{ borderLeftWidth: '4px', borderLeftColor: 'rgb(245 158 11)' }}
            >
              <div className="flex flex-col sm:flex-row p-4 gap-4">
                <div className="flex flex-col w-full sm:w-[180px] flex-shrink-0 gap-1" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  {displayImages(listingProperty)[0] ? (
                    <button
                      type="button"
                      onClick={() => setLightboxImage(displayImages(listingProperty)[0])}
                      className="block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity aspect-[4/3]"
                    >
                      <img src={displayImages(listingProperty)[0]!} alt={listingProperty.title} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="w-full aspect-[4/3] rounded-lg flex items-center justify-center text-[#2b5843]/50 text-xs" style={{ background: 'rgba(245,158,11,0.15)' }}>{t('common.noImage')}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-lg text-[#2b5843] break-words">{listingProperty.title}</p>
                      {listingProperty.listing_type && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${listingProperty.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {listingProperty.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                        </span>
                      )}
                    </div>
                    {formatPriceDisplay(listingProperty) && <span className="font-medium text-emerald-700">{formatPriceDisplay(listingProperty)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-sm text-[#2b5843]/80">
                    {listingProperty.bedrooms && <span>{listingProperty.bedrooms}</span>}
                    {listingProperty.bathrooms && <span>{listingProperty.bathrooms}</span>}
                    {(listingProperty.size_sqft || listingProperty.basic_info) && <span>{(listingProperty.size_sqft || listingProperty.basic_info)}</span>}
                    {listingProperty.listing_type === 'sale' && listingProperty.lease_tenure && <span>{listingProperty.lease_tenure}</span>}
                    {listingProperty.top_year && <span>{listingProperty.top_year}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-sm">
                    {listingProperty.link && (
                      <a href={listingProperty.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">{t('clientView.viewProperty')}</a>
                    )}
                    <a href={getGoogleMapsSearchUrl(listingProperty.title)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                      {t('clientView.mapNav')}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-l-4 border-amber-500 rounded-r-xl overflow-hidden bg-[#fffbeb] shadow-sm">
              <div className="p-4">
                <h3 className="font-semibold text-base text-[#2b5843] mb-3">{t('clientView.upcoming')} / {t('clientView.history')}</h3>
                {upcoming.length === 0 && history.length === 0 ? (
                  <p className="text-slate-500 text-sm">{t('clientView.noUpcoming')}</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-[#2b5843]/60 border-b border-amber-200/50">
                        <th className="py-2 pr-3 font-medium">{t('clientView.tableTime')}</th>
                        <th className="py-2 pr-3 font-medium">
                          {listingProperty.listing_type === 'rent' ? t('clientView.tablePotentialTenant') : t('clientView.tablePotentialBuyer')}
                        </th>
                        <th className="py-2 pr-3 font-medium">{t('clientView.tableContact')}</th>
                        <th className="py-2 font-medium">{t('clientView.tableNotes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...upcoming, ...history]
                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                        .map((a) => {
                          const canShowPhones = isAgent && showContactNumbers
                          const timeStr = new Date(a.start_time).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          const name = a.customer_info ?? '—'
                          const phone = canShowPhones ? a.customer_phone : null
                          const waUrl = phone ? getWhatsAppChatUrl(phone) : null
                          const telUrl = phone ? getTelUrl(phone) : null
                          return (
                            <tr key={a.id} className="border-b border-amber-200/50 last:border-0">
                              <td className="py-2 pr-3 text-sm text-[#2b5843]/80 tabular-nums">{timeStr}</td>
                              <td className="py-2 pr-3 text-sm text-[#2b5843]/90">{name}</td>
                              <td className="py-2 pr-3 text-sm">
                                {phone && telUrl ? (
                                  <span className="flex items-center gap-2">
                                    <a href={telUrl} className="text-[#2b5843]/90 hover:underline">{phone}</a>
                                    <CopyIcon onClick={() => copyPhone(phone)} title={t('clientView.copyNumber')} t={t} />
                                    {waUrl && (
                                      <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-[#25D366] text-white hover:bg-[#20BD5A]">WhatsApp</a>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[#2b5843]/50">—</span>
                                )}
                              </td>
                              <td className="py-2 text-sm text-[#2b5843]/70">{a.notes || '—'}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        ) : (
        <section>
          {mapProperties.length > 0 && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                title={t('clientView.viewAllOnMapTitle')}
                aria-label={t('clientView.viewAllOnMapTitle')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {t('clientView.viewAllOnMap')}
              </button>
            </div>
          )}
          <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'upcoming' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('clientView.upcoming')}{upcoming.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({upcoming.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'pending' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('clientView.pendingTab')}{pendingItems.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({pendingItems.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('clientView.history')}{history.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({history.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === 'favorites' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('clientView.favoritesTab')}{favoritedItems.length > 0 && <span className="ml-1.5 text-slate-400 font-normal">({favoritedItems.length})</span>}
            </button>
          </div>

          {activeTab === 'pending' && (
            <>
              {pendingMain.length === 0 && pendingArchive.length === 0 ? (
                <p className="text-slate-500 text-sm">{t('clientView.noPending')}</p>
              ) : (
                <div className="space-y-6">
                  {(pendingMain.length > 0 || pendingArchive.length > 0) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-[#2b5843]/70">{t('clientView.sortByPrice')}</span>
                      <div className="flex rounded-lg border border-[#53868e]/25 overflow-hidden">
                        {(['default', 'price_asc', 'price_desc'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPendingSortOrder(opt)}
                            className={`px-3 py-1.5 text-sm transition-colors ${
                              pendingSortOrder === opt
                                ? 'bg-[#53868e]/15 text-[#2b5843] font-medium'
                                : 'text-[#2b5843]/70 hover:bg-[#53868e]/5'
                            }`}
                          >
                            {t(`clientView.sortByPrice_${opt}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {pendingMain.length > 0 && (
                    <div className="space-y-4">
                      {pendingMainSorted.map((item) => renderPendingCard(item))}
                    </div>
                  )}
                  {pendingArchive.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setArchiveCollapsed((c) => !c)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <span className="font-medium text-slate-700">{t('clientView.archiveSection')}</span>
                        <span className="text-slate-500 text-sm">{t('clientView.propertiesCount', { count: pendingArchive.length })}</span>
                        <span className={`text-slate-400 transition-transform ${archiveCollapsed ? '' : 'rotate-180'}`}>▾</span>
                      </button>
                      {!archiveCollapsed && (
                        <div className="divide-y divide-slate-100 p-4 space-y-4">
                          {pendingArchiveSorted.map((item) => renderPendingCard(item, true))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'upcoming' && (
            <>
              {upcoming.length === 0 ? (
                <p className="text-slate-500 text-sm">{t('clientView.noUpcoming')}</p>
              ) : (
                <div className="space-y-4">
                  {upcoming.map((a) => renderAppointmentCard(a))}
                </div>
              )}
            </>
          )}

          {activeTab === 'favorites' && (
            <>
              {favoritedItems.length === 0 ? (
                <p className="text-slate-500 text-sm">{t('clientView.noFavorites')}</p>
              ) : (
                <div className="space-y-4">
                  {favoritedItems.map(({ property: p }) => {
                    const imgs = displayImages(p)
                    return (
                    <div
                      key={p.id}
                      className="overflow-hidden rounded-xl shadow-sm border border-[#53868e]/20 hover:shadow-md transition-shadow"
                      style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
                    >
                      <div className="flex flex-col sm:flex-row">
                        <div className={`flex flex-col w-full sm:w-[166px] flex-shrink-0 gap-0.5 p-2 order-1 sm:order-none ${imgs.length <= 1 ? 'justify-center' : ''}`} style={{ background: 'rgba(83,134,142,0.08)' }}>
                          {imgs[0] ? (
                            <button type="button" onClick={() => setLightboxImage(imgs[0])} className="block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left h-40 sm:h-auto sm:w-[150px] sm:aspect-[4/3]">
                              <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-full h-20 rounded-lg flex items-center justify-center text-[#2b5843]/50 text-xs" style={{ background: 'rgba(83,134,142,0.15)' }}>{t('common.noImage')}</div>
                          )}
                          {imgs[1] && (
                            <button type="button" onClick={() => setLightboxImage(imgs[1]!)} className="block w-full h-[100px] sm:h-auto sm:w-[150px] sm:aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left mt-0.5">
                              <img src={imgs[1]!} alt={p.title} className="w-full h-full object-cover" />
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 p-4 flex flex-col justify-center order-2 sm:order-none">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(p.id)}
                                className="shrink-0 p-0.5 -ml-0.5 rounded hover:bg-[#53868e]/10 text-amber-500"
                                title={t('clientView.unfavorite')}
                                aria-label={t('clientView.unfavorite')}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                              <p className="font-semibold text-base leading-tight break-words text-[#2b5843]">{p.title}</p>
                              {p.listing_type && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${p.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {p.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                                </span>
                              )}
                            </div>
                            {formatPriceDisplay(p) && <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(p)}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
                            {p.bedrooms && <span>{p.bedrooms}</span>}
                            {p.bathrooms && <span>{p.bathrooms}</span>}
                            {(p.size_sqft || p.basic_info) && <span>{(p.size_sqft || p.basic_info)}</span>}
                            {p.listing_type === 'sale' && p.lease_tenure && <span className="text-[#2b5843]/70">{p.lease_tenure}</span>}
                            {p.top_year && <span className="text-[#2b5843]/70">{p.top_year}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                            {p.site_plan_url && (
                              <button type="button" onClick={() => setLightboxImage(p.site_plan_url!)} className="text-emerald-600 hover:underline font-medium">{t('clientView.sitePlan')}</button>
                            )}
                            {p.link && (
                              <a href={p.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">{t('clientView.viewProperty')}</a>
                            )}
                            <a href={getGoogleMapsSearchUrl(p.title)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 text-sm hover:underline font-medium">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                              </svg>
                              {t('clientView.mapNav')}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {history.length === 0 ? (
                <p className="text-slate-500 text-sm">{t('clientView.noHistory')}</p>
              ) : (
                <div className="space-y-2">
                  {historyDates.map((dateStr) => {
                    const list = historyByDate[dateStr]
                    const isCollapsed = collapsedDates.has(dateStr)
                    const dateLabel = new Date(dateStr).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
                    return (
                      <div key={dateStr} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => toggleDate(dateStr)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <span className="font-medium text-slate-800">{dateLabel}</span>
                          <span className="text-slate-500 text-sm">{t('clientView.propertiesCount', { count: list.length })}</span>
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
        )}
      </main>

      {noteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('clientView.addNoteTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900 mb-3">{t('clientView.addNoteTitle')}</h3>
            <textarea
              value={noteModal.content}
              onChange={(e) => setNoteModal((m) => m && { ...m, content: e.target.value })}
              placeholder={t('clientView.notePlaceholder')}
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
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('lightbox.title')}
          className="fixed inset-0 z-50 flex items-center justify-center glass-overlay-dark p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
            aria-label={t('common.close')}
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt={t('lightbox.alt')}
            className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showMapModal && (
        <MapViewModal
          properties={mapProperties}
          onClose={() => setShowMapModal(false)}
          title={t('clientView.viewAllOnMapTitle')}
        />
      )}
    </div>
  )
}
