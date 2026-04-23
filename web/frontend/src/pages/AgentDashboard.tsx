import { useState, useMemo, useEffect, useRef } from 'react'
import { message, Popconfirm } from 'antd'
import { useTranslation } from 'react-i18next'
import { UserMenu } from '@/components/UserMenu'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useCustomerGroups } from '@/hooks/useCustomerGroups'
import { useClientSelfGroup } from '@/hooks/useClientSelfGroup'
import { useProperties } from '@/hooks/useProperties'
import { useAppointments } from '@/hooks/useAppointments'
import { usePendingAppointments } from '@/hooks/usePendingAppointments'
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments'
import { checkAppointmentConflict } from '@/lib/conflictCheck'
import { triggerScrapeAsync, batchScrapeProperties } from '@/lib/scrapeApi'
import { CreateClientModal } from '@/components/CreateClientModal'
import { AddListingModal } from '@/components/AddListingModal'
import { getWhatsAppChatUrl, getTelUrl } from '@/lib/whatsapp'
import { buildDayDisplayItems, getSavedSellerMergedVariant } from '@/lib/sellerMergedBlocks'
import { SellerMergedCard } from '@/components/SellerLandlordMergedCard'
import {
  applyTemplate,
  buildTemplateVars,
  extractProjectOrLocation,
  getDefaultWhatsAppTemplate,
} from '@/lib/whatsappTemplate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { AgentFeedbackSection } from '@/pages/AgentFeedback'
import { AddCustomEventModal } from '@/components/AddCustomEventModal'
import { getCustomEvents, addCustomEvent, updateCustomEvent, deleteCustomEvent } from '@/lib/scheduleCustomEvents'
import type { CustomerGroup, PartyRole, Property, Appointment, PendingAppointment, PendingAppointmentStatus, ClientFeedback } from '@/types'
import { formatPriceDisplay } from '@/types'

function usePartyRoleLabels() {
  const { t } = useTranslation()
  return {
    buyer: t('partyRole.buyer'),
    seller: t('partyRole.seller'),
    tenant: t('partyRole.tenant'),
    landlord: t('partyRole.landlord'),
  } as Record<PartyRole, string>
}

function usePendingStatusOptions() {
  const { t } = useTranslation()
  return [
    { value: 'not_scheduled' as PendingAppointmentStatus, label: t('pendingStatus.not_scheduled') },
    { value: 'to_consult' as PendingAppointmentStatus, label: t('pendingStatus.to_consult') },
    { value: 'consulted' as PendingAppointmentStatus, label: t('pendingStatus.consulted') },
    { value: 'awaiting_agent_reply' as PendingAppointmentStatus, label: t('pendingStatus.awaiting_agent_reply') },
  ]
}

type DashboardTab = 'groups' | 'appointments' | 'pending' | 'schedule' | 'feedback'

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export default function AgentDashboard({ clientMode = false }: { clientMode?: boolean }) {
  const { t } = useTranslation()
  const defaultTab: DashboardTab = clientMode ? 'appointments' : 'groups'
  const [activeTab, setActiveTab] = useState<DashboardTab>(defaultTab)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedPendingGroupId, setSelectedPendingGroupId] = useState<string | null>(null)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [initialAddAppointment, setInitialAddAppointment] = useState<{ propId: string; partyRole: 'seller' | 'landlord' } | null>(null)

  const agentGroups = useCustomerGroups()
  const clientGroups = useClientSelfGroup()
  const groups = clientMode ? clientGroups : agentGroups
  const selfGroupId = clientMode ? clientGroups.selfGroup?.id ?? null : null

  const properties = useProperties()
  const effectiveGroupId = clientMode ? selfGroupId : selectedGroupId
  const appointments = useAppointments(effectiveGroupId || undefined)
  const allAppointments = useAppointments() // 用于冲突预检（需检查同一 agent 下全部预约）
  const effectivePendingGroupId = clientMode ? selfGroupId : selectedPendingGroupId
  const pendingAppointments = usePendingAppointments(effectivePendingGroupId || undefined)
  useRealtimeAppointments(effectiveGroupId || undefined)

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/view/` : ''

  const tabList: DashboardTab[] = clientMode
    ? (['appointments', 'pending', 'schedule', 'feedback'] as const)
    : (['groups', 'appointments', 'pending', 'schedule', 'feedback'] as const)

  const pageTitle = clientMode ? t('landing.myViewings') : t('app.title')

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <header className="border-b border-[#53868e]/20 rounded-b-2xl mx-4 mt-2 sm:mx-6" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #ebece8 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="sm:hidden p-2 -ml-2 rounded-lg text-[#2b5843] hover:bg-[#53868e]/10 transition-colors"
              aria-label={t('dashboard.menu')}
            >
              <HamburgerIcon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-medium text-[#2b5843] truncate">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher zen />
            <UserMenu />
          </div>
        </div>
        {/* 桌面端：横向 tab */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 overflow-x-auto -mx-4 sm:mx-0 sm:overflow-visible hidden sm:block">
          <div className="flex gap-1 border-t border-[#53868e]/10 min-w-max sm:min-w-0 px-4 sm:px-0">
          {tabList.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm -mb-px border-b-2 transition-colors rounded-t-lg ${
                activeTab === tab
                  ? 'border-[#53868e] text-[#2b5843]'
                  : 'border-transparent text-[#2b5843]/60 hover:text-[#2b5843]'
              }`}
            >
              {tab === 'groups' && t('dashboard.groups')}
              {tab === 'appointments' && t('dashboard.appointments')}
              {tab === 'pending' && t('dashboard.pending')}
              {tab === 'schedule' && t('dashboard.schedule')}
              {tab === 'feedback' && t('dashboard.feedback')}
            </button>
          ))}
          </div>
        </div>
      </header>

      {/* 手机端：汉堡菜单展开的垂直选项 */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
          <div
            className="fixed top-0 left-4 right-4 z-50 sm:hidden pt-14 pb-6 px-4 rounded-b-2xl shadow-xl"
            style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #ebece8 100%)' }}
          >
            <div className="flex flex-col gap-0 border-t border-[#53868e]/10">
              {tabList.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab)
                    setMobileMenuOpen(false)
                  }}
                  className={`px-4 py-4 text-left text-base border-b border-[#53868e]/10 last:border-b-0 transition-colors ${
                    activeTab === tab
                      ? 'text-[#2b5843] font-medium bg-[#53868e]/10'
                      : 'text-[#2b5843]/80 hover:bg-[#53868e]/5'
                  }`}
                >
                  {tab === 'groups' && t('dashboard.groups')}
                  {tab === 'appointments' && t('dashboard.appointments')}
                  {tab === 'pending' && t('dashboard.pending')}
                  {tab === 'schedule' && t('dashboard.schedule')}
                  {tab === 'feedback' && t('dashboard.feedback')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'groups' && (
          <CustomerGroupsSection
            groups={groups}
            baseUrl={baseUrl}
            properties={properties}
            pendingAppointments={pendingAppointments}
            t={t}
            onQuickAddAppointment={(propId, partyRole) => {
              setInitialAddAppointment({ propId, partyRole })
              setActiveTab('appointments')
              setShowAddAppointment(true)
            }}
          />
        )}
        {activeTab === 'appointments' && (
          <AppointmentsSection
            groups={groups}
            properties={properties}
            appointments={appointments}
            allAppointments={allAppointments}
            selectedGroupId={clientMode ? selfGroupId : selectedGroupId}
            setSelectedGroupId={clientMode ? () => {} : setSelectedGroupId}
            showAddAppointment={showAddAppointment}
            setShowAddAppointment={setShowAddAppointment}
            initialAddAppointment={initialAddAppointment}
            onConsumeInitialAddAppointment={() => setInitialAddAppointment(null)}
            clientMode={clientMode}
          />
        )}
        {activeTab === 'pending' && (
          <PendingAppointmentsSection
            pendingAppointments={pendingAppointments}
            appointments={appointments}
            properties={properties}
            groups={groups}
            baseUrl={baseUrl}
            selectedPendingGroupId={clientMode ? selfGroupId : selectedPendingGroupId}
            setSelectedPendingGroupId={clientMode ? () => {} : setSelectedPendingGroupId}
            clientMode={clientMode}
          />
        )}
        {activeTab === 'schedule' && (
          <AgentScheduleSection appointments={allAppointments} groups={groups} />
        )}
        {activeTab === 'feedback' && <AgentFeedbackSection />}
      </main>
    </div>
  )
}

