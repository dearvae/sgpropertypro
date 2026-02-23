import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { ProfileEditModal } from './ProfileEditModal'
import { getDisplayName } from '@/types'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const avatarUrl = profile?.avatar_url
  const displayName = getDisplayName(profile) || user?.email?.split('@')[0] || '?'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[#53868e]/30 p-0.5 hover:bg-[#53868e]/10 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={t('userMenu.avatar')} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#53868e] text-sm font-medium" style={{ background: 'rgba(83,134,142,0.2)' }}>
            {(displayName || '?')[0].toUpperCase()}
          </div>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-xl border border-[#53868e]/25 shadow-lg z-50" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
          <div className="px-3 py-2 border-b border-[#53868e]/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm text-[#2b5843] truncate flex-1 min-w-0">{getDisplayName(profile) || t('userMenu.noName')}</p>
              {(profile?.is_admin || profile?.is_super_admin) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#53868e]/25 text-[#2b5843] font-medium shrink-0">
                  {t('userMenu.adminBadge')}
                </span>
              )}
            </div>
            <p className="text-xs text-[#2b5843]/70 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setShowDropdown(false)
              setShowProfileModal(true)
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#2b5843]/90 hover:bg-[#53868e]/10 rounded-t-none"
          >
            {t('userMenu.profile')}
          </button>
          <Link
            to="/invite"
            onClick={() => setShowDropdown(false)}
            className="block w-full text-left px-3 py-2 text-sm text-[#2b5843]/90 hover:bg-[#53868e]/10"
          >
            {t('userMenu.inviteFriends')}
          </Link>
          {profile?.role === 'agent' && profile?.invite_code && (
            <a
              href={`/agent/${profile.invite_code}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setShowDropdown(false)}
              className="block w-full text-left px-3 py-2 text-sm text-[#2b5843]/90 hover:bg-[#53868e]/10"
            >
              {t('userMenu.myProfilePage')}
            </a>
          )}
          <button
            onClick={() => {
              setShowDropdown(false)
              signOut()
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#2b5843]/80 hover:bg-[#53868e]/10 rounded-b-xl"
          >
            {t('userMenu.signOut')}
          </button>
        </div>
      )}

      {showProfileModal && <ProfileEditModal onClose={() => setShowProfileModal(false)} />}
    </div>
  )
}
