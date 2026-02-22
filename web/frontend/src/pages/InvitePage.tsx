import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/hooks/useAuth'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function InvitePage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  useEffect(() => {
    if (user?.id && profile && !profile.invite_code) {
      supabase.rpc('ensure_my_invite_code').then(() => {
        qc.invalidateQueries({ queryKey: ['profile', user.id] })
      })
    }
  }, [user?.id, profile, qc])

  const inviteCode = profile?.invite_code ?? ''
  const inviteLink = inviteCode ? `${window.location.origin}/register?invite=${inviteCode}` : ''

  const copy = async (text: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col px-4" style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher zen />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 rounded-2xl border border-[#53868e]/25" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <h1 className="text-2xl font-medium text-[#2b5843] mb-2">{t('invite.title')}</h1>
          <p className="text-sm text-[#2b5843]/70 mb-8">{t('invite.desc')}</p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-[#2b5843]/90 mb-1">{t('invite.inviteLink')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2.5 border border-[#53868e]/30 rounded-xl bg-[#f6f3f1] text-[#2b5843] text-sm"
                />
                <button
                  type="button"
                  onClick={() => copy(inviteLink, 'link')}
                  className="px-4 py-2 text-sm rounded-full shrink-0 hover:opacity-95 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)', color: '#f6f3f1' }}
                >
                  {copied === 'link' ? t('invite.copied') : t('invite.copy')}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[#2b5843]/90 mb-1">{t('invite.inviteCode')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteCode}
                  className="flex-1 px-3 py-2.5 border border-[#53868e]/30 rounded-xl bg-[#f6f3f1] text-[#2b5843] text-sm font-mono text-lg tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => copy(inviteCode, 'code')}
                  className="px-4 py-2 text-sm rounded-full shrink-0 hover:opacity-95 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)', color: '#f6f3f1' }}
                >
                  {copied === 'code' ? t('invite.copied') : t('invite.copy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
