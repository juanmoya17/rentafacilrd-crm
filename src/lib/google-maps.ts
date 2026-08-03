/**
 * Google Places, for the listing wizard's address field.
 *
 * Uses the CURRENT API — `AutocompleteSuggestion` + `Place.fetchFields()`.
 * Not `AutocompleteService`/`PlacesService`, which the public website still
 * calls: Google marked those legacy in March 2025, and a Cloud project created
 * since then has no access to them at all unless Places API (New) is enabled.
 *
 * The key is read from `VITE_GOOGLE_MAPS_API_KEY` and inlined at build time.
 * Everything here answers "no results" when it is absent, so a deploy without
 * the key degrades to a plain address field rather than a broken screen.
 */

/** What the wizard needs out of a place — provider-shaped detail stays here. */
export interface Place {
  /** Formatted address, for the `address` field. */
  label: string
  lat: number
  lng: number
  city: string
  state: string
  country: string
}

/** A prediction, before the (billed) details fetch. */
export interface Suggestion {
  id: string
  label: string
  /** Resolves the coordinates and address components. One call per pick. */
  resolve: () => Promise<Place | null>
}

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

/** The market — `includedRegionCodes` is the new API's country filter. */
const REGION = ['do']

export function mapsConfigured(): boolean {
  return KEY !== ''
}

/**
 * The documented inline bootstrap loader, as a module.
 *
 * Single-flight and memoised: `importLibrary` may only be installed once, and
 * every caller after the first shares the same promise. Rejecting on error
 * rather than hanging is what lets the caller fall back to a plain input.
 */
let loader: Promise<void> | null = null

function loadMaps(): Promise<void> {
  if (loader !== null) return loader

  loader = new Promise<void>((resolve, reject) => {
    if (KEY === '') {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
      return
    }
    // Already bootstrapped (a second module, or an HMR reload).
    if (typeof google !== 'undefined' && google.maps?.importLibrary !== undefined) {
      resolve()
      return
    }

    const params = new URLSearchParams({ key: KEY, v: 'weekly', loading: 'async' })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps could not load.'))
    document.head.append(script)
  })

  return loader
}

/**
 * One token per typing session, replaced after each pick — that is what makes
 * Google bill a session rather than a request per keystroke. Getting this
 * wrong is a billing bug, not a functional one, so it never shows up in
 * testing.
 */
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

/** Call after a pick, so the next search opens a fresh billing session. */
export function endPlacesSession(): void {
  sessionToken = null
}

const COMPONENT = {
  city: ['locality', 'postal_town', 'sublocality', 'administrative_area_level_2'],
  state: ['administrative_area_level_1'],
  country: ['country'],
} as const

function componentOf(
  components: google.maps.places.AddressComponent[] | null | undefined,
  wanted: readonly string[],
): string {
  for (const type of wanted) {
    const hit = components?.find((component) => component.types.includes(type))
    if (hit !== undefined) return hit.longText ?? ''
  }

  return ''
}

/**
 * Type-ahead. Returns [] for a short query, a missing key, or a failed load —
 * the address field stays typeable in every one of those cases.
 */
export async function searchPlaces(query: string): Promise<Suggestion[]> {
  const input = query.trim()
  if (input.length < 3 || !mapsConfigured()) return []

  try {
    await loadMaps()
    const { AutocompleteSuggestion, AutocompleteSessionToken } =
      await google.maps.importLibrary('places')

    sessionToken ??= new AutocompleteSessionToken()

    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      includedRegionCodes: REGION,
      sessionToken,
    })

    return suggestions.flatMap((suggestion, index) => {
      const prediction = suggestion.placePrediction
      if (prediction === null) return []

      return [
        {
          id: prediction.placeId ?? `suggestion-${index}`,
          label: prediction.text.toString(),
          resolve: async (): Promise<Place | null> => {
            const place = prediction.toPlace()
            await place.fetchFields({
              fields: ['formattedAddress', 'location', 'addressComponents'],
            })
            // The pick closes the billing session; the next keystroke opens a
            // new one.
            endPlacesSession()

            const location = place.location
            if (location === null || location === undefined) return null

            return {
              label: place.formattedAddress ?? prediction.text.toString(),
              lat: location.lat(),
              lng: location.lng(),
              city: componentOf(place.addressComponents, COMPONENT.city),
              state: componentOf(place.addressComponents, COMPONENT.state),
              country: componentOf(place.addressComponents, COMPONENT.country),
            }
          },
        },
      ]
    })
  } catch {
    return []
  }
}

/**
 * Pin -> address, so dragging the marker fills the address fields too.
 * Geocoder is the current API for this; there is no "new" replacement.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  if (!mapsConfigured()) return null

  try {
    await loadMaps()
    const { Geocoder } = await google.maps.importLibrary('geocoding')
    const { results } = await new Geocoder().geocode({ location: { lat, lng } })

    const best = results[0]
    if (best === undefined) return null

    // The legacy GeocoderAddressComponent uses long_name/types, not the
    // Place API's longText — mapped here so componentOf reads one shape.
    const components = best.address_components.map((component) => ({
      longText: component.long_name,
      shortText: component.short_name,
      types: component.types,
    })) as google.maps.places.AddressComponent[]

    return {
      label: best.formatted_address,
      lat,
      lng,
      city: componentOf(components, COMPONENT.city),
      state: componentOf(components, COMPONENT.state),
      country: componentOf(components, COMPONENT.country),
    }
  } catch {
    return null
  }
}
