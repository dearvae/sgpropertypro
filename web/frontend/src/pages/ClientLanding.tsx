import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { UserMenu } from '@/components/UserMenu'

export default function ClientLanding() {
  const { user } = useAuth()
  const { data: profile } = useProfile()

  const displayName = profile?.full_name || user?.email?.split('@')[0] || user?.email || '您'

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-stone-900">看房预约</h1>
          <UserMenu />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h2 className="text-xl font-medium text-stone-900 mb-2">欢迎，{displayName}</h2>
          <p className="text-stone-500 text-sm mb-6">
            您是客户账号。请通过中介分享的链接查看您的看房日程。
          </p>
          <p className="text-stone-400 text-xs mb-8">
            链接格式示例：https://xxx.com/view/xxxx
          </p>
        </div>
      </div>
    </div>
  )
}
