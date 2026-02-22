import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { UserMenu } from '@/components/UserMenu'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getDisplayName } from '@/types'

export default function ClientLanding() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { t } = useTranslation()
  const displayName = getDisplayName(profile) || user?.email?.split('@')[0] || user?.email || t('common.you')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <header className="border-b border-[#53868e]/20 rounded-b-2xl mx-4 mt-2 sm:mx-6" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #ebece8 100%)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-medium text-[#2b5843]">{t('clientLanding.title')}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher zen />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md p-6 rounded-2xl border border-[#53868e]/25 text-center" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <h2 className="text-xl font-medium text-[#2b5843] mb-2">{t('clientLanding.welcome', { name: displayName })}</h2>
          <p className="text-[#2b5843]/80 text-sm mb-6">
            {t('clientLanding.clientDesc')}
          </p>
          <p className="text-[#2b5843]/60 text-xs mb-8">
            {t('clientLanding.linkExample')}
          </p>
        </div>
      </div>
    </div>
  )
}
