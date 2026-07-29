# RentaFácil CRM

SPA de agente (Bloque C del M8). Vite + React + TypeScript, **sin servidor propio**:
compila a estáticos y habla directo con la API Laravel del panel
(`rentalfacilrdpanel`) por sesión de cookie Sanctum.

## Stack

| | |
|---|---|
| Build | Vite 8 |
| UI | React 19, Tailwind 4 |
| Rutas | React Router 8 (modo data, `createBrowserRouter`) |
| HTTP | `fetch` + wrapper propio (`src/lib/api.ts`) — sin axios |
| Tests | Vitest |
| Lint | oxlint |

## Modelo de autenticación

Sesión **httpOnly** de Laravel Sanctum. No hay token en JS, no hay `localStorage`,
no hay refresh token: en el flujo de cookie no existe (el endpoint `refresh-token`
del backend es del flujo Bearer del móvil).

Circuito, todo contra endpoints que **ya existen** en `routes/api.php`:

1. `GET /sanctum/csrf-cookie` — prima la cookie `XSRF-TOKEN` antes de la primera mutación.
2. `POST /api/web-login` `{email, password}` — `api.php:37`.
3. `GET /api/get-user-data` — sonda de sesión al arrancar y tras cada reintento (`api.php:125`).
4. `POST /api/web-logout` — `api.php:38`.

Dos detalles que `src/lib/api.ts` maneja y que son fáciles de perder:

- **419 → reprimar y reintentar una vez.** El `XSRF-TOKEN` muere con la sesión.
  Ese reintento es el equivalente del "refresh" en auth por cookie. Una sola vez:
  un segundo 419 es otro problema y hacer bucle lo escondería.
- **HTTP 200 con `{error: true}`.** `ApiController::webLogin` responde 200 con
  `error:true` para cuenta desactivada. Validar por status HTTP dejaría entrar a
  un usuario deshabilitado.

## Protección de rutas

`src/main.tsx` tiene **una sola ruta pública: `/login`**. Todo lo demás cuelga de
`<RequireAuth>`, así que una pantalla nueva nace protegida — hay que sacarla de
ese subárbol a propósito para exponerla. El comodín `*` redirige a `/`, que pasa
por el guard.

`RequireAuth` distingue cuatro estados y ninguno es una pantalla en blanco:

| Estado | Qué se ve |
|---|---|
| `loading` | "Verificando sesión…" — evita que un refresh parpadee el login |
| `authenticated` | la app |
| `anonymous` | redirección a `/login` con `replace` (Back no vuelve al CRM) y `from` para regresar tras entrar |
| `error` | "No pudimos contactar el servidor" + Reintentar — backend caído ≠ sesión cerrada |

Un 401 en **cualquier** llamada dispara el handler global registrado por
`AuthProvider` (`setUnauthorizedHandler`), que pasa el estado a `anonymous`;
`RequireAuth` lo convierte en redirección. En el logout explícito la sesión local
se limpia en `finally`, así que un fallo de red no deja la UI creyendo que sigue
dentro.

## Desarrollo local

Dos terminales, sin configurar nada:

```sh
npm run mock    # stand-in de Laravel en :8787
npm run dev     # SPA en :5173
```

Cuentas del mock:

| Correo | Contraseña | Qué prueba |
|---|---|---|
| `agente@test.com` | `secret` | entra |
| `inactivo@test.com` | `secret` | cuenta desactivada → HTTP **200** con `{error:true}` |
| cualquiera | otra | 422 |

Y `curl localhost:8787/api/__rotate-csrf` caduca el token CSRF sin cerrar la
sesión, para ver en DevTools cómo el cliente reprima y reintenta ante el 419.

El mock **solo implementa el auth**; las pantallas pintan desde
`src/lib/mock/data.ts`. Nada de esto se despliega: la SPA compila a estáticos y
habla con la API real.

## Variables de entorno

Ninguna es obligatoria en dev — `VITE_DEV_BACKEND_ORIGIN` cae por defecto en el
mock. Para apuntar a un backend real, `.env.local` (no se commitea):

```sh
# Dev: VITE_API_ORIGIN vacío para pasar por el proxy de Vite.
VITE_API_ORIGIN=
VITE_API_PREFIX=/api/
VITE_DEV_BACKEND_ORIGIN=https://panel.rentafacilrd.com

# Producción:
# VITE_API_ORIGIN=https://panel.rentafacilrd.com
# VITE_API_PREFIX=/api/
```

