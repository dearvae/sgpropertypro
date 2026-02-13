import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { ProfileEditModal } from './ProfileEditModal'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
  const displayName = profile?.full_name || user?.email?.split('@')[0] || '?'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-stone-200 p-0.5 hover:bg-stone-50 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="头像" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 text-sm font-medium">
            {displayName[0].toUpperCase()}
          </div>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] bg-white border border-stone-200 rounded-sm shadow-lg z-50">
          <div className="px-3 py-2 border-b border-stone-100">
            <p className="text-sm text-stone-900 truncate">{profile?.full_name || '未设置姓名'}</p>
            <p className="text-xs text-stone-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setShowDropdown(false)
              setShowProfileModal(true)
            }}
            className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            个人资料
          </button>
          <button
            onClick={() => {
              setShowDropdown(false)
              signOut()
            }}
            className="w-full text-left px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            退出
          </button>
        </div>
      )}

      {showProfileModal && <ProfileEditModal onClose={() => setShowProfileModal(false)} />}
    </div>
  )
}
