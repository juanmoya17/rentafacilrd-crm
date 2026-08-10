/**
 * Development stand-in for the Laravel panel.
 *
 * Exists so the SPA can be worked on without the real backend running. It
 * implements the auth surface plus the notification inbox — the last screen
 * that used to render from placeholder data, now wired to the real
 * endpoints — and it reproduces the two quirks the real ApiController has,
 * because those are what the client code guards against:
 *
 *   - a deactivated account answers HTTP 200 with {error:true}
 *   - a stale XSRF token answers 419, which the client must re-prime and retry
 *
 * Run it beside the dev server:  npm run mock  +  npm run dev
 * Nothing here ships: the SPA builds to static files and talks to the real API.
 */
import { createServer } from 'node:http'
import { handleCrm } from './crm.js'

const PORT = Number(process.env.MOCK_PORT ?? 8787)

// `is_verified_agent` and `verification_status` are $appends on the real
// Customer model, so get-user-data already returns them. The CRM gates on the
// first one; the API enforces it for real via the `verified.agent` middleware.
const USERS = [
  {
    email: 'agente@test.com',
    password: 'secret',
    active: true,
    data: { id: 42, name: 'Agente Demo', email: 'agente@test.com', is_verified_agent: true, verification_status: 'verified_agent' },
  },
  {
    email: 'sinverificar@test.com',
    password: 'secret',
    active: true,
    data: { id: 44, name: 'Agente Sin Verificar', email: 'sinverificar@test.com', is_verified_agent: false, verification_status: 'verified_user' },
  },
  {
    email: 'inactivo@test.com',
    password: 'secret',
    active: false,
    data: { id: 43, name: 'Agente Inactivo', email: 'inactivo@test.com', is_verified_agent: true, verification_status: 'verified_agent' },
  },
]

const sessions = new Map()
let csrfToken = 'csrf-boot'

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter((pair) => pair.length === 2),
  )
}

