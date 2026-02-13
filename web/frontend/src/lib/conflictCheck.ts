/**
 * 检查两个时间段是否重叠
 * 重叠条件：start1 < end2 && end1 > start2
 */
export function timeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2
}

export function checkAppointmentConflict(
  newStart: string,
  newEnd: string,
  existingAppointments: Array<{ start_time: string; end_time: string; id?: string }>,
  excludeId?: string
): { hasConflict: boolean; conflictingWith?: { start_time: string; end_time: string } } {
  const start = new Date(newStart)
  const end = new Date(newEnd)
  if (end <= start) {
    return { hasConflict: true }
  }
  for (const apt of existingAppointments) {
    if (excludeId && apt.id === excludeId) continue
    const aptStart = new Date(apt.start_time)
    const aptEnd = new Date(apt.end_time)
    if (timeRangesOverlap(start, end, aptStart, aptEnd)) {
      return { hasConflict: true, conflictingWith: apt }
    }
  }
  return { hasConflict: false }
}
