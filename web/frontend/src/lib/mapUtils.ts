/** 生成 Google 地图搜索 URL，用于打开地图并搜索地点，便于用户导航 */
export function getGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** 生成 Google Maps 路线 URL，展示多个地点（桌面端 waypoints 约 9 个，移动端约 3 个） */
export function getGoogleMapsDirectionsUrl(locations: string[]): string {
  if (locations.length === 0) return 'https://www.google.com/maps'
  if (locations.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`
  }
  const [origin, ...rest] = locations
  const destination = rest.pop() || origin
  const waypoints = rest.length > 0 ? rest.join('|') : undefined
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
