import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRealtimeClientView } from '@/hooks/useRealtimeAppointments'

type ClientViewData = {
  group: { id: string; name: string } | null
  appointments: Array<{
    id: string
    start_time: string
    end_time: string
    status: string
    property: { id: string; title: string; link: string | null; basic_info: string | null }
  }>
  properties: Array<{
    id: string
    title: string
    link: string | null
    basic_info: string | null
    notes: string[]
  }>
  error?: string
}

export default function ClientView() {
  const { token } = useParams<{ token: string }>()
  useRealtimeClientView(token)

  const { data, isLoading, error } = useQuery({
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500 text-sm">
        加载中...
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

  const { group, appointments, properties } = data

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <h1 className="text-lg font-medium text-stone-900">看房日程</h1>
          {group && <p className="text-sm text-stone-500 mt-1">{group.name}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-12">
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-4">已安排</h2>
          {appointments.length === 0 ? (
            <p className="text-stone-500 text-sm">暂无安排</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="border border-stone-200 rounded-sm bg-white p-4"
                >
                  <p className="font-medium text-stone-900 text-sm">{a.property.title}</p>
                  <p className="text-stone-500 text-sm mt-1">
                    {new Date(a.start_time).toLocaleString('zh-CN')} - {new Date(a.end_time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {a.property.link && (
                    <a
                      href={a.property.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-500 text-sm mt-2 inline-block hover:text-stone-700"
                    >
                      查看房源 →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-4">房源与备注</h2>
          {properties.length === 0 ? (
            <p className="text-stone-500 text-sm">暂无房源</p>
          ) : (
            <div className="space-y-3">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="border border-stone-200 rounded-sm bg-white p-4"
                >
                  <p className="font-medium text-stone-900 text-sm">{p.title}</p>
                  {p.basic_info && (
                    <p className="text-stone-500 text-sm mt-1">{p.basic_info}</p>
                  )}
                  {p.notes?.length > 0 && (
                    <ul className="mt-3 space-y-1 text-stone-600 text-sm">
                      {p.notes.map((n, i) => (
                        <li key={i}>• {n}</li>
                      ))}
                    </ul>
                  )}
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stone-500 text-sm mt-2 inline-block hover:text-stone-700"
                    >
                      查看详情 →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
