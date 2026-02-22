import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { getDisplayName } from '@/types'
import { checkPhoneAvailableForUpdate } from '@/lib/checkAvailability'
import { CompanySelect } from '@/components/CompanySelect'

const COMPANY_OPTIONS = ['Propnex', 'Huttons', 'ERA', 'others'] as const

function parsePhone(phone: string | null): string {
  if (!phone) return ''
  const m = phone.match(/^\+65(\d{8})$/)
  return m ? m[1] : phone.replace(/\D/g, '').slice(0, 8)
}

export function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { data: profile, update, canChangeName: checkCanChange } = useProfile()
  const [familyName, setFamilyName] = useState('')
  const [givenName, setGivenName] = useState('')
  const [agentNumber, setAgentNumber] = useState('')
  const [company, setCompany] = useState<string>('Propnex')
  const [companyOthers, setCompanyOthers] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState('')
  const { t } = useTranslation()

  useEffect(() => {
    if (profile) {
      setFamilyName(profile.family_name ?? '')
      setGivenName(profile.given_name ?? profile.full_name ?? '')
      setAgentNumber(profile.agent_number ?? '')
      const c = profile.company ?? ''
      if (COMPANY_OPTIONS.includes(c as (typeof COMPANY_OPTIONS)[number])) {
        setCompany(c)
        setCompanyOthers('')
      } else {
        setCompany('others')
        setCompanyOthers(c)
      }
      setPhoneDigits(parsePhone(profile.phone))
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile])

  const nameChangeable = profile ? checkCanChange(profile.name_changed_at) : false

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 8))
  }

  const getCompanyValue = () => (company === 'others' ? companyOthers.trim() : company)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const newFamily = familyName.trim()
    const newGiven = givenName.trim()
    const oldFamily = profile?.family_name ?? ''
    const oldGiven = profile?.given_name ?? ''
    const nameChanged = profile && (newFamily !== oldFamily || newGiven !== oldGiven)
    if (nameChanged && !nameChangeable) {
      setError(t('profile.nameChangeError'))
      return
    }
    if (phoneDigits.length !== 8) {
      setError(t('register.phoneMustBe8'))
      return
    }
    const phone = `+65${phoneDigits}`
    if (user?.id) {
      const ok = await checkPhoneAvailableForUpdate(phone, user.id)
      if (!ok) {
        setError(t('register.phoneExists'))
        return
      }
    }
    try {
      await update.mutateAsync({
        family_name: newFamily || undefined,
        given_name: newGiven || undefined,
        agent_number: agentNumber.trim() || undefined,
        company: profile?.role === 'agent' ? getCompanyValue() || undefined : undefined,
        phone,
        avatar_url: avatarUrl.trim() || undefined,
        updateNameChangedAt: nameChanged,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!profile) return null

  const displayName = getDisplayName({ family_name: familyName, given_name: givenName, full_name: profile.full_name })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="rounded-2xl shadow-lg p-6 w-full max-w-md mx-4 border border-[#53868e]/25"
        style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[#2b5843] mb-4">{t('profile.title')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#2b5843]/80 mb-1">{t('profile.avatarUrl')}</label>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="w-14 h-14 rounded-full shrink-0 overflow-hidden border border-[#53868e]/25" style={{ background: 'rgba(83,134,142,0.15)' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={t('profile.avatar')} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#53868e] text-xl">
                    {(displayName || '?')[0]}
                  </div>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-600 mb-1">
                {t('profile.familyName')}
                {!nameChangeable && <span className="text-[#53868e] ml-1">{t('profile.nameChangedHint')}</span>}
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                disabled={!nameChangeable}
                placeholder={t('register.familyNamePlaceholder')}
                className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e] disabled:bg-[#53868e]/10 disabled:text-[#2b5843]/50"
              />
            </div>
            <div>
              <label className="block text-xs text-[#2b5843]/80 mb-1">{t('profile.givenName')}</label>
              <input
                type="text"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                disabled={!nameChangeable}
                placeholder={t('register.givenNamePlaceholder')}
                className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e] disabled:bg-[#53868e]/10 disabled:text-[#2b5843]/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#2b5843]/80 mb-1">{t('profile.agentNumber')}</label>
            <input
              type="text"
              value={agentNumber}
              onChange={(e) => setAgentNumber(e.target.value)}
              placeholder={t('login.agentNumberPlaceholder')}
              className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e]"
            />
          </div>
          {profile.role === 'agent' && (
            <CompanySelect
              value={company}
              onChange={setCompany}
              companyOthers={companyOthers}
              onCompanyOthersChange={setCompanyOthers}
            />
          )}
          <div>
            <label className="block text-xs text-[#2b5843]/80 mb-1">{t('profile.phone')}</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#2b5843]/80 shrink-0">+65</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={8}
                value={phoneDigits}
                onChange={handlePhoneChange}
                className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e]"
                placeholder={t('register.phonePlaceholder')}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="px-4 py-2 text-sm rounded-full text-[#f6f3f1] hover:opacity-95 transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
            >
              {update.isPending ? t('profile.saving') : t('common.save')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