function CustomerGroupsSection({
  groups,
  baseUrl,
  properties,
  pendingAppointments,
  t,
  onQuickAddAppointment,
}: {
  groups: ReturnType<typeof useCustomerGroups>
  baseUrl: string
  properties: ReturnType<typeof useProperties>
  pendingAppointments: ReturnType<typeof usePendingAppointments>
  t: ReturnType<typeof useTranslation>['t']
  onQuickAddAppointment?: (propId: string, partyRole: 'seller' | 'landlord') => void
}) {
  const { user } = useAuth()
  const [createClientIntent, setCreateClientIntent] = useState<'buy' | 'rent' | null>(null)
  const [createListingType, setCreateListingType] = useState<'sale' | 'rent' | null>(null)
  const [addPendingForGroupId, setAddPendingForGroupId] = useState<string | null>(null)
  const [addPendingLink, setAddPendingLink] = useState('')
  const [addPendingNotes, setAddPendingNotes] = useState('')
  const [addPendingLoading, setAddPendingLoading] = useState(false)
  const [addPendingError, setAddPendingError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIntent, setEditIntent] = useState<'buy' | 'rent'>('buy')
  const [confirmInactiveId, setConfirmInactiveId] = useState<string | null>(null)
  const [confirmResetTokenId, setConfirmResetTokenId] = useState<string | null>(null)
  const [menuOpenGroupId, setMenuOpenGroupId] = useState<string | null>(null)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [groupFilter, setGroupFilter] = useState<'all' | 'buy' | 'rent' | 'sale' | 'rent_out'>('all')
  const addDropdownRef = useRef<HTMLDivElement>(null)

  const filteredClientGroups = useMemo(() => {
    const list = groups.data?.filter((g) => g.group_type !== 'listing') ?? []
    if (groupFilter === 'all') return list
    if (groupFilter === 'buy') return list.filter((g) => g.intent === 'buy')
    if (groupFilter === 'rent') return list.filter((g) => g.intent === 'rent')
    return list
  }, [groups.data, groupFilter])

  const filteredListingGroups = useMemo(() => {
    const list = groups.data?.filter((g) => g.group_type === 'listing') ?? []
    if (groupFilter === 'all') return list
    if (groupFilter === 'sale') return list.filter((g) => g.intent === 'sale')
    if (groupFilter === 'rent_out') return list.filter((g) => g.intent === 'rent')
    return []
  }, [groups.data, groupFilter])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false)
      }
    }
    if (showAddDropdown) {
      document.addEventListener('click', fn)
      return () => document.removeEventListener('click', fn)
    }
  }, [showAddDropdown])

  const handleCreateClient = async (name: string, description: string) => {
    if (!createClientIntent) return
    await groups.create.mutateAsync({ name, description: description || undefined, intent: createClientIntent })
  }

  const handleListingSuccess = () => {
    groups.refetch()
    properties.refetch()
    message.success(t('dashboard.addListingSuccess'))
  }

  const handleStartEdit = (g: { id: string; name: string; intent: 'buy' | 'rent' | 'sale' | null }) => {
    setEditingId(g.id)
    setEditName(g.name)
    setEditIntent((g.intent === 'rent' || g.intent === 'buy' ? g.intent : 'buy') as 'buy' | 'rent')
  }

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return
    const g = groups.data?.find((x) => x.id === editingId)
    try {
      if (g?.group_type === 'listing') {
        await groups.update.mutateAsync({ id: editingId, name: editName.trim() })
      } else {
        await groups.update.mutateAsync({ id: editingId, name: editName.trim(), intent: editIntent })
      }
      setEditingId(null)
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const handleSetInactive = async (id: string) => {
    try {
      await groups.update.mutateAsync({ id, is_active: false })
      setConfirmInactiveId(null)
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      await groups.update.mutateAsync({ id, is_active: true })
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const handleResetTokens = async (groupId: string) => {
    try {
      const result = await groups.resetTokens.mutateAsync(groupId)
      setConfirmResetTokenId(null)
      navigator.clipboard.writeText(`${baseUrl}${result.share_token}`)
      message.success(t('dashboard.resetTokenSuccess'))
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const parsePropertyLinks = (text: string): string[] => {
    const raw = text.split(/[\s\n]+/).map((s) => s.trim()).filter(Boolean)
    return [...new Set(raw.map((s) => normalizeSourceUrl(s)).filter((u) => u && isSupportedScrapeUrl(u)))]
  }

  const handleAddPending = async () => {
    if (!addPendingForGroupId || !addPendingLink.trim()) {
      setAddPendingError(t('dashboard.enterPropertyLink'))
      return
    }
    if (!user?.id) {
      setAddPendingError(t('common.pleaseLogin') || '请先登录')
      return
    }
    const urls = parsePropertyLinks(addPendingLink)
    if (urls.length === 0) {
      setAddPendingError(t('dashboard.propertyLinkOnly'))
      return
    }
    setAddPendingError(null)
    setAddPendingLoading(true)
    const groupId = addPendingForGroupId
    const existingPending = new Set(
      (pendingAppointments.data ?? [])
        .filter((p) => p.customer_group_id === groupId)
        .map((p) => (p.properties as Property)?.source_url || (p.properties as Property)?.link)
    )
    const urlsToAdd = urls.filter((u) => !existingPending.has(u))
    if (urlsToAdd.length === 0) {
      setAddPendingLoading(false)
      return
    }
    try {
      const res = await batchScrapeProperties({
        urls: urlsToAdd,
        agent_id: user.id,
        customer_group_id: groupId,
        notes: addPendingNotes.trim() || undefined,
      })
      pendingAppointments.refetch()
      properties.refetch()
      if (res.added > 0) {
        message.success(t('pendingSection.batchAddSuccess', { count: res.added }))
        message.info(t('common.asyncScrapeHint'), 5)
      }
      setAddPendingForGroupId(null)
      setAddPendingLink('')
      setAddPendingNotes('')
    } catch (e) {
      setAddPendingError((e as Error).message)
    } finally {
      setAddPendingLoading(false)
    }
  }

  return (
    <section>
      <div className="mb-6 flex justify-end" ref={addDropdownRef}>
        <div className="relative">
          <button
            onClick={() => setShowAddDropdown((v) => !v)}
            className="text-sm border border-[#53868e]/35 rounded-xl px-4 py-2 hover:bg-[#53868e]/15"
          >
            {t('dashboard.addNewClient')}
          </button>
          {showAddDropdown && (
            <div className="absolute right-0 top-full mt-1 z-40 min-w-[180px] py-1 rounded-xl border border-[#53868e]/25 bg-[#f6f3f1] shadow-lg">
              <button
                onClick={() => { setShowAddDropdown(false); setCreateClientIntent('buy') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[#53868e]/15"
              >
                {t('dashboard.addBuyer')}
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); setCreateClientIntent('rent') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[#53868e]/15"
              >
                {t('dashboard.addTenant')}
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); setCreateListingType('sale') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[#53868e]/15"
              >
                {t('dashboard.addPropertySale')}
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); setCreateListingType('rent') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[#53868e]/15"
              >
                {t('dashboard.addPropertyRent')}
              </button>
            </div>
          )}
        </div>
      </div>

      {createClientIntent && (
        <CreateClientModal
          open
          onClose={() => setCreateClientIntent(null)}
          intent={createClientIntent}
          onSubmit={async (name, description) => {
            await handleCreateClient(name, description)
          }}
          isPending={groups.create.isPending}
        />
      )}

      {createListingType && user?.id && (
        <AddListingModal
          open
          onClose={() => setCreateListingType(null)}
          listingType={createListingType}
          agentId={user.id}
          onSuccess={handleListingSuccess}
        />
      )}

      <div className="flex flex-wrap gap-1.5 mb-4 pb-2 border-b border-[#53868e]/15">
        {(['all', 'buy', 'rent', 'sale', 'rent_out'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setGroupFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              groupFilter === f
                ? 'bg-[#53868e] text-white'
                : 'border border-[#53868e]/25 text-[#2b5843]/80 hover:bg-[#53868e]/10 hover:text-[#2b5843]'
            }`}
          >
            {f === 'all' && t('dashboard.filterAll')}
            {f === 'buy' && t('dashboard.filterBuy')}
            {f === 'rent' && t('dashboard.filterRent')}
            {f === 'sale' && t('dashboard.filterSale')}
            {f === 'rent_out' && t('dashboard.filterRentOut')}
          </button>
        ))}
      </div>

      {addPendingForGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setAddPendingForGroupId(null); setAddPendingError(null) }}>
          <div
            className="bg-[#f6f3f1] rounded-xl shadow-lg p-6 w-full max-w-md mx-4 border border-[#53868e]/25"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#2b5843] mb-3">
              {t('dashboard.addPending')} · {groups.data?.find((g) => g.id === addPendingForGroupId)?.name ?? ''}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('dashboard.propertyLink')}</label>
                <textarea
                  value={addPendingLink}
                  onChange={(e) => { setAddPendingLink(e.target.value); setAddPendingError(null) }}
                  placeholder={t('dashboard.propertyLinkPlaceholder')}
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-y"
                  autoFocus
                />
                <p className="text-xs text-[#2b5843]/70 mt-1">{t('dashboard.propertyLinksMultiHint')}</p>
              </div>
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('dashboard.notesOptional')}</label>
                <input
                  value={addPendingNotes}
                  onChange={(e) => setAddPendingNotes(e.target.value)}
                  placeholder={t('dashboard.notesPlaceholder')}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                />
              </div>
              {addPendingError && <p className="text-xs text-red-600">{addPendingError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddPending}
                disabled={addPendingLoading}
                className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50 flex items-center gap-2"
              >
                {addPendingLoading && (
                  <svg className="animate-spin h-4 w-4 text-[#2b5843]/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {t('common.add')}
              </button>
              <button
                onClick={() => { setAddPendingForGroupId(null); setAddPendingError(null) }}
                className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredClientGroups.map((g) => (
          <div
            key={g.id}
            className="border border-[#53868e]/25 rounded-lg bg-[#f6f3f1] p-4 flex flex-col gap-4 shadow-md hover:shadow-lg transition-shadow min-w-0"
          >
            {editingId === g.id ? (
              <div className="flex flex-col gap-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#53868e]/25 rounded-md text-sm"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name={`edit-intent-${g.id}`} checked={editIntent === 'buy'} onChange={() => setEditIntent('buy')} />
                    {t('dashboard.buy')}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" name={`edit-intent-${g.id}`} checked={editIntent === 'rent'} onChange={() => setEditIntent('rent')} />
                    {t('dashboard.rent')}
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="text-sm text-[#2b5843]/80 px-3 py-1.5 border border-[#53868e]/25 rounded-md hover:bg-[#53868e]/10">{t('common.save')}</button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-[#2b5843]/60 hover:text-[#2b5843]/80">{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-medium text-[#2b5843] text-sm truncate">{g.name}</p>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${g.intent === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {g.intent === 'rent' ? t('dashboard.rent') : t('dashboard.buy')}
                      </span>
                      {g.is_active === false && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-[#53868e]/15 text-[#2b5843]/80">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenGroupId(menuOpenGroupId === g.id ? null : g.id) }}
                        className="p-1 rounded hover:bg-[#53868e]/15 text-[#2b5843]/70 hover:text-[#2b5843]/90"
                        aria-label="更多选项"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {menuOpenGroupId === g.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpenGroupId(null)} />
                          <div className="absolute right-0 top-full mt-0.5 py-1 bg-[#f6f3f1] rounded-md shadow-lg border border-[#53868e]/25 z-50 min-w-[160px]">
                            {g.is_active !== false && (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); handleStartEdit(g) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                              >
                                {t('common.edit')}
                              </button>
                            )}
                            <button
                              onClick={() => { setMenuOpenGroupId(null); navigator.clipboard.writeText(`${baseUrl}${g.share_token}`); message.success(t('dashboard.viewLinkCopied')) }}
                              className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                            >
                              {t('dashboard.copyViewLink')}
                            </button>
                            {g.is_active !== false ? (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); setConfirmInactiveId(g.id) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                              >
                                {t('dashboard.setInactive')}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); handleSetActive(g.id) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-emerald-600 hover:bg-[#53868e]/10"
                              >
                                {t('dashboard.setActive')}
                              </button>
                            )}
                            <button
                              onClick={() => { setMenuOpenGroupId(null); setConfirmResetTokenId(g.id) }}
                              className="block w-full text-left px-3 py-1.5 text-sm text-[#53868e] hover:bg-[#53868e]/10"
                            >
                              {t('dashboard.resetToken')}
                            </button>
                            <Popconfirm
                              title={t('dashboard.deleteGroupConfirm')}
                              onConfirm={() => { setMenuOpenGroupId(null); groups.remove.mutate(g.id) }}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              icon={null}
                            >
                              <button
                                onClick={() => setMenuOpenGroupId(null)}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/60 hover:text-red-600"
                              >
                                {t('common.delete')}
                              </button>
                            </Popconfirm>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {g.description && <p className="text-[#2b5843]/80 text-xs mt-1 line-clamp-2">{g.description}</p>}
                </div>
                <div className="flex flex-col gap-1.5 border-t border-[#53868e]/15 pt-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${baseUrl}${g.share_token_edit ?? g.share_token}`)
                      message.success(t('dashboard.editLinkCopied'))
                    }}
                    className="text-left text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90 py-1"
                  >
                    {t('dashboard.copyEditLink')}
                  </button>
                  {g.is_active !== false && (
                    <button
                      onClick={() => { setMenuOpenGroupId(null); setAddPendingForGroupId(g.id) }}
                      className="text-left text-sm text-[#53868e] hover:text-[#2b5843] py-1"
                    >
                      {t('dashboard.addPending')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {filteredListingGroups.map((g) => {
          const prop = g.property_id ? (properties.data ?? []).find((p) => p.id === g.property_id) : undefined
          const displayImages = (p: Property | undefined): string[] => {
            if (!p) return []
            const urls = Array.isArray(p.image_urls) ? p.image_urls : []
            let base: string[] = urls.length >= 2 ? urls.slice(0, 2) : urls.length === 1 && p.main_image_url && urls[0] !== p.main_image_url ? [urls[0], p.main_image_url] : urls.length === 1 ? urls : p.main_image_url ? [p.main_image_url] : []
            if (p.floor_plan_url && !base.includes(p.floor_plan_url)) base = [...base, p.floor_plan_url].slice(0, 3)
            return base
          }
          const imgs = displayImages(prop)
          const isSale = g.intent === 'sale'
          return (
            <div
              key={g.id}
              className="border border-[#53868e]/25 rounded-lg bg-[#f6f3f1] p-4 flex flex-col gap-4 shadow-md hover:shadow-lg transition-shadow min-w-0 overflow-hidden"
            >
              {editingId === g.id ? (
                <div className="flex flex-col gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('dashboard.addListingClientNamePlaceholder')}
                    className="w-full px-3 py-2 border border-[#53868e]/25 rounded-md text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} className="text-sm text-[#2b5843]/80 px-3 py-1.5 border border-[#53868e]/25 rounded-md hover:bg-[#53868e]/10">{t('common.save')}</button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-[#2b5843]/60 hover:text-[#2b5843]/80">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-0">
                <div className={`flex flex-col w-full sm:w-[120px] flex-shrink-0 gap-0.5 p-2 bg-[#53868e]/5 rounded-lg ${imgs.length <= 1 ? 'justify-center' : ''}`}>
                  {imgs[0] ? (
                    <img src={imgs[0]} alt={prop?.title ?? ''} className="w-full aspect-[4/3] object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-20 rounded-lg bg-[#53868e]/15 flex items-center justify-center text-[#2b5843]/60 text-xs">{t('common.noImage')}</div>
                  )}
                  {imgs[1] && <img src={imgs[1]} alt={t('clientView.floorPlan')} className="w-full aspect-[4/3] object-contain rounded-lg mt-0.5" />}
                  {imgs[2] && <img src={imgs[2]} alt={t('clientView.floorPlan')} className="w-full aspect-[4/3] object-contain rounded-lg mt-0.5" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-medium text-[#2b5843] text-sm truncate">{prop?.title ?? g.name ?? '—'}</p>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${isSale ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {isSale ? t('clientView.sale') : t('clientView.rent')}
                      </span>
                      {g.is_active === false && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-[#53868e]/15 text-[#2b5843]/80">inactive</span>
                      )}
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenGroupId(menuOpenGroupId === g.id ? null : g.id) }}
                        className="p-1 rounded hover:bg-[#53868e]/15 text-[#2b5843]/70"
                        aria-label="更多选项"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {menuOpenGroupId === g.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpenGroupId(null)} />
                          <div className="absolute right-0 top-full mt-0.5 py-1 bg-[#f6f3f1] rounded-md shadow-lg border border-[#53868e]/25 z-50 min-w-[160px]">
                            {g.is_active !== false && (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); handleStartEdit(g) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                              >
                                {t('common.edit')}
                              </button>
                            )}
                            <button
                              onClick={() => { setMenuOpenGroupId(null); navigator.clipboard.writeText(`${baseUrl}${g.share_token}`); message.success(t('dashboard.viewLinkCopied')) }}
                              className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                            >
                              {t('dashboard.copyViewLink')}
                            </button>
                            {g.is_active !== false ? (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); setConfirmInactiveId(g.id) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10"
                              >
                                {t('dashboard.setInactive')}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setMenuOpenGroupId(null); handleSetActive(g.id) }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-emerald-600 hover:bg-[#53868e]/10"
                              >
                                {t('dashboard.setActive')}
                              </button>
                            )}
                            <button
                              onClick={() => { setMenuOpenGroupId(null); setConfirmResetTokenId(g.id) }}
                              className="block w-full text-left px-3 py-1.5 text-sm text-[#53868e] hover:bg-[#53868e]/10"
                            >
                              {t('dashboard.resetToken')}
                            </button>
                            <Popconfirm
                              title={t('dashboard.deleteListingConfirm')}
                              onConfirm={() => { setMenuOpenGroupId(null); groups.remove.mutate(g.id) }}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              icon={null}
                            >
                              <button
                                onClick={() => setMenuOpenGroupId(null)}
                                className="block w-full text-left px-3 py-1.5 text-sm text-[#2b5843]/60 hover:text-red-600"
                              >
                                {t('common.delete')}
                              </button>
                            </Popconfirm>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {formatPriceDisplay(prop!) && <span className="font-medium text-emerald-700 text-sm">{formatPriceDisplay(prop!)}</span>}
                  {(prop?.bedrooms || prop?.bathrooms || prop?.size_sqft) && (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[#2b5843]/80">
                      {prop?.bedrooms && <span>{prop.bedrooms}</span>}
                      {prop?.bathrooms && <span>{prop.bathrooms}</span>}
                      {prop?.size_sqft && <span>{prop.size_sqft}</span>}
                    </div>
                  )}
                  {(prop?.site_plan_url || prop?.link) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                      {prop?.site_plan_url && (
                        <a href={prop.site_plan_url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{t('clientView.viewSitePlan')}</a>
                      )}
                      {prop?.link && (
                        <a href={prop.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{t('clientView.viewProperty')}</a>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 border-t border-[#53868e]/15 pt-3 mt-1">
                    {g.property_id && onQuickAddAppointment && g.is_active !== false && (
                      <button
                        onClick={() => onQuickAddAppointment(g.property_id!, isSale ? 'seller' : 'landlord')}
                        className="text-left text-sm text-[#53868e] hover:text-[#2b5843] py-1 flex items-center gap-1.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                        {t('dashboard.quickAddAppointment')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${baseUrl}${g.share_token_edit ?? g.share_token}`)
                        message.success(t('dashboard.editLinkCopied'))
                      }}
                      className="text-left text-sm text-[#53868e] hover:text-[#2b5843] py-1"
                    >
                      {t('dashboard.copyEditLink')}
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmInactiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmInactiveId(null)}>
          <div
            className="bg-[#f6f3f1] rounded-xl border border-[#53868e]/25 p-5 w-full max-w-sm shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#2b5843] mb-2">{t('dashboard.inactiveConfirmTitle')}</h3>
            <p className="text-xs text-[#2b5843]/80 mb-4">
              {t('dashboard.inactiveConfirmDesc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmInactiveId && handleSetInactive(confirmInactiveId)}
                className="flex-1 text-sm px-4 py-2 border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={() => setConfirmInactiveId(null)}
                className="text-sm px-4 py-2 border border-[#53868e]/25 rounded-xl hover:bg-[#53868e]/15"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResetTokenId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmResetTokenId(null)}>
          <div
            className="bg-[#f6f3f1] rounded-xl border border-[#53868e]/25 p-5 w-full max-w-sm shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#2b5843] mb-2">{t('dashboard.resetTokenTitle')}</h3>
            <p className="text-xs text-[#2b5843]/80 mb-4">
              {t('dashboard.resetTokenDesc')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmResetTokenId && handleResetTokens(confirmResetTokenId)}
                disabled={groups.resetTokens.isPending}
                className="flex-1 text-sm px-4 py-2 border border-[#53868e]/40 rounded-xl hover:bg-[#53868e]/15 text-[#2b5843] disabled:opacity-50"
              >
                {groups.resetTokens.isPending ? t('common.loading') : t('common.confirm')}
              </button>
              <button
                onClick={() => setConfirmResetTokenId(null)}
                className="text-sm px-4 py-2 border border-[#53868e]/25 rounded-xl hover:bg-[#53868e]/15"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function normalizeSourceUrl(url: string): string {
  let u = url.trim()
  if (!u.startsWith('http')) u = 'https://' + u
  return u.replace(/\/$/, '')
}

const SUPPORTED_SCRAPE_DOMAINS = ['propertyguru.com', 'propertygroup.com']
function isSupportedScrapeUrl(url: string): boolean {
  return SUPPORTED_SCRAPE_DOMAINS.some((d) => url.includes(d))
}

function PendingAppointmentsSection({
  pendingAppointments,
  appointments,
  properties,
  groups,
  baseUrl,
  selectedPendingGroupId,
  setSelectedPendingGroupId,
  clientMode = false,
}: {
  pendingAppointments: ReturnType<typeof usePendingAppointments>
  appointments: ReturnType<typeof useAppointments>
  properties: ReturnType<typeof useProperties>
  groups: ReturnType<typeof useCustomerGroups>
  baseUrl: string
  selectedPendingGroupId: string | null
  setSelectedPendingGroupId: (id: string | null) => void
  clientMode?: boolean
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile, update: profileUpdate } = useProfile()
  const PENDING_STATUS_OPTIONS = usePendingStatusOptions()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set())
  const [showNotInterestedByGroup, setShowNotInterestedByGroup] = useState<Set<string>>(new Set())
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateEditSale, setTemplateEditSale] = useState('')
  const [templateEditRent, setTemplateEditRent] = useState('')

  const displayImages = (p: Property | undefined): string[] => {
    if (!p) return []
    const urls = Array.isArray(p.image_urls) ? p.image_urls : []
    if (urls.length >= 2) return urls.slice(0, 2)
    if (urls.length === 1 && p.main_image_url && urls[0] !== p.main_image_url) return [urls[0], p.main_image_url]
    if (urls.length === 1) return urls
    if (p.main_image_url) return [p.main_image_url]
    return []
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxImage(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = lightboxImage ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxImage])

  const handleRefreshProperty = async (prop: Property) => {
    const url = prop.source_url || prop.link
    if (!url || !isSupportedScrapeUrl(url)) {
      message.info(t('pendingSection.noRefreshSupport'))
      return
    }
    setRefreshingPropertyId(prop.id)
    try {
      await triggerScrapeAsync(prop.id, normalizeSourceUrl(url), user?.id)
      message.info(t('common.asyncScrapeHint'), 5)
      setTimeout(() => properties.refetch(), 20000)
    } catch (e) {
      message.error((e as Error).message || t('pendingSection.refreshFailed'))
    } finally {
      setRefreshingPropertyId(null)
    }
  }

  const toggleGroup = (gid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (prev.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  const activeGroupIds = new Set(groups.data?.filter((g) => g.is_active !== false).map((g) => g.id) ?? [])
  const list = pendingAppointments.data ?? []
  const byCustomer = list.reduce<Record<string, PendingAppointment[]>>((acc, p: PendingAppointment) => {
    const gid = p.customer_group_id
    if (!activeGroupIds.has(gid)) return acc
    if (!acc[gid]) acc[gid] = []
    acc[gid].push(p)
    return acc
  }, {})

  const groupIds = Object.keys(byCustomer)
  const isGroupExpanded = (gid: string) => !collapsedGroups.has(gid)

  const [showBatchAddModal, setShowBatchAddModal] = useState(false)
  const [batchAddGroupId, setBatchAddGroupId] = useState('')
  const [batchAddLinks, setBatchAddLinks] = useState('')
  const [batchAddLoading, setBatchAddLoading] = useState(false)
  const [batchAddError, setBatchAddError] = useState<string | null>(null)
  const [confirmAppointmentModal, setConfirmAppointmentModal] = useState<{ pending: PendingAppointment } | null>(null)
  const [confirmStartTime, setConfirmStartTime] = useState('')

  const parsePropertyLinks = (text: string): string[] => {
    const raw = text.split(/[\s\n]+/).map((s) => s.trim()).filter(Boolean)
    return raw
      .map((s) => normalizeSourceUrl(s))
      .filter((u) => u && isSupportedScrapeUrl(u))
  }

  const handleBatchAdd = async () => {
    if (!batchAddGroupId.trim()) {
      setBatchAddError(t('pendingSection.selectGroupRequired'))
      return
    }
    if (!user?.id) {
      setBatchAddError(t('common.pleaseLogin') || '请先登录')
      return
    }
    const urls = [...new Set(parsePropertyLinks(batchAddLinks))]
    if (urls.length === 0) {
      setBatchAddError(t('pendingSection.enterValidLinks'))
      return
    }
    setBatchAddError(null)
    setBatchAddLoading(true)
    const existingPending = new Set(
      (pendingAppointments.data ?? [])
        .filter((p) => p.customer_group_id === batchAddGroupId)
        .map((p) => (p.properties as Property)?.source_url || (p.properties as Property)?.link)
    )
    const urlsToAdd = urls.filter((u) => !existingPending.has(u))
    if (urlsToAdd.length === 0) {
      setBatchAddLoading(false)
      setShowBatchAddModal(false)
      setBatchAddGroupId('')
      setBatchAddLinks('')
      return
    }
    try {
      const res = await batchScrapeProperties({
        urls: urlsToAdd,
        agent_id: user.id,
        customer_group_id: batchAddGroupId,
      })
      pendingAppointments.refetch()
      properties.refetch()
      if (res.added > 0) {
        message.success(t('pendingSection.batchAddSuccess', { count: res.added }))
        message.info(t('common.asyncScrapeHint'), 5)
      }
      setShowBatchAddModal(false)
      setBatchAddGroupId('')
      setBatchAddLinks('')
    } catch (e) {
      setBatchAddError((e as Error).message)
    } finally {
      setBatchAddLoading(false)
    }
  }

  const activeGroups = groups.data?.filter((g) => g.is_active !== false) ?? []
  const clientGroupsForFilter = activeGroups.filter((g) => g.group_type !== 'listing')
  const clientSettingUp = clientMode && activeGroups.length === 0 && groups.create.isPending

  return (
    <section>
      {clientSettingUp && (
        <div className="mb-4 py-4 text-center text-[#2b5843]/70 text-sm">
          {t('common.loading')}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {!clientMode && (
            <>
              <select
                value={selectedPendingGroupId || ''}
                onChange={(e) => setSelectedPendingGroupId(e.target.value || null)}
                className="text-sm border border-[#53868e]/25 rounded-xl px-3 py-1.5"
              >
                <option value="">{t('pendingSection.allGroups')}</option>
                {clientGroupsForFilter.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {selectedPendingGroupId && (() => {
                const g = groups.data?.find((x) => x.id === selectedPendingGroupId)
                const token = g?.share_token
                if (!token) return null
                return (
                  <a
                    href={`${baseUrl}${token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[#53868e] hover:text-[#2b5843] px-2 py-1"
                    title={t('pendingSection.openClientView')}
                  >
                    {t('pendingSection.openClientView')}
                  </a>
                )
              })()}
            </>
          )}
          <button
            onClick={() => {
              setShowTemplateModal(true)
              const isAgent = profile?.role === 'agent'
              setTemplateEditSale(
                (isAgent ? profile?.whatsapp_template_agent_sale : profile?.whatsapp_template_client_sale) ??
                getDefaultWhatsAppTemplate(!!isAgent, 'sale')
              )
              setTemplateEditRent(
                (isAgent ? profile?.whatsapp_template_agent_rent : profile?.whatsapp_template_client_rent) ??
                getDefaultWhatsAppTemplate(!!isAgent, 'rent')
              )
            }}
            className="text-sm text-[#2b5843]/80 hover:text-[#2b5843]"
          >
            {t('pendingSection.editTemplate')}
          </button>
          <button
            onClick={() => {
              if (clientGroupsForFilter.length === 0) {
                message.warning(t('pendingSection.createGroupFirst'))
                return
              }
              setShowBatchAddModal(true)
              setBatchAddError(null)
              setBatchAddLinks('')
              setBatchAddGroupId(clientGroupsForFilter[0]?.id ?? '')
            }}
            className="text-sm border border-[#53868e]/35 rounded-xl px-3 py-1.5 hover:bg-[#53868e]/15"
          >
            {t('pendingSection.batchAddButton')}
          </button>
          {groupIds.length > 0 && (
            <>
              <Popconfirm
                title={t('pendingSection.batchDeleteConfirm', { count: selectedPendingIds.size })}
                onConfirm={() => {
                  const ids = [...selectedPendingIds]
                  pendingAppointments.removeMany.mutate(ids)
                  setSelectedPendingIds(new Set())
                  message.success(t('pendingSection.batchDeleteSuccess', { count: ids.length }))
                }}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                icon={null}
              >
                <button
                  disabled={selectedPendingIds.size === 0 || pendingAppointments.removeMany.isPending}
                  className="text-sm border border-red-400/50 text-red-600 rounded-xl px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('pendingSection.batchDelete')}
                </button>
              </Popconfirm>
              <button
                onClick={() => {
                  const selectedWithPhone = list.filter(
                    (p) => selectedPendingIds.has(p.id) && (p.properties as Property)?.listing_agent_phone
                  )
                  if (selectedWithPhone.length === 0) {
                    message.warning(t('pendingSection.selectWithPhone'))
                    return
                  }
                  const isAgent = profile?.role === 'agent'
                  selectedWithPhone.forEach((p, i) => {
                    const prop = p.properties as Property
                    const lt = prop.listing_type ?? 'sale'
                    const custom = isAgent
                      ? (lt === 'sale' ? profile?.whatsapp_template_agent_sale : profile?.whatsapp_template_agent_rent)
                      : (lt === 'sale' ? profile?.whatsapp_template_client_sale : profile?.whatsapp_template_client_rent)
                    const template = custom ?? getDefaultWhatsAppTemplate(!!isAgent, lt)
                    const vars = buildTemplateVars(prop, profile ?? {}, !!isAgent)
                    const msg = applyTemplate(template, vars)
                    setTimeout(() => {
                      window.open(getWhatsAppChatUrl(prop.listing_agent_phone!, msg), '_blank', 'noopener')
                    }, i * 400)
                  })
                  message.success(t('pendingSection.batchWhatsAppSuccess', { count: selectedWithPhone.length }))
                }}
                disabled={selectedPendingIds.size === 0}
                className="text-sm border border-[#25D366] text-[#25D366] rounded-xl px-3 py-1.5 hover:bg-[#25D366]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pendingSection.batchWhatsApp')}
              </button>
            </>
          )}
        </div>
      </div>
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-[#f6f3f1] rounded-xl shadow-lg p-6 w-full max-w-lg mx-4 border border-[#53868e]/25 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-[#2b5843] mb-2">{t('pendingSection.editTemplateTitle')}</h3>
            <p className="text-xs text-[#2b5843]/70 mb-3">{t('pendingSection.editTemplateHint')}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#2b5843]/90 mb-1">{t('pendingSection.templateSale')}</label>
                <textarea
                  value={templateEditSale}
                  onChange={(e) => setTemplateEditSale(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm font-mono resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2b5843]/90 mb-1">{t('pendingSection.templateRent')}</label>
                <textarea
                  value={templateEditRent}
                  onChange={(e) => setTemplateEditRent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm font-mono resize-y"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const isAgent = profile?.role === 'agent'
                  await profileUpdate.mutateAsync(
                    isAgent
                      ? {
                          whatsapp_template_agent_sale: templateEditSale.trim() || null,
                          whatsapp_template_agent_rent: templateEditRent.trim() || null,
                        }
                      : {
                          whatsapp_template_client_sale: templateEditSale.trim() || null,
                          whatsapp_template_client_rent: templateEditRent.trim() || null,
                        }
                  )
                  message.success(t('common.save'))
                  setShowTemplateModal(false)
                }}
                disabled={profileUpdate.isPending}
                className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => {
                  const isAgent = profile?.role === 'agent'
                  setTemplateEditSale(getDefaultWhatsAppTemplate(!!isAgent, 'sale'))
                  setTemplateEditRent(getDefaultWhatsAppTemplate(!!isAgent, 'rent'))
                }}
                className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90"
              >
                {t('pendingSection.restoreDefault')}
              </button>
              <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showBatchAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBatchAddModal(false)}>
          <div className="bg-[#f6f3f1] rounded-xl shadow-lg p-6 w-full max-w-md mx-4 border border-[#53868e]/25" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-[#2b5843] mb-3">{t('pendingSection.batchAddTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('pendingSection.batchAddGroup')}</label>
                <select
                  value={batchAddGroupId}
                  onChange={(e) => setBatchAddGroupId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm bg-[#f6f3f1]"
                >
                  {clientGroupsForFilter.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('pendingSection.batchAddLinks')}</label>
                <textarea
                  value={batchAddLinks}
                  onChange={(e) => { setBatchAddLinks(e.target.value); setBatchAddError(null) }}
                  placeholder={t('pendingSection.batchAddLinksPlaceholder')}
                  rows={6}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-none"
                />
              </div>
              {batchAddError && <p className="text-xs text-red-600">{batchAddError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleBatchAdd}
                disabled={batchAddLoading}
                className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50 flex items-center gap-2"
              >
                {batchAddLoading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {t('common.add')}
              </button>
              <button onClick={() => setShowBatchAddModal(false)} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {groupIds.length === 0 ? (
          <div className="py-12 text-center text-[#2b5843]/70 text-sm border border-dashed border-[#53868e]/25 rounded-xl">
            {t('pendingSection.noPending')}
          </div>
        ) : (
          groupIds.map((gid: string) => {
            const items = byCustomer[gid] ?? []
            const mainItems = items.filter((p) => (p.client_feedback as string) !== 'not_interested')
            const notInterestedItems = items.filter((p) => (p.client_feedback as string) === 'not_interested')
            const showNotInterested = showNotInterestedByGroup.has(gid)
            const displayItems = showNotInterested ? [...mainItems, ...notInterestedItems] : mainItems
            const displayCount = displayItems.length
            const groupName = (items[0]?.customer_groups as CustomerGroup)?.name ?? '—'
            const isExpanded = isGroupExpanded(gid)
            return (
              <div key={gid} className="border border-[#53868e]/25 rounded-xl bg-[#f6f3f1] overflow-hidden">
                <div
                  onClick={() => toggleGroup(gid)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#53868e]/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-[#2b5843] text-sm shrink-0">{groupName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPendingIds((prev) => new Set([...prev, ...items.map((p) => p.id)]))
                      }}
                      className="text-sm text-[#2b5843]/80 hover:text-[#2b5843] shrink-0"
                    >
                      {t('pendingSection.selectAll')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const ids = new Set(items.map((p) => p.id))
                        setSelectedPendingIds((prev) => new Set([...prev].filter((id) => !ids.has(id))))
                      }}
                      className="text-sm text-[#2b5843]/80 hover:text-[#2b5843] shrink-0"
                    >
                      {t('pendingSection.deselectAll')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {notInterestedItems.length > 0 && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 cursor-pointer text-[#2b5843]/70 hover:text-[#2b5843]/90 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={showNotInterested}
                          onChange={(e) => {
                            setShowNotInterestedByGroup((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(gid)
                              else next.delete(gid)
                              return next
                            })
                          }}
                          className="w-4 h-4 rounded border-2 border-[#53868e]/50 text-[#2b5843] focus:ring-2 focus:ring-[#53868e]/30 cursor-pointer accent-[#2b5843]"
                        />
                        {t('pendingSection.showNotInterested', { count: notInterestedItems.length })}
                      </label>
                    )}
                    <span className="text-[#2b5843]/70 text-xs">{t('pendingSection.itemsCount', { count: displayCount })}</span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-[#2b5843]/70 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                {isExpanded && (
                  <div className="border-t border-[#53868e]/15 divide-y divide-stone-100">
                    {displayItems.map((p: PendingAppointment) => {
                      const prop = p.properties as Property | undefined
                      const agentName = prop?.listing_agent_name
                      const agentPhone = prop?.listing_agent_phone
                      const hasAgent = agentName || agentPhone
                      const whatsappUrl = agentPhone ? getWhatsAppChatUrl(agentPhone) : null
                      const imgs = displayImages(prop)
                      return (
                        <div key={p.id} className="p-4 flex flex-col sm:flex-row gap-3 sm:gap-0 bg-[#f6f3f1] border-t border-[#53868e]/15 first:border-t-0">
                          <div className="flex items-center sm:items-start pt-0 sm:pt-2 shrink-0 pr-0 sm:pr-3 order-first">
                            <label className="flex items-center cursor-pointer select-none" title={t('pendingSection.selectForBatch')}>
                              <input
                                type="checkbox"
                                checked={selectedPendingIds.has(p.id)}
                                onChange={(e) => {
                                  setSelectedPendingIds((prev) => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(p.id)
                                    else next.delete(p.id)
                                    return next
                                  })
                                }}
                                className="w-5 h-5 rounded border-2 border-[#53868e]/50 text-[#2b5843] focus:ring-2 focus:ring-[#53868e]/30 focus:ring-offset-1 cursor-pointer accent-[#2b5843] shrink-0"
                              />
                            </label>
                          </div>
                          <div className={`flex flex-col w-full sm:w-[166px] flex-shrink-0 gap-0.5 p-2 bg-[#53868e]/5 rounded-lg sm:mr-4 order-1 sm:order-none ${imgs.length <= 1 ? 'justify-center' : ''}`}>
                            {imgs[0] ? (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(imgs[0])}
                                className={`block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left ${imgs.length >= 2 ? 'h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3]' : 'h-40 sm:h-auto sm:w-[150px] sm:aspect-[4/3]'}`}
                              >
                                <img src={imgs[0]} alt={prop?.title ?? ''} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-full h-20 rounded-lg bg-[#53868e]/15 flex items-center justify-center text-[#2b5843]/60 text-xs">{t('common.noImage')}</div>
                            )}
                            {imgs[1] && (
                              <button type="button" onClick={() => setLightboxImage(imgs[1])} className="block w-full h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left">
                                <img src={imgs[1]} alt={prop?.title ?? ''} className="w-full h-full object-cover" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-1 min-w-0 flex-col justify-between order-2 sm:order-none">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <p className="font-semibold text-base leading-tight text-[#2b5843] break-words">{prop?.title ?? '—'}</p>
                                  {prop?.listing_type && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${prop.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                      {prop.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                                    </span>
                                  )}
                                  {(() => {
                                    const fb = p.client_feedback as ClientFeedback | null | undefined
                                    const fbLabels: Record<string, string> = {
                                      interested: t('clientFeedback.interested'),
                                      neutral: t('clientFeedback.neutral'),
                                      not_interested: t('clientFeedback.not_interested'),
                                    }
                                    const fbClasses: Record<string, string> = {
                                      interested: 'bg-emerald-100 text-emerald-800',
                                      neutral: 'bg-amber-100 text-amber-800',
                                      not_interested: 'bg-slate-100 text-slate-600',
                                    }
                                    if (fb && fbLabels[fb]) {
                                      return (
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${fbClasses[fb] ?? 'bg-slate-100 text-slate-600'}`}>
                                          {fbLabels[fb]}
                                        </span>
                                      )
                                    }
                                    return (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium shrink-0 bg-slate-50 text-slate-500 border border-slate-200">
                                        {t('clientFeedback.none')}
                                      </span>
                                    )
                                  })()}
                                </div>
                                {formatPriceDisplay(prop!) && (
                                  <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(prop!)}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
                                {prop?.bedrooms && <span>{prop.bedrooms}</span>}
                                {prop?.bathrooms && <span>{prop.bathrooms}</span>}
                                {(prop?.size_sqft || prop?.basic_info) && <span>{(prop.size_sqft || prop.basic_info)}</span>}
                                {prop?.listing_type === 'sale' && prop?.lease_tenure && <span className="text-[#2b5843]/70">{prop.lease_tenure}</span>}
                                {prop?.top_year && <span className="text-[#2b5843]/70">{prop.top_year}</span>}
                              </div>
                              <p className="text-[#2b5843]/70 text-sm mt-1">{t('pendingSection.timeTbd')}</p>
                              <div className="mt-2">
                                <label className="block text-xs text-[#2b5843]/70 mb-1">{t('clientView.noteLabel')}</label>
                                <textarea
                                  defaultValue={p.notes ?? ''}
                                  placeholder={t('pendingSection.notesPlaceholder')}
                                onBlur={(e) => {
                                  const v = e.target.value.trim()
                                  if (v !== (p.notes ?? '').trim()) {
                                    pendingAppointments.update.mutate({ id: p.id, notes: v || null })
                                  }
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-white/60 border border-[#53868e]/20 text-sm text-[#2b5843]/90 placeholder:text-[#2b5843]/50 focus:outline-none focus:ring-2 focus:ring-[#53868e]/30 focus:border-[#53868e]/40 resize-none min-h-[2.5rem]"
                                rows={2}
                              />
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                                {prop?.floor_plan_url && (
                                  <button type="button" onClick={() => setLightboxImage(prop.floor_plan_url!)} className="text-emerald-600 hover:underline font-medium">
                                    {t('clientView.floorPlan')}
                                  </button>
                                )}
                                {prop?.site_plan_url && (
                                  <button type="button" onClick={() => setLightboxImage(prop.site_plan_url!)} className="text-emerald-600 hover:underline font-medium">
                                    {t('clientView.viewSitePlan')}
                                  </button>
                                )}
                                {prop?.link && (
                                  <a href={prop.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">{t('clientView.viewProperty')}</a>
                                )}
                              </div>
                              {hasAgent && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-[#2b5843]/80">
                                    {t('clientView.listingAgent')}：{agentName && <span className="font-medium text-[#2b5843]/90">{agentName}</span>}
                                    {agentName && agentPhone && <span className="text-[#2b5843]/60 mx-1">·</span>}
                                    {agentPhone && (
                                      <a href={getTelUrl(agentPhone)} className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">{agentPhone}</a>
                                    )}
                                  </span>
                                  {whatsappUrl && (
                                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A]">
                                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#53868e]/15 shrink-0 flex-wrap">
                              {agentPhone && (
                                <a href={getWhatsAppChatUrl(agentPhone)} target="_blank" rel="noreferrer" className="text-xs text-[#25D366] hover:underline">
                                  {t('pendingSection.sendWhatsApp')}
                                </a>
                              )}
                              {prop && (prop.source_url || prop.link) && isSupportedScrapeUrl((prop.source_url || prop.link)!) && (
                                <button
                                  onClick={() => handleRefreshProperty(prop)}
                                  disabled={refreshingPropertyId === prop.id}
                                  className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90 disabled:opacity-50 flex items-center gap-1"
                                  title={t('pendingSection.refreshTitle')}
                                >
                                  {refreshingPropertyId === prop.id ? (
                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" /></svg>
                                  )}
                                  {t('common.refresh')}
                                </button>
                              )}
                              {!clientMode && (
                                <button
                                  onClick={() => {
                                    const d = new Date()
                                    d.setDate(d.getDate() + 1)
                                    d.setHours(9, 0, 0, 0)
                                    const pad = (n: number) => String(n).padStart(2, '0')
                                    const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                                    setConfirmStartTime(start)
                                    setConfirmAppointmentModal({ pending: p })
                                  }}
                                  className="text-xs px-2 py-1.5 border border-emerald-500/50 text-emerald-700 rounded-xl hover:bg-emerald-50"
                                >
                                  {t('pendingSection.confirmAppointment')}
                                </button>
                              )}
                              <select
                                value={p.status}
                                onChange={(e) => { const v = e.target.value as PendingAppointmentStatus; pendingAppointments.update.mutate({ id: p.id, status: v }) }}
                                className="text-xs border border-[#53868e]/25 rounded-xl px-2 py-1.5 bg-[#f6f3f1]"
                              >
                                {PENDING_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <Popconfirm
                                title={t('pendingSection.deleteItemConfirm')}
                                onConfirm={() => pendingAppointments.remove.mutate(p.id)}
                                okText={t('common.confirm')}
                                cancelText={t('common.cancel')}
                                icon={null}
                              >
                                <button className="text-xs text-[#2b5843]/60 hover:text-red-600">{t('common.delete')}</button>
                              </Popconfirm>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {confirmAppointmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAppointmentModal(null)}>
          <div
            className="bg-[#f6f3f1] rounded-xl shadow-lg p-6 w-full max-w-md mx-4 border border-[#53868e]/25"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#2b5843] mb-3">{t('pendingSection.confirmAppointmentTitle')}</h3>
            <p className="text-xs text-[#2b5843]/70 mb-3">{t('pendingSection.confirmAppointmentHint')}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#2b5843]/80 mb-1">{t('pendingSection.appointmentTime')}</label>
                <input
                  type="datetime-local"
                  value={confirmStartTime}
                  onChange={(e) => setConfirmStartTime(e.target.value)}
                  min={(() => {
                    const d = new Date()
                    const pad = (n: number) => String(n).padStart(2, '0')
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                  })()}
                  className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const { pending } = confirmAppointmentModal
                  if (!confirmStartTime || !pending) return
                  const cg = pending.customer_groups as CustomerGroup | undefined
                  const partyRole: PartyRole = cg?.intent === 'rent' ? 'tenant' : 'buyer'
                  const startIso = new Date(confirmStartTime).toISOString()
                  const endIso = new Date(new Date(confirmStartTime).getTime() + 15 * 60 * 1000).toISOString()
                  try {
                    await appointments.create.mutateAsync({
                      property_id: pending.property_id,
                      customer_group_id: pending.customer_group_id,
                      party_role: partyRole,
                      start_time: startIso,
                      end_time: endIso,
                    })
                    await pendingAppointments.remove.mutateAsync(pending.id)
                    message.success(t('pendingSection.confirmAppointmentSuccess'))
                    setConfirmAppointmentModal(null)
                  } catch (err) {
                    message.error((err as Error).message)
                  }
                }}
                disabled={!confirmStartTime || appointments.create.isPending || pendingAppointments.remove.isPending}
                className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={() => setConfirmAppointmentModal(null)}
                className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {lightboxImage && (
        <div role="dialog" aria-modal="true" aria-label={t('lightbox.title')} className="fixed inset-0 z-50 flex items-center justify-center glass-overlay-dark p-4" onClick={() => setLightboxImage(null)}>
          <button type="button" onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none micro-btn" aria-label={t('common.close')}>✕</button>
          <img src={lightboxImage} alt={t('lightbox.alt')} className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg micro-scale" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  )
}

function AppointmentsSection({
  groups,
  properties,
  appointments,
  allAppointments,
  selectedGroupId,
  setSelectedGroupId,
  showAddAppointment,
  setShowAddAppointment,
  initialAddAppointment,
  onConsumeInitialAddAppointment,
  clientMode = false,
}: {
  groups: ReturnType<typeof useCustomerGroups>
  properties: ReturnType<typeof useProperties>
  appointments: ReturnType<typeof useAppointments>
  allAppointments: ReturnType<typeof useAppointments>
  selectedGroupId: string | null
  setSelectedGroupId: (id: string | null) => void
  showAddAppointment: boolean
  setShowAddAppointment: (v: boolean) => void
  initialAddAppointment: { propId: string; partyRole: 'seller' | 'landlord' } | null
  onConsumeInitialAddAppointment: () => void
  clientMode?: boolean
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const PARTY_ROLE_LABELS = usePartyRoleLabels()
  const [propId, setPropId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [partyRole, setPartyRole] = useState<PartyRole>('buyer')
  const [customerInfo, setCustomerInfo] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [propertyInputMode, setPropertyInputMode] = useState<'select' | 'byLink'>('byLink')
  const [propertyLinkInput, setPropertyLinkInput] = useState('')
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPartyRole, setEditPartyRole] = useState<PartyRole>('buyer')
  const [editPropId, setEditPropId] = useState('')
  const [editGroupId, setEditGroupId] = useState('')
  const [editCustomerInfo, setEditCustomerInfo] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const displayImages = (p: Property | undefined): string[] => {
    if (!p) return []
    const urls = Array.isArray(p.image_urls) ? p.image_urls : []
    if (urls.length >= 2) return urls.slice(0, 2)
    if (urls.length === 1 && p.main_image_url && urls[0] !== p.main_image_url) return [urls[0], p.main_image_url]
    if (urls.length === 1) return urls
    if (p.main_image_url) return [p.main_image_url]
    return []
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.body.style.overflow = lightboxImage ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxImage])

  // 从出售/出租卡片快捷进入时，预填房源和角色
  useEffect(() => {
    if (showAddAppointment && initialAddAppointment) {
      setPropId(initialAddAppointment.propId)
      setPartyRole(initialAddAppointment.partyRole)
      setPropertyInputMode('select')
      onConsumeInitialAddAppointment()
    }
  }, [showAddAppointment, initialAddAppointment, onConsumeInitialAddAppointment])

  const handleRefreshProperty = async (prop: Property) => {
    const url = prop.source_url || prop.link
    if (!url || !isSupportedScrapeUrl(url)) {
      message.info(t('pendingSection.noRefreshSupport'))
      return
    }
    setRefreshingPropertyId(prop.id)
    try {
      await triggerScrapeAsync(prop.id, normalizeSourceUrl(url), user?.id)
      message.info(t('common.asyncScrapeHint'), 5)
      setTimeout(() => properties.refetch(), 20000)
    } catch (e) {
      message.error((e as Error).message || t('pendingSection.refreshFailed'))
    } finally {
      setRefreshingPropertyId(null)
    }
  }

  const needsCustomerGroup = partyRole === 'buyer' || partyRole === 'tenant'
  const isSellerOrLandlord = partyRole === 'seller' || partyRole === 'landlord'
  const buyerOrTenantLabel = partyRole === 'seller' ? t('partyRole.buyer') : t('partyRole.tenant')

  // 代表房东/卖家→只能选已有房源；代表买家/租客→只能通过链接添加
  useEffect(() => {
    if (partyRole === 'seller' || partyRole === 'landlord') setPropertyInputMode('select')
    else setPropertyInputMode('byLink')
  }, [partyRole])

  // 实时计算新增预约是否有时间冲突（用于红色标签展示）
  const createConflictInfo = useMemo(() => {
    if (!startTime || !propId) return null
    const effGroup = clientMode && needsCustomerGroup ? selectedGroupId : groupId
    if (needsCustomerGroup && !effGroup) return null
    const startDate = new Date(startTime)
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000)
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    const existing = (allAppointments.data ?? []).map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
    }))
    const { hasConflict, conflictingWith } = checkAppointmentConflict(startIso, endIso, existing)
    if (!hasConflict) return null
    if (conflictingWith) {
      return t('appointmentsSection.conflictWith', { date: new Date(conflictingWith.start_time).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })
    }
    return t('appointmentsSection.adjustTime')
  }, [startTime, propId, groupId, selectedGroupId, clientMode, partyRole, allAppointments.data])

  const handleCreate = async () => {
    setConflictError(null)
    if (!startTime) {
      message.warning(t('appointmentsSection.fillComplete'))
      return
    }
    const effectiveGroupId = clientMode && needsCustomerGroup ? selectedGroupId : groupId
    if (needsCustomerGroup && !effectiveGroupId) {
      message.warning(t('appointmentsSection.selectGroupRequired'))
      return
    }

    let propertyId: string
    if (propertyInputMode === 'byLink' && propertyLinkInput.trim()) {
      const sourceUrl = normalizeSourceUrl(propertyLinkInput)
      if (!isSupportedScrapeUrl(sourceUrl)) {
        message.warning(t('appointmentsSection.propertyLinkOnly'))
        return
      }
      setIsCreatingAppointment(true)
      try {
        const existing = await properties.findBySourceUrl(sourceUrl)
        if (existing) {
          propertyId = existing.id
          triggerScrapeAsync(existing.id, sourceUrl, user?.id).catch(() => {})
          message.info(t('common.asyncScrapeHint'), 5)
        } else {
          const created = await properties.create.mutateAsync({
            title: t('appointmentsSection.scraping'),
            link: sourceUrl,
            source_url: sourceUrl,
          })
          propertyId = created.id
          triggerScrapeAsync(created.id, sourceUrl, user?.id).catch(() => {})
          message.info(t('common.asyncScrapeHint'), 5)
        }
      } catch (e) {
        message.error((e as Error).message || t('appointmentsSection.createFailed'))
        setIsCreatingAppointment(false)
        return
      }
    } else if (propId) {
      propertyId = propId
    } else {
      message.warning(t('appointmentsSection.fillComplete'))
      return
    }

    const startDate = new Date(startTime)
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000)
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    try {
      setIsCreatingAppointment(true)
      await appointments.create.mutateAsync({
        property_id: propertyId,
        party_role: partyRole,
        customer_group_id: needsCustomerGroup ? effectiveGroupId : null,
        customer_info: isSellerOrLandlord ? (customerInfo.trim() || null) : null,
        customer_phone: isSellerOrLandlord ? (customerPhone.trim() || null) : null,
        start_time: startIso,
        end_time: endIso,
        notes: notes.trim() || null,
      })
      setShowAddAppointment(false)
      setPropId('')
      setPropertyLinkInput('')
      setGroupId('')
      setPartyRole('buyer')
      setCustomerInfo('')
      setCustomerPhone('')
      setStartTime('')
      setNotes('')
      setConflictError(null)
    } catch (e: unknown) {
      const err = e as { message?: string }
      if (err?.message?.includes('APPOINTMENT_CONFLICT') || err?.message?.includes('冲突')) {
        setConflictError(t('appointmentsSection.conflictError'))
      } else {
        message.error(err?.message || t('appointmentsSection.createFailed'))
      }
    } finally {
      setIsCreatingAppointment(false)
    }
  }

  const handleOpenEdit = (a: Appointment) => {
    setEditingAppointment(a)
    const d = new Date(a.start_time)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    setEditStartTime(`${y}-${m}-${day}T${h}:${min}`)
    setEditNotes(a.notes || '')
    setEditPartyRole(a.party_role)
    setEditPropId(a.property_id)
    setEditGroupId(a.customer_group_id || '')
    setEditCustomerInfo(a.customer_info || '')
    setEditCustomerPhone(a.customer_phone || '')
    setConflictError(null)
  }

  // 实时计算编辑预约是否有时间冲突（用于红色标签展示）
  const editConflictInfo = useMemo(() => {
    if (!editingAppointment || !editStartTime) return null
    const startDate = new Date(editStartTime)
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000)
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    const existing = (allAppointments.data ?? []).map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
    }))
    const { hasConflict, conflictingWith } = checkAppointmentConflict(
      startIso,
      endIso,
      existing,
      editingAppointment.id
    )
    if (!hasConflict) return null
    if (conflictingWith) {
      return t('appointmentsSection.conflictWith', { date: new Date(conflictingWith.start_time).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })
    }
    return t('appointmentsSection.adjustTime')
  }, [editingAppointment, editStartTime, allAppointments.data])

  const editNeedsCustomerGroup = editPartyRole === 'buyer' || editPartyRole === 'tenant'
  const editIsSellerOrLandlord = editPartyRole === 'seller' || editPartyRole === 'landlord'

  const handleSaveEdit = async () => {
    if (!editingAppointment) return
    setConflictError(null)
    if (!editStartTime) {
      message.warning(t('appointmentsSection.selectTime'))
      return
    }
    if (!editPropId) {
      message.warning(t('appointmentsSection.selectPropertyRequired'))
      return
    }
    if (editNeedsCustomerGroup && !editGroupId) {
      message.warning(t('appointmentsSection.selectGroupRequired'))
      return
    }
    const startDate = new Date(editStartTime)
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000)
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    try {
      await appointments.update.mutateAsync({
        id: editingAppointment.id,
        property_id: editPropId,
        party_role: editPartyRole,
        customer_group_id: editNeedsCustomerGroup ? editGroupId : null,
        customer_info: editIsSellerOrLandlord ? (editCustomerInfo.trim() || null) : null,
        customer_phone: editIsSellerOrLandlord ? (editCustomerPhone.trim() || null) : null,
        start_time: startIso,
        end_time: endIso,
        notes: editNotes.trim() || null,
      })
      setEditingAppointment(null)
      setConflictError(null)
    } catch (e: unknown) {
      const err = e as { message?: string }
      if (err?.message?.includes('APPOINTMENT_CONFLICT') || err?.message?.includes('冲突')) {
        setConflictError(t('appointmentsSection.conflictError'))
      } else {
        message.error(err?.message || t('appointmentsSection.updateFailed'))
      }
    }
  }

  const activeGroups = groups.data?.filter((g) => g.is_active !== false) ?? []
  const activeGroupIds = new Set(activeGroups.map((g) => g.id))
  // 代表选择关联客户分组：买家→买房客户，租客→租房客户
  const groupsForPartyRole = useMemo(() => {
    if (partyRole === 'buyer') return activeGroups.filter((g) => g.intent === 'buy')
    if (partyRole === 'tenant') return activeGroups.filter((g) => g.intent === 'rent')
    return []
  }, [activeGroups, partyRole])
  const groupsForEditPartyRole = useMemo(() => {
    if (editPartyRole === 'buyer') return activeGroups.filter((g) => g.intent === 'buy')
    if (editPartyRole === 'tenant') return activeGroups.filter((g) => g.intent === 'rent')
    return []
  }, [activeGroups, editPartyRole])
  // 代表房东/卖家时，房源 dropdown 只显示「我的客户」里的房源（listing 分组关联的 property）
  const listingGroups = useMemo(() => activeGroups.filter((g) => g.group_type === 'listing'), [activeGroups])
  const propertiesForPartyRole = useMemo(() => {
    const allProps = properties.data ?? []
    if (partyRole === 'landlord') {
      const ids = new Set(listingGroups.filter((g) => g.intent === 'rent' && g.property_id).map((g) => g.property_id!))
      return allProps.filter((p) => ids.has(p.id))
    }
    if (partyRole === 'seller') {
      const ids = new Set(listingGroups.filter((g) => g.intent === 'sale' && g.property_id).map((g) => g.property_id!))
      return allProps.filter((p) => ids.has(p.id))
    }
    return allProps
  }, [properties.data, partyRole, listingGroups])
  const propertiesForEditPartyRole = useMemo(() => {
    const allProps = properties.data ?? []
    if (editPartyRole === 'landlord') {
      const ids = new Set(listingGroups.filter((g) => g.intent === 'rent' && g.property_id).map((g) => g.property_id!))
      return allProps.filter((p) => ids.has(p.id))
    }
    if (editPartyRole === 'seller') {
      const ids = new Set(listingGroups.filter((g) => g.intent === 'sale' && g.property_id).map((g) => g.property_id!))
      return allProps.filter((p) => ids.has(p.id))
    }
    return allProps
  }, [properties.data, editPartyRole, listingGroups])
  useEffect(() => {
    if (selectedGroupId && !activeGroupIds.has(selectedGroupId)) {
      setSelectedGroupId(null)
    }
  }, [selectedGroupId, activeGroupIds, setSelectedGroupId])
  useEffect(() => {
    if (clientMode && showAddAppointment && selectedGroupId && (partyRole === 'buyer' || partyRole === 'tenant')) {
      setGroupId(selectedGroupId)
    }
  }, [clientMode, showAddAppointment, selectedGroupId, partyRole])
  const rawAppts = appointments.data ?? []
  const appts =
    selectedGroupId
      ? rawAppts
      : rawAppts.filter((a) => !a.customer_group_id || activeGroupIds.has(a.customer_group_id))

  const now = new Date()
  const upcomingAppts = appts.filter((a) => new Date(a.start_time) >= now)
  const pastAppts = appts.filter((a) => new Date(a.start_time) < now)
  // 未来预约：越靠近现在越靠上 → 升序（最早的在前）
  const upcomingSorted = [...upcomingAppts].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  // 历史记录：越靠近现在越靠上 → 降序（最近的在前）
  const pastSorted = [...pastAppts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())

  const [apptSubTab, setApptSubTab] = useState<'future' | 'history'>('future')
  const displayAppts = apptSubTab === 'future' ? upcomingSorted : pastSorted
  const groupedByDate = displayAppts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const d = new Date(a.start_time).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(a)
    return acc
  }, {})
  // 日期排序：未来升序（早→晚），历史降序（晚→早）
  const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
    apptSubTab === 'future'
      ? new Date(a).getTime() - new Date(b).getTime()
      : new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[#2b5843]/90">{t('appointmentsSection.title')}</h2>
        <div className="flex gap-2 items-center">
          {!clientMode && (
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value || null)}
              className="text-sm border border-[#53868e]/25 rounded-xl px-3 py-1.5"
            >
              <option value="">{t('appointmentsSection.allGroups')}</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowAddAppointment(!showAddAppointment)}
            className="text-sm border border-[#53868e]/35 rounded-xl px-4 py-1.5 hover:bg-[#53868e]/15"
          >
            {showAddAppointment ? t('common.cancel') : t('appointmentsSection.addAppointment')}
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-[#53868e]/25">
        <button
          type="button"
          onClick={() => setApptSubTab('future')}
          className={`px-3 py-2 text-sm rounded-t border-b -mb-px ${
            apptSubTab === 'future'
              ? 'border-stone-400 text-[#2b5843] font-medium bg-[#f6f3f1]'
              : 'border-transparent text-[#2b5843]/70 hover:text-[#2b5843]/90'
          }`}
        >
          {t('appointmentsSection.future')} {upcomingAppts.length > 0 && `(${upcomingAppts.length})`}
        </button>
        <button
          type="button"
          onClick={() => setApptSubTab('history')}
          className={`px-3 py-2 text-sm rounded-t border-b -mb-px ${
            apptSubTab === 'history'
              ? 'border-stone-400 text-[#2b5843] font-medium bg-[#f6f3f1]'
              : 'border-transparent text-[#2b5843]/70 hover:text-[#2b5843]/90'
          }`}
        >
          {t('appointmentsSection.history')} {pastAppts.length > 0 && `(${pastAppts.length})`}
        </button>
      </div>

      {showAddAppointment && (
        <div className="mb-6 p-4 border border-[#53868e]/25 rounded-xl bg-[#f6f3f1] space-y-3">
          {conflictError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
              {conflictError}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.representLabel')}</label>
            <div className="flex gap-1 flex-wrap justify-end">
              {(['buyer', 'seller', 'tenant', 'landlord'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setPartyRole(role)
                    if (role === 'seller' || role === 'landlord') {
                      setGroupId('')
                      // 代表房东/卖家时房源只来自 listing 客户，若当前选中的房源不在其列则清空
                      const listingIds = role === 'landlord'
                        ? listingGroups.filter((g) => g.intent === 'rent' && g.property_id).map((g) => g.property_id!)
                        : listingGroups.filter((g) => g.intent === 'sale' && g.property_id).map((g) => g.property_id!)
                      if (propId && !listingIds.includes(propId)) setPropId('')
                    } else {
                      setCustomerInfo(''); setCustomerPhone('')
                      setPropId(''); setPropertyLinkInput('')
                      const nextIntent = role === 'buyer' ? 'buy' : 'rent'
                      if (groupId && !activeGroups.find((g) => g.id === groupId && g.intent === nextIntent)) setGroupId('')
                    }
                  }}
                  className={`px-2.5 py-1 text-xs rounded-xl border ${
                    partyRole === role
                      ? 'border-stone-600 bg-[#53868e]/10 text-[#2b5843]'
                      : 'border-[#53868e]/25 text-[#2b5843]/80 hover:bg-[#53868e]/10'
                  }`}
                >
                  {PARTY_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">房源</label>
            {isSellerOrLandlord ? (
              <select
                value={propId}
                onChange={(e) => { setPropId(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              >
                <option value="">{t('appointmentsSection.selectProperty')}</option>
                {propertiesForPartyRole.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.listing_type === 'rent' ? t('clientView.rent') : p.listing_type === 'sale' ? t('clientView.sale') : t('appointmentsSection.unknown')}] {p.title}{formatPriceDisplay(p) ? ` - ${formatPriceDisplay(p)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 mt-1">
                <input
                  value={propertyLinkInput}
                  onChange={(e) => setPropertyLinkInput(e.target.value)}
                  placeholder={t('appointmentsSection.propertyLinkPlaceholder')}
                  className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                />
              </div>
            )}
          </div>
          {needsCustomerGroup && !clientMode && (
            <div>
              <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.selectGroup')}</label>
              <select
                value={groupId}
                onChange={(e) => { setGroupId(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              >
                <option value="">{t('appointmentsSection.selectGroup')}</option>
                {groupsForPartyRole.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          {isSellerOrLandlord && (
            <>
              <div>
                <label className="text-xs text-[#2b5843]/80">潜在{buyerOrTenantLabel}手机号（可选）</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t('appointmentsSection.phonePlaceholder')}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.customerInfo')}</label>
                <input
                  value={customerInfo}
                  onChange={(e) => setCustomerInfo(e.target.value)}
                  placeholder={t('appointmentsSection.customerInfoPlaceholder')}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.viewTime')}</label>
            {createConflictInfo && (
              <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200" title={createConflictInfo}>
                {t('appointmentsSection.timeConflict')}
              </span>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              <input
                type="date"
                value={startTime ? startTime.slice(0, 10) : ''}
                onChange={(e) => {
                  const d = e.target.value
                  const t = startTime ? startTime.slice(11, 16) : '09:00'
                  setStartTime(d ? `${d}T${t}` : '')
                  setConflictError(null)
                }}
                className="flex-1 min-w-[120px] px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              />
              <select
                value={startTime ? startTime.slice(11, 13) : ''}
                onChange={(e) => {
                  const h = e.target.value
                  const m = startTime ? startTime.slice(14, 16) : '00'
                  const d = startTime ? startTime.slice(0, 10) : new Date().toISOString().slice(0, 10)
                  setStartTime(h ? `${d}T${h}:${m}` : '')
                  setConflictError(null)
                }}
                className="w-20 px-2 py-2 border border-[#53868e]/25 rounded-xl text-sm bg-[#f6f3f1]"
              >
                <option value="">{t('scheduleSection.hourSuffix') || ''}</option>
                {Array.from({ length: 18 }, (_, i) => {
                  const h = i + 6
                  return (
                    <option key={h} value={String(h).padStart(2, '0')}>
                      {h}{t('scheduleSection.hourSuffix')}
                    </option>
                  )
                })}
              </select>
              <select
                value={startTime ? startTime.slice(14, 16) : ''}
                onChange={(e) => {
                  const m = e.target.value
                  const h = startTime ? startTime.slice(11, 13) : '09'
                  const d = startTime ? startTime.slice(0, 10) : new Date().toISOString().slice(0, 10)
                  setStartTime(m !== '' ? `${d}T${h}:${m}` : '')
                  setConflictError(null)
                }}
                className="w-24 px-2 py-2 border border-[#53868e]/25 rounded-xl text-sm bg-[#f6f3f1]"
              >
                <option value="">{t('scheduleSection.minuteSuffix') || ''}</option>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={String(m).padStart(2, '0')}>
                    {m}{t('scheduleSection.minuteSuffix')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.notesOptional')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('appointmentsSection.notesPlaceholder')}
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={appointments.create.isPending || isCreatingAppointment}
            className="text-sm px-4 py-2 border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
          >
            {t('common.create')}
          </button>
        </div>
      )}

      {editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8" onClick={() => setEditingAppointment(null)}>
          <div
            className="bg-[#f6f3f1] rounded-xl border border-[#53868e]/25 p-5 w-full max-w-md shadow-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-[#2b5843] mb-3">{t('appointmentsSection.editTitle')}</h3>
            {conflictError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200 mb-3">
                {conflictError}
              </p>
            )}
            {editConflictInfo && !conflictError && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 mb-3" title={editConflictInfo}>
                {t('appointmentsSection.timeConflict')}
              </span>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.representLabel')}</label>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(['buyer', 'seller', 'tenant', 'landlord'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setEditPartyRole(role)
                        if (role === 'seller' || role === 'landlord') {
                          setEditGroupId('')
                          const listingIds = role === 'landlord'
                            ? listingGroups.filter((g) => g.intent === 'rent' && g.property_id).map((g) => g.property_id!)
                            : listingGroups.filter((g) => g.intent === 'sale' && g.property_id).map((g) => g.property_id!)
                          if (editPropId && !listingIds.includes(editPropId)) setEditPropId('')
                        } else {
                          setEditCustomerInfo(''); setEditCustomerPhone('')
                          const nextIntent = role === 'buyer' ? 'buy' : 'rent'
                          if (editGroupId && !activeGroups.find((g) => g.id === editGroupId && g.intent === nextIntent)) setEditGroupId('')
                        }
                      }}
                      className={`px-2.5 py-1 text-xs rounded-xl border ${
                        editPartyRole === role
                          ? 'border-stone-600 bg-[#53868e]/10 text-[#2b5843]'
                          : 'border-[#53868e]/25 text-[#2b5843]/80 hover:bg-[#53868e]/10'
                      }`}
                    >
                      {PARTY_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#2b5843]/80">房源</label>
                <select
                  value={editPropId}
                  onChange={(e) => { setEditPropId(e.target.value); setConflictError(null) }}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                >
                  <option value="">{t('appointmentsSection.selectProperty')}</option>
                  {propertiesForEditPartyRole.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.listing_type === 'rent' ? t('clientView.rent') : p.listing_type === 'sale' ? t('clientView.sale') : t('appointmentsSection.unknown')}] {p.title}{formatPriceDisplay(p) ? ` - ${formatPriceDisplay(p)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {editNeedsCustomerGroup && (
                <div>
                  <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.selectGroup')}</label>
                  <select
                    value={editGroupId}
                    onChange={(e) => { setEditGroupId(e.target.value); setConflictError(null) }}
                    className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                  >
                    <option value="">{t('appointmentsSection.selectGroup')}</option>
                    {groupsForEditPartyRole.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editIsSellerOrLandlord && (
                <>
                  <div>
                    <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.potentialBuyerPhone', { role: editPartyRole === 'seller' ? t('partyRole.buyer') : t('partyRole.tenant') })}</label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="如：81234567 或 +65 8123 4567"
                      className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#2b5843]/80">客户信息（可选）</label>
                    <input
                      value={editCustomerInfo}
                      onChange={(e) => setEditCustomerInfo(e.target.value)}
                      placeholder="如：潜在买家/租客姓名等"
                      className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.viewTime')}</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <input
                    type="date"
                    value={editStartTime ? editStartTime.slice(0, 10) : ''}
                    onChange={(e) => {
                      const d = e.target.value
                      const t = editStartTime ? editStartTime.slice(11, 16) : '09:00'
                      setEditStartTime(d ? `${d}T${t}` : '')
                      setConflictError(null)
                    }}
                    className="flex-1 min-w-[120px] px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
                  />
                  <select
                    value={editStartTime ? editStartTime.slice(11, 13) : ''}
                    onChange={(e) => {
                      const h = e.target.value
                      const m = editStartTime ? editStartTime.slice(14, 16) : '00'
                      const d = editStartTime ? editStartTime.slice(0, 10) : new Date().toISOString().slice(0, 10)
                      setEditStartTime(h ? `${d}T${h}:${m}` : '')
                      setConflictError(null)
                    }}
                    className="w-20 px-2 py-2 border border-[#53868e]/25 rounded-xl text-sm bg-[#f6f3f1]"
                  >
                    <option value="">{t('scheduleSection.hourSuffix') || ''}</option>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hour = i + 6
                      return (
                        <option key={hour} value={String(hour).padStart(2, '0')}>
                          {hour}{t('scheduleSection.hourSuffix')}
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={editStartTime ? editStartTime.slice(14, 16) : ''}
                    onChange={(e) => {
                      const m = e.target.value
                      const h = editStartTime ? editStartTime.slice(11, 13) : '09'
                      const d = editStartTime ? editStartTime.slice(0, 10) : new Date().toISOString().slice(0, 10)
                      setEditStartTime(m !== '' ? `${d}T${h}:${m}` : '')
                      setConflictError(null)
                    }}
                    className="w-24 px-2 py-2 border border-[#53868e]/25 rounded-xl text-sm bg-[#f6f3f1]"
                  >
                    <option value="">{t('scheduleSection.minuteSuffix') || ''}</option>
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((min) => (
                      <option key={min} value={String(min).padStart(2, '0')}>
                        {min}{t('scheduleSection.minuteSuffix')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#2b5843]/80">{t('appointmentsSection.notesOptional')}</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder={t('appointmentsSection.notesPlaceholder')}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  disabled={appointments.update.isPending}
                  className="flex-1 text-sm px-4 py-2 border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
                <button
                  onClick={() => setEditingAppointment(null)}
                  className="text-sm px-4 py-2 border border-[#53868e]/25 rounded-xl hover:bg-[#53868e]/15"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {displayAppts.length === 0 ? (
          <p className="text-sm text-[#2b5843]/70 py-8 text-center">
            {apptSubTab === 'future' ? t('appointmentsSection.noFuture') : t('appointmentsSection.noHistory')}
          </p>
        ) : sortedDates.map((date) => {
          const list = groupedByDate[date]
          const dayItems = buildDayDisplayItems(list)
          const sellerVariant = getSavedSellerMergedVariant()
          return (
          <div key={date}>
            <p className="text-xs text-[#2b5843]/70 mb-2">{new Date(date).toLocaleDateString('zh-CN')}</p>
            <div className="space-y-2">
              {dayItems.map((item) => {
                if (item.type === 'merged') {
                  return (
                    <SellerMergedCard
                      key={`merged-${item.block.property.id}-${date}`}
                      block={item.block}
                      variant={sellerVariant}
                      t={t as (k: string, o?: Record<string, unknown>) => string}
                      renderActions={() => (
                        item.block.property && (item.block.property.source_url || item.block.property.link) && isSupportedScrapeUrl((item.block.property.source_url || item.block.property.link)!) ? (
                          <button
                            onClick={() => handleRefreshProperty(item.block.property)}
                            disabled={refreshingPropertyId === item.block.property.id}
                            className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90 disabled:opacity-50 flex items-center gap-1"
                            title={t('pendingSection.refreshTitle')}
                          >
                            {refreshingPropertyId === item.block.property.id ? (
                              <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                              </svg>
                            )}
                            {t('common.refresh')}
                          </button>
                        ) : null
                      )}
                      renderRowActions={(a) => (
                        <span className="flex gap-2 items-center">
                          <button onClick={() => handleOpenEdit(a)} className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90">{t('common.edit')}</button>
                          <Popconfirm title={t('appointmentsSection.deleteAppointmentConfirm')} onConfirm={() => appointments.remove.mutate(a.id)} okText={t('common.confirm')} cancelText={t('common.cancel')} icon={null}>
                            <button className="text-xs text-[#2b5843]/60 hover:text-red-600">{t('common.delete')}</button>
                          </Popconfirm>
                        </span>
                      )}
                    />
                  )
                }
                const a = item.appointment
                const prop = a.properties as Property | undefined
                const agentName = prop?.listing_agent_name
                const agentPhone = prop?.listing_agent_phone
                const isMeListingAgent = a.party_role === 'seller' || a.party_role === 'landlord'
                const hasAgent = !isMeListingAgent && (agentName || agentPhone)
                const whatsappUrl = agentPhone ? getWhatsAppChatUrl(agentPhone) : null
                const customerPhone = a.customer_phone
                const customerWhatsAppUrl = customerPhone ? getWhatsAppChatUrl(customerPhone) : null
                const existingForConflict = (allAppointments.data ?? [])
                  .filter((x) => x.status !== 'cancelled')
                  .map((x) => ({ id: x.id, start_time: x.start_time, end_time: x.end_time }))
                const { hasConflict: hasConflictTag } = checkAppointmentConflict(
                  a.start_time,
                  a.end_time,
                  existingForConflict,
                  a.id
                )

                if (isMeListingAgent) {
                  return (
                    <div
                      key={a.id}
                      className="border-l-4 border-amber-500 rounded-r-xl overflow-hidden bg-[#fffbeb] shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 shrink-0">
                              {t('appointmentsSection.represent', { role: PARTY_ROLE_LABELS[a.party_role] })}
                            </span>
                            {hasConflictTag && (
                              <span className="px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 shrink-0">
                                {t('appointmentsSection.timeConflict')}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-semibold text-base leading-tight text-[#2b5843] break-words">{prop?.title ?? '—'}</p>
                        <p className="text-[#2b5843]/70 text-sm">
                          {new Date(a.start_time).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {a.notes && (
                          <p className="text-[#2b5843]/80 text-sm px-3 py-2 rounded-lg bg-amber-100/50 border border-amber-200/50">
                            {t('appointmentsSection.agentNote')}：{a.notes}
                          </p>
                        )}
                        {(a.customer_info || customerPhone) && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[#2b5843]/80">
                              {t('appointmentsSection.potentialBuyer', { role: a.party_role === 'seller' ? t('partyRole.buyer') : t('partyRole.tenant') })}
                              {a.customer_info && <span className="font-medium text-[#2b5843]/90">{a.customer_info}</span>}
                              {a.customer_info && customerPhone && <span className="text-[#2b5843]/60 mx-1">·</span>}
                              {customerPhone && (
                                <a href={getTelUrl(customerPhone)} className="font-medium text-[#2b5843]/90 hover:underline ml-1">
                                  {customerPhone}
                                </a>
                              )}
                            </span>
                            {customerWhatsAppUrl && (
                              <a
                                href={customerWhatsAppUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A]"
                              >
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t border-amber-200/50 shrink-0">
                          {prop && (prop.source_url || prop.link) && isSupportedScrapeUrl((prop.source_url || prop.link)!) && (
                            <button
                              onClick={() => handleRefreshProperty(prop)}
                              disabled={refreshingPropertyId === prop.id}
                              className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90 disabled:opacity-50 flex items-center gap-1"
                              title={t('pendingSection.refreshTitle')}
                            >
                              {refreshingPropertyId === prop.id ? (
                                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                </svg>
                              )}
                              {t('common.refresh')}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(a)}
                            className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90"
                          >
                            {t('common.edit')}
                          </button>
                          <Popconfirm
                            title={t('appointmentsSection.deleteAppointmentConfirm')}
                            onConfirm={() => appointments.remove.mutate(a.id)}
                            okText={t('common.confirm')}
                            cancelText={t('common.cancel')}
                            icon={null}
                          >
                            <button className="text-xs text-[#2b5843]/60 hover:text-red-600">
                              {t('common.delete')}
                            </button>
                          </Popconfirm>
                        </div>
                      </div>
                    </div>
                  )
                }

                const imgs = displayImages(prop)
                return (
                  <div
                    key={a.id}
                    className="border border-[#53868e]/25 rounded-xl overflow-hidden bg-[#f6f3f1] shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row"
                  >
                    <div className={`flex flex-col w-full sm:w-[166px] flex-shrink-0 gap-0.5 p-2 bg-[#53868e]/5 order-1 sm:order-none ${imgs.length <= 1 ? 'justify-center' : ''}`}>
                      {imgs[0] ? (
                        <button
                          type="button"
                          onClick={() => setLightboxImage(imgs[0])}
                          className={`block w-full rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left ${imgs.length >= 2 ? 'h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3]' : 'h-40 sm:h-auto sm:w-[150px] sm:aspect-[4/3]'}`}
                        >
                          <img src={imgs[0]} alt={prop?.title ?? ''} className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <div className="w-full h-20 rounded-lg bg-[#53868e]/15 flex items-center justify-center text-[#2b5843]/60 text-xs">{t('common.noImage')}</div>
                      )}
                      {imgs[1] && (
                        <button type="button" onClick={() => setLightboxImage(imgs[1])} className="block w-full h-[160px] sm:h-auto sm:w-[150px] sm:aspect-[4/3] rounded-lg overflow-hidden cursor-zoom-in hover:opacity-90 transition-opacity text-left">
                          <img src={imgs[1]} alt={prop?.title ?? ''} className="w-full h-full object-cover" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-4 flex flex-col justify-between order-2 sm:order-none">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <p className="font-semibold text-base leading-tight text-[#2b5843] break-words">{prop?.title ?? '—'}</p>
                            {prop?.listing_type && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${prop.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {prop.listing_type === 'rent' ? t('clientView.rent') : t('clientView.sale')}
                              </span>
                            )}
                            {(a.party_role === 'seller' || a.party_role === 'landlord') && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-[#53868e]/10 text-[#2b5843]/90 shrink-0">
                                {t('appointmentsSection.represent', { role: PARTY_ROLE_LABELS[a.party_role] })}
                              </span>
                            )}
                            {hasConflictTag && (
                              <span className="px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 shrink-0">
                                {t('appointmentsSection.timeConflict')}
                              </span>
                            )}
                          </div>
                          {formatPriceDisplay(prop!) && (
                            <span className="font-medium text-emerald-700 shrink-0">{formatPriceDisplay(prop!)}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-sm text-[#2b5843]/80">
                          {prop?.bedrooms && <span>{prop.bedrooms}</span>}
                          {prop?.bathrooms && <span>{prop.bathrooms}</span>}
                          {(prop?.size_sqft || prop?.basic_info) && (
                            <span>{(prop.size_sqft || prop.basic_info)}</span>
                          )}
                          {prop?.listing_type === 'sale' && prop?.lease_tenure && (
                            <span className="text-[#2b5843]/70">{prop.lease_tenure}</span>
                          )}
                          {prop?.top_year && <span className="text-[#2b5843]/70">{prop.top_year}</span>}
                        </div>
                        <p className="text-[#2b5843]/70 text-sm mt-2">
                          {(a.customer_groups as CustomerGroup | null)?.name ?? a.customer_info ?? t('appointmentsSection.represent', { role: PARTY_ROLE_LABELS[a.party_role ?? 'buyer'] })} ·{' '}
                          {new Date(a.start_time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {a.notes && (
                          <p className="text-[#2b5843]/80 text-sm mt-2 px-3 py-2 rounded-lg bg-[#53868e]/5 border border-[#53868e]/15">
                            {t('appointmentsSection.agentNote')}：{a.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
                          {prop?.floor_plan_url && (
                            <button type="button" onClick={() => setLightboxImage(prop.floor_plan_url!)} className="text-emerald-600 hover:underline font-medium">
                              户型图
                            </button>
                          )}
                          {prop?.site_plan_url && (
                            <button type="button" onClick={() => setLightboxImage(prop.site_plan_url!)} className="text-emerald-600 hover:underline font-medium">
{t('clientView.sitePlan')}
                                  </button>
                          )}
                          {prop?.link && (
                            <a href={prop.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">
                              {t('clientView.viewProperty')}
                            </a>
                          )}
                        </div>
                        {(customerPhone || hasAgent) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {customerPhone && (
                              <>
                                <span className="text-xs text-[#2b5843]/80">
                                  {t('appointmentsSection.potentialBuyer', { role: a.party_role === 'seller' ? t('partyRole.buyer') : t('partyRole.tenant') })}
                                  <a href={getTelUrl(customerPhone)} className="font-medium text-[#2b5843]/90 hover:underline ml-1">
                                    {customerPhone}
                                  </a>
                                </span>
                                {customerWhatsAppUrl && (
                                  <a
                                    href={customerWhatsAppUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A]"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WhatsApp
                                  </a>
                                )}
                              </>
                            )}
                            {hasAgent && (
                              <>
                                <span className="text-xs text-[#2b5843]/80">
                                  {t('appointmentsSection.listingAgent')}
                                  {agentName && <span className="font-medium text-[#2b5843]/90">{agentName}</span>}
                                  {agentName && agentPhone && <span className="text-[#2b5843]/60 mx-1">·</span>}
                                  {agentPhone && (
                                    <a href={getTelUrl(agentPhone)} className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                                      {agentPhone}
                                    </a>
                                  )}
                                </span>
                                {whatsappUrl && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl bg-[#25D366] text-white hover:bg-[#20BD5A]"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WhatsApp
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#53868e]/15 shrink-0">
                        {prop && (prop.source_url || prop.link) && isSupportedScrapeUrl((prop.source_url || prop.link)!) && (
                          <button
                            onClick={() => handleRefreshProperty(prop)}
                            disabled={refreshingPropertyId === prop.id}
                            className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90 disabled:opacity-50 flex items-center gap-1"
                            title={t('pendingSection.refreshTitle')}
                          >
                            {refreshingPropertyId === prop.id ? (
                              <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                              </svg>
                            )}
                            {t('common.refresh')}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(a)}
                          className="text-xs text-[#2b5843]/60 hover:text-[#2b5843]/90"
                        >
                          {t('common.edit')}
                        </button>
                        <Popconfirm
                          title={t('appointmentsSection.deleteAppointmentConfirm')}
                          onConfirm={() => appointments.remove.mutate(a.id)}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                          icon={null}
                        >
                          <button className="text-xs text-[#2b5843]/60 hover:text-red-600">
                            {t('common.delete')}
                          </button>
                        </Popconfirm>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          )
        })}
      </div>

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
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none micro-btn"
            aria-label={t('common.close')}
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt={t('lightbox.alt')}
            className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg micro-scale"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  )
}

/** 合并后的时间块：同一天、同一客户组、相邻时段的预约合并为一块 */
type ScheduleBlock = {
  customerGroupId: string
  customerGroupName: string
  partyRole: PartyRole
  startTime: string
  endTime: string
  appointments: Appointment[]
  propertyCount: number
  /** 自定义事件（用户手动添加） */
  customEvent?: import('@/lib/scheduleCustomEvents').ScheduleCustomEvent
}

/** 时间轴条目：预约块或空闲时段 */
type TimelineItem =
  | { type: 'appointment'; block: ScheduleBlock }
  | { type: 'free'; startTime: string; endTime: string; durationMinutes: number }

const MERGE_GAP_MS = 30 * 60 * 1000 // 30 分钟内视为相邻，可合并
const SELLER_START_GAP_MS = 45 * 60 * 1000 // 卖家/房东：两预约起始时间差 ≤ 45 分钟则合并，不显示休息

function mergeAppointmentsIntoBlocks(
  appointments: Appointment[],
  getRepresentLabel: (role: PartyRole) => string
): ScheduleBlock[] {
  if (appointments.length === 0) return []
  const byDateAndGroup = new Map<string, Appointment[]>()
  for (const a of appointments) {
    const dateKey = new Date(a.start_time).toDateString()
    const groupId = a.customer_group_id ?? `standalone-${a.id}`
    const key = `${dateKey}|${groupId}`
    if (!byDateAndGroup.has(key)) byDateAndGroup.set(key, [])
    byDateAndGroup.get(key)!.push(a)
  }
  const blocks: ScheduleBlock[] = []
  for (const list of byDateAndGroup.values()) {
    list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const group = list[0]
    const role = (group.party_role ?? 'buyer') as PartyRole
    const name = (group.customer_groups as CustomerGroup | null)?.name ?? group.customer_info ?? getRepresentLabel(role)
    let startMs = new Date(list[0].start_time).getTime()
    let endMs = new Date(list[0].end_time).getTime()
    const merged: Appointment[] = [list[0]]
    for (let i = 1; i < list.length; i++) {
      const next = list[i]
      const nextStart = new Date(next.start_time).getTime()
      const nextEnd = new Date(next.end_time).getTime()
      if (nextStart <= endMs + MERGE_GAP_MS) {
        endMs = Math.max(endMs, nextEnd)
        merged.push(next)
      } else {
        blocks.push({
          customerGroupId: group.customer_group_id ?? `standalone-${group.id}`,
          customerGroupName: name,
          partyRole: (group.party_role ?? 'buyer') as PartyRole,
          startTime: new Date(startMs).toISOString(),
          endTime: new Date(endMs).toISOString(),
          appointments: [...merged],
          propertyCount: merged.length,
        })
        startMs = nextStart
        endMs = nextEnd
        merged.length = 0
        merged.push(next)
      }
    }
    blocks.push({
      customerGroupId: group.customer_group_id ?? `standalone-${group.id}`,
      customerGroupName: name,
      partyRole: (group.party_role ?? 'buyer') as PartyRole,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      appointments: [...merged],
      propertyCount: merged.length,
    })
  }
  blocks.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  return blocks
}

/** 合并同一天内、同一客户的连续时间块 */
function mergeConsecutiveSameCustomerBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  if (blocks.length === 0) return []
  const merged: ScheduleBlock[] = []
  let current = { ...blocks[0], appointments: [...blocks[0].appointments], propertyCount: blocks[0].propertyCount }
  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i]
    if (next.customerGroupId === current.customerGroupId) {
      current.endTime = next.endTime
      current.appointments.push(...next.appointments)
      current.propertyCount = current.appointments.length
    } else {
      merged.push(current)
      current = { ...next, appointments: [...next.appointments], propertyCount: next.propertyCount }
    }
  }
  merged.push(current)
  return merged
}

/** 合并连续卖家/房东块：起始时间差 < 45 分钟则不显示休息，合并展示 */
function mergeConsecutiveSellerBlocksByStartGap(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const sellerRoles: PartyRole[] = ['seller', 'landlord']
  if (blocks.length === 0) return []
  const merged: ScheduleBlock[] = []
  let current = { ...blocks[0], appointments: [...blocks[0].appointments], propertyCount: blocks[0].propertyCount }
  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i]
    const currIsSeller = sellerRoles.includes(current.partyRole)
    const nextIsSeller = sellerRoles.includes(next.partyRole)
    const currStartMs = new Date(current.startTime).getTime()
    const nextStartMs = new Date(next.startTime).getTime()
    const startGapMs = nextStartMs - currStartMs
    if (currIsSeller && nextIsSeller && startGapMs <= SELLER_START_GAP_MS) {
      current.endTime = next.endTime
      current.appointments.push(...next.appointments)
      current.propertyCount = current.appointments.length
    } else {
      merged.push(current)
      current = { ...next, appointments: [...next.appointments], propertyCount: next.propertyCount }
    }
  }
  merged.push(current)
  return merged
}

/** 为某天的预约块插入空闲时段，生成时间轴条目列表（仅在不同客户之间显示空闲） */
function buildTimelineWithFreeSlots(blocks: ScheduleBlock[]): TimelineItem[] {
  if (blocks.length === 0) return []
  const items: TimelineItem[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    items.push({ type: 'appointment', block })
    if (i < blocks.length - 1) {
      const thisEnd = new Date(block.endTime).getTime()
      const nextStart = new Date(blocks[i + 1].startTime).getTime()
      const gapMs = nextStart - thisEnd
      const gapMinutes = Math.round(gapMs / 60000)
      if (gapMinutes > 0) {
        items.push({
          type: 'free',
          startTime: block.endTime,
          endTime: blocks[i + 1].startTime,
          durationMinutes: gapMinutes,
        })
      }
    }
  }
  return items
}

function customEventToBlock(ce: import('@/lib/scheduleCustomEvents').ScheduleCustomEvent): ScheduleBlock {
  return {
    customerGroupId: `custom-${ce.id}`,
    customerGroupName: ce.name,
    partyRole: 'buyer',
    startTime: ce.startTime,
    endTime: ce.endTime,
    appointments: [],
    propertyCount: 0,
    customEvent: ce,
  }
}

function AgentScheduleSection({
  appointments,
  groups,
}: {
  appointments: ReturnType<typeof useAppointments>
  groups: ReturnType<typeof useCustomerGroups>
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const PARTY_ROLE_LABELS = usePartyRoleLabels()
  const [rangeMode, setRangeMode] = useState<'twoWeeks' | 'all'>('twoWeeks')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<import('@/lib/scheduleCustomEvents').ScheduleCustomEvent | null>(null)
  const [customEvents, setCustomEvents] = useState<import('@/lib/scheduleCustomEvents').ScheduleCustomEvent[]>([])

  useEffect(() => {
    if (user?.id) setCustomEvents(getCustomEvents(user.id))
  }, [user?.id])

  const activeGroupIds = new Set(groups.data?.filter((g) => g.is_active !== false).map((g) => g.id) ?? [])
  const rawAppts = appointments.data ?? []
  const appts = rawAppts.filter((a) => !a.customer_group_id || activeGroupIds.has(a.customer_group_id))
  const now = new Date()
  const future = appts.filter((a) => new Date(a.start_time) >= now)
  const twoWeeksEnd = new Date(now)
  twoWeeksEnd.setDate(twoWeeksEnd.getDate() + 14)
  const filtered =
    rangeMode === 'twoWeeks'
      ? future.filter((a) => new Date(a.start_time) <= twoWeeksEnd)
      : future
  const blocks = mergeAppointmentsIntoBlocks(filtered, (role) => t('appointmentsSection.represent', { role: PARTY_ROLE_LABELS[role] }))
  const byDate = blocks.reduce<Record<string, ScheduleBlock[]>>((acc, b) => {
    const d = new Date(b.startTime).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(b)
    return acc
  }, {})

  // 合并自定义事件
  const futureCustomEvents = customEvents.filter((ce) => new Date(ce.startTime) >= now)
  const rangeCustomEvents =
    rangeMode === 'twoWeeks'
      ? futureCustomEvents.filter((ce) => new Date(ce.startTime) <= twoWeeksEnd)
      : futureCustomEvents
  for (const ce of rangeCustomEvents) {
    const d = new Date(ce.startTime).toDateString()
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(customEventToBlock(ce))
  }
  for (const arr of Object.values(byDate)) {
    arr.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  const sortedDates = Object.keys(byDate).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const handleAddCustomEvent = (event: Omit<import('@/lib/scheduleCustomEvents').ScheduleCustomEvent, 'id'>) => {
    if (!user?.id) return
    addCustomEvent(user.id, event)
    setCustomEvents(getCustomEvents(user.id))
  }

  const handleUpdateCustomEvent = (eventId: string, event: Omit<import('@/lib/scheduleCustomEvents').ScheduleCustomEvent, 'id'>) => {
    if (!user?.id) return
    updateCustomEvent(user.id, eventId, event)
    setCustomEvents(getCustomEvents(user.id))
  }

  const handleDeleteCustomEvent = (eventId: string) => {
    if (!user?.id) return
    deleteCustomEvent(user.id, eventId)
    setCustomEvents(getCustomEvents(user.id))
  }

  const dayNames = i18n.language === 'zh'
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <section>
      <AddCustomEventModal
        open={showAddEvent}
        onClose={() => { setShowAddEvent(false); setEditingEvent(null) }}
        onSubmit={(event) => {
          if (editingEvent) {
            handleUpdateCustomEvent(editingEvent.id, event)
          } else {
            handleAddCustomEvent(event)
          }
          setEditingEvent(null)
          setShowAddEvent(false)
        }}
        initialEvent={editingEvent ?? undefined}
      />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-[#2b5843]/90">{t('scheduleSection.title')}</h2>
          <button
            onClick={() => setShowAddEvent(true)}
            className="micro-btn text-xs px-3 py-1.5 rounded-xl border border-[#53868e]/35 hover:bg-[#53868e]/15 text-[#2b5843]/90"
          >
            + {t('scheduleSection.addEvent')}
          </button>
        </div>
        <div className="flex gap-1 border border-[#53868e]/25 rounded-xl p-0.5">
          <button
            onClick={() => setRangeMode('twoWeeks')}
            className={`px-3 py-1.5 text-sm rounded-xl ${
              rangeMode === 'twoWeeks'
                ? 'bg-stone-800 text-white'
                : 'text-[#2b5843]/80 hover:bg-[#53868e]/15'
            }`}
          >
            {t('scheduleSection.twoWeeks')}
          </button>
          <button
            onClick={() => setRangeMode('all')}
            className={`px-3 py-1.5 text-sm rounded-xl ${
              rangeMode === 'all'
                ? 'bg-stone-800 text-white'
                : 'text-[#2b5843]/80 hover:bg-[#53868e]/15'
            }`}
          >
            {t('scheduleSection.all')}
          </button>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="py-12 text-center text-[#2b5843]/70 text-sm border border-dashed border-[#53868e]/25 rounded-xl">
          {rangeMode === 'twoWeeks'
            ? t('scheduleSection.noTwoWeeks')
            : t('scheduleSection.noFuture')}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const date = new Date(dateStr)
            const dayName = dayNames[date.getDay()]
            const blocksForDate = byDate[dateStr]
            const mergedBlocks = mergeConsecutiveSameCustomerBlocks(blocksForDate)
            const sellerMergedBlocks = mergeConsecutiveSellerBlocksByStartGap(mergedBlocks)
            const timelineItems = buildTimelineWithFreeSlots(sellerMergedBlocks)
            const totalMinutes = timelineItems.reduce((sum, item) => {
              if (item.type === 'appointment') {
                const s = new Date(item.block.startTime).getTime()
                const e = new Date(item.block.endTime).getTime()
                return sum + (e - s) / 60000
              }
              return sum + item.durationMinutes
            }, 0)
            const minDayHeight = Math.max(280, Math.min(500, totalMinutes * 4))

            return (
              <div
                key={dateStr}
                className="border border-[#53868e]/25 rounded-xl bg-[#f6f3f1] overflow-hidden shadow-sm"
              >
                <div className="px-4 py-3 bg-[#53868e]/5 border-b border-[#53868e]/15 flex items-center justify-between">
                  <span className="font-medium text-stone-800 text-sm">
                    {date.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[#2b5843]/70 text-xs">{dayName}</span>
                </div>
                <div
                  className="flex flex-col p-2 gap-1"
                  style={{ minHeight: minDayHeight }}
                >
                  {timelineItems.map((item, idx) => {
                    const durationMinutes = item.type === 'appointment'
                      ? (new Date(item.block.endTime).getTime() - new Date(item.block.startTime).getTime()) / 60000
                      : item.durationMinutes
                    const flexRatio = Math.max(durationMinutes, 5)

                    if (item.type === 'free') {
                      const start = new Date(item.startTime)
                      const end = new Date(item.endTime)
                      const timeStr = `${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                      return (
                        <div
                          key={`free-${idx}-${item.startTime}`}
                          className="flex-shrink-0 flex items-center justify-center rounded-lg bg-emerald-50/80 border border-dashed border-emerald-200/70"
                          style={{ flex: `${flexRatio} 1 0`, minHeight: 48 }}
                        >
                          <p className="text-emerald-700 text-sm">{timeStr}（{t('scheduleSection.mins', { count: item.durationMinutes })}）</p>
                        </div>
                      )
                    }

                    const block = item.block
                    const start = new Date(block.startTime)
                    const end = new Date(block.endTime)
                    const timeStr = `${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`

                    if (block.customEvent) {
                      const ce = block.customEvent
                      return (
                        <div
                          key={`custom-${ce.id}`}
                          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg bg-violet-50 border border-violet-200/70"
                          style={{ flex: `${flexRatio} 1 0`, minHeight: 64 }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-violet-600/80 mb-0.5">{t('scheduleSection.customEventBadge')}</p>
                            <p className="font-medium text-violet-900 text-sm truncate">{ce.name}</p>
                            <p className="text-violet-700/80 text-xs mt-0.5">
                              {timeStr}
                              {ce.location && <span className="ml-1.5 text-violet-600">· {ce.location}</span>}
                            </p>
                          </div>
                          <div className="shrink-0 flex gap-1">
                            <button
                              type="button"
                              onClick={() => { setEditingEvent(ce); setShowAddEvent(true) }}
                              className="micro-btn text-xs px-2 py-1 rounded-lg text-violet-600 hover:bg-violet-200/50 border border-violet-200/60"
                            >
                              {t('common.edit')}
                            </button>
                            <Popconfirm
                              title={t('scheduleSection.deleteCustomEventConfirm')}
                              onConfirm={() => handleDeleteCustomEvent(ce.id)}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                            >
                              <button
                                type="button"
                                className="micro-btn text-xs px-2 py-1 rounded-lg text-violet-600 hover:bg-violet-200/50 border border-violet-200/60"
                              >
                                {t('scheduleSection.deleteCustomEvent')}
                              </button>
                            </Popconfirm>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={`${block.customerGroupId}-${block.startTime}`}
                        className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200/60"
                        style={{ flex: `${flexRatio} 1 0`, minHeight: 64 }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#2b5843]/70 mb-0.5">
                            {t('scheduleSection.serveRole', { role: PARTY_ROLE_LABELS[block.partyRole] })}
                          </p>
                          <p className="font-medium text-[#2b5843] text-sm truncate">
                            {block.customerGroupName}
                          </p>
                          <p className="text-[#2b5843]/80 text-xs mt-0.5">
                            {timeStr}
                            {block.propertyCount > 1 && (
                              <span className="ml-1.5 text-[#2b5843]">
                                · {t('scheduleSection.viewProperties', { count: block.propertyCount })}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 flex gap-1 flex-wrap">
                          {(() => {
                            const seen = new Set<string>()
                            const locations: string[] = []
                            for (const a of block.appointments) {
                              const prop = a.properties as Property | undefined
                              const loc = extractProjectOrLocation(prop?.title) || prop?.title?.trim() || '—'
                              if (loc && !seen.has(loc)) {
                                seen.add(loc)
                                locations.push(loc)
                                if (locations.length >= 3) break
                              }
                            }
                            const totalUnique = new Set(
                              block.appointments
                                .map((a) => extractProjectOrLocation((a.properties as Property | undefined)?.title) || (a.properties as Property | undefined)?.title?.trim())
                                .filter(Boolean)
                            ).size
                            const hasMore = totalUnique > 3
                            return (
                              <>
                                {locations.map((loc) => (
                                  <span
                                    key={loc}
                                    className="text-xs px-2 py-0.5 rounded bg-[#f6f3f1] border border-[#53868e]/25 text-[#2b5843]/80 break-words max-w-full sm:max-w-[140px] line-clamp-2 sm:line-clamp-1"
                                    title={loc}
                                  >
                                    {loc}
                                  </span>
                                ))}
                                {hasMore && (
                                  <span className="text-xs text-[#2b5843]/60 self-center">+{totalUnique - 3}</span>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
