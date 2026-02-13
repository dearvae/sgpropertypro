import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '@/types'

/** 是否已满一年可再次修改姓名 */
export function canChangeName(nameChangedAt: string | null): boolean {
  if (!nameChangedAt) return true
  const last = new Date(nameChangedAt).getTime()
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
  return last < oneYearAgo
}

export function useProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: user!.id, role: 'agent' })
          .select()
          .single()
        if (insertErr) {
          if (insertErr.code === '23505') {
            const { data: existing } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user!.id)
              .maybeSingle()
            if (existing) return existing as Profile
          }
          throw insertErr
        }
        return inserted as Profile
      }
      return data as Profile
    },
    enabled: !!user?.id,
  })

  const update = useMutation({
    mutationFn: async (updates: {
      full_name?: string
      agent_number?: string
      phone?: string
      avatar_url?: string
      updateNameChangedAt?: boolean
    }) => {
      const { full_name, agent_number, phone, avatar_url, updateNameChangedAt } = updates
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (full_name !== undefined) payload.full_name = full_name || null
      if (agent_number !== undefined) payload.agent_number = agent_number || null
      if (phone !== undefined) payload.phone = phone || null
      if (avatar_url !== undefined) payload.avatar_url = avatar_url || null
      if (updateNameChangedAt) payload.name_changed_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user!.id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  })

  return { ...query, update, canChangeName }
}
