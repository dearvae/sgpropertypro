import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CACHE_KEY = 'propertyassistance_geocode'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

type CachedResult = { lat: number; lng: number; fetched: number }

async function geocodeWithNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const cache = sessionStorage.getItem(`${CACHE_KEY}:${query}`)
  if (cache) {
    try {
      const { lat, lng, fetched } = JSON.parse(cache) as CachedResult
      if (Date.now() - fetched < CACHE_TTL) return { lat, lng }
    } catch {
      /* ignore */
    }
  }

  const searchQuery = query.includes('Singapore') ? query : `${query}, Singapore`
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PropertyAssistance/1.0 (viewing schedule map)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const { lat, lon } = data[0]
  const result = { lat: parseFloat(lat), lng: parseFloat(lon) }
  sessionStorage.setItem(
    `${CACHE_KEY}:${query}`,
    JSON.stringify({ ...result, fetched: Date.now() })
  )
  return result
}

// Fix Leaflet default icon in vite/bundler
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export type MapProperty = { id: string; title: string }

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [map, points])
  return null
}

type Props = {
  properties: MapProperty[]
  onClose: () => void
  title?: string
}

export function MapViewModal({ properties, onClose, title }: Props) {
  const { t } = useTranslation()
  const [markers, setMarkers] = useState<{ id: string; title: string; lat: number; lng: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [failed, setFailed] = useState<string[]>([])

  const uniqueTitles = [...new Set(properties.map((p) => p.title.trim()).filter(Boolean))]

  const fetchAll = useCallback(async () => {
    if (uniqueTitles.length === 0) {
      setLoading(false)
      return
    }
    setProgress({ current: 0, total: uniqueTitles.length })
    const results: { id: string; title: string; lat: number; lng: number }[] = []
    const failList: string[] = []
    for (let i = 0; i < uniqueTitles.length; i++) {
      setProgress((p) => ({ ...p, current: i + 1 }))
      const title = uniqueTitles[i]
      const coord = await geocodeWithNominatim(title)
      if (coord) {
        results.push({ id: `m-${i}`, title, lat: coord.lat, lng: coord.lng })
      } else {
        failList.push(title)
      }
      if (i < uniqueTitles.length - 1) {
        await new Promise((r) => setTimeout(r, 1100))
      }
    }
    setMarkers(results)
    setFailed(failList)
    setLoading(false)
  }, [uniqueTitles.join('|')])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const points: [number, number][] = markers.map((m) => [m.lat, m.lng])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h3 className="text-base font-semibold text-slate-900">{title ?? 'Map'}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
              <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-slate-600">
                {progress.total > 0
                  ? t('clientView.mapLoadingProgress', { current: progress.current, total: progress.total })
                  : t('common.loading')}
              </p>
            </div>
          ) : markers.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-600 text-sm">
              <p>{t('clientView.mapNoLocations')}</p>
              {failed.length > 0 && (
                <p className="text-xs text-slate-500">{t('clientView.mapGeocodeFailed', { count: failed.length })}</p>
              )}
            </div>
          ) : (
            <MapContainer
              center={[1.3521, 103.8198]}
              zoom={11}
              className="w-full h-full"
              style={{ minHeight: 300 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={points} />
              {markers.map((m) => (
                <Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
                  <Popup>{m.title}</Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
        {failed.length > 0 && !loading && markers.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 bg-amber-50 text-amber-800 text-xs shrink-0">
            {t('clientView.mapPartialFailed', {
              list: failed.slice(0, 3).join(', '),
              extra: failed.length > 3 ? ` +${failed.length - 3} ${t('clientView.mapMore')}` : '',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
