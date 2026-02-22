import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCustomerGroups } from './useCustomerGroups'
import { useAuth } from './useAuth'
import type { CustomerGroup } from '@/types'

/** For client users: ensures one "self" customer group exists and returns it. */
export function useClientSelfGroup() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const groups = useCustomerGroups()
  const createdRef = useRef(false)

  useEffect(() => {
    if (!user?.id || !groups.data || groups.data.length > 0 || createdRef.current || groups.create.isPending) return
    createdRef.current = true
    groups.create.mutate(
      { name: t('landing.myViewings'), intent: 'buy' },
      { onError: () => { createdRef.current = false } }
    )
  }, [user?.id, groups.data?.length, groups.create.isPending, t])

  const selfGroup: CustomerGroup | null = groups.data?.[0] ?? null
  return { ...groups, selfGroup }
}
