/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin. Empty in dev so requests go through the Vite proxy. */
  readonly VITE_API_ORIGIN?: string
  /** Laravel route prefix. RouteServiceProvider.php:33 -> prefix('api'). */
  readonly VITE_API_PREFIX?: string
  /** Dev-only proxy target for /api and /sanctum. */
  readonly VITE_DEV_BACKEND_ORIGIN?: string
  /**
   * Google Maps JS key for the address autocomplete on the listing wizard.
   *
   * Vite inlines this at BUILD time, so it has to be present when `pnpm build`
   * runs — adding it to the host after the fact and restarting does nothing.
   * It ships inside the bundle by design (the Maps JS API has no other way),
   * which is why it must be restricted by HTTP referrer and to the Maps
   * JavaScript + Places APIs in Google Cloud Console.
   *
   * Absent is a supported state: the address field degrades to a plain input
   * and the map pin still sets the coordinates by hand.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
