import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { checkPhoneAvailable } from '@/lib/checkAvailability'
import { CompanySelect } from '@/components/CompanySelect'

const COMPANY_OPTIONS = ['Propnex', 'Huttons', 'ERA', 'others'] as const

function normalizeAuthError(err: Error): string {
  const msg = err.message ?? ''
  const code = (err as { code?: string }).code ?? ''
  if (msg === 'EMAIL_EXISTS' || code === 'email_exists' || code === 'user_already_exists' || msg.toLowerCase().includes('email') && (msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered'))) {
    return 'EMAIL_EXISTS'
  }
  if (code === 'phone_exists' || msg.toLowerCase().includes('phone') && (msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('already'))) {
    return 'PHONE_EXISTS'
  }
  return 'OTHER'
}

export default function Register() {
  const [searchParams] = useSearchParams()
  const inviteFromUrl = searchParams.get('invite') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'agent' | 'client'>('agent')
  const [familyName, setFamilyName] = useState('')
  const [givenName, setGivenName] = useState('')
  const [agentNumber, setAgentNumber] = useState('')
  const [company, setCompany] = useState<(typeof COMPANY_OPTIONS)[number]>('Propnex')
  const [companyOthers, setCompanyOthers] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [inviteCode, setInviteCode] = useState(inviteFromUrl)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  useEffect(() => { inviteFromUrl && setInviteCode(inviteFromUrl) }, [inviteFromUrl])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8)
    setPhoneDigits(val)
  }

  const getCompanyValue = () => (company === 'others' ? companyOthers.trim() : company)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (role === 'agent' && company === 'others' && !companyOthers.trim()) {
        setError(t('register.companyOthersRequired'))
        return
      }
      if (!phoneDigits || phoneDigits.length !== 8) {
        setError(t('register.phoneMustBe8'))
        return
      }
      if (!inviteCode.trim() || inviteCode.trim().length !== 6) {
        setError(t('invite.inviteCodeRequired'))
        return
      }
      const phone = `+65${phoneDigits}`
      const phoneOk = await checkPhoneAvailable(phone)
      if (!phoneOk) {
        setError(t('register.phoneExists'))
        return
      }
      const { error: err } = await signUp(email, password, role, {
        familyName: familyName.trim(),
        givenName: givenName.trim(),
        agentNumber: agentNumber.trim(),
        company: role === 'agent' ? getCompanyValue() : undefined,
        phone,
        inviteCode: inviteCode.trim() || undefined,
      })
      if (err) {
        const kind = normalizeAuthError(err)
        if (kind === 'EMAIL_EXISTS') setError(t('register.emailExists'))
        else if (kind === 'PHONE_EXISTS') setError(t('register.phoneExists'))
        else setError(err.message)
        return
      }
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
      if (from && (from.startsWith('/home/') || from.startsWith('/view/'))) {
        navigate(from, { replace: true })
      } else {
        navigate('/home/agent', { replace: true })
      }
    } finally {
      setSubmitting(false)
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
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-sm p-6 rounded-2xl border border-[#53868e]/25" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <h1 className="text-2xl font-medium text-[#2b5843] mb-2">{t('app.title')}</h1>
          <p className="text-sm text-[#2b5843]/70 mb-8">{t('register.title')}</p>

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
              <label className={labelClass}>{t('register.userType')}</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'agent' | 'client')}
                className={inputClass}
              >
                <option value="agent">{t('register.agent')}</option>
                <option value="client">{t('register.client')}</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="familyName" className={labelClass}>{t('register.familyName')}</label>
                <input
                  id="familyName"
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t('register.familyNamePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="givenName" className={labelClass}>{t('register.givenName')}</label>
                <input
                  id="givenName"
                  type="text"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t('register.givenNamePlaceholder')}
                />
              </div>
            </div>
            {role === 'agent' && (
              <>
                <div>
                  <label htmlFor="agentNumber" className={labelClass}>{t('login.agentNumber')}</label>
                  <input
                    id="agentNumber"
                    type="text"
                    value={agentNumber}
                    onChange={(e) => setAgentNumber(e.target.value)}
                    className={inputClass}
                    placeholder={t('login.agentNumberPlaceholder')}
                  />
                </div>
                <CompanySelect
                  value={company}
                  onChange={(v) => setCompany(v as (typeof COMPANY_OPTIONS)[number])}
                  companyOthers={companyOthers}
                  onCompanyOthersChange={setCompanyOthers}
                  labelKey="login.company"
                  othersRequired
                  labelClassName={labelClass}
                  selectClassName={inputClass}
                  inputClassName={`mt-2 ${inputClass}`}
                />
              </>
            )}
            <div>
              <label htmlFor="phone" className={labelClass}>{t('login.phone')}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#2b5843]/80 shrink-0">+65</span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={phoneDigits}
                  onChange={handlePhoneChange}
                  required
                  className={inputClass}
                  placeholder={t('register.phonePlaceholder')}
                />
              </div>
              <p className="mt-1 text-xs text-[#2b5843]/60">{t('register.phoneHint')}</p>
            </div>
            <div>
              <label htmlFor="inviteCode" className={labelClass}>{t('invite.inviteCode')}</label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                required
                placeholder={t('invite.inviteCodePlaceholder')}
                className={inputClass}
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
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-[#f6f3f1] rounded-full hover:opacity-95 transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
            >
              {submitting ? t('common.loading') : t('login.signUp')}
            </button>
          </form>

          <p className="mt-6 text-sm text-[#2b5843]/70">
            {t('login.haveAccount')}{' '}
            <Link to="/login" state={location.state} className={linkClass}>
              {t('login.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
