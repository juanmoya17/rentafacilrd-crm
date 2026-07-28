/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin. Empty in dev so requests go through the Vite proxy. */
  readonly VITE_API_ORIGIN?: string
  /** Laravel route prefix. RouteServiceProvider.php:33 -> prefix('api'). */
  readonly VITE_API_PREFIX?: string
  /** Dev-only proxy target for /api and /sanctum. */
  readonly VITE_DEV_BACKEND_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
