import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile } from '@/hooks/useProfile'

export function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const { data: profile, update, canChangeName: checkCanChange } = useProfile()
  const [fullName, setFullName] = useState('')
  const [agentNumber, setAgentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState('')
  const { t } = useTranslation()

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setAgentNumber(profile.agent_number ?? '')
      setPhone(profile.phone ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile])

  const nameChangeable = profile ? checkCanChange(profile.name_changed_at) : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const nameChanged = profile && fullName.trim() !== (profile.full_name ?? '')
    if (nameChanged && !nameChangeable) {
      setError(t('profile.nameChangeError'))
      return
    }
    try {
      await update.mutateAsync({
        full_name: fullName.trim() || undefined,
        agent_number: agentNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        updateNameChangedAt: nameChanged,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!profile) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-sm shadow-lg p-6 w-full max-w-md mx-4 border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-stone-900 mb-4">{t('profile.title')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-600 mb-1">{t('profile.avatarUrl')}</label>
            <div className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-full shrink-0 overflow-hidden bg-stone-200 border border-stone-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={t('profile.avatar')} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-500 text-xl">
                    {fullName ? fullName[0] : '?'}
                  </div>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 border border-stone-200 rounded-sm text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-600 mb-1">
              {t('profile.fullName')}
              {!nameChangeable && <span className="text-amber-600 ml-1">{t('profile.nameChangedHint')}</span>}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!nameChangeable}
              placeholder={t('login.namePlaceholder')}
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm disabled:bg-stone-100 disabled:text-stone-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-600 mb-1">{t('profile.agentNumber')}</label>
            <input
              type="text"
              value={agentNumber}
              onChange={(e) => setAgentNumber(e.target.value)}
              placeholder={t('login.agentNumberPlaceholder')}
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-600 mb-1">{t('profile.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('login.phonePlaceholder')}
              className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={update.isPending}
              className="px-4 py-2 text-sm border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50"
            >
              {update.isPending ? t('profile.saving') : t('common.save')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
