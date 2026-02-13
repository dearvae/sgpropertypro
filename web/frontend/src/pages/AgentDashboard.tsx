import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCustomerGroups } from '@/hooks/useCustomerGroups'
import { useProperties } from '@/hooks/useProperties'
import { useAppointments } from '@/hooks/useAppointments'
import { useNotes } from '@/hooks/useNotes'
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments'
import { checkAppointmentConflict } from '@/lib/conflictCheck'
import type { CustomerGroup, Property, Appointment } from '@/types'

export default function AgentDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<'groups' | 'properties' | 'appointments' | 'client'>('groups')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showAddAppointment, setShowAddAppointment] = useState(false)

  const groups = useCustomerGroups()
  const properties = useProperties()
  const appointments = useAppointments(selectedGroupId || undefined)
  const allAppointments = useAppointments() // 用于冲突预检（需检查同一 agent 下全部预约）
  const notes = useNotes()
  useRealtimeAppointments(selectedGroupId || undefined)

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/view/` : ''

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-stone-900">看房预约管理</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-sm px-3 py-1.5"
            >
              退出
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 border-t border-stone-100">
          {(['groups', 'properties', 'appointments', 'client'] as const).map((tab) => (
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
              {tab === 'properties' && '房源'}
              {tab === 'appointments' && '预约'}
              {tab === 'client' && '客户视图'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'groups' && (
          <CustomerGroupsSection
            groups={groups}
            baseUrl={baseUrl}
          />
        )}
        {activeTab === 'properties' && (
          <PropertiesSection properties={properties} notes={notes} />
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
        {activeTab === 'client' && (
          <ClientViewPreview groups={groups} baseUrl={baseUrl} />
        )}
      </main>
    </div>
  )
}

function CustomerGroupsSection({
  groups,
  baseUrl,
}: {
  groups: ReturnType<typeof useCustomerGroups>
  baseUrl: string
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await groups.create.mutateAsync(newName.trim())
      setNewName('')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await groups.update.mutateAsync({ id: editingId, name: editName.trim() })
      setEditingId(null)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-stone-700 mb-4">客户分组</h2>
      <div className="flex gap-2 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="分组名称"
          className="flex-1 max-w-xs px-3 py-2 border border-stone-200 rounded-sm text-sm"
        />
        <button
          onClick={handleCreate}
          disabled={groups.create.isPending}
          className="px-4 py-2 text-sm border border-stone-300 rounded-sm hover:bg-stone-100"
        >
          新建
        </button>
      </div>

      <div className="space-y-3">
        {groups.data?.map((g) => (
          <div
            key={g.id}
            className="border border-stone-200 rounded-sm bg-white p-4 flex items-center justify-between"
          >
            {editingId === g.id ? (
              <div className="flex gap-2 flex-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-stone-200 rounded-sm text-sm"
                />
                <button onClick={handleUpdate} className="text-sm text-stone-600">保存</button>
                <button onClick={() => setEditingId(null)} className="text-sm text-stone-400">取消</button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-medium text-stone-900 text-sm">{g.name}</p>
                  <p className="text-stone-500 text-xs mt-1 font-mono">{baseUrl}{g.share_token}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(g.id)
                      setEditName(g.name)
                    }}
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
    </section>
  )
}

function PropertiesSection({
  properties,
  notes,
}: {
  properties: ReturnType<typeof useProperties>
  notes: ReturnType<typeof useNotes>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [basicInfo, setBasicInfo] = useState('')
  const [addNotePropId, setAddNotePropId] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [noteVisibility, setNoteVisibility] = useState<'client_visible' | 'internal'>('internal')

  const handleCreateProperty = async () => {
    if (!title.trim()) return
    try {
      await properties.create.mutateAsync({ title: title.trim(), link: link || undefined, basic_info: basicInfo || undefined })
      setShowAdd(false)
      setTitle('')
      setLink('')
      setBasicInfo('')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleAddNote = async () => {
    if (!addNotePropId || !noteContent.trim()) return
    try {
      await notes.create.mutateAsync({
        property_id: addNotePropId,
        content: noteContent.trim(),
        visibility: noteVisibility,
      })
      setAddNotePropId(null)
      setNoteContent('')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const propertyNotes = (propId: string) => notes.data?.filter((n) => n.property_id === propId) ?? []

  return (
    <section>
      <h2 className="text-sm font-medium text-stone-700 mb-4">房源</h2>
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-6 text-sm border border-stone-300 rounded-sm px-4 py-2 hover:bg-stone-100"
        >
          添加房源
        </button>
      ) : (
        <div className="mb-6 p-4 border border-stone-200 rounded-sm bg-white space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="房源标题"
            className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="房源链接（可选）"
            className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
          />
          <textarea
            value={basicInfo}
            onChange={(e) => setBasicInfo(e.target.value)}
            placeholder="基本信息（可选）"
            rows={2}
            className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleCreateProperty} disabled={properties.create.isPending} className="text-sm px-4 py-1.5 border border-stone-300 rounded-sm">
              保存
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-stone-500">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {properties.data?.map((p) => (
          <div key={p.id} className="border border-stone-200 rounded-sm bg-white p-4">
            <p className="font-medium text-stone-900 text-sm">{p.title}</p>
            {p.link && (
              <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-stone-500 hover:text-stone-700">
                {p.link}
              </a>
            )}
            {p.basic_info && <p className="text-stone-500 text-sm mt-1">{p.basic_info}</p>}
            <div className="mt-3">
              {propertyNotes(p.id).map((n) => (
                <div key={n.id} className="text-xs text-stone-600 flex items-center gap-2 py-1">
                  <span className={n.visibility === 'client_visible' ? 'text-stone-700' : 'text-stone-400'}>
                    [{n.visibility === 'client_visible' ? '客户可见' : '内部'}]
                  </span>
                  {n.content}
                  <button onClick={() => notes.remove.mutate(n.id)} className="text-stone-400 hover:text-red-600">删</button>
                </div>
              ))}
              {addNotePropId === p.id ? (
                <div className="mt-2 flex gap-2 items-start">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="备注内容"
                    rows={2}
                    className="flex-1 px-2 py-1 border border-stone-200 rounded-sm text-xs"
                  />
                  <select
                    value={noteVisibility}
                    onChange={(e) => setNoteVisibility(e.target.value as 'client_visible' | 'internal')}
                    className="text-xs border border-stone-200 rounded-sm"
                  >
                    <option value="internal">内部</option>
                    <option value="client_visible">客户可见</option>
                  </select>
                  <button onClick={handleAddNote} className="text-xs px-2 py-1 border rounded-sm">添加</button>
                  <button onClick={() => setAddNotePropId(null)} className="text-xs text-stone-400">取消</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddNotePropId(p.id)}
                  className="mt-2 text-xs text-stone-500 hover:text-stone-700"
                >
                  + 添加备注
                </button>
              )}
            </div>
          </div>
        ))}
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
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [conflictError, setConflictError] = useState<string | null>(null)

  const handleCreate = async () => {
    setConflictError(null)
    if (!propId || !groupId || !startTime || !endTime) {
      alert('请填写完整')
      return
    }
    const startIso = new Date(startTime).toISOString()
    const endIso = new Date(endTime).toISOString()
    if (new Date(endIso) <= new Date(startIso)) {
      setConflictError('结束时间须晚于开始时间')
      return
    }
    // 前端冲突预检
    const existing = (allAppointments.data ?? []).map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
    }))
    const { hasConflict, conflictingWith } = checkAppointmentConflict(startIso, endIso, existing)
    if (hasConflict && conflictingWith) {
      setConflictError(
        `与已有预约冲突：${new Date(conflictingWith.start_time).toLocaleString('zh-CN')} - ${new Date(conflictingWith.end_time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}，请调整时段`
      )
      return
    }
    if (hasConflict) {
      setConflictError('请调整时间后再提交')
      return
    }
    try {
      await appointments.create.mutateAsync({
        property_id: propId,
        customer_group_id: groupId,
        start_time: startIso,
        end_time: endIso,
      })
      setShowAddAppointment(false)
      setPropId('')
      setGroupId('')
      setStartTime('')
      setEndTime('')
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

  const appts = appointments.data ?? []
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
            {groups.data?.map((g) => (
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
          <div>
            <label className="text-xs text-stone-600">房源</label>
            <select
              value={propId}
              onChange={(e) => { setPropId(e.target.value); setConflictError(null) }}
              className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
            >
              <option value="">选择房源</option>
              {properties.data?.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-600">客户分组</label>
            <select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); setConflictError(null) }}
              className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
            >
              <option value="">选择分组</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-600">开始时间</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-stone-600">结束时间</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setConflictError(null) }}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={appointments.create.isPending}
            className="text-sm px-4 py-2 border border-stone-300 rounded-sm hover:bg-stone-100"
          >
            创建
          </button>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, list]) => (
          <div key={date}>
            <p className="text-xs text-stone-500 mb-2">{new Date(date).toLocaleDateString('zh-CN')}</p>
            <div className="space-y-2">
              {list.map((a) => (
                <div
                  key={a.id}
                  className="border border-stone-200 rounded-sm bg-white p-4 flex justify-between"
                >
                  <div>
                    <p className="font-medium text-stone-900 text-sm">
                      {(a.properties as Property)?.title ?? '—'}
                    </p>
                    <p className="text-stone-500 text-xs mt-1">
                      {(a.customer_groups as CustomerGroup)?.name} ·{' '}
                      {new Date(a.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(a.end_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => appointments.remove.mutate(a.id)}
                    className="text-xs text-stone-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ClientViewPreview({
  groups,
  baseUrl,
}: {
  groups: ReturnType<typeof useCustomerGroups>
  baseUrl: string
}) {
  const [previewToken, setPreviewToken] = useState<string | null>(null)

  return (
    <section>
      <h2 className="text-sm font-medium text-stone-700 mb-4">客户视图预览</h2>
      <p className="text-stone-500 text-sm mb-4">选择分组查看客户看到的页面</p>
      <select
        value={previewToken || ''}
        onChange={(e) => setPreviewToken(e.target.value || null)}
        className="mb-4 text-sm border border-stone-200 rounded-sm px-3 py-2"
      >
        <option value="">选择分组</option>
        {groups.data?.map((g) => (
          <option key={g.id} value={g.share_token}>{g.name}</option>
        ))}
      </select>
      {previewToken && (
        <a
          href={`/view/${previewToken}`}
          target="_blank"
          rel="noreferrer"
          className="block text-sm text-stone-600 hover:text-stone-900"
        >
          在新标签页打开客户视图 →
        </a>
      )}
    </section>
  )
}
