import { useState, useMemo, useEffect } from 'react'
import { UserMenu } from '@/components/UserMenu'
import { useCustomerGroups } from '@/hooks/useCustomerGroups'
import { useProperties } from '@/hooks/useProperties'
import { useAppointments } from '@/hooks/useAppointments'
import { usePendingAppointments } from '@/hooks/usePendingAppointments'
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments'
import { checkAppointmentConflict } from '@/lib/conflictCheck'
import { scrapeProperty } from '@/lib/scrapeApi'
import { getWhatsAppChatUrl } from '@/lib/whatsapp'
import { AgentFeedbackSection } from '@/pages/AgentFeedback'
import type { CustomerGroup, PartyRole, Property, Appointment, PendingAppointment, PendingAppointmentStatus } from '@/types'

const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  buyer: '买家',
  seller: '卖家',
  tenant: '租客',
  landlord: '房东',
}

const PENDING_STATUS_OPTIONS: { value: PendingAppointmentStatus; label: string }[] = [
  { value: 'not_scheduled', label: '还未预约' },
  { value: 'to_consult', label: '待咨询' },
  { value: 'consulted', label: '已咨询' },
  { value: 'awaiting_agent_reply', label: '待对方中介回复正在确认时间' },
]

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState<'groups' | 'appointments' | 'pending' | 'schedule' | 'feedback'>('groups')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showAddAppointment, setShowAddAppointment] = useState(false)

  const groups = useCustomerGroups()
  const properties = useProperties()
  const appointments = useAppointments(selectedGroupId || undefined)
  const allAppointments = useAppointments() // 用于冲突预检（需检查同一 agent 下全部预约）
  const pendingAppointments = usePendingAppointments()
  useRealtimeAppointments(selectedGroupId || undefined)

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/view/` : ''

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-stone-900">看房预约管理</h1>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 border-t border-stone-100">
          {(['groups', 'appointments', 'pending', 'schedule', 'feedback'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm -mb-px border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab === 'groups' && '客户分组'}
              {tab === 'appointments' && '预约'}
              {tab === 'pending' && '待预约'}
              {tab === 'schedule' && '时间表'}
              {tab === 'feedback' && '建议反馈'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'groups' && (
          <CustomerGroupsSection
            groups={groups}
            baseUrl={baseUrl}
            properties={properties}
            pendingAppointments={pendingAppointments}
          />
        )}
        {activeTab === 'appointments' && (
          <AppointmentsSection
            groups={groups}
            properties={properties}
            appointments={appointments}
            allAppointments={allAppointments}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            showAddAppointment={showAddAppointment}
            setShowAddAppointment={setShowAddAppointment}
          />
        )}
        {activeTab === 'pending' && (
          <PendingAppointmentsSection
            pendingAppointments={pendingAppointments}
            properties={properties}
            groups={groups}
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
}: {
  groups: ReturnType<typeof useCustomerGroups>
  baseUrl: string
  properties: ReturnType<typeof useProperties>
  pendingAppointments: ReturnType<typeof usePendingAppointments>
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [addPendingForGroupId, setAddPendingForGroupId] = useState<string | null>(null)
  const [addPendingLink, setAddPendingLink] = useState('')
  const [addPendingNotes, setAddPendingNotes] = useState('')
  const [addPendingLoading, setAddPendingLoading] = useState(false)
  const [addPendingError, setAddPendingError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newIntent, setNewIntent] = useState<'buy' | 'rent'>('buy')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIntent, setEditIntent] = useState<'buy' | 'rent'>('buy')
  const [confirmInactiveId, setConfirmInactiveId] = useState<string | null>(null)

  const handleOpenCreateModal = () => {
    setNewName('')
    setNewDescription('')
    setNewIntent('buy')
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      alert('请输入分组名称')
      return
    }
    try {
      await groups.create.mutateAsync({ name: newName.trim(), description: newDescription.trim() || undefined, intent: newIntent })
      setShowCreateModal(false)
      setNewName('')
      setNewDescription('')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleStartEdit = (g: { id: string; name: string; intent: 'buy' | 'rent' | null }) => {
    setEditingId(g.id)
    setEditName(g.name)
    setEditIntent(g.intent || 'buy')
  }

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await groups.update.mutateAsync({ id: editingId, name: editName.trim(), intent: editIntent })
      setEditingId(null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleSetInactive = async (id: string) => {
    try {
      await groups.update.mutateAsync({ id, is_active: false })
      setConfirmInactiveId(null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      await groups.update.mutateAsync({ id, is_active: true })
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleAddPending = async () => {
    if (!addPendingForGroupId || !addPendingLink.trim()) {
      setAddPendingError('请输入 Property Guru 链接')
      return
    }
    const sourceUrl = normalizeSourceUrl(addPendingLink)
    if (!sourceUrl.includes('propertyguru.com')) {
      setAddPendingError('仅支持 Property Guru 链接')
      return
    }
    setAddPendingError(null)
    setAddPendingLoading(true)
    try {
      const scraped = await scrapeProperty(sourceUrl)
      const existing = await properties.findBySourceUrl(sourceUrl)
      let propId: string
      if (existing) {
        await properties.update.mutateAsync({
          id: existing.id,
          title: scraped.title,
          link: scraped.link,
          basic_info: scraped.basic_info || undefined,
          price: scraped.price || undefined,
          size_sqft: scraped.size_sqft || undefined,
          bedrooms: scraped.bedrooms || undefined,
          bathrooms: scraped.bathrooms || undefined,
          main_image_url: scraped.main_image_url || undefined,
          image_urls: scraped.image_urls || undefined,
          floor_plan_url: scraped.floor_plan_url || undefined,
          site_plan_url: scraped.site_plan_url || existing.site_plan_url || undefined,
          listing_agent_name: scraped.listing_agent_name || undefined,
          listing_agent_phone: scraped.listing_agent_phone || undefined,
          listing_type: scraped.listing_type || undefined,
          lease_tenure: scraped.lease_tenure || undefined,
        })
        propId = existing.id
      } else {
        const created = await properties.create.mutateAsync({
          title: scraped.title,
          link: scraped.link,
          basic_info: scraped.basic_info || undefined,
          source_url: sourceUrl,
          price: scraped.price || undefined,
          size_sqft: scraped.size_sqft || undefined,
          bedrooms: scraped.bedrooms || undefined,
          bathrooms: scraped.bathrooms || undefined,
          main_image_url: scraped.main_image_url || undefined,
          image_urls: scraped.image_urls || undefined,
          floor_plan_url: scraped.floor_plan_url || undefined,
          site_plan_url: scraped.site_plan_url || undefined,
          listing_agent_name: scraped.listing_agent_name || undefined,
          listing_agent_phone: scraped.listing_agent_phone || undefined,
          listing_type: scraped.listing_type || undefined,
          lease_tenure: scraped.lease_tenure || undefined,
        })
        propId = created.id
      }
      await pendingAppointments.create.mutateAsync({
        property_id: propId,
        customer_group_id: addPendingForGroupId,
        status: 'not_scheduled',
        notes: addPendingNotes.trim() || null,
      })
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
      <h2 className="text-sm font-medium text-stone-700 mb-4">客户分组</h2>
      <button
        onClick={handleOpenCreateModal}
        className="mb-6 text-sm border border-stone-300 rounded-sm px-4 py-2 hover:bg-stone-100"
      >
        新建
      </button>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-white rounded-sm shadow-lg p-6 w-full max-w-md mx-4 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-stone-900 mb-4">新建客户分组</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-600">分组名称</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：张先生"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-stone-600">客户需求 <span className="text-amber-600">*必选</span></label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="intent" value="buy" checked={newIntent === 'buy'} onChange={() => setNewIntent('buy')} className="text-emerald-600" />
                    <span className="text-sm">买房</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="intent" value="rent" checked={newIntent === 'rent'} onChange={() => setNewIntent('rent')} className="text-emerald-600" />
                    <span className="text-sm">租房</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-600">描述 / 备注</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="预算范围、备注等..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreate}
                disabled={groups.create.isPending}
                className="px-4 py-2 text-sm border border-stone-300 rounded-sm hover:bg-stone-100"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {addPendingForGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setAddPendingForGroupId(null); setAddPendingError(null) }}>
          <div
            className="bg-white rounded-sm shadow-lg p-6 w-full max-w-md mx-4 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-stone-900 mb-3">
              新增待预约 · {groups.data?.find((g) => g.id === addPendingForGroupId)?.name ?? ''}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-600">房源链接</label>
                <input
                  value={addPendingLink}
                  onChange={(e) => { setAddPendingLink(e.target.value); setAddPendingError(null) }}
                  placeholder="粘贴 Property Guru 链接"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-stone-600">备注（可选）</label>
                <input
                  value={addPendingNotes}
                  onChange={(e) => setAddPendingNotes(e.target.value)}
                  placeholder="正在跟对方讨论、待确认时间等"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                />
              </div>
              {addPendingError && <p className="text-xs text-red-600">{addPendingError}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddPending}
                disabled={addPendingLoading}
                className="px-4 py-2 text-sm border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50 flex items-center gap-2"
              >
                {addPendingLoading && (
                  <svg className="animate-spin h-4 w-4 text-stone-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                添加
              </button>
              <button
                onClick={() => { setAddPendingForGroupId(null); setAddPendingError(null) }}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {groups.data?.map((g) => (
          <div
            key={g.id}
            className="border border-stone-200 rounded-sm bg-white p-4 flex items-center justify-between"
          >
            {editingId === g.id ? (
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-w-[100px] px-2 py-1 border border-stone-200 rounded-sm text-sm"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="radio" name={`edit-intent-${g.id}`} checked={editIntent === 'buy'} onChange={() => setEditIntent('buy')} />
                    买房
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="radio" name={`edit-intent-${g.id}`} checked={editIntent === 'rent'} onChange={() => setEditIntent('rent')} />
                    租房
                  </label>
                </div>
                <button onClick={handleUpdate} className="text-sm text-stone-600">保存</button>
                <button onClick={() => setEditingId(null)} className="text-sm text-stone-400">取消</button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-stone-900 text-sm">{g.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${g.intent === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {g.intent === 'rent' ? '租房' : '买房'}
                    </span>
                    {g.is_active === false && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-200 text-stone-600">
                        inactive
                      </span>
                    )}
                  </div>
                  {g.description && <p className="text-stone-600 text-xs mt-1">{g.description}</p>}
                  <p className="text-stone-500 text-xs mt-1 font-mono">{baseUrl}{g.share_token}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {g.is_active !== false && (
                    <button
                      onClick={() => setAddPendingForGroupId(g.id)}
                      className="text-sm text-amber-600 hover:text-amber-700"
                    >
                      新增待预约
                    </button>
                  )}
                  {g.is_active !== false ? (
                    <button
                      onClick={() => setConfirmInactiveId(g.id)}
                      className="text-sm text-stone-500 hover:text-stone-700"
                    >
                      设为 inactive
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSetActive(g.id)}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      设为 active
                    </button>
                  )}
                  <button
                    onClick={() => handleStartEdit(g)}
                    className="text-sm text-stone-500 hover:text-stone-700"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${baseUrl}${g.share_token}`)
                      alert('链接已复制')
                    }}
                    className="text-sm text-stone-500 hover:text-stone-700"
                  >
                    复制链接
                  </button>
                  <button
                    onClick={() => groups.remove.mutate(g.id)}
                    className="text-sm text-stone-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {confirmInactiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmInactiveId(null)}>
          <div
            className="bg-white rounded-sm border border-stone-200 p-5 w-full max-w-sm shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-stone-900 mb-2">设为 inactive</h3>
            <p className="text-xs text-stone-600 mb-4">
              如果设为 inactive，该客户将不会出现在其他页面的筛选列表中，与其相关的预约和待预约也不会再显示，除非再将其改回 active。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmInactiveId && handleSetInactive(confirmInactiveId)}
                className="flex-1 text-sm px-4 py-2 border border-stone-300 rounded-sm hover:bg-stone-100"
              >
                确认
              </button>
              <button
                onClick={() => setConfirmInactiveId(null)}
                className="text-sm px-4 py-2 border border-stone-200 rounded-sm hover:bg-stone-100"
              >
                取消
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

