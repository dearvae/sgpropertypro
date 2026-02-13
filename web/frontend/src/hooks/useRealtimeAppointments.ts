import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/** 中介端：预约表变更时刷新列表 */
export function useRealtimeAppointments(customerGroupId?: string) {
  const { user } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          qc.invalidateQueries({ queryKey: ['appointments', user.id, customerGroupId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, customerGroupId, qc])
}

/** 客户端：预约或相关表变更时刷新 client-view */
export function useRealtimeClientView(token: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!token) return

    const channel = supabase
      .channel('client-view-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          qc.invalidateQueries({ queryKey: ['client-view', token] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          qc.invalidateQueries({ queryKey: ['client-view', token] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [token, qc])
}
