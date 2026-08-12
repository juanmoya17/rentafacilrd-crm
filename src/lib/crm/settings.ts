import { api } from '@/lib/api'

interface Envelope<T> {
  error: boolean
  data: T
}

/**
 * `social_login` is the admin's kill switch, the same one the website reads
 * for its Google button. It rides on `web-settings`, which is PUBLIC
 * (routes/api.php:357, outside the auth:sanctum group) — which is what lets
 * the login screen read it while signed out.
 *
 * Fails closed: if the call fails we hide the button rather than offer a
 * sign-in method the admin may have switched off.
 */
export async function isSocialLoginEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await api<Envelope<Record<string, unknown> | null>>('web-settings', { signal })
    return String(response.data?.social_login ?? '') === '1'
  } catch {
    return false
  }
}
