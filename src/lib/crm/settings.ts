import { api } from '@/lib/api'

interface Envelope<T> {
  error: boolean
  data: T
}

/**
 * `social_login` is the admin's kill switch, the same one the website reads
 * for its Google button.
 *
 * Reads `auth/providers`, not `web-settings`. The latter answers with 57
 * fields and ~58KB uncompressed to report one boolean, on the one screen where
 * there is no session yet and every kilobyte is in front of the agent. It is
 * public for the same reason this is: the login screen has to ask before
 * signing in.
 *
 * THROWS rather than failing closed. Swallowing the error here made a failed
 * request indistinguishable from "the admin switched Google off": the button
 * simply did not appear and there was nothing to retry. The caller decides
 * what to show — see the retry on the login screen.
 */
export async function isSocialLoginEnabled(signal?: AbortSignal): Promise<boolean> {
  const response = await api<Envelope<{ google?: boolean } | null>>('auth/providers', { signal })

  return response.data?.google === true
}
