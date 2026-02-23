import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { getDisplayName } from '@/types'

// Simple line icons as SVG components (no photos)
function IconUsers() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  )
}

function IconShare() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-5 h-5 text-[#53868e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const role = (user?.user_metadata?.role as string) || 'agent'
  const dashboardPath = role === 'client' ? '/home/user' : '/home/agent'
  const displayName = getDisplayName(profile) || user?.email?.split('@')[0] || user?.email || t('common.you')

  const features = [
    { key: '1', Icon: IconUsers },
    { key: '2', Icon: IconClipboard },
    { key: '3', Icon: IconShare },
    { key: '4', Icon: IconChat },
  ]

  const benefits = [
    { key: '1' },
    { key: '2' },
    { key: '3' },
    { key: '4' },
  ]

  return (
    <div className="min-h-screen flex flex-col text-[#2b5843]" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 50%, #dde4e2 100%)' }}>
      {/* Header: sticky, cream gradient */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-[#53868e]/20 rounded-b-3xl mx-4 mt-2 sm:mx-6 sm:mt-3" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #f0ebe8 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="text-lg font-medium text-[#2b5843] hover:opacity-80 transition-opacity">
            propsuite.tech
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors">
              {t('landing.navFeatures')}
            </a>
            <a href="#pricing" className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors">
              {t('landing.navPricing')}
            </a>
            <a href="#whyUs" className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors">
              {t('landing.navTestimonials')}
            </a>
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher zen />
            {user ? (
              <Link
                to={dashboardPath}
                className="px-5 py-2.5 rounded-full text-[#f6f3f1] text-base font-medium hover:opacity-95 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
              >
                {displayName}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors hidden sm:inline"
                >
                  {t('landing.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-full text-[#f6f3f1] text-base font-medium hover:opacity-95 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
                >
                  {t('landing.getStarted')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero: gradient bg, geometric shapes, headline, CTA */}
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-28 px-4 sm:px-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(246,243,241,0.5) 0%, rgba(83,134,142,0.08) 50%, rgba(246,243,241,0.3) 100%)' }}>
        {/* Soft geometric shapes - no right angles */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-10 right-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-[#53868e]/25" />
          <div className="absolute bottom-20 left-8 w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-[#53868e]/20" />
          <div className="absolute top-1/4 right-1/5 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(83,134,142,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/3 right-1/4 w-24 h-24 rounded-[2rem] border border-[#2b5843]/15" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-[#2b5843] leading-tight">
            {t('landing.heroTitle')}
          </h1>
          <p className="mt-3 text-xl sm:text-2xl text-[#2b5843]/90 font-medium">
            {t('landing.heroSubtitle')}
          </p>
          <p className="mt-4 text-lg sm:text-xl text-[#2b5843]/85 max-w-xl mx-auto" style={{ fontSize: 'min(1.125rem, max(1rem, 4vw))' }}>
            {t('landing.heroDesc')}
          </p>
          <div className="mt-10">
            <Link
              to={user ? dashboardPath : '/register'}
              className="inline-flex px-8 py-3.5 rounded-full text-[#f6f3f1] text-base font-medium hover:opacity-95 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
            >
              {user ? t('landing.dashboard') : t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </section>

      {/* Designed for Serious Agents */}
      <section className="py-12 sm:py-16 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#2b5843] mb-6">
            {t('landing.forAgents')}
          </h2>
          <p className="text-base text-[#2b5843]/90 mb-4">
            {t('landing.agentHeadline')}
          </p>
          <ul className="text-left max-w-sm mx-auto space-y-2 text-[#2b5843]/85">
            <li>• {t('landing.agentPoint1')}</li>
            <li>• {t('landing.agentPoint2')}</li>
            <li>• {t('landing.agentPoint3')}</li>
            <li>• {t('landing.agentPoint4')}</li>
          </ul>
          <p className="mt-6 text-base font-medium text-[#2b5843]">
            {t('landing.agentCta')}
          </p>
        </div>
      </section>

      {/* Features: What You Can Do */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #e8ebe8 0%, #f6f3f1 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843] text-center mb-12">
            {t('landing.whatYouCanDo')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ key, Icon }) => (
              <article
                key={key}
                className="p-6 border border-[#53868e]/25 rounded-2xl"
                style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebe8e5 100%)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-[#53868e]" style={{ background: 'linear-gradient(135deg, rgba(83,134,142,0.2) 0%, rgba(43,88,67,0.1) 100%)' }}>
                    {key}
                  </span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#53868e]" style={{ background: 'linear-gradient(135deg, rgba(83,134,142,0.15) 0%, rgba(43,88,67,0.08) 100%)' }}>
                    <Icon />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-[#2b5843] mb-2">
                  {t(`landing.feature${key}Title`)}
                </h3>
                <p className="text-base text-[#2b5843]/80 leading-relaxed">
                  {t(`landing.feature${key}Desc`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why Agents Love PropSuite */}
      <section id="whyUs" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843] text-center mb-12">
            {t('landing.whyLoveUs')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map(({ key }) => (
              <div
                key={key}
                className="flex items-center gap-3 p-4 border border-[#53868e]/20 rounded-2xl"
                style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
              >
                <IconCheck />
                <span className="text-base font-medium text-[#2b5843]">{t(`landing.benefit${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #e8ebe8 0%, #dde4e2 100%)' }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843] mb-6">
            {t('landing.pricing')}
          </h2>
          <p className="text-lg text-[#2b5843]/90">
            {t('landing.pricingFree')}{' '}
            <span className="font-medium">{t('landing.pricingPro')}</span>
          </p>
        </div>
      </section>

      {/* CTA block */}
      <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #e8ebe8 0%, #dde4e2 100%)' }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843]">
            {t('landing.ctaTitle')}
          </h2>
          <p className="mt-3 text-base text-[#2b5843]/80">
            {t('landing.ctaSubtitle')}
          </p>
          <Link
            to={user ? dashboardPath : '/register'}
            className="mt-6 inline-flex px-8 py-3.5 rounded-full text-[#f6f3f1] text-base font-medium hover:opacity-95 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
          >
            {user ? t('landing.dashboard') : t('landing.getStarted')}
          </Link>
        </div>
      </section>

      {/* Footer: gradient to dark green, cream text, rounded top */}
      <footer className="mt-auto py-8 px-4 sm:px-6 text-[#f6f3f1]/90 rounded-t-3xl" style={{ background: 'linear-gradient(180deg, #2b5843 0%, #1e3d30 100%)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-[#f6f3f1]/70">
            © propsuite.tech. {t('landing.rights')}
          </span>
          <div>
            <LanguageSwitcher dark />
          </div>
        </div>
      </footer>
    </div>
  )
}
