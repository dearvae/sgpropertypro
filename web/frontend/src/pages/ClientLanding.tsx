import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { UserMenu } from '@/components/UserMenu'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function ClientLanding() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { t } = useTranslation()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || user?.email || t('common.you')

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-stone-900">{t('clientLanding.title')}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <h2 className="text-xl font-medium text-stone-900 mb-2">{t('clientLanding.welcome', { name: displayName })}</h2>
          <p className="text-stone-500 text-sm mb-6">
            {t('clientLanding.clientDesc')}
          </p>
          <p className="text-stone-400 text-xs mb-8">
            {t('clientLanding.linkExample')}
          </p>
        </div>
      </div>
    </div>
  )
}