`VITE_API_PREFIX` es `/api/` porque `RouteServiceProvider.php:33` hace
`->prefix('api')`. El `.env.example` del sitio web dice `/api/v1/` — está
desactualizado o hay un rewrite en nginx; confirmar contra el entorno real.

### Por qué existe el proxy de dev

En dev la SPA corre en `localhost:5173` y Laravel en otro host: eso es
*cross-site*, y `config/session.php:200` fija `same_site='lax'`, así que la cookie
de sesión nunca viajaría. El proxy de `vite.config.ts` hace que dev sea
mismo-origen. Producción no usa proxy: va cross-subdominio y depende de la config
de abajo.

## Lo que hay que configurar en el backend

En el `.env` del panel Laravel (solo variables, cero cambios de código —
`config/cors.php` ya tiene `supports_credentials: true` y ambas listas se leen
separadas por coma):

```sh
CORS_ALLOWED_ORIGINS=...,https://crm.rentafacilrd.com
SANCTUM_STATEFUL_DOMAINS=...,crm.rentafacilrd.com
SESSION_DOMAIN=.rentafacilrd.com
SESSION_SECURE_COOKIE=true
```

Dos condiciones **obligatorias**:

1. **El CRM va en un subdominio del mismo dominio registrable** (`crm.rentafacilrd.com`).
   En un `*.up.railway.app` la petición es cross-site, `same_site='lax'` bloquea la
   cookie y no hay auth. Dominio custom en Railway es gratis.
2. **`SESSION_DRIVER` no puede quedar en `file`.** Con sesiones en disco local, un
   redeploy o una segunda instancia del backend desloguea a todos. Pasar a `redis`
   o `database`.

## Deploy (Railway)

`npm run build` → `dist/`. Estáticos, sin proceso Node.

**Requiere fallback SPA**: cualquier ruta desconocida debe servir `index.html`.
Sin eso, un F5 en `/leads/123` da 404 porque el routing es de cliente. La config
concreta (Caddy/nginx/Dockerfile) se añade al conectar el servicio.

## Scripts

```sh
npm run dev         # servidor de desarrollo con proxy
npm run mock        # stand-in de Laravel para el auth
npm run build       # tsc -b && vite build
npm test            # vitest run
npm run test:watch
npm run lint        # oxlint
```

## Estructura

```
mock/laravel.js              stand-in de Laravel (solo dev, no se despliega)
src/
  lib/api.ts                 cliente Sanctum: CSRF, retry 419, hook global de 401
  lib/api.test.ts
  lib/auth-context.ts        tipos + useAuth
  lib/auth-provider.tsx      sonda de sesión, login, logout, retry
  lib/i18n/                  diccionarios es/en, provider, translate puro
  lib/mock/data.ts           datos de ejemplo de las pantallas
  components/require-auth.tsx  el único guard
  components/crm-layout.tsx    shell: cabecera, sidebar, cerrar sesión
  components/ui.tsx            Badge, Card, Button, EmptyState, ScoreDot…
  components/labels.tsx        badges de dominio (etapa, ciclo de vida, origen…)
  routes/                      las 11 pantallas
```

## Diseño

Tokens en `src/index.css`, tomados de `globals.css` del sitio público: teal
`#087c7c`, fondo cálido `#f5f5f4` y los colores de venta/alquiler que el
comprador ya lee en los anuncios. Cuerpo a 13–14px: es una herramienta de
trabajo, no una landing.

## Estado de las pantallas

Las 11 están mockeadas y navegables. Cada una lleva un aviso con la línea del
M8 que sustituirá sus datos de ejemplo:

| Pantalla | Se conecta en |
|---|---|
| Resumen (KPIs + riel) | A.5 · A.6 |
| Pipeline | C.3 |
| Leads, ficha de lead | C.2 – C.6 · D.1 |
| Mis propiedades, ficha | A.1 – A.8 · C.7 |
| Proyectos, ficha, inventario | E.1 – E.4 · E.8 |
| Tareas | C.4 · D.5 |
| Notificaciones | B.2 · B.3 |

## Siguiente

El dominio CRM — Contacto / Lead / Actividad / Tarea — todavía no existe en el
backend: es C.1 (migraciones + backfill desde `InterestedUser`) y C.2 (API).
Hasta que aterricen hay datos reales en `get_interested_users`,
`get-contact-attempts`, `get-added-properties`, `get-meetings` y
`property-analytics`.
