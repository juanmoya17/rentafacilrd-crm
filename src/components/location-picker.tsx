import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { loadMaps, mapsConfigured } from '@/lib/google-maps'

/**
 * One draggable pin. `post_property` requires latitude AND longitude, and
 * typing coordinates by hand is how a listing ends up in the Atlantic — so the
 * map is the input, and the coordinate line beneath it only echoes it.
 *
 * Google Maps when a key is configured, so the picker matches the autocomplete
 * beside it (same place data, same street names, same imagery the agent sees
 * on the public site). Leaflet/OpenStreetMap when it is not — that keeps local
 * dev and a key-less deploy working instead of showing an empty grey box.
 *
 * The properties list keeps its own Leaflet map (`property-map.tsx`): it draws
 * hundreds of pins and costs nothing to run.
 */

/** Santo Domingo. Where an unplaced pin starts, never what gets submitted —
 *  the form still refuses until the agent has actually placed one. */
const DEFAULT_CENTER = { lat: 18.4861, lng: -69.9312 }
const CITY_ZOOM = 12
const PLACED_ZOOM = 15

export function LocationPicker(props: {
  /** Null until the agent places the pin. */
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  /** Accessible name for the map region — it has no heading of its own. */
  label: string
}) {
  return mapsConfigured() ? <GooglePicker {...props} /> : <LeafletPicker {...props} />
}

interface PickerProps {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
  label: string
}

function GooglePicker({ lat, lng, onChange, label }: PickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /**
   * State, not a ref, because the marker effect has to re-run when the map
   * finishes loading. The map is built asynchronously; on the edit screen the
   * coordinates are already set at first render, so the marker effect fired
   * once against a null map, returned, and — with nothing left to change —
   * never fired again. A saved pin simply never appeared.
   */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (containerRef.current === null) return
    let live = true

    void (async () => {
      await loadMaps()
      const { Map } = await google.maps.importLibrary('maps')
      if (!live || containerRef.current === null) return

      const map = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: CITY_ZOOM,
        // No mapId, deliberately. It is required by AdvancedMarkerElement and
        // by nothing else here, and a mapId that does not resolve — created in
        // a different Cloud project, or not a JavaScript-type style — renders
        // the base map and then silently refuses every advanced marker. That
        // is what "the map works but clicking does nothing" looked like in
        // production. One draggable dot does not need advanced markers, so the
        // dependency is gone rather than documented.
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        // The page already scrolls; a wheel that zooms the map instead of
        // moving the page is the most hated thing an embedded map does.
        gestureHandling: 'cooperative',
      })
      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        const position = event.latLng
        if (position !== null) onChangeRef.current(position.lat(), position.lng())
      })
      mapRef.current = map
      setReady(true)
    })()

    return () => {
      live = false
      mapRef.current = null
      markerRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    let live = true

    void (async () => {
      const map = mapRef.current
      if (map === null) return

      if (lat === null || lng === null) {
        markerRef.current?.setMap(null)
        markerRef.current = null
        return
      }

      if (markerRef.current === null) {
        const { Marker } = await google.maps.importLibrary('marker')
        if (!live || mapRef.current === null) return

        const marker = new Marker({
          map: mapRef.current,
          position: { lat, lng },
          draggable: true,
        })
        marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
          const position = event.latLng
          if (position === null || position === undefined) return
          onChangeRef.current(position.lat(), position.lng())
        })
        markerRef.current = marker
        // Only on first placement: re-centring on every drag would fight the
        // hand that is dragging.
        mapRef.current.setCenter({ lat, lng })
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 0, PLACED_ZOOM))
      } else {
        markerRef.current.setPosition({ lat, lng })
      }
    })()

    return () => {
      live = false
    }
    // `ready` is a dependency on purpose: it is what replays this effect for
    // coordinates that arrived before the map did.
  }, [lat, lng, ready])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      className="h-72 w-full overflow-hidden rounded-lg border border-rule"
    />
  )
}

/* -------------------------------------------------- no-key fallback (OSM) */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function LeafletPicker({ lat, lng, onChange, label }: PickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (containerRef.current === null) return

    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], CITY_ZOOM)
    mapRef.current = map

    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current(event.latlng.lat, event.latlng.lng)
    })

    // Leaflet caches the size it saw at construction — the classic grey band
    // when the container is laid out after the map is built.
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
        // A divIcon, so the marker-icon.png 404 bundlers famously produce
        // cannot happen — Leaflet never asks for the image.
        icon: L.divIcon({ className: 'rf-pin', html: '<span class="rf-pin__label">●</span>' }),
      })
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        onChangeRef.current(position.lat, position.lng)
      })
      marker.addTo(map)
      markerRef.current = marker
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
