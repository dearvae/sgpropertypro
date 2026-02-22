import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err.message)
      return
    }
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
    if (from && (from.startsWith('/home/') || from.startsWith('/view/'))) {
      navigate(from, { replace: true })
    } else {
      navigate('/home/agent', { replace: true })
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border border-[#53868e]/30 rounded-xl bg-[#f6f3f1] text-[#2b5843] text-sm focus:outline-none focus:border-[#53868e] focus:ring-1 focus:ring-[#53868e]/30'
  const labelClass = 'block text-sm text-[#2b5843]/90 mb-1'
  const linkClass = 'text-[#53868e] underline hover:text-[#2b5843] transition-colors'

  return (
    <div className="min-h-screen flex flex-col px-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher zen />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm p-6 rounded-2xl border border-[#53868e]/25" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <h1 className="text-2xl font-medium text-[#2b5843] mb-2">{t('app.title')}</h1>
          <p className="text-sm text-[#2b5843]/70 mb-8">{t('app.agentLogin')}</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className={labelClass}>{t('login.email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>{t('login.password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-medium text-[#f6f3f1] rounded-full hover:opacity-95 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
            >
              {t('login.signIn')}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#2b5843]/70">
            {t('login.noAccount')}{' '}
            <Link to="/register" state={location.state} className={linkClass}>
              {t('login.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
