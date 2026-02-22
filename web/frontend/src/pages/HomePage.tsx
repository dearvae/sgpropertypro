import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { getDisplayName } from '@/types'

// Simple line icons as SVG components (no photos)
function IconCalendar() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
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
    { key: '1', Icon: IconCalendar },
    { key: '2', Icon: IconLink },
    { key: '3', Icon: IconMap },
    { key: '4', Icon: IconTable },
  ]

  const testimonials = [
    { key: '1' },
    { key: '2' },
    { key: '3' },
  ]

  return (
    <div className="min-h-screen flex flex-col text-[#2b5843]" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 50%, #dde4e2 100%)' }}>
      {/* Header: sticky, cream gradient */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-[#53868e]/20 rounded-b-3xl mx-4 mt-2 sm:mx-6 sm:mt-3" style={{ background: 'linear-gradient(135deg, #f6f3f1 0%, #f0ebe8 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="text-lg font-medium text-[#2b5843] hover:opacity-80 transition-opacity">
            SG PropertyPro
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors">
              {t('landing.navFeatures')}
            </a>
            <a href="#testimonials" className="text-base text-[#2b5843]/90 hover:text-[#2b5843] transition-colors">
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
          <p className="mt-5 text-lg sm:text-xl text-[#2b5843]/85 max-w-xl mx-auto" style={{ fontSize: 'min(1.125rem, max(1rem, 4vw))' }}>
            {t('landing.heroSubtitle')}
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

      {/* Features: 4 cards, cream gradient, rounded corners */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #e8ebe8 0%, #f6f3f1 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843] text-center mb-12">
            {t('landing.navFeatures')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ key, Icon }) => (
              <article
                key={key}
                className="p-6 border border-[#53868e]/25 rounded-2xl"
                style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebe8e5 100%)' }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#53868e] mb-4" style={{ background: 'linear-gradient(135deg, rgba(83,134,142,0.15) 0%, rgba(43,88,67,0.08) 100%)' }}>
                  <Icon />
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

      {/* Testimonials: 3 cards */}
      <section id="testimonials" className="py-16 sm:py-24 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#2b5843] text-center mb-12">
            {t('landing.testimonialHeadline')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ key }) => {
              const name = t(`landing.testimonial${key}Name`)
              const initial = name.charAt(0)
              return (
              <article
                key={key}
                className="p-6 border border-[#53868e]/20 rounded-2xl"
                style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
              >
                <p className="text-base text-[#2b5843]/85 leading-relaxed mb-5">
                  &ldquo;{t(`landing.testimonial${key}`)}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#53868e] text-sm font-medium" style={{ background: 'linear-gradient(135deg, rgba(83,134,142,0.2) 0%, rgba(43,88,67,0.1) 100%)', border: '1px solid rgba(83,134,142,0.3)' }}>
                    {initial}
                  </div>
                  <div>
                    <p className="font-medium text-[#2b5843]">{t(`landing.testimonial${key}Name`)}</p>
                    <p className="text-sm text-[#2b5843]/70">{t(`landing.testimonial${key}Role`)}</p>
                  </div>
                </div>
              </article>
            )})}
          </div>
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
            © SG PropertyPro. {t('landing.rights')}
          </span>
          <div className="flex items-center gap-6">
            <LanguageSwitcher dark />
            <a href="#" className="text-sm text-[#f6f3f1]/80 hover:text-[#f6f3f1] transition-colors">
              {t('landing.privacy')}
            </a>
            <a href="#" className="text-sm text-[#f6f3f1]/80 hover:text-[#f6f3f1] transition-colors">
              {t('landing.terms')}
            </a>
            <a href="#" className="text-sm text-[#f6f3f1]/80 hover:text-[#f6f3f1] transition-colors">
              {t('landing.contact')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
