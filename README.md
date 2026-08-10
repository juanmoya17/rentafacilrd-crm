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

### Verificación de agente

El CRM es solo para **agentes verificados**. No existe columna de tipo de cuenta:
`customers` guarda a todo el mundo y "agente" se deriva de una fila con
`status = success` en `verify_customers`. Cualquiera puede publicar un anuncio y
acumular leads sin estar verificado — esos leads se guardan igual contra
`propertys.added_by` y aparecen el día que se aprueba la verificación.

Quien entra sin estar verificado ve `VerificationPending`, que explica eso en
vez de rebotarlo al login que acaba de pasar.

**El gate del cliente no es la frontera de seguridad**: la real es el middleware
`verified.agent` en la API (`app/Http/Middleware/EnsureVerifiedAgent.php` del
panel), que responde 403 con `key: agentNotVerified`. Toda ruta de CRM que se
añada en C.2 tiene que llevarlo.

### Estados del guard

`RequireAuth` distingue cinco estados y ninguno es una pantalla en blanco:

| Estado | Qué se ve |
|---|---|
| `loading` | "Verificando sesión…" — evita que un refresh parpadee el login |
| `authenticated` + agente verificado | la app |
| `authenticated` sin verificar | pantalla de verificación pendiente + cerrar sesión |
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
| `sinverificar@test.com` | `secret` | pantalla de verificación pendiente |
| `inactivo@test.com` | `secret` | cuenta desactivada → HTTP **200** con `{error:true}` |
| cualquiera | otra | 422 |

Y `curl localhost:8787/api/__rotate-csrf` caduca el token CSRF sin cerrar la
sesión, para ver en DevTools cómo el cliente reprima y reintenta ante el 419.

El mock implementa el **auth** y la **bandeja de notificaciones**; todo lo
demás lo sirve la API real, así que esas pantallas necesitan un backend
levantado (o `VITE_DEV_BACKEND_ORIGIN` apuntando a uno). **Ninguna pantalla
pinta ya datos de ejemplo**: `src/lib/mock/data.ts` se borró cuando la bandeja
se conectó. Nada de esto se despliega: la SPA compila a estáticos.

## Variables de entorno

Ninguna es obligatoria en dev — `VITE_DEV_BACKEND_ORIGIN` cae por defecto en el
mock. Para apuntar a un backend real, `.env.local` (no se commitea):

```sh
# Dev: VITE_API_ORIGIN vacío para pasar por el proxy de Vite.
VITE_API_ORIGIN=
VITE_API_PREFIX=/api/
VITE_DEV_BACKEND_ORIGIN=https://api.rentafacilrd.com

# Producción:
# VITE_API_ORIGIN=https://api.rentafacilrd.com
# VITE_API_PREFIX=/api/
```

*** Es `api.rentafacilrd.com`, **no** `panel.` — ese subdominio no resuelve.
Verificado contra producción el 2026-08-06: `GET /sanctum/csrf-cookie` en `api.`
devuelve 204 con las dos cookies en `.rentafacilrd.com`.

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
Sin eso, un F5 en `/leads/123` da 404 porque el routing es de cliente.

**Ya está desplegado y resuelto** en `crm.rentafacilrd.com` (verificado el
2026-08-06: `/leads/123` y una ruta inventada devuelven ambas el mismo
`index.html` con 200). Railway sirve el build de Vite con ese fallback por su
cuenta: **no hace falta `railway.json` ni Dockerfile**, y que no estén en el
repo no prueba nada — esa configuración vive en el panel de Railway, no en el
árbol de archivos. Darlo por roto mirando un `ls` fue un error de método que se
cometió dos sesiones seguidas.

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
  lib/crm/                   tipos + llamadas por recurso de la API
  lib/crm/unread-store.ts    contador del badge, compartido sidebar ↔ pantalla
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

| Pantalla | Datos | Falta |
|---|---|---|
| Pipeline (arrastre + persistencia optimista) | **API** | — |
| Leads (filtros server-side) | **API** | — |
| Ficha de lead (timeline, etapa, actividades) | **API** | — |
| Tareas | **API** | — |
| Ficha de propiedad → sus leads | **API** | la ficha en sí: A.1–A.8 |
| Resumen: leads nuevos, SLA vencido | **API** | contadores de propiedades: A.5 |
| Mis propiedades | **API** | — |
| Proyectos, ficha, inventario | **API** | — |
| Notificaciones | **API** | — |
| Plan y checkout | **API** | — |

**Ninguna pantalla queda en ejemplo.** La última fue Notificaciones, conectada
el 2026-08-10 a `get_notification_list`, `notification-unread-count` y
`mark-notification-read` — las mismas rutas `auth:sanctum` que llama la app de
Flutter, no endpoints propios del CRM. Con ella se fueron `src/lib/mock/data.ts`
y el componente `MockNotice`.

### Capa de datos

`src/lib/crm/types.ts` copia las formas de `CrmLeadResource` y compañía en
snake_case, tal cual las manda la API, para que un desajuste sea error de
compilación y no un `undefined` silencioso. `src/lib/crm/api.ts` son las
llamadas; `src/lib/use-resource.ts` da carga / error / recarga con aborto de la
petición anterior, que es justo lo que necesitaban cuatro pantallas y no lo
suficiente para meter una librería de fetching.

## Siguiente

El dominio CRM — Contacto / Lead / Actividad / Tarea — todavía no existe en el
backend: es C.1 (migraciones + backfill desde `InterestedUser`) y C.2 (API).
Hasta que aterricen hay datos reales en `get_interested_users`,
`get-contact-attempts`, `get-added-properties`, `get-meetings` y
`property-analytics`.