function PendingAppointmentsSection({
  pendingAppointments,
  properties,
  groups,
}: {
  pendingAppointments: ReturnType<typeof usePendingAppointments>
  properties: ReturnType<typeof useProperties>
  groups: ReturnType<typeof useCustomerGroups>
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null)

  const handleRefreshProperty = async (prop: Property) => {
    const url = prop.source_url || prop.link
    if (!url || !url.includes('propertyguru.com')) {
      alert('该房源无 Property Guru 链接，无法刷新')
      return
    }
    setRefreshingPropertyId(prop.id)
    try {
      const scraped = await scrapeProperty(normalizeSourceUrl(url))
      await properties.update.mutateAsync({
        id: prop.id,
        title: scraped.title,
        link: scraped.link,
        basic_info: scraped.basic_info || undefined,
        price: scraped.price || undefined,
        size_sqft: scraped.size_sqft || undefined,
        bedrooms: scraped.bedrooms || undefined,
        bathrooms: scraped.bathrooms || undefined,
        main_image_url: scraped.main_image_url || undefined,
        image_urls: scraped.image_urls || undefined,
        floor_plan_url: scraped.floor_plan_url || undefined,
        site_plan_url: scraped.site_plan_url || prop.site_plan_url || undefined,
        listing_agent_name: scraped.listing_agent_name || undefined,
        listing_agent_phone: scraped.listing_agent_phone || undefined,
        listing_type: scraped.listing_type || undefined,
        lease_tenure: scraped.lease_tenure || undefined,
      })
    } catch (e) {
      alert((e as Error).message || '刷新失败')
    } finally {
      setRefreshingPropertyId(null)
    }
  }

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      const currentlyExpanded = prev.size === 0 || prev.has(gid)
      if (currentlyExpanded) {
        if (prev.size === 0) groupIds.forEach((id) => { if (id !== gid) next.add(id) })
        next.delete(gid)
      } else {
        next.add(gid)
      }
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
  const isGroupExpanded = (gid: string) => expandedGroups.size === 0 || expandedGroups.has(gid)

  return (
    <section>
      <h2 className="text-sm font-medium text-stone-700 mb-4">待预约</h2>
      <div className="space-y-2">
        {groupIds.length === 0 ? (
          <div className="py-12 text-center text-stone-500 text-sm border border-dashed border-stone-200 rounded-sm">
            暂无待预约，在客户分组卡片旁点击「新增待预约」添加
          </div>
        ) : (
          groupIds.map((gid: string) => {
            const items = byCustomer[gid] ?? []
            const groupName = (items[0]?.customer_groups as CustomerGroup)?.name ?? '—'
            const isExpanded = isGroupExpanded(gid)
            return (
              <div key={gid} className="border border-stone-200 rounded-sm bg-white overflow-hidden">
                <button
                  onClick={() => toggleGroup(gid)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-900 text-sm">{groupName}</span>
                  <span className="text-stone-500 text-xs">{items.length} 条</span>
                  <svg
                    className={`w-5 h-5 text-stone-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-stone-100 divide-y divide-stone-100">
                    {items.map((p: PendingAppointment) => {
                      const prop = p.properties as Property | undefined
                      const agentName = prop?.listing_agent_name
                      const agentPhone = prop?.listing_agent_phone
                      const hasAgent = agentName || agentPhone
                      const whatsappUrl = agentPhone ? getWhatsAppChatUrl(agentPhone) : null
                      return (
                        <div key={p.id} className="p-4 flex justify-between gap-4 bg-white">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-stone-900 text-sm">{prop?.title ?? '—'}</p>
                              {prop?.listing_type && (
                                <span className={`px-1.5 py-0.5 rounded text-xs ${prop.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {prop.listing_type === 'rent' ? '出租' : '出售'}
                                </span>
                              )}
                            </div>
                            <p className="text-stone-500 text-xs mt-1">
                              时间待定
                              {prop?.listing_type === 'sale' && prop?.lease_tenure && (
                                <span className="ml-1.5 text-stone-400">· {prop.lease_tenure}</span>
                              )}
                            </p>
                            {p.notes && (
                              <p className="text-stone-600 text-xs mt-1 bg-stone-50 px-2 py-1 rounded border border-stone-100">
                                备注：{p.notes}
                              </p>
                            )}
                            {hasAgent && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-stone-600">
                                  卖家中介：
                                  {agentName && <span className="font-medium text-stone-700">{agentName}</span>}
                                  {agentName && agentPhone && <span className="text-stone-400 mx-1">·</span>}
                                  {agentPhone && (
                                    <a href={`tel:${agentPhone}`} className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                                      {agentPhone}
                                    </a>
                                  )}
                                </span>
                                {whatsappUrl && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-[#25D366] text-white hover:bg-[#20BD5A]"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WhatsApp
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            {prop && (prop.source_url || prop.link)?.includes('propertyguru.com') && (
                              <button
                                onClick={() => handleRefreshProperty(prop)}
                                disabled={refreshingPropertyId === prop.id}
                                className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-50 flex items-center gap-1"
                                title="重新抓取最新信息"
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
                                刷新
                              </button>
                            )}
                            <select
                              value={p.status}
                              onChange={(e) => {
                                const v = e.target.value as PendingAppointmentStatus
                                pendingAppointments.update.mutate({ id: p.id, status: v })
                              }}
                              className="text-xs border border-stone-200 rounded-sm px-2 py-1.5 bg-white"
                            >
                              {PENDING_STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => pendingAppointments.remove.mutate(p.id)}
                              className="text-xs text-stone-400 hover:text-red-600"
                            >
                              删除
                            </button>
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
}: {
  groups: ReturnType<typeof useCustomerGroups>
  properties: ReturnType<typeof useProperties>
  appointments: ReturnType<typeof useAppointments>
  allAppointments: ReturnType<typeof useAppointments>
  selectedGroupId: string | null
  setSelectedGroupId: (id: string | null) => void
  showAddAppointment: boolean
  setShowAddAppointment: (v: boolean) => void
}) {
  const [propId, setPropId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [partyRole, setPartyRole] = useState<PartyRole>('buyer')
  const [customerInfo, setCustomerInfo] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [propertyInputMode, setPropertyInputMode] = useState<'select' | 'byLink'>('select')
  const [propertyLinkInput, setPropertyLinkInput] = useState('')
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [scrapeSuccess, setScrapeSuccess] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPartyRole, setEditPartyRole] = useState<PartyRole>('buyer')
  const [editPropId, setEditPropId] = useState('')
  const [editGroupId, setEditGroupId] = useState('')
  const [editCustomerInfo, setEditCustomerInfo] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null)

  const handleRefreshProperty = async (prop: Property) => {
    const url = prop.source_url || prop.link
    if (!url || !url.includes('propertyguru.com')) {
      alert('该房源无 Property Guru 链接，无法刷新')
      return
    }
    setRefreshingPropertyId(prop.id)
    try {
      const scraped = await scrapeProperty(normalizeSourceUrl(url))
      await properties.update.mutateAsync({
        id: prop.id,
        title: scraped.title,
        link: scraped.link,
        basic_info: scraped.basic_info || undefined,
        price: scraped.price || undefined,
        size_sqft: scraped.size_sqft || undefined,
        bedrooms: scraped.bedrooms || undefined,
        bathrooms: scraped.bathrooms || undefined,
        main_image_url: scraped.main_image_url || undefined,
        image_urls: scraped.image_urls || undefined,
        floor_plan_url: scraped.floor_plan_url || undefined,
        site_plan_url: scraped.site_plan_url || prop.site_plan_url || undefined,
        listing_agent_name: scraped.listing_agent_name || undefined,
        listing_agent_phone: scraped.listing_agent_phone || undefined,
        listing_type: scraped.listing_type || undefined,
        lease_tenure: scraped.lease_tenure || undefined,
      })
    } catch (e) {
      alert((e as Error).message || '刷新失败')
    } finally {
      setRefreshingPropertyId(null)
    }
  }

  const handleScrapeAndAdd = async () => {
    setScrapeError(null)
    setScrapeSuccess(false)
    if (!propertyLinkInput.trim()) {
      setScrapeError('请输入 Property Guru 链接')
      return
    }
    const sourceUrl = normalizeSourceUrl(propertyLinkInput)
    if (!sourceUrl.includes('propertyguru.com')) {
      setScrapeError('仅支持 Property Guru 链接')
      return
    }
    setScrapeLoading(true)
    try {
      const scraped = await scrapeProperty(sourceUrl)
      const existing = await properties.findBySourceUrl(sourceUrl)
      if (existing) {
        await properties.update.mutateAsync({
          id: existing.id,
          title: scraped.title,
          link: scraped.link,
          basic_info: scraped.basic_info || undefined,
          price: scraped.price || undefined,
          size_sqft: scraped.size_sqft || undefined,
          bedrooms: scraped.bedrooms || undefined,
          bathrooms: scraped.bathrooms || undefined,
          main_image_url: scraped.main_image_url || undefined,
          image_urls: scraped.image_urls || undefined,
          floor_plan_url: scraped.floor_plan_url || undefined,
          site_plan_url: scraped.site_plan_url || existing.site_plan_url || undefined,
          listing_agent_name: scraped.listing_agent_name || undefined,
          listing_agent_phone: scraped.listing_agent_phone || undefined,
          listing_type: scraped.listing_type || undefined,
          lease_tenure: scraped.lease_tenure || undefined,
        })
        setPropId(existing.id)
      } else {
        const created = await properties.create.mutateAsync({
          title: scraped.title,
          link: scraped.link,
          basic_info: scraped.basic_info || undefined,
          source_url: sourceUrl,
          price: scraped.price || undefined,
          size_sqft: scraped.size_sqft || undefined,
          bedrooms: scraped.bedrooms || undefined,
          bathrooms: scraped.bathrooms || undefined,
          main_image_url: scraped.main_image_url || undefined,
          image_urls: scraped.image_urls || undefined,
          floor_plan_url: scraped.floor_plan_url || undefined,
          site_plan_url: scraped.site_plan_url || undefined,
          listing_agent_name: scraped.listing_agent_name || undefined,
          listing_agent_phone: scraped.listing_agent_phone || undefined,
          listing_type: scraped.listing_type || undefined,
          lease_tenure: scraped.lease_tenure || undefined,
        })
        setPropId(created.id)
      }
      setScrapeSuccess(true)
      setTimeout(() => {
        setPropertyInputMode('select')
        setPropertyLinkInput('')
        setScrapeSuccess(false)
      }, 600)
    } catch (e) {
      setScrapeError((e as Error).message)
    } finally {
      setScrapeLoading(false)
    }
  }

  const needsCustomerGroup = partyRole === 'buyer' || partyRole === 'tenant'
  const isSellerOrLandlord = partyRole === 'seller' || partyRole === 'landlord'
  const buyerOrTenantLabel = partyRole === 'seller' ? '买家' : '租客'

  // 实时计算新增预约是否有时间冲突（用于红色标签展示）
  const createConflictInfo = useMemo(() => {
    if (!startTime || !propId) return null
    if (needsCustomerGroup && !groupId) return null
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
      return `与已有预约冲突：${new Date(conflictingWith.start_time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    }
    return '请调整时间后再提交'
  }, [startTime, propId, groupId, partyRole, allAppointments.data])

  const handleCreate = async () => {
    setConflictError(null)
    if (!propId || !startTime) {
      alert('请填写完整')
      return
    }
    if (needsCustomerGroup && !groupId) {
      alert('请选择客户分组')
      return
    }
    const startDate = new Date(startTime)
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000)
    const startIso = startDate.toISOString()
    const endIso = endDate.toISOString()
    try {
      await appointments.create.mutateAsync({
        property_id: propId,
        party_role: partyRole,
        customer_group_id: needsCustomerGroup ? groupId : null,
        customer_info: isSellerOrLandlord ? (customerInfo.trim() || null) : null,
        customer_phone: isSellerOrLandlord ? (customerPhone.trim() || null) : null,
        start_time: startIso,
        end_time: endIso,
        notes: notes.trim() || null,
      })
      setShowAddAppointment(false)
      setPropId('')
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
        setConflictError('时间与已有预约冲突，请调整时段')
      } else {
        alert(err?.message || '创建失败')
      }
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
      return `与已有预约冲突：${new Date(conflictingWith.start_time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    }
    return '请调整时间后再提交'
  }, [editingAppointment, editStartTime, allAppointments.data])

  const editNeedsCustomerGroup = editPartyRole === 'buyer' || editPartyRole === 'tenant'
  const editIsSellerOrLandlord = editPartyRole === 'seller' || editPartyRole === 'landlord'

  const handleSaveEdit = async () => {
    if (!editingAppointment) return
    setConflictError(null)
    if (!editStartTime) {
      alert('请选择时间')
      return
    }
    if (!editPropId) {
      alert('请选择房源')
      return
    }
    if (editNeedsCustomerGroup && !editGroupId) {
      alert('请选择客户分组')
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
        setConflictError('时间与已有预约冲突，请调整时段')
      } else {
        alert(err?.message || '更新失败')
      }
    }
  }

  const activeGroups = groups.data?.filter((g) => g.is_active !== false) ?? []
  const activeGroupIds = new Set(activeGroups.map((g) => g.id))
  useEffect(() => {
    if (selectedGroupId && !activeGroupIds.has(selectedGroupId)) {
      setSelectedGroupId(null)
    }
  }, [selectedGroupId, activeGroupIds, setSelectedGroupId])
  const rawAppts = appointments.data ?? []
  const appts =
    selectedGroupId
      ? rawAppts
      : rawAppts.filter((a) => !a.customer_group_id || activeGroupIds.has(a.customer_group_id))
  const groupedByDate = appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const d = new Date(a.start_time).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(a)
    return acc
  }, {})

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-stone-700">预约</h2>
        <div className="flex gap-2 items-center">
          <select
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(e.target.value || null)}
            className="text-sm border border-stone-200 rounded-sm px-3 py-1.5"
          >
            <option value="">全部分组</option>
            {activeGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddAppointment(!showAddAppointment)}
            className="text-sm border border-stone-300 rounded-sm px-4 py-1.5 hover:bg-stone-100"
          >
            {showAddAppointment ? '取消' : '添加预约'}
          </button>
        </div>
      </div>

      {showAddAppointment && (
        <div className="mb-6 p-4 border border-stone-200 rounded-sm bg-white space-y-3">
          {conflictError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-sm border border-red-200">
              {conflictError}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs text-stone-600">预约角色</label>
            <div className="flex gap-1 flex-wrap justify-end">
              {(['buyer', 'seller', 'tenant', 'landlord'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setPartyRole(role)
                    if (role === 'seller' || role === 'landlord') setGroupId('')
                    else { setCustomerInfo(''); setCustomerPhone('') }
                  }}
                  className={`px-2.5 py-1 text-xs rounded-sm border ${
                    partyRole === role
                      ? 'border-stone-600 bg-stone-100 text-stone-900'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {PARTY_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-600">房源</label>
            <div className="flex gap-2 mt-1 mb-1">
              <button
                type="button"
                onClick={() => { setPropertyInputMode('select'); setScrapeError(null) }}
                className={`text-xs px-2 py-1.5 border rounded-sm ${propertyInputMode === 'select' ? 'border-stone-600 bg-stone-100' : 'border-stone-200'}`}
              >
                选择已有房源
              </button>
              <button
                type="button"
                onClick={() => { setPropertyInputMode('byLink'); setScrapeError(null); setScrapeSuccess(false) }}
                className={`text-xs px-2 py-1.5 border rounded-sm ${propertyInputMode === 'byLink' ? 'border-stone-600 bg-stone-100' : 'border-stone-200'}`}
              >
                通过链接添加
              </button>
            </div>
            {propertyInputMode === 'select' ? (
              <select
                value={propId}
                onChange={(e) => { setPropId(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
              >
                <option value="">选择房源</option>
                {properties.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.listing_type === 'rent' ? '出租' : p.listing_type === 'sale' ? '出售' : '未知'}] {p.title}{p.price ? ` - ${p.price}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  value={propertyLinkInput}
                  onChange={(e) => { setPropertyLinkInput(e.target.value); setScrapeError(null) }}
                  placeholder="粘贴 Property Guru 链接，例如 https://www.propertyguru.com.sg/listing/..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
                />
                {scrapeError && (
                  <p className="text-xs text-red-600">{scrapeError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScrapeAndAdd}
                    disabled={scrapeLoading}
                    className="text-sm px-4 py-1.5 border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50 flex items-center gap-2"
                  >
                    {scrapeLoading && (
                      <svg className="animate-spin h-4 w-4 text-stone-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    抓取并添加
                  </button>
                  {scrapeSuccess && !scrapeLoading && (
                    <span className="text-green-600" title="添加成功">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {scrapeError && !scrapeLoading && (
                    <button
                      type="button"
                      onClick={handleScrapeAndAdd}
                      className="p-1 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded"
                      title="重试"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 011.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059 4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {needsCustomerGroup && (
            <div>
              <label className="text-xs text-stone-600">客户分组</label>
              <select
                value={groupId}
                onChange={(e) => { setGroupId(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
              >
                <option value="">选择分组</option>
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          {isSellerOrLandlord && (
            <>
              <div>
                <label className="text-xs text-stone-600">潜在{buyerOrTenantLabel}手机号（可选）</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="如：81234567 或 +65 8123 4567"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-stone-600">客户信息（可选）</label>
                <input
                  value={customerInfo}
                  onChange={(e) => setCustomerInfo(e.target.value)}
                  placeholder="如：潜在买家/租客姓名等"
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-stone-600">看房时间（每 15 分钟一个时段）</label>
            {createConflictInfo && (
              <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200" title={createConflictInfo}>
                时间冲突
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
                className="flex-1 min-w-[120px] px-3 py-2 border border-stone-200 rounded-sm text-sm"
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
                className="w-20 px-2 py-2 border border-stone-200 rounded-sm text-sm bg-white"
              >
                <option value="">时</option>
                {Array.from({ length: 18 }, (_, i) => {
                  const h = i + 6
                  return (
                    <option key={h} value={String(h).padStart(2, '0')}>
                      {h}时
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
                className="w-24 px-2 py-2 border border-stone-200 rounded-sm text-sm bg-white"
              >
                <option value="">分</option>
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={String(m).padStart(2, '0')}>
                    {m}分
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-600">备注（可选，客户可见）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如：带钥匙、提前10分钟到、客户特殊需求等"
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm resize-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={appointments.create.isPending || (propertyInputMode === 'byLink' && scrapeLoading)}
            className="text-sm px-4 py-2 border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50"
          >
            创建
          </button>
        </div>
      )}

      {editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8" onClick={() => setEditingAppointment(null)}>
          <div
            className="bg-white rounded-sm border border-stone-200 p-5 w-full max-w-md shadow-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-stone-900 mb-3">编辑预约</h3>
            {conflictError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-sm border border-red-200 mb-3">
                {conflictError}
              </p>
            )}
            {editConflictInfo && !conflictError && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 mb-3" title={editConflictInfo}>
                时间冲突
              </span>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs text-stone-600">预约角色</label>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(['buyer', 'seller', 'tenant', 'landlord'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setEditPartyRole(role)
                        if (role === 'seller' || role === 'landlord') setEditGroupId('')
                        else { setEditCustomerInfo(''); setEditCustomerPhone('') }
                      }}
                      className={`px-2.5 py-1 text-xs rounded-sm border ${
                        editPartyRole === role
                          ? 'border-stone-600 bg-stone-100 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {PARTY_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-600">房源</label>
                <select
                  value={editPropId}
                  onChange={(e) => { setEditPropId(e.target.value); setConflictError(null) }}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                >
                  <option value="">选择房源</option>
                  {properties.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.listing_type === 'rent' ? '出租' : p.listing_type === 'sale' ? '出售' : '未知'}] {p.title}{p.price ? ` - ${p.price}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {editNeedsCustomerGroup && (
                <div>
                  <label className="text-xs text-stone-600">客户分组</label>
                  <select
                    value={editGroupId}
                    onChange={(e) => { setEditGroupId(e.target.value); setConflictError(null) }}
                    className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                  >
                    <option value="">选择分组</option>
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editIsSellerOrLandlord && (
                <>
                  <div>
                    <label className="text-xs text-stone-600">潜在{editPartyRole === 'seller' ? '买家' : '租客'}手机号（可选）</label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="如：81234567 或 +65 8123 4567"
                      className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600">客户信息（可选）</label>
                    <input
                      value={editCustomerInfo}
                      onChange={(e) => setEditCustomerInfo(e.target.value)}
                      placeholder="如：潜在买家/租客姓名等"
                      className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-stone-600">看房时间（每 15 分钟一个时段）</label>
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
                    className="flex-1 min-w-[120px] px-3 py-2 border border-stone-200 rounded-sm text-sm"
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
                    className="w-20 px-2 py-2 border border-stone-200 rounded-sm text-sm bg-white"
                  >
                    <option value="">时</option>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hour = i + 6
                      return (
                        <option key={hour} value={String(hour).padStart(2, '0')}>
                          {hour}时
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
                    className="w-24 px-2 py-2 border border-stone-200 rounded-sm text-sm bg-white"
                  >
                    <option value="">分</option>
                    {[0, 15, 30, 45].map((min) => (
                      <option key={min} value={String(min).padStart(2, '0')}>
                        {min}分
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-stone-600">备注（可选，客户可见）</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="如：带钥匙、提前10分钟到、客户特殊需求等"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  disabled={appointments.update.isPending}
                  className="flex-1 text-sm px-4 py-2 border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingAppointment(null)}
                  className="text-sm px-4 py-2 border border-stone-200 rounded-sm hover:bg-stone-100"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, list]) => (
          <div key={date}>
            <p className="text-xs text-stone-500 mb-2">{new Date(date).toLocaleDateString('zh-CN')}</p>
            <div className="space-y-2">
              {list.map((a) => {
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
                return (
                  <div
                    key={a.id}
                    className="border border-stone-200 rounded-sm bg-white p-4 flex justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-stone-900 text-sm">
                          {prop?.title ?? '—'}
                        </p>
                        {prop?.listing_type && (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${prop.listing_type === 'rent' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {prop.listing_type === 'rent' ? '出租' : '出售'}
                          </span>
                        )}
                        {(a.party_role === 'seller' || a.party_role === 'landlord') && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-stone-100 text-stone-700">
                            代表{PARTY_ROLE_LABELS[a.party_role]}
                          </span>
                        )}
                        {hasConflictTag && (
                          <span className="px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                            时间冲突
                          </span>
                        )}
                      </div>
                      <p className="text-stone-500 text-xs mt-1">
                        {(a.customer_groups as CustomerGroup | null)?.name ?? a.customer_info ?? `代表${PARTY_ROLE_LABELS[a.party_role ?? 'buyer']}`} ·{' '}
                        {new Date(a.start_time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {prop?.listing_type === 'sale' && prop?.lease_tenure && (
                          <span className="ml-1.5 text-stone-400">· {prop.lease_tenure}</span>
                        )}
                      </p>
                      {a.notes && (
                        <p className="text-stone-600 text-xs mt-1 bg-stone-50 px-2 py-1 rounded border border-stone-100">
                          备注：{a.notes}
                        </p>
                      )}
                      {(customerPhone || hasAgent) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {customerPhone && (
                            <>
                              <span className="text-xs text-stone-600">
                                潜在{(a.party_role === 'seller' ? '买家' : '租客')}：
                                <a href={`tel:${customerPhone}`} className="font-medium text-stone-700 hover:underline ml-1">
                                  {customerPhone}
                                </a>
                              </span>
                              {customerWhatsAppUrl && (
                                <a
                                  href={customerWhatsAppUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-[#25D366] text-white hover:bg-[#20BD5A]"
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
                              <span className="text-xs text-stone-600">
                                卖家中介：
                                {agentName && <span className="font-medium text-stone-700">{agentName}</span>}
                                {agentName && agentPhone && <span className="text-stone-400 mx-1">·</span>}
                                {agentPhone && (
                                  <a href={`tel:${agentPhone}`} className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                                    {agentPhone}
                                  </a>
                                )}
                              </span>
                              {whatsappUrl && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-[#25D366] text-white hover:bg-[#20BD5A]"
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
                    <div className="flex items-center gap-2 shrink-0">
                      {prop && (prop.source_url || prop.link)?.includes('propertyguru.com') && (
                        <button
                          onClick={() => handleRefreshProperty(prop)}
                          disabled={refreshingPropertyId === prop.id}
                          className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-50 flex items-center gap-1"
                          title="重新抓取最新信息"
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
                          刷新
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(a)}
                        className="text-xs text-stone-400 hover:text-stone-700"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => appointments.remove.mutate(a.id)}
                        className="text-xs text-stone-400 hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
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
}

/** 时间轴条目：预约块或空闲时段 */
type TimelineItem =
  | { type: 'appointment'; block: ScheduleBlock }
  | { type: 'free'; startTime: string; endTime: string; durationMinutes: number }

const MERGE_GAP_MS = 30 * 60 * 1000 // 30 分钟内视为相邻，可合并

function mergeAppointmentsIntoBlocks(appointments: Appointment[]): ScheduleBlock[] {
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
    const name = (group.customer_groups as CustomerGroup | null)?.name ?? group.customer_info ?? `代表${PARTY_ROLE_LABELS[group.party_role ?? 'buyer']}`
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

/** 合并同一天内、同一客户的连续时间块（中间在路上的时间算作陪客户） */
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

function AgentScheduleSection({
  appointments,
  groups,
}: {
  appointments: ReturnType<typeof useAppointments>
  groups: ReturnType<typeof useCustomerGroups>
}) {
  const [rangeMode, setRangeMode] = useState<'twoWeeks' | 'all'>('twoWeeks')
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
  const blocks = mergeAppointmentsIntoBlocks(filtered)
  const byDate = blocks.reduce<Record<string, ScheduleBlock[]>>((acc, b) => {
    const d = new Date(b.startTime).toDateString()
    if (!acc[d]) acc[d] = []
    acc[d].push(b)
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-stone-700">我的时间表</h2>
        <div className="flex gap-1 border border-stone-200 rounded-sm p-0.5">
          <button
            onClick={() => setRangeMode('twoWeeks')}
            className={`px-3 py-1.5 text-sm rounded-sm ${
              rangeMode === 'twoWeeks'
                ? 'bg-stone-800 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            未来两周
          </button>
          <button
            onClick={() => setRangeMode('all')}
            className={`px-3 py-1.5 text-sm rounded-sm ${
              rangeMode === 'all'
                ? 'bg-stone-800 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            全部
          </button>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="py-12 text-center text-stone-500 text-sm border border-dashed border-stone-200 rounded-sm">
          {rangeMode === 'twoWeeks'
            ? '未来两周暂无预约'
            : '暂无未来预约'}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const date = new Date(dateStr)
            const dayName = dayNames[date.getDay()]
            const blocksForDate = byDate[dateStr]
            const mergedBlocks = mergeConsecutiveSameCustomerBlocks(blocksForDate)
            const timelineItems = buildTimelineWithFreeSlots(mergedBlocks)
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
                className="border border-stone-200 rounded-xl bg-white overflow-hidden shadow-sm"
              >
                <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <span className="font-medium text-stone-800 text-sm">
                    {date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-stone-500 text-xs">{dayName}</span>
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
                          <p className="text-emerald-700 text-sm">{timeStr}（约 {item.durationMinutes} 分钟）</p>
                        </div>
                      )
                    }

                    const block = item.block
                    const start = new Date(block.startTime)
                    const end = new Date(block.endTime)
                    const timeStr = `${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                    return (
                      <div
                        key={`${block.customerGroupId}-${block.startTime}`}
                        className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200/60"
                        style={{ flex: `${flexRatio} 1 0`, minHeight: 64 }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-stone-500 mb-0.5">
                            服务{PARTY_ROLE_LABELS[block.partyRole]}
                          </p>
                          <p className="font-medium text-stone-900 text-sm truncate">
                            {block.customerGroupName}
                          </p>
                          <p className="text-stone-600 text-xs mt-0.5">
                            {timeStr}
                            {block.propertyCount > 1 && (
                              <span className="ml-1.5 text-amber-700">
                                · 看 {block.propertyCount} 套房
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 flex gap-1 flex-wrap">
                          {block.appointments.slice(0, 3).map((a) => {
                            const prop = a.properties as Property | undefined
                            return (
                              <span
                                key={a.id}
                                className="text-xs px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-600 truncate max-w-[120px]"
                                title={prop?.title}
                              >
                                {prop?.title?.slice(0, 12) ?? '—'}
                                {(prop?.title?.length ?? 0) > 12 ? '…' : ''}
                              </span>
                            )
                          })}
                          {block.propertyCount > 3 && (
                            <span className="text-xs text-stone-400 self-center">
                              +{block.propertyCount - 3}
                            </span>
                          )}
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
