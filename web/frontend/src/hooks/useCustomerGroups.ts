import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { CustomerGroup } from '@/types'

export function useCustomerGroups() {
  const { user } = useAuth()
  const qc = useQueryClient()
  
  const query = useQuery({
    queryKey: ['customer-groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_groups')
        .select('*')
        .eq('agent_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as CustomerGroup[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async ({ name, description, intent }: { name: string; description?: string; intent: 'buy' | 'rent' }) => {
      const { data, error } = await supabase
        .from('customer_groups')
        .insert({ agent_id: user!.id, name, description: description || null, intent })
        .select()
        .single()
      if (error) throw error
      return data as CustomerGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-groups', user?.id] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, name, intent }: { id: string; name: string; intent?: 'buy' | 'rent' }) => {
      const { data, error } = await supabase
        .from('customer_groups')
        .update({
          name,
          ...(intent !== undefined && { intent }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CustomerGroup
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-groups', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-groups', user?.id] }),
  })

  return { ...query, create, update, remove }
}
