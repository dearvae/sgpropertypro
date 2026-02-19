import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

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
  const { t } = useTranslation()

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
    <div className="min-h-screen flex flex-col bg-stone-50 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-medium text-stone-900 mb-2">{t('app.title')}</h1>
          <p className="text-sm text-stone-500 mb-8">{t('app.agentLogin')}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm text-stone-700 mb-1">{t('login.email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm text-stone-700 mb-1">{t('login.role')}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'agent' | 'client')}
                    className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm"
                  >
                    <option value="agent">{t('login.agent')}</option>
                    <option value="client">{t('login.client')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fullName" className="block text-sm text-stone-700 mb-1">{t('login.fullName')}</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                    placeholder={t('login.namePlaceholder')}
                  />
                </div>
                {role === 'agent' && (
                  <div>
                    <label htmlFor="agentNumber" className="block text-sm text-stone-700 mb-1">{t('login.agentNumber')}</label>
                    <input
                      id="agentNumber"
                      type="text"
                      value={agentNumber}
                      onChange={(e) => setAgentNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                      placeholder={t('login.agentNumberPlaceholder')}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="phone" className="block text-sm text-stone-700 mb-1">{t('login.phone')}</label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-sm bg-white text-stone-900 text-sm focus:outline-none focus:border-stone-400"
                    placeholder={t('login.phonePlaceholder')}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="password" className="block text-sm text-stone-700 mb-1">{t('login.password')}</label>
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
              {isSignUp ? t('login.signUp') : t('login.signIn')}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-6 text-sm text-stone-500 hover:text-stone-700"
          >
            {isSignUp ? t('login.haveAccount') : t('login.noAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}
