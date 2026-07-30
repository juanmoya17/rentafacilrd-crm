import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '@/lib/i18n/context'
import type { LocatedProperty } from '@/lib/crm/properties'

/**
 * OpenStreetMap tiles + one price pin per geocoded listing.
 *
 * Three things worth knowing before editing this:
 *
 *  1. **Tiles are fetched from tile.openstreetmap.org.** That is an outbound
 *     request per tile from an agent's browser to a third party, and the only
 *     thing it leaks is which part of the country they are looking at. If the
 *     brokerage ever needs that to stay in-house, swap `TILE_URL` for a
 *     self-hosted or paid endpoint — nothing else here changes.
 *  2. **No default Leaflet markers.** Every pin is a `divIcon`, so the
 *     `marker-icon.png` 404 that bundlers famously produce cannot happen —
 *     Leaflet never asks for the image.
 *  3. **The popup is the list, not a bubble.** Clicking a pin selects the
 *     listing and the column beside the map scrolls it into view. A bubble
 *     over the map would cover the neighbours you are comparing against,
 *     which is the entire reason for looking at a map.
 */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Wide enough that a single pin does not open at street level. */
const SINGLE_PIN_ZOOM = 14

export function PropertyMap({
  properties,
  activeId,
  onSelect,
}: {
  properties: LocatedProperty[]
  activeId: number | null
  onSelect: (id: number) => void
}) {
  const { formatNumber } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef(new Map<number, L.Marker>())
  // Read inside the marker click handler so a changing callback does not have
  // to tear down and rebuild every pin.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (containerRef.current === null) return

    const map = L.map(containerRef.current, {
      // The page already scrolls; a wheel that zooms the map instead of moving
      // the page is the single most hated thing an embedded map does. Ctrl or
      // ⌘ + wheel still zooms, and so do the buttons.
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    mapRef.current = map

    // The container is often laid out after the map is constructed (a view
    // switch, a flex parent settling), and Leaflet caches the size it saw at
    // construction — the classic grey-tile-band bug.
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(containerRef.current)

    // Captured now rather than read in the cleanup: by teardown time the ref
    // may already point at the next mount's map.
    const markers = markersRef.current
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markers.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map === null) return

    for (const marker of markersRef.current.values()) marker.remove()
    markersRef.current.clear()

    for (const property of properties) {
      const label =
        property.price === null
          ? '—'
          : formatNumber(property.price, { notation: 'compact', maximumFractionDigits: 1 })

      const marker = L.marker([property.lat, property.lng], {
        title: property.title,
        keyboard: true,
        alt: property.title,
        icon: L.divIcon({
          className: 'rf-pin',
          // Only `label` reaches this, and it is Intl output — a formatted
          // number, never listing-supplied text.
          html: `<span class="rf-pin__label">${label}</span>`,
          iconSize: undefined,
          iconAnchor: [0, 0],
        }),
      })
      marker.on('click', () => {
        onSelectRef.current(property.id)
      })
      marker.addTo(map)
      markersRef.current.set(property.id, marker)
    }

    const only = properties.length === 1 ? properties[0] : undefined
    if (only !== undefined) {
      map.setView([only.lat, only.lng], SINGLE_PIN_ZOOM)
    } else if (properties.length > 1) {
      map.fitBounds(L.latLngBounds(properties.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
      })
    }
  }, [properties, formatNumber])

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      // getElement() is null until the marker has painted; on the first pass
      // after a filter change that is normal, and the next selection sets it.
      marker.getElement()?.classList.toggle('rf-pin--active', id === activeId)
      if (id === activeId) marker.setZIndexOffset(1000)
      else marker.setZIndexOffset(0)
    }
  }, [activeId, properties])

  return (
    <div
      ref={containerRef}
      /* Leaflet needs a resolved height or it renders 0px tall. */
      className="h-[28rem] w-full rounded-lg border border-rule lg:h-[calc(100vh-16rem)] lg:min-h-[32rem]"
    />
  )
}
