import { useAuth } from '@/hooks/useAuth'

export default function ClientLanding() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-medium text-stone-900 mb-2">欢迎，{user?.email}</h1>
        <p className="text-stone-500 text-sm mb-6">
          您是客户账号。请通过中介分享的链接查看您的看房日程。
        </p>
        <p className="text-stone-400 text-xs mb-8">
          链接格式示例：https://xxx.com/view/xxxx
        </p>
        <button
          onClick={() => signOut()}
          className="text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-sm px-4 py-2"
        >
          退出登录
        </button>
      </div>
    </div>
  )
}
