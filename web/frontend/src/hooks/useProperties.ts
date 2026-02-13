import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Property } from '@/types'

export function useProperties() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['properties', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Property[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async (p: { title: string; link?: string; basic_info?: string }) => {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          agent_id: user!.id,
          title: p.title,
          link: p.link || null,
          basic_info: p.basic_info || null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Property
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  const update = useMutation({
    mutationFn: async (p: Partial<Property> & { id: string }) => {
      const { id, ...rest } = p
      const { data, error } = await supabase
        .from('properties')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Property
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  return { ...query, create, update, remove }
}
