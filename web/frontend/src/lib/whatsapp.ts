/**
 * 将电话号码标准化为 WhatsApp wa.me URL 格式
 * 格式：https://wa.me/<国际码+数字>，无空格、括号、横线
 * 新加坡 8 位本地号自动补 65
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length >= 10) return digits
  if (digits.length === 8 && !digits.startsWith('65')) return '65' + digits
  return digits || phone
}

/** 生成与指定号码的 WhatsApp 对话链接 */
export function getWhatsAppChatUrl(phone: string, prefillText?: string): string {
  const normalized = normalizePhoneForWhatsApp(phone)
  const base = `https://wa.me/${normalized}`
  if (prefillText?.trim()) {
    return `${base}?text=${encodeURIComponent(prefillText.trim())}`
  }
  return base
}
