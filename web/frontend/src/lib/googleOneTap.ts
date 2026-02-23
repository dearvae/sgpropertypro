import type { SupabaseClient } from '@supabase/supabase-js'

/** 加载 Google Identity Services (GSI) 脚本 */
async function loadGsiScript(): Promise<void> {
  if (document.getElementById('gsi-script')) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.id = 'gsi-script'
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google GSI script'))
    document.head.appendChild(s)
  })
}

/** 生成 nonce 对：[plain, hashed-hex]，供 Google（hashed）和 Supabase（plain）使用 */
async function generateNoncePair(): Promise<[string, string]> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const nonce = btoa(String.fromCharCode(...bytes))

  const encoder = new TextEncoder()
  const data = encoder.encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return [nonce, hashedNonce]
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            nonce: string
            use_fedcm_for_prompt?: boolean
            callback: (resp: { credential: string }) => void
          }) => void
          prompt: () => void
        }
      }
    }
  }
}

/**
 * 初始化 Google One Tap 登录
 * - 若用户已登录则不会弹窗
 * - nonce：Google 侧用 SHA-256 hex，Supabase 侧用原始 plain nonce
 * - use_fedcm_for_prompt：兼容 Chrome 新策略
 */
export async function initGoogleOneTap({
  supabase,
  googleClientId,
  onSuccess,
  onError,
}: {
  supabase: SupabaseClient
  googleClientId: string
  onSuccess?: () => void
  onError?: (err: Error) => void
}): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return

  await loadGsiScript()
  const [nonce, hashedNonce] = await generateNoncePair()

  if (!window.google?.accounts?.id) {
    onError?.(new Error('Google GSI not ready'))
    return
  }

  window.google.accounts.id.initialize({
    client_id: googleClientId,
    nonce: hashedNonce,
    use_fedcm_for_prompt: true,
    callback: async (resp) => {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: resp.credential,
        nonce,
      })
      if (!error) onSuccess?.()
      else onError?.(new Error(error.message))
    },
  })

  window.google.accounts.id.prompt()
}
