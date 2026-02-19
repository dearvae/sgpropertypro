/** 生成 Google 地图搜索 URL，用于打开地图并搜索地点，便于用户导航 */
export function getGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
