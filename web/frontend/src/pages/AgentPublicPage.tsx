import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getWhatsAppChatUrl, getTelUrl } from '@/lib/whatsapp'
import { getGoogleMapsSearchUrl } from '@/lib/mapUtils'
import { formatPriceDisplay, getDisplayName } from '@/types'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

type AgentData = {
  id: string
  family_name: string | null
  given_name: string | null
  company: string | null
  avatar_url: string | null
  phone: string | null
}

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

type AgentListingsData = {
  agent: AgentData | null
  properties: PropertyData[]
  error?: string
}

function displayImages(p: PropertyData): string[] {
  if (!p) return []
  const urls = Array.isArray(p.image_urls) ? p.image_urls : []
  if (urls.length >= 2) return urls.slice(0, 2)
  if (urls.length === 1 && p.main_image_url && urls[0] !== p.main_image_url) return [urls[0], p.main_image_url]
  if (urls.length === 1) return urls
  if (p.main_image_url) return [p.main_image_url]
  return []
}

export default function AgentPublicPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const { t } = useTranslation()
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'rent'>('all')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-listings', inviteCode],
    queryFn: async (): Promise<AgentListingsData> => {
      const { data: result, error: rpcError } = await supabase.rpc('get_agent_listings', {
        p_invite_code: inviteCode ?? '',
      })
      if (rpcError) throw rpcError
      const resolved = Array.isArray(result) && result.length > 0 ? result[0] : result
      return resolved as AgentListingsData
    },
    enabled: !!inviteCode,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-[#53868e]/30 border-t-[#53868e] animate-spin" />
        </div>
        <p className="text-[#2b5843]/70 text-sm">{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !data || data.error === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col px-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <header className="py-4 flex justify-end">
          <LanguageSwitcher zen />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#2b5843]/90">{t('agentPublic.notFound')}</p>
            <p className="text-[#2b5843]/60 text-sm mt-2">{t('agentPublic.notFoundHint')}</p>
            <Link to="/" className="mt-4 inline-block text-[#53868e] hover:underline font-medium">
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { agent, properties: rawProperties } = data
  const properties = Array.isArray(rawProperties) ? rawProperties : []
  const filteredProperties =
    filterType === 'all'
      ? properties
      : properties.filter((p) => p.listing_type === filterType)

  const displayName = agent ? getDisplayName(agent) : ''
  const agentPhone = agent?.phone ?? ''
  const agentWhatsAppUrl = agentPhone ? getWhatsAppChatUrl(agentPhone) : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-[#53868e]/20" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #f0ebe8 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-medium text-[#2b5843] hover:opacity-80 transition-opacity">
            propsuite.tech
          </Link>
          <LanguageSwitcher zen />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Agent info */}
        <section className="mb-8 p-6 rounded-2xl border border-[#53868e]/25" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {agent?.avatar_url ? (
              <img src={agent.avatar_url} alt={displayName} className="w-20 h-20 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium text-[#53868e] shrink-0" style={{ background: 'rgba(83,134,142,0.2)' }}>
                {(displayName || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-semibold text-[#2b5843]">{displayName || t('agentPublic.agent')}</h1>
              {agent?.company && <p className="text-sm text-[#2b5843]/80 mt-1">{agent.company}</p>}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {agentWhatsAppUrl && (
                  <a
                    href={agentWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#25D366] text-white hover:bg-[#20BD5A] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    {t('agentPublic.whatsapp')}
                  </a>
                )}
                {agentPhone && (
                  <a
                    href={getTelUrl(agentPhone)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-[#53868e]/30 text-[#2b5843] hover:bg-[#53868e]/10 transition-colors"
                  >
                    {t('agentPublic.call')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'sale', 'rent'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterType(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filterType === key
                  ? 'text-[#f6f3f1]'
                  : 'text-[#2b5843]/80 hover:text-[#2b5843] bg-transparent border border-[#53868e]/25'
              }`}
              style={filterType === key ? { background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' } : undefined}
            >
              {key === 'all' ? t('agentPublic.filterAll') : key === 'sale' ? t('clientView.sale') : t('clientView.rent')}
            </button>
          ))}
        </div>

        {/* Property grid */}
        {filteredProperties.length === 0 ? (
          <div className="py-16 text-center text-[#2b5843]/70">
            <p>{t('agentPublic.noListings')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredProperties.map((p) => {
              const imgs = displayImages(p)
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-xl shadow-sm border border-[#53868e]/20 hover:shadow-md transition-shadow"
                  style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
                >
                  <div className="flex flex-col">
                    <div className="flex gap-0.5 p-2" style={{ background: 'rgba(83,134,142,0.08)' }}>
                      {imgs[0] ? (
                        <button
                          type="button"
                          onClick={() => setLightboxImage(imgs[0])}
                          className="block w-full aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left"
                        >
                          <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <div className="w-full aspect-[4/3] rounded-lg flex items-center justify-center text-[#2b5843]/50 text-xs" style={{ background: 'rgba(83,134,142,0.15)' }}>
                          {t('common.noImage')}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <p className="font-semibold text-base leading-tight break-words text-[#2b5843]">{p.title}</p>
                          {p.listing_type && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${p.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {p.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                            </span>
                          )}
                        </div>
                        {formatPriceDisplay(p) && (
                          <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(p)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
                        {p.bedrooms && <span>{p.bedrooms}</span>}
                        {p.bathrooms && <span>{p.bathrooms}</span>}
                        {(p.size_sqft || p.basic_info) && <span>{p.size_sqft || p.basic_info}</span>}
                        {p.listing_type === 'sale' && p.lease_tenure && <span className="text-[#2b5843]/70">{p.lease_tenure}</span>}
                        {p.top_year && <span className="text-[#2b5843]/70">{p.top_year}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                        {p.site_plan_url && (
                          <button
                            type="button"
                            onClick={() => setLightboxImage(p.site_plan_url!)}
                            className="text-emerald-600 hover:underline font-medium"
                          >
                            {t('clientView.sitePlan')}
                          </button>
                        )}
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">
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
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt={t('lightbox.alt')}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
