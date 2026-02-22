import { supabase } from '@/lib/supabase'

/** 检查手机号是否可用（未在 profiles 中注册） */
export async function checkPhoneAvailable(phone: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_phone_available', { p_phone: phone })
  if (error) throw error
  return data === true
}

/** 检查手机号是否可用于更新（排除指定用户） */
export async function checkPhoneAvailableForUpdate(phone: string, excludeUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_phone_available_for_update', {
    p_phone: phone,
    p_exclude_id: excludeUserId,
  })
  if (error) throw error
  return data === true
}
