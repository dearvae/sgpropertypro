import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Note } from '@/types'

export function useNotes(propertyId?: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notes', user?.id, propertyId],
    queryFn: async () => {
      if (propertyId) {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return data as Note[]
      }
      // 获取该 agent 下所有房源的备注（通过 properties join）
      const { data: props } = await supabase.from('properties').select('id').eq('agent_id', user!.id)
      const ids = props?.map((p) => p.id) ?? []
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .in('property_id', ids)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Note[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async (n: { property_id: string; content: string; visibility?: 'client_visible' | 'internal' }) => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          property_id: n.property_id,
          content: n.content,
          visibility: n.visibility ?? 'internal',
        })
        .select()
        .single()
      if (error) throw error
      return data as Note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', user?.id] }),
  })

  const update = useMutation({
    mutationFn: async (n: Partial<Note> & { id: string }) => {
      const { id, ...rest } = n
      const { data, error } = await supabase
        .from('notes')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', user?.id] }),
  })

  return { ...query, create, update, remove }
}
