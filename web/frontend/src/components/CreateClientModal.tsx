import { useState, useEffect } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'

type Intent = 'buy' | 'rent'

interface CreateClientModalProps {
  open: boolean
  onClose: () => void
  intent: Intent
  onSubmit: (name: string, description: string) => Promise<void>
  isPending: boolean
}

export function CreateClientModal({ open, onClose, intent, onSubmit, isPending }: CreateClientModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
    }
  }, [open])

  const title = intent === 'buy' ? t('dashboard.addBuyer') : t('dashboard.addTenant')

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await onSubmit(trimmed, description.trim())
      onClose()
    } catch (e) {
      message.error((e as Error).message)
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
              {t('dashboard.groupName')} <span className="text-[#53868e]">{t('dashboard.required')}</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dashboard.groupNamePlaceholder')}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-[#2b5843]/80">{t('dashboard.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dashboard.descriptionPlaceholder')}
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm border border-[#53868e]/35 rounded-xl hover:bg-[#53868e]/15 disabled:opacity-50"
          >
            {t('common.create')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#2b5843]/70 hover:text-[#2b5843]/90">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
