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
  /**
   * Map ID for the wizard's picker. Advanced markers do not render without
   * one — the map draws and the pin silently never appears. Defaults to
   * Currently unused: the location picker's marker needs no map ID. Kept
   * because a styled JavaScript map would want one back.
   */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string
  /**
   * Firebase (Google sign-in). Same project as the website and the app — the
   * `auth_id` linking depends on the UIDs matching. Empty is a supported
   * state: `isFirebaseConfigured()` in lib/firebase.ts gates the button off
   * rather than let an unconfigured client show one that always fails.
   */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
