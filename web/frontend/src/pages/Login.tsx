import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState<'agent' | 'client'>('agent')
  const [fullName, setFullName] = useState('')
  const [agentNumber, setAgentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = isSignUp
      ? await signUp(email, password, role, {
          fullName,
          agentNumber,
          phone,
        })
      : await signIn(email, password)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium text-stone-900 mb-2">看房预约管理</h1>
        <p className="text-sm text-stone-500 mb-8">中介登录</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm text-stone-700 mb-1">邮箱</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
              placeholder="you@example.com"
            />
          </div>
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm text-stone-700 mb-1">身份</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'agent' | 'client')}
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm"
                >
                  <option value="agent">中介</option>
                  <option value="client">客户</option>
                </select>
              </div>
              <div>
                <label htmlFor="fullName" className="block text-sm text-stone-700 mb-1">姓名</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                  placeholder="您的姓名"
                />
              </div>
              {role === 'agent' && (
                <div>
                  <label htmlFor="agentNumber" className="block text-sm text-stone-700 mb-1">中介号</label>
                  <input
                    id="agentNumber"
                    type="text"
                    value={agentNumber}
                    onChange={(e) => setAgentNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                    placeholder="中介注册号"
                  />
                </div>
              )}
              <div>
                <label htmlFor="phone" className="block text-sm text-stone-700 mb-1">手机号</label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                  placeholder="手机号码"
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="password" className="block text-sm text-stone-700 mb-1">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-medium text-stone-900 border border-stone-300 rounded-sm hover:bg-stone-100 transition-colors"
          >
            {isSignUp ? '注册' : '登录'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-sm text-stone-500 hover:text-stone-700"
        >
          {isSignUp ? '已有账号？去登录' : '没有账号？注册'}
        </button>
      </div>
    </div>
  )
}
