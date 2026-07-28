/**
 * Laravel Sanctum SPA client.
 *
 * The session lives in an httpOnly cookie — no token is ever readable from JS,
 * so there is nothing to store, rotate or refresh here. Mutations echo the
 * XSRF-TOKEN cookie back as a header, which is what Laravel's CSRF middleware
 * checks.
 */

const ORIGIN = import.meta.env.VITE_API_ORIGIN ?? ''
const PREFIX = import.meta.env.VITE_API_PREFIX ?? '/api/'
const CSRF_COOKIE = 'XSRF-TOKEN'

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

/**
 * Registered once by AuthProvider. Lets a 401 from any call anywhere drop the
 * session without this module importing React or the router.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  const value = match?.[1]
  return value === undefined ? null : decodeURIComponent(value)
}

let csrfInflight: Promise<void> | null = null

/** Ask Laravel to set the XSRF-TOKEN cookie. Single-flight: parallel mutations share one call. */
function primeCsrf(force = false): Promise<void> {
  if (!force && readCookie(CSRF_COOKIE)) return Promise.resolve()

  csrfInflight ??= fetch(`${ORIGIN}/sanctum/csrf-cookie`, { credentials: 'include' })
    .then(() => undefined)
    .finally(() => {
      csrfInflight = null
    })

  return csrfInflight
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Skip the global sign-out on 401. Used by the boot probe, where 401 just means "not logged in". */
  silent401?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageOf(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.message === 'string' ? payload.message : null
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    // 500s and proxy errors come back as HTML. Keep it for the error payload.
    return text
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, silent401 = false } = options
  const mutates = method !== 'GET'
  const url = `${ORIGIN}${PREFIX}${path.replace(/^\//, '')}`

  const send = (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const token = readCookie(CSRF_COOKIE)
    if (mutates && token !== null) headers['X-XSRF-TOKEN'] = token

    return fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  }

  if (mutates) await primeCsrf()

  let response = await send()

  // 419 = the XSRF token died with the session. Cookie auth has no refresh
  // token; re-priming the cookie and retrying once IS the refresh. Once only —
  // a second 419 means something else is wrong and looping would hide it.
  if (response.status === 419 && mutates) {
    await primeCsrf(true)
    response = await send()
  }

  const payload = await parseBody(response)

  if (response.status === 401) {
    if (!silent401) onUnauthorized?.()
    throw new ApiError(messageOf(payload) ?? 'Tu sesión expiró.', 401, payload)
  }

  // ApiController::webLogin answers 200 with {error:true} for a deactivated
  // account, so the HTTP status alone would let a disabled user through.
  const failed = !response.ok || (isRecord(payload) && payload.error === true)
  if (failed) {
    throw new ApiError(messageOf(payload) ?? `Error ${response.status}`, response.status, payload)
  }

  return payload as T
}
