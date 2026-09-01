import { describe, expect, it } from 'vitest'
import { ADDRESS_COMPONENTS, componentOf, mapsBootstrapUrl } from './google-maps'

/**
 * The priority order in ADDRESS_COMPONENTS is the entire behaviour of the
 * address fill. Getting it wrong does not throw — it quietly writes the city
 * into the field the project form labels "Zona", which is how this was found.
 */
type Component = { longText: string; shortText: string; types: string[] }

const component = (longText: string, ...types: string[]): Component => ({
  longText,
  shortText: longText,
  types,
})

// A typical Santo Domingo result: sector, city, province, country.
const SANTO_DOMINGO: Component[] = [
  component('Piantini', 'neighborhood', 'political'),
  component('Santo Domingo', 'locality', 'political'),
  component('Distrito Nacional', 'administrative_area_level_1', 'political'),
  component('República Dominicana', 'country', 'political'),
]

describe('componentOf', () => {
  const pick = (components: Component[], wanted: readonly string[]) =>
    componentOf(components as unknown as google.maps.places.AddressComponent[], wanted)

  it('keeps the sector and the city apart', () => {
    expect(pick(SANTO_DOMINGO, ADDRESS_COMPONENTS.zone)).toBe('Piantini')
    expect(pick(SANTO_DOMINGO, ADDRESS_COMPONENTS.city)).toBe('Santo Domingo')
    expect(pick(SANTO_DOMINGO, ADDRESS_COMPONENTS.state)).toBe('Distrito Nacional')
    expect(pick(SANTO_DOMINGO, ADDRESS_COMPONENTS.country)).toBe('República Dominicana')
  })

  it('prefers the finest name available for the zone', () => {
    const both = [
      component('Naco', 'sublocality_level_1', 'political'),
      component('Ensanche Naco', 'neighborhood', 'political'),
    ]

    expect(pick(both, ADDRESS_COMPONENTS.zone)).toBe('Ensanche Naco')
  })

  it('lets a sublocality serve as both zone and city when nothing finer exists', () => {
    // A rural or sector-only result: the sector is the best name that address
    // has, so filling both is right, not a bug.
    const sectorOnly = [
      component('Bávaro', 'sublocality', 'political'),
      component('La Altagracia', 'administrative_area_level_1', 'political'),
    ]

    expect(pick(sectorOnly, ADDRESS_COMPONENTS.zone)).toBe('Bávaro')
    expect(pick(sectorOnly, ADDRESS_COMPONENTS.city)).toBe('Bávaro')
  })

  it('returns an empty string rather than undefined when nothing matches', () => {
    // applyPlace relies on this: '' is falsy, so a missing part leaves whatever
    // the agent typed instead of blanking it.
    expect(pick([component('República Dominicana', 'country')], ADDRESS_COMPONENTS.zone)).toBe('')
    expect(pick([], ADDRESS_COMPONENTS.city)).toBe('')
  })
})

/**
 * The bootstrap URL. `script.onload` fires before the loader has installed
 * `google.maps.importLibrary`, so a caller that awaits onload and then calls
 * importLibrary throws "is not a function" — which is precisely what an empty
 * location map in production turned out to be. The `callback` parameter is the
 * fix, and it is the whole reason this URL is built here rather than inline.
 */
describe('mapsBootstrapUrl', () => {
  it('asks Google to call back when the loader is actually ready', () => {
    const url = new URL(mapsBootstrapUrl('KEY-DE-PRUEBA', '__rfMapsReady'))

    expect(url.searchParams.get('callback')).toBe('__rfMapsReady')
    expect(url.searchParams.get('loading')).toBe('async')
    expect(url.searchParams.get('key')).toBe('KEY-DE-PRUEBA')
    expect(url.searchParams.get('v')).toBe('weekly')
  })

  it('points at the documented bootstrap endpoint', () => {
    const url = new URL(mapsBootstrapUrl('K', 'cb'))

    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js')
  })
})
