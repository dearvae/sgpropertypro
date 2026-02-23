import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    role?: 'agent' | 'client',
    meta?: {
      familyName?: string
      givenName?: string
      agentNumber?: string
      company?: string
      phone?: string
      inviteCode?: string
    }
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!import.meta.env.VITE_POSTHOG_KEY) return
    if (!user) {
      posthog.reset()
    } else {
      posthog.identify(user.id, {
        email: user.email,
        role: user.user_metadata?.role,
      })
    }
  }, [user])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      role: 'agent' | 'client' = 'agent',
      meta?: {
        familyName?: string
        givenName?: string
        agentNumber?: string
        company?: string
        phone?: string
        inviteCode?: string
      }
    ) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            family_name: meta?.familyName?.trim() || null,
            given_name: meta?.givenName?.trim() || null,
            agent_number: meta?.agentNumber?.trim() || null,
            phone: meta?.phone?.trim() || null,
            company: meta?.company?.trim() || null,
            invited_by_code: meta?.inviteCode?.trim() || null,
          },
        },
      })
      if (error) return { error: error as Error }
      if (data.user && !(data.user.identities && data.user.identities.length > 0)) {
        return { error: new Error('EMAIL_EXISTS') }
      }
      return { error: null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