function json(response, status, body, setCookies = []) {
  const headers = { 'Content-Type': 'application/json' }
  if (setCookies.length > 0) headers['Set-Cookie'] = setCookies
  response.writeHead(status, headers)
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString()
  try {
    return raw === '' ? {} : JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * In-memory notification inbox.
 *
 * Deliberately mixed: modern rows carry `event_type`, one legacy row carries
 * only the numeric `type` the tinyInteger column used to hold, and one carries
 * an event_type nobody has mapped. Those three are what categoryOf() has to
 * survive, and a mock that only emits clean rows would never show it failing.
 */
const NOTIFICATION_PATHS = new Set([
  '/api/get_notification_list',
  '/api/notification-unread-count',
  '/api/mark-notification-read',
])

const HOUR = 3_600_000
const inbox = [
  { id: 5, title: 'Tu destacado vence en 2 días', message: 'RF0412 generó 120 visitas y 8 contactos mientras estuvo destacado.', type: '0', event_type: 'advertisement', hoursAgo: 1 },
  { id: 4, title: 'Nuevo lead', message: 'Rosa Guzmán preguntó por RF0288.', type: '0', event_type: 'lead', hoursAgo: 3 },
  { id: 3, title: 'Bajada de precio publicada', message: 'RF0412 bajó 6% — notificados 14 favoritos y 3 búsquedas guardadas.', type: '0', event_type: 'saved_search', hoursAgo: 26 },
  { id: 2, title: 'Consulta sobre un anuncio', message: 'Un usuario preguntó por RF0301.', type: '1', event_type: null, hoursAgo: 50 },
  { id: 1, title: 'Aviso del sistema', message: 'Evento que este cliente no sabe clasificar.', type: '2', event_type: 'something_new', hoursAgo: 96 },
]
const readIds = new Set([1])

function notificationRow(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    event_type: row.event_type,
    created_at: new Date(Date.now() - row.hoursAgo * HOUR).toISOString(),
    notification_image: '',
    is_read: readIds.has(row.id),
  }
}

function handleNotifications(method, pathname, params, body) {
  if (pathname === '/api/notification-unread-count') {
    return { error: false, unread_count: inbox.filter((row) => !readIds.has(row.id)).length }
  }

  if (pathname === '/api/mark-notification-read') {
    if (body.all === true) {
      for (const row of inbox) readIds.add(row.id)
      return { error: false, message: 'Success' }
    }
    const id = Number(body.notification_id)
    // Mirrors the real endpoint: an id you cannot see is refused, not ignored.
    if (!inbox.some((row) => row.id === id)) {
      return { error: true, message: 'No Data Found' }
    }
    readIds.add(id)
    return { error: false, message: 'Success' }
  }

  const offset = Number(params.get('offset') ?? 0)
  const limit = Number(params.get('limit') ?? 10)
  const page = inbox.slice(offset, offset + limit)
  // The real endpoint omits `total` on the empty response instead of sending 0.
  return page.length === 0
    ? { error: false, message: 'No Data Found', data: [] }
    : { error: false, total: inbox.length, data: page.map(notificationRow) }
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`)
  const jar = cookies(request)
  console.log(`${request.method} ${url.pathname}`)

  if (url.pathname === '/sanctum/csrf-cookie') {
    csrfToken = `csrf-${process.hrtime.bigint()}`
    response.writeHead(204, {
      'Set-Cookie': [`XSRF-TOKEN=${csrfToken}; Path=/; SameSite=Lax`],
    })
    response.end()
    return
  }

  // Test hook: expire the CSRF token while keeping the session alive, so the
  // next mutation gets a 419 and you can watch the client recover in DevTools.
  //   curl http://localhost:8787/api/__rotate-csrf
  if (url.pathname === '/api/__rotate-csrf') {
    csrfToken = `csrf-rotated-${process.hrtime.bigint()}`
    json(response, 200, { error: false, message: 'CSRF token rotated' })
    return
  }

  if (request.method !== 'GET' && request.headers['x-xsrf-token'] !== csrfToken) {
    json(response, 419, { message: 'CSRF token mismatch.' })
    return
  }

  if (url.pathname === '/api/web-login') {
    const body = await readBody(request)
    const user = USERS.find((candidate) => candidate.email === body.email)

    if (user === undefined) {
      json(response, 422, { error: true, message: 'Invalid email' })
      return
    }
    if (user.password !== body.password) {
      json(response, 422, { error: true, message: 'Invalid password' })
      return
    }
    if (!user.active) {
      // Matches ApiController::webLogin — 200, not 4xx. The client must read
      // the envelope, not the status.
      json(response, 200, {
        error: true,
        message: 'Your account has been deactivated',
        key: 'accountDeactivated',
        is_active: false,
      })
      return
    }

    const sid = `sess-${process.hrtime.bigint()}`
    sessions.set(sid, user.data)
    json(response, 200, { error: false, message: 'Login Successfully', data: user.data }, [
      `crm_session=${sid}; Path=/; HttpOnly; SameSite=Lax`,
    ])
    return
  }

  if (url.pathname === '/api/web-logout') {
    sessions.delete(jar.crm_session)
    json(response, 200, { error: false, message: 'Logout Successfully' }, [
      'crm_session=; Path=/; HttpOnly; Max-Age=0',
    ])
    return
  }

  if (url.pathname === '/api/get-user-data') {
    const user = sessions.get(jar.crm_session)
    if (user === undefined) {
      json(response, 401, { error: true, message: 'Unauthenticated.' })
      return
    }
    json(response, 200, { error: false, data: user })
    return
  }

  // Notification inbox. NOT under /api/crm: these are the same auth:sanctum
  // routes the Flutter app calls, so a session is enough — no verified.agent.
  if (NOTIFICATION_PATHS.has(url.pathname)) {
    const user = sessions.get(jar.crm_session)
    if (user === undefined) {
      json(response, 401, { error: true, message: 'Unauthenticated.' })
      return
    }
    json(response, 200, handleNotifications(request.method, url.pathname, url.searchParams, await readBody(request)))
    return
  }

  // CRM endpoints. Mirrors the real group: a session is required, and the user
  // must be a verified agent — the same 403 + key the Laravel middleware sends.
  if (url.pathname.startsWith('/api/crm/')) {
    const user = sessions.get(jar.crm_session)
    if (user === undefined) {
      json(response, 401, { error: true, message: 'Unauthenticated.' })
      return
    }
    if (user.is_verified_agent !== true) {
      json(response, 403, {
        error: true,
        message: 'Your account is not verified as an agent yet',
        key: 'agentNotVerified',
        verification_status: user.verification_status ?? 'unverified_user',
      })
      return
    }

    const result = handleCrm(
      request.method,
      url.pathname.replace('/api/crm', ''),
      url.searchParams,
      await readBody(request),
    )
    if (result !== null) {
      json(response, result.status, result.body)
      return
    }
  }

  json(response, 404, { error: true, message: `No mock route for ${url.pathname}` })
}).listen(PORT, () => {
  console.log(`\n  Mock Laravel  →  http://localhost:${PORT}`)
  console.log('  agente@test.com / secret        (entra)')
  console.log('  sinverificar@test.com / secret  (pantalla de verificación pendiente)')
  console.log('  inactivo@test.com / secret      (200 + error:true)')
  console.log('  cualquier otra contraseña    (422)')
  console.log('  curl :%d/api/__rotate-csrf   (fuerza un 419)\n', PORT)
})
