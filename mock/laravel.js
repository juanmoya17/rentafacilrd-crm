/**
 * Development stand-in for the Laravel panel.
 *
 * Exists so the SPA can be worked on without the real backend running. It
 * implements only the auth surface — every screen still renders from
 * src/lib/mock/data.ts — and it reproduces the two quirks the real
 * ApiController has, because those are what the client code guards against:
 *
 *   - a deactivated account answers HTTP 200 with {error:true}
 *   - a stale XSRF token answers 419, which the client must re-prime and retry
 *
 * Run it beside the dev server:  npm run mock  +  npm run dev
 * Nothing here ships: the SPA builds to static files and talks to the real API.
 */
import { createServer } from 'node:http'

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

  json(response, 404, { error: true, message: `No mock route for ${url.pathname}` })
}).listen(PORT, () => {
  console.log(`\n  Mock Laravel  →  http://localhost:${PORT}`)
  console.log('  agente@test.com / secret        (entra)')
  console.log('  sinverificar@test.com / secret  (pantalla de verificación pendiente)')
  console.log('  inactivo@test.com / secret      (200 + error:true)')
  console.log('  cualquier otra contraseña    (422)')
  console.log('  curl :%d/api/__rotate-csrf   (fuerza un 419)\n', PORT)
})
