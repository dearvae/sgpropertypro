import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { PendingAppointment, PendingAppointmentStatus } from '@/types'

export function usePendingAppointments(customerGroupId?: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['pending_appointments', user?.id, customerGroupId],
    queryFn: async () => {
      let q = supabase
        .from('pending_appointments')
        .select(`
          *,
          properties (*),
          customer_groups (*)
        `)
        .order('created_at', { ascending: false })

      if (customerGroupId) {
        q = q.eq('customer_group_id', customerGroupId)
      } else {
        const { data: props } = await supabase.from('properties').select('id').eq('agent_id', user!.id)
        const ids = props?.map((p) => p.id) ?? []
        if (ids.length === 0) return []
        q = q.in('property_id', ids)
      }

      const { data, error } = await q
      if (error) throw error
      return data as PendingAppointment[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async (a: {
      property_id: string
      customer_group_id: string
      status?: PendingAppointmentStatus
      notes?: string | null
    }) => {
      const { property_id, customer_group_id, status = 'not_scheduled', notes } = a
      const { data, error } = await supabase
        .from('pending_appointments')
        .insert({ property_id, customer_group_id, status, notes: notes || null })
        .select('*, properties(*), customer_groups(*)')
        .single()
      if (error) throw error
      return data as PendingAppointment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending_appointments', user?.id] })
    },
  })

  const update = useMutation({
    mutationFn: async (a: Partial<PendingAppointment> & { id: string }) => {
      const { id, ...rest } = a
      const { data, error } = await supabase
        .from('pending_appointments')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, properties(*), customer_groups(*)')
        .single()
      if (error) throw error
      return data as PendingAppointment
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending_appointments', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pending_appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending_appointments', user?.id] }),
  })

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.from('pending_appointments').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending_appointments', user?.id] }),
  })

  return { ...query, create, update, remove, removeMany }
}
