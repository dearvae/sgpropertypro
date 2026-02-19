import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="text-sm text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:border-stone-300 transition-colors"
      title={i18n.language === 'zh' ? t('lang.switchToEn') : t('lang.switchToZh')}
    >
      {i18n.language === 'zh' ? 'EN' : '中文'}
    </button>
  )
}
