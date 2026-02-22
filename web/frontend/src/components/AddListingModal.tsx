import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { addAgentListing, isSupportedScrapeUrl, normalizeSourceUrl } from '@/lib/scrapeApi'

type ListingType = 'sale' | 'rent'

interface AddListingModalProps {
  open: boolean
  onClose: () => void
  listingType: ListingType
  agentId: string
  onSuccess: () => void
}

export function AddListingModal({ open, onClose, listingType, agentId, onSuccess }: AddListingModalProps) {
  const { t } = useTranslation()
  const [propertyLink, setPropertyLink] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setPropertyLink('')
      setClientName('')
      setError(null)
    }
  }, [open])

  const title = listingType === 'sale' ? t('dashboard.addPropertySale') : t('dashboard.addPropertyRent')

  const handleSubmit = async () => {
    const link = propertyLink.trim()
    if (!link) {
      setError(t('dashboard.addListingPropertyLinkRequired'))
      return
    }
    const url = normalizeSourceUrl(link)
    if (!isSupportedScrapeUrl(url)) {
      setError(t('dashboard.propertyLinkOnly'))
      return
    }
    setError(null)
    setIsPending(true)
    try {
      await addAgentListing({
        url,
        agent_id: agentId,
        client_name: clientName.trim() || undefined,
        listing_type: listingType,
      })
      onSuccess()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[#f6f3f1] rounded-xl shadow-lg p-6 w-full max-w-md mx-4 border border-[#53868e]/25"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[#2b5843] mb-4">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#2b5843]/80">
              {t('dashboard.propertyLink')} <span className="text-[#53868e]">{t('dashboard.required')}</span>
            </label>
            <textarea
              value={propertyLink}
              onChange={(e) => { setPropertyLink(e.target.value); setError(null) }}
              placeholder={t('dashboard.propertyLinkPlaceholder')}
              rows={4}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-y"
              autoFocus
            />
            <p className="text-xs text-[#2b5843]/70 mt-1">{t('dashboard.addListingPropertyLinkHint')}</p>
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('dashboard.addListingClientNameOptional')}</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('dashboard.addListingClientNamePlaceholder')}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={isPending || !propertyLink.trim()}
            className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && (
              <svg className="animate-spin h-4 w-4 text-[#2b5843]/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {t('common.add')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
