import { useTranslation } from 'react-i18next'

const COMPANY_OPTIONS = [
  { value: 'Propnex', label: 'Propnex' },
  { value: 'Huttons', label: 'Huttons' },
  { value: 'ERA', label: 'ERA' },
  { value: 'others', labelKey: 'register.companyOthers' },
] as const

export type CompanyOptionValue = (typeof COMPANY_OPTIONS)[number]['value']

export interface CompanySelectProps {
  value: string
  onChange: (value: string) => void
  companyOthers: string
  onCompanyOthersChange: (value: string) => void
  labelKey?: string
  othersRequired?: boolean
  labelClassName?: string
  selectClassName?: string
  inputClassName?: string
}

const baseSelectClass =
  'w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e]'
const baseInputClass =
  'mt-2 w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] focus:outline-none focus:border-[#53868e]'
const baseLabelClass = 'block text-xs text-[#2b5843]/80 mb-1'

export function CompanySelect({
  value,
  onChange,
  companyOthers,
  onCompanyOthersChange,
  labelKey = 'profile.company',
  othersRequired = false,
  labelClassName = baseLabelClass,
  selectClassName = baseSelectClass,
  inputClassName = baseInputClass,
}: CompanySelectProps) {
  const { t } = useTranslation()

  return (
    <div>
      <label className={labelClassName}>{t(labelKey)}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
      >
        {COMPANY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {'labelKey' in opt ? t(opt.labelKey) : opt.label}
          </option>
        ))}
      </select>
      {value === 'others' && (
        <input
          type="text"
          value={companyOthers}
          onChange={(e) => onCompanyOthersChange(e.target.value)}
          required={othersRequired}
          className={inputClassName}
          placeholder={t('register.companyOthersPlaceholder')}
        />
      )}
    </div>
  )
}
