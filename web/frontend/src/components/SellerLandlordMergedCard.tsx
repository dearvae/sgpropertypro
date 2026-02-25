/**
 * 代表卖家/房东的合并预约卡片：同一房源、同一时段、多组潜在买家，无穿插其他预约时合并展示
 * 支持多种时间表布局变体，供 Playground 选型
 */
import { message } from 'antd'
import { getWhatsAppChatUrl, getTelUrl } from '@/lib/whatsapp'
import type { Appointment, PartyRole } from '@/types'
import type { SellerMergedBlock, SellerMergedCardVariant } from '@/lib/sellerMergedBlocks'

export type { SellerMergedBlock, SellerMergedCardVariant }

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const ROLE_LABELS: Record<PartyRole, string> = { buyer: '买家', tenant: '租客', seller: '卖家', landlord: '房东' }

function formatTime(iso: string, locale = 'zh-CN') {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

function renderRow(
  a: Appointment,
  _partyRole: PartyRole,
  variant: SellerMergedCardVariant,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const name = a.customer_info ?? `—`
  const phone = a.customer_phone
  const timeStr = formatTime(a.start_time)
  const waUrl = phone ? getWhatsAppChatUrl(phone) : null
  const telUrl = phone ? getTelUrl(phone) : null

  if (variant === 'table') {
    return (
      <tr key={a.id} className="border-b border-amber-200/50 last:border-0">
        <td className="py-2 pr-3 text-sm text-[#2b5843]/80 tabular-nums">{timeStr}</td>
        <td className="py-2 pr-3 text-sm text-[#2b5843]/90">{name}</td>
        <td className="py-2 pr-3 text-sm">
          {phone && telUrl ? (
            <span className="flex items-center gap-2">
              <a href={telUrl ?? ''} className="text-[#2b5843]/90 hover:underline">{phone}</a>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault()
                  try {
                    await navigator.clipboard.writeText(phone)
                    message.success(t('common.copied'))
                  } catch {
                    message.error(t('common.retry'))
                  }
                }}
                className="p-0.5 rounded text-[#2b5843]/60 hover:text-[#2b5843]/90 hover:bg-amber-100/50"
                title={t('common.copy')}
                aria-label={t('common.copy')}
              >
                <CopyIcon />
              </button>
              {waUrl && (
                <a href={waUrl ?? ''} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-[#25D366] text-white hover:bg-[#20BD5A]">
                  <WhatsAppIcon /> WhatsApp
                </a>
              )}
            </span>
          ) : (
            <span className="text-[#2b5843]/50">—</span>
          )}
        </td>
        <td className="py-2 text-sm text-[#2b5843]/70">{a.notes || '—'}</td>
      </tr>
    )
  }

  if (variant === 'timeline') {
    return (
      <div key={a.id} className="flex gap-3 py-2 border-b border-amber-200/30 last:border-0">
        <span className="shrink-0 w-14 text-sm text-amber-700 font-medium tabular-nums">{timeStr}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#2b5843]">{name}</span>
          {phone && telUrl && (
            <span className="text-sm text-[#2b5843]/70 ml-2">
              <a href={telUrl ?? ''} className="hover:underline">{phone}</a>
              {waUrl && (
                <a href={waUrl ?? ''} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[#25D366] hover:underline">
                  <WhatsAppIcon /> WhatsApp
                </a>
              )}
            </span>
          )}
          {a.notes && <p className="text-xs text-[#2b5843]/60 mt-0.5">{a.notes}</p>}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div key={a.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
        <span className="shrink-0 text-amber-700 tabular-nums font-medium">{timeStr}</span>
        <span className="text-[#2b5843]/90">{name}</span>
        {phone && telUrl && (
          <>
            <a href={telUrl} className="text-[#2b5843]/80 hover:underline">{phone}</a>
            {waUrl && (
              <a href={waUrl ?? ''} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-xs">
                <WhatsAppIcon /> WA
              </a>
            )}
          </>
        )}
      </div>
    )
  }

  if (variant === 'blocks') {
    return (
      <div key={a.id} className="rounded-lg border border-amber-200/50 bg-amber-50/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-amber-800 tabular-nums">{timeStr}</span>
          {waUrl && phone && (
            <a href={waUrl ?? ''} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#25D366] text-white hover:bg-[#20BD5A]">
              <WhatsAppIcon /> WhatsApp
            </a>
          )}
        </div>
        <p className="text-sm font-medium text-[#2b5843] mt-1">{name}</p>
        {phone && telUrl && <a href={telUrl} className="text-xs text-[#2b5843]/80 hover:underline">{phone}</a>}
        {a.notes && <p className="text-xs text-[#2b5843]/60 mt-2">{a.notes}</p>}
      </div>
    )
  }

  // minimal
  return (
    <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="tabular-nums text-amber-700">{timeStr}</span>
      <span className="text-[#2b5843]/90 truncate">{name}</span>
      {waUrl && (
        <a href={waUrl ?? ''} target="_blank" rel="noreferrer" className="shrink-0 p-1 rounded text-[#25D366] hover:bg-[#25D366]/10" title="WhatsApp">
          <WhatsAppIcon />
        </a>
      )}
    </div>
  )
}

export type SellerMergedCardProps = {
  block: SellerMergedBlock
  variant: SellerMergedCardVariant
  t: (key: string, options?: Record<string, unknown>) => string
  renderActions?: (appointments: Appointment[]) => React.ReactNode
}

export function SellerMergedCard({ block, variant, t, renderActions }: SellerMergedCardProps) {
  const { property, partyRole, appointments } = block
  const roleLabel = ROLE_LABELS[partyRole]
  const timeRange =
    appointments.length > 0
      ? `${formatTime(appointments[0].start_time)} – ${formatTime(appointments[appointments.length - 1].end_time)}`
      : ''

  return (
    <div className="border-l-4 border-amber-500 rounded-r-xl overflow-hidden bg-[#fffbeb] shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 shrink-0">
            {t('appointmentsSection.represent', { role: roleLabel })}
          </span>
          <span className="text-xs text-[#2b5843]/60">{timeRange}</span>
        </div>
        <h3 className="font-semibold text-base text-[#2b5843] mb-3">{property.title ?? '—'}</h3>

        {variant === 'table' && (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-[#2b5843]/60 border-b border-amber-200/50">
                <th className="py-2 pr-3 font-medium">时间</th>
                <th className="py-2 pr-3 font-medium">{partyRole === 'seller' ? '潜在买家' : '潜在租客'}</th>
                <th className="py-2 pr-3 font-medium">联系方式</th>
                <th className="py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => renderRow(a, partyRole, 'table', t))}
            </tbody>
          </table>
        )}

        {variant === 'timeline' && (
          <div className="space-y-0">
            {appointments.map((a) => renderRow(a, partyRole, 'timeline', t))}
          </div>
        )}

        {variant === 'compact' && (
          <div className="space-y-0 divide-y divide-amber-200/30">
            {appointments.map((a) => renderRow(a, partyRole, 'compact', t))}
          </div>
        )}

        {variant === 'blocks' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {appointments.map((a) => renderRow(a, partyRole, 'blocks', t))}
          </div>
        )}

        {variant === 'minimal' && (
          <div className="space-y-0">
            {appointments.map((a) => renderRow(a, partyRole, 'minimal', t))}
          </div>
        )}

        {renderActions && (
          <div className="mt-3 pt-3 border-t border-amber-200/50 flex flex-wrap items-center gap-2">
            {renderActions(appointments)}
          </div>
        )}
      </div>
    </div>
  )
}
