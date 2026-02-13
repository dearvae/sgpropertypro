import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Appointment } from '@/types'

export function useAppointments(customerGroupId?: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['appointments', user?.id, customerGroupId],
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select(`
          *,
          properties (*),
          customer_groups (*)
        `)
        .eq('status', 'scheduled')

      if (customerGroupId) {
        q = q.eq('customer_group_id', customerGroupId)
      } else {
        const { data: props } = await supabase.from('properties').select('id').eq('agent_id', user!.id)
        const ids = props?.map((p) => p.id) ?? []
        if (ids.length === 0) return []
        q = q.in('property_id', ids)
      }

      const { data, error } = await q.order('start_time', { ascending: true })
      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async (a: {
      property_id: string
      party_role: 'buyer' | 'seller' | 'tenant' | 'landlord'
      customer_group_id?: string | null
      customer_info?: string | null
      customer_phone?: string | null
      start_time: string
      end_time: string
      notes?: string | null
    }) => {
      const { property_id, party_role, customer_group_id, customer_info, customer_phone, start_time, end_time, notes } = a
      const payload: Record<string, unknown> = {
        property_id,
        party_role,
        start_time,
        end_time,
        notes: notes || null,
        customer_info: customer_info?.trim() || null,
        customer_phone: customer_phone?.trim() || null,
      }
      if (customer_group_id) payload.customer_group_id = customer_group_id
      else payload.customer_group_id = null
      const { data, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select('*, properties(*), customer_groups(*)')
        .single()
      if (error) throw error
      return data as Appointment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments', user?.id] })
    },
  })

  const update = useMutation({
    mutationFn: async (a: Partial<Appointment> & { id: string }) => {
      const { id, ...rest } = a
      const { data, error } = await supabase
        .from('appointments')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, properties(*), customer_groups(*)')
        .single()
      if (error) throw error
      return data as Appointment
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments', user?.id] }),
  })

  return { ...query, create, update, remove }
}
