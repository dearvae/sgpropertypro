import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getTelUrl } from '@/lib/whatsapp'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

type InviteRelation = {
  id: string
  email: string | null
  display_name: string | null
  phone: string | null
  invite_code: string | null
  invited_by_id: string | null
  inviter_display_name: string | null
  inviter_email: string | null
  verification_status: string
  created_at: string
}

type ScrapeFailure = {
  id: string
  property_id: string
  property_title: string
  source_url: string
  error_message: string
  error_type: string | null
  created_at: string
}

type ScrapeRun = {
  id: string
  property_id: string | null
  property_title: string
  source_url: string
  scrape_type: string
  operator_id: string | null
  operator_display_name: string | null
  started_at: string
  duration_ms: number | null
  result: string
  error_message: string | null
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const isAdmin = profile?.is_admin === true || profile?.is_super_admin === true

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['admin-invite-relations', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc('admin_get_invite_relations')
      if (err) throw err
      return (data ?? []) as InviteRelation[]
    },
    enabled: !!user && isAdmin,
  })

  const { data: scrapeFailures, isLoading: scrapeFailuresLoading } = useQuery({
    queryKey: ['admin-scrape-failures', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc('admin_get_scrape_failures')
      if (err) throw err
      return (data ?? []) as ScrapeFailure[]
    },
    enabled: !!user && isAdmin,
  })

  const { data: scrapeRuns, isLoading: scrapeRunsLoading } = useQuery({
    queryKey: ['admin-scrape-runs', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc('admin_get_scrape_runs')
      if (err) throw err
      return (data ?? []) as ScrapeRun[]
    },
    enabled: !!user && isAdmin,
  })

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <p className="text-[#2b5843]/70">{t('common.loading')}</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="text-center p-6 rounded-2xl border border-[#53868e]/25" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <p className="text-[#2b5843]/80 mb-4">{t('admin.forbidden')}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm rounded-full hover:opacity-95 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)', color: '#f6f3f1' }}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-medium text-[#2b5843] mb-6">{t('admin.title')}</h1>
        <p className="text-sm text-[#2b5843]/70 mb-6">{t('admin.desc')}</p>

        {isLoading && <p className="text-[#2b5843]/70">{t('common.loading')}</p>}
        {error && <p className="text-red-600">{String(error)}</p>}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto border border-[#53868e]/25 rounded-2xl" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>
                  <th className="text-left p-3 font-medium text-[#2b5843]">{t('admin.user')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.email')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.phone')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.inviteCode')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.invitedBy')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.verificationStatus')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.registeredAt')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#53868e]/10 hover:bg-[#53868e]/5">
                    <td className="p-3">{r.display_name || '-'}</td>
                    <td className="p-3">{r.email || '-'}</td>
                    <td className="p-3">
                      {r.phone ? (
                        <a href={getTelUrl(r.phone)} className="text-[#53868e] hover:text-[#2b5843] hover:underline">
                          {r.phone}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 font-mono">{r.invite_code || '-'}</td>
                    <td className="p-3">
                      {r.inviter_display_name || r.inviter_email ? (
                        <span title={r.inviter_email ?? ''}>
                          {r.inviter_display_name || r.inviter_email || '-'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3">{r.verification_status}</td>
                    <td className="p-3 text-[#2b5843]/70">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && rows.length === 0 && !isLoading && (
          <p className="text-[#2b5843]/70">{t('admin.noData')}</p>
        )}

        <h2 className="text-xl font-medium text-[#2b5843] mt-10 mb-3">{t('admin.scrapeFailures')}</h2>
        <p className="text-sm text-[#2b5843]/70 mb-4">{t('admin.scrapeFailuresDesc')}</p>

        {scrapeFailuresLoading && <p className="text-[#2b5843]/70">{t('common.loading')}</p>}

        {scrapeFailures && scrapeFailures.length > 0 && (
          <div className="overflow-x-auto border border-[#53868e]/25 rounded-2xl" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>
                  <th className="text-left p-3 font-medium text-[#2b5843]">{t('admin.propertyTitle')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.link')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.errorMessage')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.failedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {scrapeFailures.map((f) => (
                  <tr key={f.id} className="border-b border-[#53868e]/10 hover:bg-[#53868e]/5">
                    <td className="p-3 max-w-[200px] truncate" title={f.property_title}>{f.property_title || '-'}</td>
                    <td className="p-3 max-w-[220px]">
                      <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="text-[#53868e] hover:underline truncate block" title={f.source_url}>
                        {f.source_url.replace(/^https?:\/\//, '').length > 48
                          ? f.source_url.replace(/^https?:\/\//, '').slice(0, 45) + '...'
                          : f.source_url.replace(/^https?:\/\//, '')}
                      </a>
                    </td>
                    <td className="p-3 max-w-[300px] text-red-600/90" title={f.error_message}>
                      {f.error_message.length > 80 ? f.error_message.slice(0, 80) + '...' : f.error_message}
                    </td>
                    <td className="p-3 text-[#2b5843]/70 whitespace-nowrap">
                      {f.created_at ? new Date(f.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scrapeFailures && scrapeFailures.length === 0 && !scrapeFailuresLoading && (
          <p className="text-[#2b5843]/70">{t('admin.noScrapeFailures')}</p>
        )}

        <h2 className="text-xl font-medium text-[#2b5843] mt-10 mb-3">{t('admin.scrapeRuns')}</h2>
        <p className="text-sm text-[#2b5843]/70 mb-4">{t('admin.scrapeRunsDesc')}</p>

        {scrapeRunsLoading && <p className="text-[#2b5843]/70">{t('common.loading')}</p>}

        {scrapeRuns && scrapeRuns.length > 0 && (
          <div className="overflow-x-auto border border-[#53868e]/25 rounded-2xl" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#53868e]/20" style={{ background: 'rgba(83,134,142,0.08)' }}>
                  <th className="text-left p-3 font-medium text-[#2b5843]">{t('admin.propertyTitle')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.link')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.scrapeType')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.operator')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.startedAt')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.duration')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.result')}</th>
                  <th className="text-left p-3 font-medium">{t('admin.errorMessage')}</th>
                </tr>
              </thead>
              <tbody>
                {scrapeRuns.map((r) => (
                  <tr key={r.id} className="border-b border-[#53868e]/10 hover:bg-[#53868e]/5">
                    <td className="p-3 max-w-[180px] truncate" title={r.property_title}>{r.property_title || '-'}</td>
                    <td className="p-3 max-w-[200px]">
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[#53868e] hover:underline truncate block" title={r.source_url}>
                        {r.source_url.replace(/^https?:\/\//, '').length > 40
                          ? r.source_url.replace(/^https?:\/\//, '').slice(0, 37) + '...'
                          : r.source_url.replace(/^https?:\/\//, '')}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {r.scrape_type === 'sync' ? t('admin.scrapeTypeSync')
                        : r.scrape_type === 'trigger' ? t('admin.scrapeTypeTrigger')
                        : r.scrape_type === 'batch' ? t('admin.scrapeTypeBatch')
                        : r.scrape_type === 'add_listing' ? t('admin.scrapeTypeAddListing')
                        : r.scrape_type}
                    </td>
                    <td className="p-3">{r.operator_display_name || '-'}</td>
                    <td className="p-3 text-[#2b5843]/70 whitespace-nowrap">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '-'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)} ${t('admin.durationUnit')}` : '-'}
                    </td>
                    <td className="p-3">
                      <span className={r.result === 'success' ? 'text-green-600' : 'text-red-600'}>
                        {r.result === 'success' ? t('admin.resultSuccess') : t('admin.resultFailure')}
                      </span>
                    </td>
                    <td className="p-3 max-w-[220px] text-red-600/90 truncate" title={r.error_message || ''}>
                      {r.error_message ? (r.error_message.length > 50 ? r.error_message.slice(0, 50) + '...' : r.error_message) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scrapeRuns && scrapeRuns.length === 0 && !scrapeRunsLoading && (
          <p className="text-[#2b5843]/70">{t('admin.noScrapeRuns')}</p>
        )}
      </div>
    </div>
  )
}
