import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * One draggable pin. `post_property` requires latitude AND longitude, and
 * typing coordinates by hand is how a listing ends up in the Atlantic — so the
 * map is the input, and the two number fields beside it only echo it.
 *
 * Same tile source and same no-default-icon rule as `PropertyMap` (see the
 * notes there). No reverse geocoding: the address fields are typed by the
 * agent, which keeps this free of a geocoding key and of a second outbound
 * service. If the product wants "drop pin → fill address", that is a Nominatim
 * or Google Places call added here, not a rewrite.
 */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Santo Domingo. Where an unplaced pin starts, never what gets submitted —
 *  the form still refuses until the agent has actually moved it. */
const DEFAULT_CENTER: [number, number] = [18.4861, -69.9312]
const CITY_ZOOM = 12
const PLACED_ZOOM = 15

export function LocationPicker({
  lat,
  lng,
  onChange,
  label,
}: {
  /** Null until the agent places the pin. */
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  /** Accessible name for the map region — it has no heading of its own. */
  label: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (containerRef.current === null) return

    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    map.setView(DEFAULT_CENTER, CITY_ZOOM)
    mapRef.current = map

    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current(event.latlng.lat, event.latlng.lng)
    })

    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map === null) return

    if (lat === null || lng === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (markerRef.current === null) {
      const marker = L.marker([lat, lng], {
        draggable: true,
        keyboard: true,
        icon: L.divIcon({ className: 'rf-pin', html: '<span class="rf-pin__label">●</span>' }),
      })
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        onChangeRef.current(position.lat, position.lng)
      })
      marker.addTo(map)
      markerRef.current = marker
      // Only on first placement: re-centring on every drag would fight the
      // hand that is dragging.
      map.setView([lat, lng], Math.max(map.getZoom(), PLACED_ZOOM))
    } else {
      markerRef.current.setLatLng([lat, lng])
    }
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      /* Leaflet renders 0px tall without a resolved height. */
      className="h-72 w-full rounded-lg border border-rule"
    />
  )
}
