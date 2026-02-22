import { useTranslation } from 'react-i18next'

export function LanguageSwitcher({ dark, zen }: { dark?: boolean; zen?: boolean }) {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
  }

  const baseClass = 'text-sm px-3 py-1.5 rounded-full border transition-colors'
  const variantClass = dark
    ? 'text-[#f6f3f1]/70 hover:text-[#f6f3f1] border-[#f6f3f1]/20 hover:border-[#f6f3f1]/40'
    : zen
      ? 'text-[#2b5843]/80 hover:text-[#2b5843] border-[#53868e]/40 hover:border-[#53868e]'
      : 'text-[#2b5843]/80 hover:text-[#2b5843] border-[#53868e]/30 hover:border-[#53868e]'

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`${baseClass} ${variantClass}`}
      title={i18n.language === 'zh' ? t('lang.switchToEn') : t('lang.switchToZh')}
    >
      {i18n.language === 'zh' ? 'EN' : '中文'}
    </button>
  )
}
