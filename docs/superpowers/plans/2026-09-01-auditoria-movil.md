# Auditoría móvil — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** cerrar los 20 hallazgos abiertos de la auditoría móvil del 27‑ago‑2026 en `rentafacilrd-crm` (+ un arreglo en `rentalfacilrdpanel`), de modo que un asesor pueda operar el CRM completo desde el teléfono.

**Architecture:** el CRM ya es responsive; esto no es un rediseño. Cada tarea toca uno o dos archivos existentes. Tres decisiones transversales:
1. **`<dialog>` nativo para todo lo que se superpone** (drawer, bottom sheets). `showModal()` da backdrop, Escape, foco atrapado y fondo inerte gratis; `Modal` en `src/components/ui.tsx:501` ya lo usa. No entra ninguna librería.
2. **Los tamaños táctiles se resuelven con tokens**, no clase por clase. `tokens.css` ya define `--text-xs/sm/base`; se añade `--control-h` y un único `@media (max-width: 639px)`.
3. **La lógica pura sale del `.tsx` a un `.ts`** para poder testearla (ver Global Constraints).

**Tech Stack:** React 19, react-router 8, Tailwind 4, Vite 8, vitest 4, motion 12, Firebase Auth 12, Google Maps JS API. Backend Laravel (repo `rentalfacilrdpanel`).

**Spec:** `/Users/deam/Downloads/Auditoria_Movil_CRM_RentaFacil_RD_2026-08-27_actualizada.md` (§4 Hallazgos priorizados, §10 Criterios de aceptación).

## Global Constraints

- **No hay test de componentes.** `vite.config.ts` fija `test: { environment: 'node', include: ['src/**/*.test.ts'] }` — sin jsdom y sin `.tsx`. TDD aplica **solo** a funciones puras extraídas a `.ts`. Todo lo visual se verifica a mano; cada tarea dice exactamente cómo. **No añadir jsdom/testing-library**: son 4 dependencias para probar lo que un vistazo a 360 px prueba mejor.
- **Anchos de verificación obligatorios:** 320, 360, 390, 412 y 768 px. Cero scroll horizontal del `body`.
- **Objetivo táctil:** 44 × 44 px efectivos como mínimo en cualquier control primario. El check visual puede ser de 18–20 px dentro de un área de 44.
- **Fuente de inputs en móvil: 16 px exactos.** Menos hace que Safari iOS haga zoom al enfocar.
- **Sin dependencias nuevas.** Ninguna tarea de este plan necesita una.
- **Comandos:** `npm test`, `npm run lint`, `npm run build` (los tres deben pasar antes de cada commit). En el panel: `./vendor/bin/pint --dirty` y `php artisan test`.
- **Nada de toast de éxito** (`src/lib/toast-context.ts`): la pantalla actualizada es la confirmación. Los toasts son para fallo + Deshacer.
- **Idioma:** todo texto nuevo entra en `src/lib/i18n/es.ts` **y** `en.ts`. `TranslationKey` es un tipo cerrado: falta una clave y no compila.
- **Commits:** uno por tarea, en español, formato `tipo(scope): asunto`.

## No romper lo que ya funciona

Seis sitios donde este plan toca código compartido. Cada uno tiene su trampa
concreta identificada en la tarea correspondiente; se listan juntos aquí
porque son lo que hay que mirar en la revisión de cada PR.

| Qué se toca | Quién más lo usa | La trampa |
|---|---|---|
| `--text-xs/sm/base` (Task 3) | toda la app **y `.rf-pin__label`** (`index.css:110`) | Las etiquetas de los pines del mapa dimensionan por `--text-xs`. Subirlas de 11 a 13 px las hace chocar entre sí justo donde hay menos sitio. **Exentas.** |
| `Modal` (Task 5) | 11 llamadas en 7 archivos | El `variant` por defecto tiene que producir **el mismo CSS de hoy**. |
| `<aside>` → `<dialog>` (Task 6) | transiciones de vista (`vt-sidebar`) | `view-transition-name` duplicado **aborta todas** las transiciones en silencio, también las de cabecera y contenido. |
| `agencyIdForPublishing()` en un GET (Task 7) | alta de propiedad y de proyecto | Un GET que escribe, a 60 req/min: dos peticiones a la vez chocan contra el índice único y dejan una agencia huérfana. |
| Checkboxes (Task 9) | 8 sitios, **no todos móviles** | El de `properties.tsx:795` es `card: 'hide'` — no existe en móvil. Y la fila de tareas contiene un `<Link>`. |
| `useResource` (Task 17) | 37 llamadas | La firma sin `key` tiene que comportarse exactamente igual que hoy. |
| `validateProperty` (Task 2) | cada alta de propiedad | Una lista de obligatorios **en paralelo** habilita Publicar sobre formularios que el servidor rechaza. Se recolecta desde ella, no junto a ella. |
| `.rf-cardlink` (Task 5) | tarjetas de lead, y donde más se use | Es un *stretched link*: `::after { inset: 0 }` cubre la tarjeta entera. Un `onClick` encima no dispara; ponerlo por encima mata la navegación. |
| `ToastApi` (Task 5) | toda la app | Solo existe `fail`, y su render es rojo y sin autocierre. Un movimiento correcto no puede anunciarse con él. |
| `auth-provider` (Task 4) | los tres inicios de sesión | El `setState` de autenticado vive ahí. Canjear el redirect fuera deja la sesión abierta en el servidor y la app en el formulario. |
| Contenedor de toasts (Tasks 5+6) | toda la app | Es `fixed bottom-0`: la barra de navegación nueva lo tapa, y con él el botón Reintentar. |

**Regla de ejecución:** ninguna tarea de este plan cambia comportamiento de
escritorio. Si una verificación a ≥ 1024 px sale distinta de antes, es un fallo
de la tarea, no un efecto secundario aceptable.

---

# Fase 1 — Bloqueos móviles y funcionales

## Task 1: Reparar Google Maps y darle estado de error

**Files:**
- Modify: `src/lib/google-maps.ts:64-88` (`loadMaps`)
- Modify: `src/components/location-picker.tsx:59-80` (efecto de arranque)
- Modify: `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`
- Test: `src/lib/google-maps.test.ts` (ya existe)

**Interfaces:**
- Produces: `loadMaps(): Promise<void>` — resuelve **solo** cuando `google.maps.importLibrary` existe.

**Causa raíz** (no el síntoma): `loadMaps()` resuelve en `script.onload`. Con `loading=async` y sin `callback=`, el bootstrap de Google todavía no ha instalado `importLibrary` en ese instante, así que `location-picker.tsx:66` lo llama y revienta con `google.maps.importLibrary is not a function`. `searchPlaces()` no falla porque se ejecuta segundos después (hay que teclear 3 caracteres), que es exactamente lo que el auditor observó: sugerencias sí, mapa no.

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/google-maps.test.ts`:

```ts
import { expect, test } from 'vitest'
import { mapsBootstrapUrl } from './google-maps'

test('el bootstrap pide un callback: sin él, importLibrary no existe todavía en onload', () => {
  const url = new URL(mapsBootstrapUrl('KEY-DE-PRUEBA', '__rfMapsReady'))
  expect(url.searchParams.get('callback')).toBe('__rfMapsReady')
  expect(url.searchParams.get('loading')).toBe('async')
  expect(url.searchParams.get('key')).toBe('KEY-DE-PRUEBA')
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- google-maps`
Expected: FAIL — `mapsBootstrapUrl is not a function`.

- [ ] **Step 3: Implementar**

En `src/lib/google-maps.ts`, extraer la URL y cambiar `onload` por `callback`:

```ts
/** Exportada para su test: el `callback` es la corrección entera. */
export function mapsBootstrapUrl(key: string, callbackName: string): string {
  const params = new URLSearchParams({
    key,
    v: 'weekly',
    loading: 'async',
    // SIN esto, `script.onload` dispara antes de que el bootstrap instale
    // `google.maps.importLibrary`, y el primer importLibrary() del picker
    // lanza "is not a function". Ese fue el mapa vacío de la auditoría.
    callback: callbackName,
  })
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`
}

const CALLBACK = '__rfMapsReady'

export function loadMaps(): Promise<void> {
  if (loader !== null) return loader

  loader = new Promise<void>((resolve, reject) => {
    if (KEY === '') {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
      return
    }
    if (typeof google !== 'undefined' && google.maps?.importLibrary !== undefined) {
      resolve()
      return
    }

    ;(window as unknown as Record<string, () => void>)[CALLBACK] = () => resolve()

    const script = document.createElement('script')
    script.src = mapsBootstrapUrl(KEY, CALLBACK)
    script.async = true
    // onerror sigue haciendo falta: el callback nunca llega si la red, el
    // bloqueador o una clave restringida tumban el script, y sin esto la
    // promesa se quedaría colgada para siempre en vez de rechazar.
    script.onerror = () => reject(new Error('Google Maps could not load.'))
    document.head.append(script)
  })

  return loader
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -- google-maps` → PASS.

- [ ] **Step 5: Estado de error visible en el picker**

`location-picker.tsx` no tiene `try/catch`: cuando el efecto lanza, el contenedor queda vacío y en silencio. Envolver:

```tsx
const [mapsError, setMapsError] = useState(false)

useEffect(() => {
  if (containerRef.current === null) return
  let live = true

  void (async () => {
    try {
      await loadMaps()
      const { Map } = await google.maps.importLibrary('maps')
      if (!live || containerRef.current === null) return
      /* …el cuerpo actual, sin cambios… */
    } catch {
      if (live) setMapsError(true)
    }
  })()

  return () => { live = false }
}, [])
```

Y sobre el contenedor del mapa:

```tsx
{mapsError && (
  <p role="alert" className="mb-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
    {t('newProperty.mapUnavailable')}
  </p>
)}
```

Claves nuevas: `newProperty.mapUnavailable` — es `'No se pudo cargar el mapa. Puedes escribir la dirección y elegir una sugerencia; el pin se ajusta al publicar.'` / `'The map could not load. You can type the address and pick a suggestion; the pin is set on publish.'`

- [ ] **Step 6: Verificación manual**

1. **Primero, lo que ya funcionaba.** `searchPlaces()` y `reverseGeocode()`
   comparten `loadMaps()`: el autocompletado de dirección **hoy funciona** y
   esta tarea toca justo su cimiento. Teclear tres letras en el campo de
   dirección, elegir una sugerencia, y comprobar que siguen rellenándose país,
   provincia, ciudad y Zona. Si esto se rompe, la tarea es una regresión neta
   por mucho que el mapa aparezca.
2. `npm test -- google-maps` — los cuatro tests de `componentOf` que ya existían
   siguen pasando (`ADDRESS_COMPONENTS` no se toca en esta tarea).
3. Abrir `/properties/new` → paso Ubicación. El mapa dibuja, el pin arrastra,
   arrastrarlo rellena la dirección, cero errores en consola.
4. En DevTools → Network, bloquear `maps.googleapis.com` y recargar: aparece el
   aviso, la dirección sigue tecleable y la pantalla no se cae.
5. Recargar dos veces seguidas con HMR activo: `loadMaps()` es single-flight y
   el callback en `window` se instala una sola vez; un segundo bootstrap con el
   mismo nombre de callback no debe lanzar.
6. Repetir en 390 px.

- [ ] **Step 7: Commit**

```bash
git add src/lib/google-maps.ts src/lib/google-maps.test.ts src/components/location-picker.tsx src/lib/i18n
git commit -m "fix(maps): esperar al callback del bootstrap y avisar si el mapa no carga"
```

**Nota de despliegue (no es código):** verificar en Google Cloud que la clave tiene **Maps JavaScript API**, **Places API (New)** y **Geocoding API** habilitadas, y la restricción por HTTP referrer incluye `crm.rentafacilrd.com/*`. Si el `callback` llega pero el mapa sale gris, el problema es ese, no este archivo.

---

## Task 2: Bloquear Publicar y enumerar los pendientes en Revisar

**Files:**
- Modify: `src/lib/crm/create-property.ts:203-283` (`validateProperty`)
- Modify: `src/lib/crm/create-property.test.ts`
- Modify: `src/routes/property-new.tsx` (`submit()` ~L490, `<Review>` ~L1265, botón Publicar)
- Modify: `src/lib/i18n/es.ts`, `en.ts`

**Interfaces:**
- Produces: `propertyOffenders(form, media, parameters, required, galleryLimit, mediaRich): PropertyField[]` — **todos** los campos que impiden publicar, en orden de paso.
- Preserva: `validateProperty(...)` con su firma y su contrato de hoy (`PropertyField | null`).

### Por qué NO una función de validación aparte

El primer borrador de este plan proponía un `missingRequired(form, media)` nuevo
con cinco campos: título, precio, dirección, pin y foto. **Habría hecho el
problema peor.** `validateProperty` (`create-property.ts:203`) exige bastante
más que eso:

`category_id` · `rentduration` (si es alquiler) · `title` · **`description`** ·
`price` (regex decimal **y ≥ 1**, no «> 0») · formato de `area`/`land_area` ·
**cada parámetro `is_required` de la categoría elegida** (`param:${id}`,
dinámicos) · `address` · `latitude`+`longitude` · `title_image` **con su MIME y
su tamaño** · el límite de galería del plan · `three_d_image` · `documents`.

Una lista paralela de cinco campos habría **habilitado Publicar** con la
descripción vacía o un parámetro obligatorio sin llenar; el agente pulsa, el
servidor o `validateProperty` lo rebotan, y la pantalla acaba de decirle que no
faltaba nada. Hoy al menos el rebote es el único mecanismo y no miente.

Una sola fuente de verdad: `validateProperty` pasa a construir la lista
completa, y su contrato actual se conserva como «el primero de la lista».

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/crm/create-property.test.ts` (ya existe; añadir un `describe`):

```ts
import { EMPTY_PROPERTY_FORM, EMPTY_PROPERTY_MEDIA, propertyOffenders, validateProperty } from './create-property'

const REQUIRED_PARAM = [{ id: 7, is_required: 1 }]

test('enumera todo lo que falta, en orden de paso', () => {
  expect(propertyOffenders(EMPTY_PROPERTY_FORM, EMPTY_PROPERTY_MEDIA, {}, REQUIRED_PARAM, null, true))
    .toEqual(['category_id', 'title', 'description', 'price', 'param:7', 'address', 'latitude', 'title_image'])
})

test('validateProperty sigue siendo el primero de la lista', () => {
  const args = [EMPTY_PROPERTY_FORM, EMPTY_PROPERTY_MEDIA, {}, REQUIRED_PARAM, null, true] as const
  expect(validateProperty(...args)).toBe(propertyOffenders(...args)[0])
})

test('un precio de 0 cuenta como pendiente: el servidor lo rechaza tras cobrar la subida', () => {
  const form = { ...EMPTY_PROPERTY_FORM, price: '0' }
  expect(propertyOffenders(form, EMPTY_PROPERTY_MEDIA, {}, [], null, true)).toContain('price')
})

test('sin pendientes, la lista es vacía y validateProperty es null', () => {
  const form = {
    ...EMPTY_PROPERTY_FORM,
    category_id: '3', title: 'Apto', description: 'Amplio', price: '95000',
    address: 'C/ 1', latitude: '18.4', longitude: '-69.9',
  }
  const media = { ...EMPTY_PROPERTY_MEDIA, title_image: new File([''], 'p.jpg', { type: 'image/jpeg' }) }
  expect(propertyOffenders(form, media, {}, [], null, true)).toEqual([])
  expect(validateProperty(form, media, {}, [], null, true)).toBeNull()
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- create-property`
Expected: FAIL — `propertyOffenders is not a function`. **Los tests que ya
existían en ese archivo tienen que seguir pasando**; si alguno se pone rojo,
has cambiado el contrato de `validateProperty` y eso no es esta tarea.

- [ ] **Step 3: Implementar — recolectar en vez de retornar al primero**

Convertir cada `return 'x'` de `validateProperty` en un `push`, y dejar
`validateProperty` como envoltura. Mismo orden, mismas reglas, cero lógica
duplicada:

```ts
/**
 * Todos los campos que impiden publicar. Mismo orden y mismas reglas que
 * validateProperty(), porque es literalmente su cuerpo: aquella pasa a ser
 * "el primero de éstos".
 *
 * Existe porque la pantalla de Revisar necesita LA LISTA y el salto-al-campo
 * necesita EL PRIMERO. Mantener dos validaciones en paralelo es cómo se acaba
 * habilitando Publicar sobre un formulario que el servidor rechaza.
 */
export function propertyOffenders(
  form: PropertyForm,
  media: PropertyMedia,
  parameters: ParameterValues,
  required: { id: number; is_required: number }[],
  galleryLimit: number | null,
  mediaRich: boolean,
): PropertyField[] {
  const offenders: PropertyField[] = []
  /* …el cuerpo actual, con `offenders.push(...)` donde había `return ...`… */
  return offenders
}

export function validateProperty(/* …firma intacta… */): PropertyField | null {
  return propertyOffenders(form, media, parameters, required, galleryLimit, mediaRich)[0] ?? null
}
```

**Ojo con los `for` internos**: hoy `return` corta el bucle. Con `push` hay que
poner `break` donde el campo es uno solo (`gallery_images`, `documents`) o
saldría repetido por cada archivo malo.

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -- create-property` → PASS, **incluidos los tests previos**.

- [ ] **Step 5: Cablearlo en la pantalla**

```tsx
const pending = propertyOffenders(form, media, parameters, categoryParameters, galleryLimit, mediaRich)
```

Botón Publicar: `disabled={saving || pending.length > 0}`, con `aria-describedby`
apuntando a la lista — un botón deshabilitado sin explicación es un callejón.

En `<Review>`, encima de la primera `ReviewCard`, la lista con enlace al campo.
**La etiqueta de un `param:${id}` no sale de i18n**: no hay clave para un
parámetro dinámico. Resolverla contra `categoryParameters`:

```tsx
const labelOfField = (field: PropertyField): string => {
  const parameter = field.startsWith('param:')
    ? categoryParameters.find((entry) => `param:${entry.id}` === field)
    : undefined
  if (parameter !== undefined) return parameter.translated_name ?? parameter.name
  return t(`newProperty.error.${field}` as 'newProperty.error.title')
}
```

- [ ] **Step 6: Enfocar el primer error** (cierra el P2 «Error final poco guiado»)

**Los ids no son `property-${field}`.** Verificado en el archivo: el campo se
llama `title_image` pero su control es `id="property-title-image"` (L970), y lo
mismo pasa con `gallery_images` → `property-gallery` (L987), `three_d_image` →
`property-3d` (L1012), `meta_image` → `property-meta-image` (L1068). Un
`getElementById(\`property-${field}\`)` devuelve `null` en todos esos y el foco
no se mueve, en silencio.

Mapa explícito, y `?? ` al patrón por defecto para los que sí coinciden:

```tsx
/** Los controles de medios no siguen el patrón `property-${field}`. */
const FIELD_ELEMENT_ID: Partial<Record<PropertyField, string>> = {
  title_image: 'property-title-image',
  gallery_images: 'property-gallery',
  three_d_image: 'property-3d',
  documents: 'property-documents',
  meta_image: 'property-meta-image',
}

useEffect(() => {
  if (invalid === null) return
  const id = FIELD_ELEMENT_ID[invalid] ?? `property-${invalid}`
  const element = document.getElementById(id)
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}, [step, invalid])
```

`preventScroll: true` + `scrollIntoView` explícito y no el scroll del foco: el
foco garantiza visibilidad, no centrado, y sobre el teclado de un móvil
«visible» acaba siendo la última fila de píxeles.

- [ ] **Step 7: Verificación manual**

1. Abrir `/properties/new` y saltar a Revisar sin llenar nada: Publicar
   deshabilitado y la lista enumera **también** descripción y categoría, no solo
   los cinco obvios.
2. Elegir una categoría con parámetros obligatorios: aparecen en la lista con su
   nombre real, no con `param:7`.
3. Tocar el pendiente de «Foto principal»: salta al paso de medios **y el
   control queda enfocado y centrado** — ésta es la que falla si el mapa de ids
   está mal.
4. Llenarlo todo: Publicar se habilita y publica. **Comprobar que sigue
   publicando**: esta tarea toca la función que valida cada alta.

- [ ] **Step 8: Commit**

```bash
git add src/lib/crm/create-property.ts src/lib/crm/create-property.test.ts src/routes/property-new.tsx src/lib/i18n
git commit -m "feat(alta): recolectar todos los obligatorios y bloquear Publicar"
```

---

## Task 3: Alturas táctiles y tipografía móvil

**Files:**
- Modify: `tokens.css:34-36`
- Modify: `src/index.css` (bloque nuevo al final de las reglas base)
- Modify: `src/components/ui.tsx` (`min-h-9` en L107, L212, L262, L471; `text-sm` de inputs)

Cinco sitios, no ochenta: `Button`, `Field`, `LinkButton`, `TextArea`, `Select` y `FileField` son de dónde salen prácticamente todos los controles de la app.

- [ ] **Step 1: Añadir el token de altura**

En `tokens.css`, junto a los `--text-*`:

```css
  /* Alto de control. 36px en escritorio (densidad de CRM), 44 en móvil
   * (Apple HIG 44pt, Material 48dp). Es una variable y no dos clases para
   * que un control nuevo herede el comportamiento sin acordarse de nada. */
  --control-h: 2.25rem;
```

- [ ] **Step 2: El único media query**

Al final de la sección de reglas base de `src/index.css`:

```css
/* Móvil (< sm). Tres tokens y una regla: el resto de la app ya los consume.
 * Los 16px de los inputs no son estética — por debajo de eso Safari iOS hace
 * zoom al enfocar y deja la página descuadrada al salir del campo. */
@media (max-width: 639px) {
  :root {
    --text-xs: 0.8125rem;  /* 13px */
    --text-sm: 0.875rem;   /* 14px */
    --text-base: 1rem;     /* 16px */
    --control-h: 2.75rem;  /* 44px */
  }

  input,
  select,
  textarea {
    font-size: 16px;
  }
}
```

- [ ] **Step 3: Que los controles lean el token**

En `src/components/ui.tsx`, sustituir `min-h-9` por `min-h-(--control-h)` en las cuatro apariciones (L107 `Button`, L212 `Field`, L262 `LinkButton`, L471 del control de archivo). En `TextArea` (L320) no aplica: ya crece.

- [ ] **Step 4: Eximir las etiquetas de los pines del mapa**

`index.css:110` — `.rf-pin__label` dimensiona con `var(--text-xs)`. Ahí el
tamaño es **espacial**, no jerárquico: subirlo de 11 a 13 px engorda cada pin un
18 % justo en la pantalla donde más se solapan. Fijarlo literal:

```css
.rf-pin__label {
  /* Literal, no var(--text-xs): los pines compiten por espacio en el mapa y
   * no participan del escalado de texto de móvil. Ver Task 3. */
  font-size: 11px;
}
```

Buscar cualquier otro consumidor con la misma naturaleza antes de dar la tarea
por hecha: `grep -n "var(--text-" src/index.css`.

- [ ] **Step 5: Verificación manual**

1. `npm run build`. Después, **mirar el CSS emitido**, no suponer:
   `grep -o "font-size:var(--text-sm)" dist/assets/*.css | head`.
   Tailwind v4 compila `text-sm` a `font-size: var(--text-sm)`, que es lo que
   hace que el override en `:root` funcione en tiempo de ejecución. Si en su
   lugar hubiera inlineado `0.8125rem`, **este enfoque entero no vale** y hay
   que pasar a clases `sm:` explícitas. Comprobarlo aquí cuesta un comando;
   descubrirlo en producción cuesta la tarea.
2. Confirmar que `min-h-(--control-h)` compiló; si no, `min-h-[var(--control-h)]`.
3. En 390 px, medir con DevTools: botón y campo ≥ 44 px, texto de input = 16 px, texto secundario ≥ 13 px.
4. En ≥ 640 px **nada cambia**: botón 36 px, `text-sm` 13 px, badges 11 px. **Esta comprobación es la mitad de la tarea** — el CRM de escritorio vive de su densidad.
5. Abrir `/properties` en vista Mapa a 390 px: los pines no se han engordado.
6. Enfocar un input en Safari iOS (o simulador): no hace zoom.

- [ ] **Step 6: Commit**

```bash
git add tokens.css src/index.css src/components/ui.tsx
git commit -m "feat(móvil): controles de 44px y tipografía de 16px por debajo de sm"
```

---

## Task 4: Login con Google por redirect en móvil

**Files:**
- Modify: `src/lib/firebase.ts`
- Create: `src/lib/crm/google-flow.ts` + `.test.ts`
- Modify: `src/lib/crm/google-login.ts`
- Modify: `src/routes/login.tsx`

**Interfaces:**
- Produces: `prefersRedirect(width: number): boolean`; `startGoogleRedirect(): Promise<void>`; `finishGoogleRedirect(): Promise<GoogleCredential | null>`.

El popup en móvil es frágil: Safari iOS lo bloquea por defecto salvo gesto directo, y cualquier `await` antes de abrirlo pierde ese gesto.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { expect, test } from 'vitest'
import { prefersRedirect } from './google-flow'

test('un teléfono usa redirect', () => {
  expect(prefersRedirect(390)).toBe(true)
})

test('un escritorio usa popup', () => {
  expect(prefersRedirect(1440)).toBe(false)
})

test('una ventana estrecha en escritorio usa redirect: es el caso que rompe', () => {
  expect(prefersRedirect(600)).toBe(true)
})

test('el límite es 768 inclusive por abajo', () => {
  expect(prefersRedirect(767)).toBe(true)
  expect(prefersRedirect(768)).toBe(false)
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- google-flow` → FAIL.

- [ ] **Step 3: Implementar la decisión pura**

```ts
/**
 * Redirect por debajo de 768px. Decide el ANCHO, no el tipo de puntero: un
 * portátil táctil de 1440px abre popups perfectamente y el redirect ahí sería
 * peor (recarga la app entera). El caso que falla es la ventana estrecha.
 */
export function prefersRedirect(width: number): boolean {
  return width < 768
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -- google-flow` → PASS.

- [ ] **Step 5: Las dos mitades del redirect en `firebase.ts`**

```ts
import { getRedirectResult, signInWithRedirect } from 'firebase/auth'

/** Sale de la página. No devuelve nada: la respuesta llega en el arranque. */
export async function startGoogleRedirect(): Promise<void> {
  const auth = getAuth(firebaseApp())
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithRedirect(auth, provider)
}

/**
 * `null` = esta carga no viene de un redirect (el caso normal). Cierra la
 * sesión de Firebase igual que getGoogleIdToken(), y por la misma razón:
 * el refresh token de Google no tiene nada que hacer en IndexedDB una vez
 * canjeado por la cookie de Laravel.
 */
export async function finishGoogleRedirect(): Promise<GoogleCredential | null> {
  const auth = getAuth(firebaseApp())
  const result = await getRedirectResult(auth)
  if (result === null) return null
  try {
    return { idToken: await result.user.getIdToken(), name: result.user.displayName ?? '' }
  } finally {
    await signOut(auth)
  }
}
```

- [ ] **Step 6: El canje va en el AuthProvider, no en la pantalla**

**Trampa.** `loginWithGoogle` vive en `auth-provider.tsx:76` y hace dos cosas:
canjea el token y **`setState({ status: 'authenticated', user })`**. Si el
redirect se canjea desde `login.tsx` llamando al API directamente, la cookie de
Laravel queda puesta pero el `AuthState` del SPA sigue en `anonymous`: el
usuario ha iniciado sesión de verdad y la aplicación le sigue enseñando el
formulario. `setState` solo existe dentro del provider.

Extender el contrato (`auth-context.ts:48`) con una tercera vía que comparte
el `setState`:

```ts
export interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  /** `true` si esta carga venía de un redirect y la sesión quedó abierta. */
  completeGoogleRedirect: () => Promise<boolean>
  logout: () => Promise<void>
  retry: () => void
  refreshUser: () => Promise<void>
}
```

```tsx
// auth-provider.tsx — misma forma que loginWithGoogle, un paso más
const completeGoogleRedirect = useCallback(async () => {
  const credential = await finishGoogleRedirect()
  if (credential === null) return false
  setState({ status: 'authenticated', user: await exchangeGoogleCredential(credential) })
  return true
}, [])
```

Y extraer de `signInWithGoogle()` la mitad del canje como
`exchangeGoogleCredential(credential)`, para que popup y redirect compartan el
POST a `user_signup` en vez de duplicarlo. **`loginWithGoogle` no cambia de
comportamiento**: sigue siendo popup + `setState`, y el login de escritorio no
se entera de esta tarea.

- [ ] **Step 7: No enseñar el formulario mientras vuelve el redirect**

`LoginPage` decide con `state.status`: tras volver de Google, la sonda de sesión
contesta `anonymous` (la cookie aún no existe, el canje no ha ocurrido) y la
pantalla **pinta el formulario de login durante un instante** antes de
autenticarse. Da la sensación de que el inicio falló.

Marcar la salida y leerla a la vuelta:

```tsx
// antes de startGoogleRedirect()
window.sessionStorage.setItem('rf.google-redirect', '1')
```

```tsx
// en LoginPage, ANTES del primer render que decide
const returning = window.sessionStorage.getItem('rf.google-redirect') === '1'
const [googleSubmitting, setGoogleSubmitting] = useState(returning)
```

`sessionStorage` y no `localStorage`: muere con la pestaña, que es exactamente
la vida útil de este dato. Borrarlo en el `finally` del canje, **también cuando
falla** — si no, un intento abortado deja la pantalla en «Iniciando sesión…»
para siempre.

```tsx
useEffect(() => {
  if (!isFirebaseConfigured() || !returning) return
  void completeGoogleRedirect()
    .catch((error: unknown) => setGoogleError(t(GOOGLE_ERROR_COPY[googleErrorKey(error)])))
    .finally(() => {
      window.sessionStorage.removeItem('rf.google-redirect')
      setGoogleSubmitting(false)
    })
}, [])
```

- [ ] **Step 8: Añadir `auth/missing-initial-state` a `googleErrorKey`**

Es el error del redirect cuando el navegador bloquea almacenamiento de terceros (Safari con prevención de rastreo). Mapear a una clave nueva `redirectStorage` con copy que diga qué hacer: *«Tu navegador bloqueó el inicio con Google. Añade `crm.rentafacilrd.com` a los sitios permitidos o inicia sesión con tu correo y contraseña.»* Sin esto el usuario ve «generic» y no tiene salida.

- [ ] **Step 9: Verificación manual**

1. **Primero el escritorio, que hoy funciona.** A 1440 px: el popup abre, entra,
   y `loginWithGoogle` no ha cambiado. Y el login por correo y contraseña
   también — esta tarea toca `auth-provider`, que es por donde pasan los tres.
2. Chrome Android real: pulsar Google → redirige, vuelve a `/login`, **sin
   parpadeo del formulario**, entra solo. Requiere que `crm.rentafacilrd.com`
   esté en Firebase Console → Authentication → Settings → Authorized domains; si
   no está, sale `auth/unauthorized-domain` y no es culpa del código.
3. Safari iOS: igual.
4. Volver atrás a mitad del redirect: la app **no** queda colgada en «Iniciando
   sesión…» — el `finally` limpió la marca de `sessionStorage`.
5. Recargar `/login` con sesión ya abierta: sigue redirigiendo al panel, sin
   pasar por el canje.

- [ ] **Step 10: Commit**

```bash
git add src/lib/firebase.ts src/lib/auth-provider.tsx src/lib/auth-context.ts src/lib/crm/google-flow.ts src/lib/crm/google-flow.test.ts src/lib/crm/google-login.ts src/routes/login.tsx src/lib/i18n
git commit -m "feat(auth): iniciar con Google por redirect en pantallas estrechas"
```

---

## Task 5: Pipeline operable por toque

**Files:**
- Modify: `src/routes/pipeline.tsx`
- Modify: `src/components/ui.tsx` (`Modal` gana `variant`)
- Modify: `src/lib/i18n/es.ts`, `en.ts`

Lo caro ya está hecho: `move()` (L28) ya es optimista, ya revierte y ya lanza un toast con reintento. Falta la superficie táctil.

- [ ] **Step 1: `Modal` con variante hoja inferior**

En `ui.tsx`, añadir `variant?: 'center' | 'sheet'` (por defecto `'center'`) y elegir clases:

```tsx
const SHELL = {
  center: 'm-auto max-h-[85dvh] w-[min(100%-2rem,32rem)] rounded-lg',
  // mt-auto: pegada abajo. En sm+ se recentra, para no dejar una hoja
  // inferior gigante en un monitor.
  sheet: 'mt-auto mb-0 max-h-[85dvh] w-full rounded-t-2xl sm:m-auto sm:w-[min(100%-2rem,32rem)] sm:rounded-lg',
} as const
```

y en el `<dialog>`: `className={`${SHELL[variant]} overflow-y-auto border border-rule bg-surface-raised p-0 text-ink backdrop:bg-ink/40`}`.

Un componente nuevo sería otra copia de `showModal()`, del `close` en unmount y del botón de cerrar. Es la misma caja con otro anclaje.

**No-regresión (11 llamadas en 7 archivos):** `variant` es opcional con defecto
`'center'`, y la cadena resultante tiene que contener **exactamente las mismas
clases de hoy** —`m-auto max-h-[85dvh] w-[min(100%-2rem,32rem)] overflow-y-auto
rounded-lg border border-rule bg-surface-raised p-0 text-ink
backdrop:bg-ink/40`—; el orden en el atributo da igual, el conjunto no.
Comprobar abriendo uno de cada archivo: `project-dialogs.tsx`,
`share-property-dialog.tsx`, `reassign-dialog.tsx`, `checkout-dialog.tsx`,
`property-collaborations.tsx`, `agency.tsx`, `project-detail.tsx`.

- [ ] **Step 2: La hoja de etapas**

```tsx
{picked !== null && (
  <Modal
    variant="sheet"
    title={picked.name}
    closeLabel={t('common.close')}
    onClose={() => setPicked(null)}
  >
    <p className="mb-3 text-sm text-muted">
      {picked.property_title ?? t('pipeline.noProperty')} · {t(`stage.${picked.stage}`)}
    </p>
    <ul className="grid gap-1">
      {STAGES.map((stage) => (
        <li key={stage}>
          <button
            type="button"
            disabled={stage === picked.stage}
            onClick={() => { void move(picked.id, stage, picked.stage); setPicked(null) }}
            className="flex min-h-14 w-full items-center justify-between rounded-md px-3 text-left text-base hover:bg-surface-sunken disabled:opacity-55"
          >
            {t(`stage.${stage}`)}
            {stage === picked.stage && <Check className="size-4" aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  </Modal>
)}
```

56 px de fila (`min-h-14`), dentro del rango 48–56 que pide la auditoría.

- [ ] **Step 3: Abrirla desde la tarjeta, sin romper la navegación al lead**

**Trampa: la tarjeta entera YA es un enlace.** `BoardCard` envuelve el nombre en
`<span className="rf-cardlink">`, y `index.css:75` define
`.rf-cardlink > a::after { position: absolute; inset: 0 }` — el clásico
*stretched link*: una capa invisible que cubre la tarjeta completa para que
tocar en cualquier punto navegue a `/leads/:id`. Un `onClick={onPick}` sobre la
tarjeta **nunca se dispararía**, porque ese `::after` está encima; y si lo
pusiera por encima, rompería la navegación al lead, que hoy funciona.

Dos objetivos explícitos por debajo de `lg`, y el estirado solo en escritorio:

```css
/* El stretched link es de escritorio. En móvil la tarjeta tiene dos acciones
 * —abrir el lead y mover de etapa— y una capa invisible que cubre la tarjeta
 * entera se queda con las dos. */
@media (max-width: 1023px) {
  .rf-cardlink > a::after {
    content: none;
  }
}
```

Y en la tarjeta, una franja «Mover · {etapa}» de `min-h-11` al pie que abre la
hoja. El nombre sigue siendo el `Link`. En `lg` la franja se oculta y vuelve el
comportamiento de hoy, intacto.

El `draggable` **se queda**: arrastrar y tocar conviven, un `dragstart` no
dispara `click`.

- [ ] **Step 4: Un tono no-error en el toast, para poder colgar el Deshacer**

**`ToastApi` solo tiene `fail`** (`toast-context.ts:19`), y el render está
cableado a error: `border-error bg-error-bg`, glifo `⚠`, `text-error`, y sin
auto-cierre a propósito («el usuario puede querer todavía el reintento»).
Llamar a `toast.info(...)` no compila, y reusar `fail()` anunciaría un
movimiento correcto con un toast rojo de advertencia.

Añadir el tono al contrato y al render:

```ts
// toast-context.ts
export interface ToastApi {
  fail: (message: string, action?: ToastAction) => void
  /** Neutro y efímero: confirma algo que salió bien y ofrece deshacerlo. */
  notify: (message: string, action?: ToastAction) => void
}
```

En `ToastProvider`, un `tone: 'error' | 'neutral'` en el `Toast`, las clases
por tono, y **auto-cierre solo en `neutral`** (~6 s, tiempo de leer y pulsar
Deshacer). El error sigue sin cerrarse solo — ese comentario del archivo
describe una decisión, no un descuido: no tocarlo.

- [ ] **Step 5: Deshacer**

```tsx
toast.notify(t('pipeline.moved', { stage: t(`stage.${stage}`) }), {
  label: t('common.undo'),
  run: () => void move(id, from, stage),
})
```

Única excepción a la regla de «sin toast de éxito» del proyecto, y la razón es
concreta: un cambio de etapa por toque no tiene el gesto que lo explique, así
que sin el toast no hay dónde colgar el Deshacer. Anotarlo en
`toast-context.ts` junto al tono nuevo.

- [ ] **Step 6: El toast no puede quedar bajo la barra inferior**

El contenedor es `fixed inset-x-0 bottom-0 z-50` (`toast.tsx:42`). La barra de
navegación de la Task 6 ocupa exactamente esa franja: a partir de esa tarea, un
toast de fallo con su botón Reintentar queda **debajo** de la barra y es
inalcanzable con el pulgar.

`bottom-16 lg:bottom-0` en ese contenedor. Cuesta una clase y es la clase de
regresión que solo aparece cuando dos tareas se juntan — hacerlo aquí, no
esperar a verlo.

- [ ] **Step 7: `scroll-snap` en el tablero**

En el contenedor de L90: `snap-x snap-mandatory`; en cada `<section>`: `snap-start`. Y bajar la columna a `w-[85vw] max-w-64 lg:w-64` para que asome la siguiente y se vea que hay más.

- [ ] **Step 8: Verificación manual**

1. 390 px con leads de prueba: tocar el **nombre** abre el lead; tocar la franja
   «Mover» abre la hoja. Las dos, no una.
2. Elegir etapa: la tarjeta se mueve al instante; el toast es neutro (no rojo),
   se cierra solo, y Deshacer la devuelve.
3. Provocar un fallo (backend caído): el toast de error sigue siendo rojo, **no**
   se autocierra, y su Reintentar es alcanzable — no tapado por la barra inferior.
4. El tablero encaja columna a columna al deslizar y asoma la siguiente.
5. **≥ 1024 px: arrastrar sigue funcionando y la tarjeta entera vuelve a ser
   clicable hacia el lead** (el `::after` vuelve). Idéntico a antes.

- [ ] **Step 9: Commit**

```bash
git add src/routes/pipeline.tsx src/components/ui.tsx src/components/toast.tsx src/lib/toast-context.ts src/index.css src/lib/i18n
git commit -m "feat(pipeline): mover un lead por toque, con hoja de etapas y Deshacer"
```

---

## Task 6: Drawer superpuesto y barra inferior

**Files:**
- Modify: `src/components/crm-layout.tsx:150-338`
- Modify: `src/lib/i18n/es.ts`, `en.ts`

Hoy el `aside` (L216) alterna `block`/`hidden` dentro de un `flex-col` con `shrink-0`: por eso empuja. Y las 13 entradas solo existen detrás de la hamburguesa.

- [ ] **Step 1: El drawer, como `<dialog>`**

El `<aside>` de escritorio se queda tal cual (`hidden lg:block`). En móvil, un `<dialog>` hermano montado solo con `menuOpen`, con la misma lista de enlaces extraída a un componente `<NavLinks onNavigate={() => setMenuOpen(false)} />` para no duplicarla:

```tsx
{menuOpen && (
  <Modal variant="drawer" title={t('nav.menu')} closeLabel={t('common.close')} onClose={() => setMenuOpen(false)}>
    <NavLinks onNavigate={() => setMenuOpen(false)} />
  </Modal>
)}
```

Tercera variante en `SHELL` (Task 5): `drawer: 'mr-auto ml-0 my-0 h-dvh max-h-none w-72 rounded-none'`.

`showModal()` trae backdrop, Escape, cierre al pulsar fuera (el `::backdrop` recibe el click en el `<dialog>`), foco atrapado y `inert` sobre el resto — los cinco requisitos de la auditoría, cero JavaScript propio. Escribirlos a mano sería ~60 líneas de gestión de foco que el navegador ya hace bien.

**Trampa — `view-transition-name` duplicado.** El `<aside>` lleva `vt-sidebar`,
que es `view-transition-name: app-sidebar` (`index.css:142`). Ese nombre tiene
que ser **único en el documento** durante una transición: si el drawer también
lo lleva, el navegador aborta **todas** las transiciones de la app —incluidas
`app-header` y `app-main`— y lo hace en silencio, sin error en consola. El
drawer usa `Modal`, que no tiene clase `vt-*`: **no añadírsela**. El `<aside>`
pasa a `hidden lg:block` y conserva la suya; con `display: none` no participa,
así que nunca coinciden.

**La lista de enlaces se comparte, no se duplica.** Extraer el `<nav>` de
`SECTIONS` (`crm-layout.tsx:221-313`) a un `<NavLinks onNavigate>` que consumen
el `<aside>` de escritorio y el drawer. Dos copias de trece enlaces con estado
activo divergen a la tercera pantalla que se añada.

- [ ] **Step 2: La barra inferior**

Al final del layout, hermana del `<main>`:

```tsx
<nav
  aria-label={t('nav.primary')}
  className="grid shrink-0 grid-cols-5 border-t border-rule bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
>
  {/* Resumen · Leads · Propiedades · Tareas · Más */}
</nav>
```

Cuatro `NavLink` de `min-h-14` (icono + etiqueta) y un botón «Más» que abre el mismo drawer. `env(safe-area-inset-bottom)` es lo que evita que el iPhone monte su barra de gestos encima del quinto botón.

**`shrink-0`, no `sticky`.** El layout es `h-dvh` y quien scrollea es el panel
de contenido, no la página (`crm-layout.tsx:327` lo explica: es la condición
para que `useScrollRestoration` funcione). Una barra `sticky` fuera de ese
contenedor no tiene respecto a qué pegarse; como hermana `shrink-0` al final
de la columna flex queda fija por construcción. Consecuencia buena: **no hace
falta `pb-16` en el `<main>`**, la barra ocupa su propia fila y no tapa nada.

- [ ] **Step 3: Verificación manual**

1. 390 px: abrir el menú → se superpone, el contenido de detrás **no se mueve**; Escape cierra; tocar el backdrop cierra; al cerrar, el foco vuelve a la hamburguesa.
2. Con el drawer abierto, `Tab` no sale de él.
3. La barra inferior no tapa el último elemento de una lista larga, y el scroll del panel de contenido sigue restaurándose al volver atrás (`useScrollRestoration`).
4. Navegar entre dos rutas: las transiciones de vista siguen animando. Si dejaron de hacerlo, hay un `view-transition-name` duplicado.
5. ≥ 1024 px: barra oculta, sidebar fijo, transiciones intactas — **idéntico a antes de esta tarea**.

- [ ] **Step 4: Commit**

```bash
git add src/components/crm-layout.tsx src/components/ui.tsx src/lib/i18n
git commit -m "feat(nav): drawer superpuesto y barra inferior en móvil"
```

---

## Task 7: Agencia individual sin callejón «No autorizado»

**Files (repo `rentalfacilrdpanel`):**
- Modify: `app/Http/Controllers/Api/CrmAgencyProfileController.php:36-42`
- Test: `tests/Feature/Api/CrmAgencyProfileTest.php`

La agencia de un miembro **solo se crea al publicar**: `AgencyContext::agencyIdForPublishing()` se llama desde `ApiController.php:1584` y `:5864`, y de ningún otro sitio. Una cuenta sin anuncios —la del auditor— no tiene `AgencyMember`, así que `show()` devuelve `403 'No autorizado'`, y el enlace del menú lleva a una pared. La regla de producto ya está escrita en el docblock de ese método: *nadie opera fuera de una agencia*. Solo falta aplicarla al leer, no únicamente al escribir.

- [ ] **Step 1: Escribir el test que falla**

```php
public function test_un_asesor_sin_anuncios_recibe_su_agencia_de_un_miembro(): void
{
    $customer = Customer::factory()->create(['name' => 'Ana Reyes']);

    $response = $this->actingAs($customer, 'sanctum')->getJson('/api/crm/agency');

    $response->assertOk()
        ->assertJsonPath('data.name', 'Ana Reyes')
        ->assertJsonPath('role', 'owner')
        ->assertJsonPath('is_admin', true)
        ->assertJsonPath('seats_used', 1);

    $this->assertDatabaseHas('agency_members', [
        'customer_id' => $customer->id, 'role' => 'owner', 'status' => 'active',
    ]);
}

public function test_no_crea_una_segunda_agencia_al_repetir_la_llamada(): void
{
    $customer = Customer::factory()->create();

    $this->actingAs($customer, 'sanctum')->getJson('/api/crm/agency')->assertOk();
    $this->actingAs($customer, 'sanctum')->getJson('/api/crm/agency')->assertOk();

    $this->assertSame(1, Agency::query()->count());
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `php artisan test --filter=CrmAgencyProfileTest` → FAIL con 403.

- [ ] **Step 3: Implementar**

```php
public function show()
{
    $context = app(AgencyContext::class);

    // Provisiona la agencia de un miembro si el asesor todavía no publicó
    // nada. Hasta aquí solo la creaba el alta de un anuncio, así que una
    // cuenta nueva veía "Mi agencia" en el menú y recibía un 403 al entrar.
    // agencyIdForPublishing() es idempotente: devuelve la existente si la hay.
    $context->agencyIdForPublishing();

    $agency = $this->myAgency();

    if ($agency === null) {
        // Sigue siendo alcanzable: guard `web` (un User del panel, no un
        // Customer) no tiene agencia que provisionar y no debe entrar aquí.
        return ApiResponseService::errorResponse('No autorizado', null, 403);
    }
    /* …el resto igual… */
}
```

`agencyIdForPublishing()` ya hace `$this->resolved = false` al terminar, y
`myAgency()` (L180) no cachea nada por su cuenta: relee `agencyId()` del
contexto y hace `Agency::find()`. Verificado, no supuesto.

**Trampa — un GET que escribe.** La ruta está a `throttle:60,1` y el CRM la
pide al montar la pantalla: dos peticiones simultáneas de la misma cuenta (doble
toque, o un `StrictMode` en dev) entran las dos por la rama de creación. La
segunda choca contra `agency_members_active_customer_unique` —el índice único
sobre la columna generada `active_customer_id`, creado en
`2026_08_25_000002`— y muere con un 500, **dejando además una fila huérfana en
`agencies`** porque el `Agency::create()` ya había pasado.

Envolver la provisión en una transacción y tratar el duplicado como lo que es:
alguien se te adelantó, relee.

```php
try {
    DB::transaction(fn () => $context->agencyIdForPublishing());
} catch (QueryException $e) {
    // 23000 = violación de integridad: otra petición de esta misma cuenta
    // creó la membresía entre nuestro chequeo y nuestro insert. No es un
    // error: es exactamente el estado que queríamos. Releer y seguir.
    if ($e->getCode() !== '23000') {
        throw $e;
    }
}

$agency = $this->myAgency();
```

La transacción es lo que evita la agencia huérfana; el `catch` es lo que evita
el 500. Hacen falta las dos: sin transacción, el rollback no revierte el
`Agency::create()`; sin `catch`, el usuario ve un error donde no lo hay.

- [ ] **Step 3b: Test de la carrera**

```php
public function test_dos_lecturas_simultaneas_no_dejan_una_agencia_huerfana(): void
{
    $customer = Customer::factory()->create();

    // Simula la segunda petición: la membresía aparece después de que la
    // primera decidiera que no existía.
    AgencyMember::create([
        'agency_id' => Agency::factory()->create()->id,
        'customer_id' => $customer->id,
        'role' => 'owner', 'status' => 'active', 'joined_at' => now(),
    ]);

    $this->actingAs($customer, 'sanctum')->getJson('/api/crm/agency')->assertOk();

    $this->assertSame(1, Agency::query()->count());
    $this->assertSame(1, AgencyMember::query()->where('customer_id', $customer->id)->count());
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `php artisan test --filter=CrmAgencyProfileTest` → PASS. Luego `php artisan test --filter=Agency` completo: nada más se apoyaba en ese 403.

- [ ] **Step 5: Backfill de las cuentas ya existentes**

Los asesores que se registraron y nunca publicaron siguen sin fila. Un comando, no una migración (crea datos, y una migración que crea datos no se puede repetir ni auditar):

```bash
php artisan agency:backfill-solo --dry-run   # cuántos afecta
php artisan agency:backfill-solo             # los crea
```

Reutilizar `AgencyContext::agencyIdFor($customerId)`, que ya existe justo para esto (no depende del guard). Iterar `Customer` sin `AgencyMember` activo **por lotes** (`chunkById(500)`), que es lo que ya hace `SanitizeSlugs`.

- [ ] **Step 6: Verificación de punta a punta**

Con una cuenta recién creada, sin anuncios: entrar al CRM → «Mi agencia» carga, muestra la agencia de un miembro, 1 de N plazas, rol owner. Cero `No autorizado`.

- [ ] **Step 7: Commit**

```bash
./vendor/bin/pint --dirty
git add app tests
git commit -m "fix(agency): provisionar la agencia individual al leer el perfil, no solo al publicar"
```

- [ ] **Step 8: En el CRM, quitar el «no sé» que ya no aplica**

`src/lib/crm/use-agency-role.ts:41` documenta que *«la rama del panel que manda `agency_role` no está mergeada»*. Sí lo está (`ApiController.php:967`, en `main`). Corregir el comentario. El `fail-closed` de `agency_role === undefined` **se queda**: sigue siendo la respuesta correcta ante un backend viejo.

---

## Task 8: Borrador del alta de propiedad

**Files:**
- Create: `src/lib/crm/property-draft.ts` + `.test.ts`
- Modify: `src/routes/property-new.tsx`
- Modify: `src/lib/i18n/es.ts`, `en.ts`

Ocho pasos que viven solo en estado de React. Una llamada entrante, una recarga o quedarse sin batería y se pierde todo.

**Decisión de alcance:** el borrador va a `localStorage`, no al backend. La auditoría pide «local y, preferiblemente, en backend»; el backend son tabla, endpoints, política de expiración y sincronización entre dispositivos, y no resuelve nada del caso real (mismo teléfono, misma sesión, recarga). Si aparece la necesidad de continuar en otro dispositivo, se sube entonces.

**Las fotos no caben en `localStorage`** (cuota de ~5 MB, y son `File` no serializables). Se resuelven en la Task 11 subiéndolas al elegirlas; hasta entonces el borrador restaura texto y avisa de que hay que volver a adjuntarlas. Decirlo en la UI, no fingir que se guardaron.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { expect, test } from 'vitest'
import { EMPTY_PROPERTY_FORM } from './create-property'
import { isFresh, readDraft, serializeDraft } from './property-draft'

test('un borrador da la vuelta completa', () => {
  const form = { ...EMPTY_PROPERTY_FORM, title: 'Apto en Naco', price: '120000' }
  const restored = readDraft(serializeDraft(form, {}, {}, {}, 'details'), Date.now())
  expect(restored?.form.title).toBe('Apto en Naco')
  expect(restored?.step).toBe('details')
})

test('un borrador de más de 7 días se descarta', () => {
  const stale = serializeDraft(EMPTY_PROPERTY_FORM, {}, {}, {}, 'category')
  const ochoDias = Date.now() + 8 * 24 * 60 * 60 * 1000
  expect(readDraft(stale, ochoDias)).toBeNull()
})

test('un JSON corrupto no tumba la pantalla', () => {
  expect(readDraft('{no es json', Date.now())).toBeNull()
})

test('isFresh no confunde "recién guardado" con "sin guardar"', () => {
  expect(isFresh(null)).toBe(false)
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- property-draft` → FAIL.

- [ ] **Step 3: Implementar**

Serializar/parsear con `try/catch` y sello de tiempo; `MAX_AGE = 7 días`. Clave
`rf.property-draft.v1` — versionada, para que un cambio de forma de
`PropertyForm` no restaure basura en un formulario nuevo.

**`ParameterValues` puede contener `File`.** El tipo es
`Record<number, string | string[] | File>` (`create-property.ts:74`) — hay
parámetros de categoría que son ficheros. `JSON.stringify` convierte un `File`
en `{}`, así que un guardado ingenuo **restaura un objeto vacío donde había un
documento** y `validateProperty` lo da por lleno (`value instanceof File` es
falso, pero `{}.toString().trim()` tampoco es `''`… y ahí empieza el bug).

Filtrarlos al serializar y decirlo al restaurar:

```ts
/** Los File no viajan a localStorage: se omiten y se piden de nuevo. */
function serializableParameters(parameters: ParameterValues): ParameterValues {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => !(value instanceof File)),
  ) as ParameterValues
}
```

Un test que lo fija:

```ts
test('un File dentro de los parámetros no se guarda como objeto vacío', () => {
  const parameters = { 7: new File([''], 'plano.pdf'), 8: 'Sí' }
  const restored = readDraft(serializeDraft(EMPTY_PROPERTY_FORM, parameters, {}, {}, 'parameters'), Date.now())
  expect(restored?.parameters).toEqual({ 8: 'Sí' })
})
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -- property-draft` → PASS.

- [ ] **Step 5: Autosave con debounce**

```tsx
useEffect(() => {
  const id = setTimeout(() => {
    window.localStorage.setItem(DRAFT_KEY, serializeDraft(form, parameters, facilities, translations, step))
    setSavedAt(Date.now())
  }, 1500)
  return () => clearTimeout(id)
}, [form, parameters, facilities, translations, step])
```

1500 ms: por debajo se escribe en cada tecla y `localStorage` es síncrono (bloquea el hilo principal en un móvil modesto).

- [ ] **Step 6: Restaurar, avisar y limpiar**

- Al montar, si hay borrador fresco: banner *«Tienes un borrador del {fecha}. [Continuar] [Descartar]»*. **No restaurar solo**: pisar en silencio un formulario en blanco que el agente abrió a propósito es peor que preguntar.
- Si el borrador traía parámetros de tipo fichero, el banner lo dice: *«Vuelve a adjuntar los archivos»*. Prometer lo que no se guardó es peor que no guardarlo.
- Indicador «Borrador guardado» junto a los pasos, con `aria-live="polite"`.
- `beforeunload` mientras haya cambios sin publicar.
- `localStorage.removeItem(DRAFT_KEY)` **solo** tras un `createProperty()` con éxito, antes del `navigate`.

- [ ] **Step 7: Verificación manual**

Llenar 3 pasos, recargar (F5): sale el banner, Continuar restaura texto y paso. Publicar y volver a `/properties/new`: no hay banner. Cerrar pestaña con cambios: el navegador pregunta.

- [ ] **Step 8: Commit**

```bash
git add src/lib/crm/property-draft.ts src/lib/crm/property-draft.test.ts src/routes/property-new.tsx src/lib/i18n
git commit -m "feat(alta): borrador local con autoguardado y restauración"
```

---

# Fase 2 — Flujos de trabajo

## Task 9: Áreas táctiles de los checkboxes

**Files:**
- Modify: `src/components/ui.tsx` (componente `CheckField` nuevo)
- Modify: `src/routes/tasks.tsx:90`, `src/routes/settings.tsx:172`, `src/routes/properties.tsx:336,795,977,1118`, `src/components/claim-listings.tsx:122,141`

Ocho `<input type="checkbox">` sueltos de 16 px. La corrección es **uno** compartido, no ocho parches — y así el noveno checkbox de la app nace bien.

- [ ] **Step 1: El componente**

```tsx
/** Check de 18px dentro de una etiqueta de 44: el área pulsable es la fila
 *  entera, que es lo que la gente intenta tocar de todos modos. */
export function CheckField({ id, label, checked, onChange, disabled }: {
  id: string; label: ReactNode; checked: boolean
  onChange: (next: boolean) => void; disabled?: boolean
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2.5 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-[18px] shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0 text-sm">{label}</span>
    </label>
  )
}
```

- [ ] **Step 2: Sustituir solo los que existen en móvil**

**Siete, no ocho.** `properties.tsx:795` está marcado `card: 'hide'` y el
comentario lo explica: *«Desktop-only: the card layout selects by tapping, so a
checkbox column there would be a second way to do one thing»*. En móvil ese
checkbox no se renderiza nunca. Dejarlo como está — cambiarlo sería trabajo
sobre algo invisible, y `CheckField` con su `min-h-11` engordaría la fila de la
tabla de escritorio, que es densa a propósito.

Los que sí: `tasks.tsx:90`, `settings.tsx:172`, `properties.tsx:336,977,1118`,
`claim-listings.tsx:122,141`. Verificar uno por uno si es `card: 'hide'` antes
de tocarlo.

- [ ] **Step 3: La fila de tareas, sin tragarse el enlace**

`tasks.tsx` pinta la fila dentro de un `<Card>` que **contiene un `<Link>` al
lead** (L104). Envolver la fila entera en una `<label>` haría que tocar ese
enlace marcara la tarea en vez de navegar: se rompe una función que hoy
funciona, a cambio de un área táctil.

El área grande se consigue sin eso: la `<label>` cubre el checkbox **y el
título** (`flex-1`), y el `<Link>` al lead queda fuera de ella, como hermano.

```tsx
<Card className="flex flex-wrap items-center gap-3 p-3 …">
  <label htmlFor={`task-${task.id}`} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
    <input id={`task-${task.id}`} type="checkbox" className="size-[18px] shrink-0 accent-[var(--color-accent)]" … />
    <span className="min-w-0 flex-1 …">{task.title}</span>
  </label>
  {task.lead_id !== null && <Link …>{/* fuera de la label */}</Link>}
</Card>
```

- [ ] **Step 4: Verificación manual**

En 390 px, tocar el título de una tarea: marca. Tocar el enlace al lead:
**navega, no marca** — esta es la comprobación que justifica el paso 3. Medir:
≥ 44 px de alto. En escritorio, la tabla de propiedades conserva su densidad.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui.tsx src/routes src/components/claim-listings.tsx
git commit -m "feat(a11y): un solo CheckField con área pulsable de 44px"
```

---

## Task 10: Agencia en fichas

**Files:**
- Modify: `src/routes/agency.tsx:196-260` (miembros), y la tabla de invitaciones
- Modify: `src/components/claim-listings.tsx`

`agency.tsx:201` sigue siendo `<Card className="overflow-x-auto"><table>`. El patrón correcto ya existe en el repo: `src/components/record.tsx` es el que convierte tabla en fichas por debajo de `lg` en leads, propiedades e inventario. Leerlo antes de escribir nada; esto debería ser reutilizar, no inventar.

- [ ] **Step 1: Leer `record.tsx` y `register.tsx`**

`register.tsx:226` y `:351` documentan las reglas de este sistema (cuándo icono, cuándo etiqueta). Seguirlas.

- [ ] **Step 2: La ficha de miembro**

Nombre y contacto, chips de rol y estado (`Badge` con `ROLE_TONE`/`STATUS_TONE`, ya definidos en L39‑40), fecha de ingreso, y un menú de tres puntos (`Modal variant="sheet"` de la Task 5) con ascender, suspender, transferir y retirar. Acciones destructivas dentro del menú, nunca sueltas en la ficha.

- [ ] **Step 3: Lo mismo en anuncios por incorporar**

`claim-listings.tsx`: ficha con `CheckField` (Task 9) y barra inferior pegajosa con el conteo y Incorporar. `src/components/bulk-bar.tsx` ya existe — usarlo, no escribir otra.

- [ ] **Step 4: Verificación manual**

320 y 390 px: cero scroll horizontal en las tres pestañas. Multi‑selección de anuncios con la barra inferior visible sobre el teclado.

- [ ] **Step 5: Commit**

```bash
git add src/routes/agency.tsx src/components/claim-listings.tsx
git commit -m "feat(agency): fichas en móvil, sin scroll horizontal"
```

---

## Task 11: Fotos que se suben al elegirlas

**Files:**
- Modify: `src/components/photo-input.tsx`
- Modify: `src/routes/property-new.tsx`
- Modify: `src/lib/crm/property-draft.ts` (guardar ids, no `File`)
- Backend: comprobar si `POST /api/crm/property-media` existe; si no, es una tarea de panel aparte

Subirlo todo al pulsar Publicar es frágil en una conexión móvil: un fallo a los 8 MB tira los ocho pasos.

- [ ] **Step 1: Comprimir antes de subir**

`createImageBitmap` + `OffscreenCanvas` + `toBlob('image/webp', 0.82)`, lado mayor a 1920 px. Ambas APIs son nativas en Chrome Android y Safari 17+; una foto de 4 MB del carrete baja a ~300 KB. Sin librería.

```ts
// ponytail: reduce en el hilo principal; si se nota el tirón con 20 fotos,
// moverlo a un Worker (createImageBitmap y OffscreenCanvas ya funcionan allí).
```

- [ ] **Step 2: Subida al elegir, con progreso por foto**

`XMLHttpRequest` y no `fetch`: `fetch` todavía no da progreso de subida, y el progreso es medio requisito. Guardar el id devuelto; el payload de Publicar lleva ids, no ficheros.

- [ ] **Step 3: Verificar contra el backend**

Antes de escribir el cliente: `grep -rn "property-media\|temp-upload" routes/api.php` en `rentalfacilrdpanel`. Si no hay endpoint, **parar** y planificarlo aparte — el cliente contra un endpoint imaginario no es medio trabajo, es cero.

- [ ] **Step 4: Verificación manual**

Con red a «Fast 3G» en DevTools: elegir 5 fotos, ver 5 barras avanzar, Publicar responde al instante. Recargar a media subida: el borrador (Task 8) conserva las ya subidas.

- [ ] **Step 5: Commit**

```bash
git add src/components/photo-input.tsx src/routes/property-new.tsx src/lib/crm/property-draft.ts
git commit -m "feat(alta): comprimir y subir las fotos al elegirlas, con progreso"
```

---

## Task 12: Mapa de propiedades a pantalla completa

**Files:**
- Modify: `src/components/property-map.tsx:140`
- Modify: `src/routes/properties.tsx` (conmutador de vista)

- [ ] **Step 1: Conmutador Mapa / Lista en móvil**

Por debajo de `lg`, el mapa ocupa `h-[calc(100dvh-var(--header-h))]` y la lista pasa a una hoja inferior arrastrable (`Modal variant="sheet"`, Task 5) con los resultados del área visible. Los controles de zoom, pegajosos.

- [ ] **Step 2: Renombrar «Tabla» a «Lista compacta»**

En móvil esa vista pinta fichas sin imagen; llamarla «Tabla» describe algo que no está en pantalla. Solo i18n. Y ocultar «Densidad» por debajo de `lg` (no significa nada cuando cada fila es una ficha).

- [ ] **Step 3: Verificación manual**

390 px: el mapa llena la pantalla, la hoja de resultados sube y baja, se puede tocar un pin y llegar a la ficha sin pasar por escritorio.

- [ ] **Step 4: Commit**

```bash
git add src/components/property-map.tsx src/routes/properties.tsx src/lib/i18n
git commit -m "feat(mapa): pantalla completa con lista en hoja inferior"
```

---

## Task 13: Filtros en hoja inferior y cabecera aligerada

**Files:**
- Modify: `src/routes/properties.tsx`, `src/routes/leads.tsx`
- Modify: `src/components/crm-layout.tsx:184-201`

- [ ] **Step 1: Filtros**

Búsqueda y orden quedan visibles (búsqueda pegajosa). Todo lo demás va a un `Modal variant="sheet"` tras un botón «Filtros» con **contador de filtros activos** y botones Aplicar/Limpiar. El estado ya vive en `src/lib/control-state.ts` (tiene tests) — se reutiliza tal cual, esto es solo otra superficie.

- [ ] **Step 2: Cabecera**

Por debajo de `sm`: quedan hamburguesa, logo y una acción de perfil. `LanguageSwitcher` y Cerrar sesión bajan al drawer (Task 6). Ambos ya son parte de `NavLinks`, así que es mover, no duplicar.

- [ ] **Step 3: Verificación manual**

320 px: la cabecera cabe en una fila, sin truncar la marca. Los filtros se abren, aplican y el contador cuadra con lo aplicado.

- [ ] **Step 4: Commit**

```bash
git add src/routes/properties.tsx src/routes/leads.tsx src/components/crm-layout.tsx
git commit -m "feat(móvil): filtros en hoja inferior y cabecera de tres elementos"
```

---

# Fase 3 — Rendimiento y calidad

## Task 14: Code splitting y carga diferida de Stripe/mapas

**Files:**
- Modify: `src/main.tsx:11-28` y el árbol de rutas
- Modify: `src/lib/crm/stripe-loader.ts:1`
- Modify: `src/components/checkout-dialog.tsx:17`

Hoy `main.tsx` importa las 18 rutas estáticamente; no hay ni un `lazy()` en todo `src`. Y `stripe-loader.ts` importa `loadStripe` de `@stripe/stripe-js`, cuyo *efecto de módulo* inyecta `js.stripe.com` — por eso Stripe pesa 245 KB en `/login`.

- [ ] **Step 1: Stripe primero** (una línea, ~245 KB)

```ts
import { loadStripe, type Stripe } from '@stripe/stripe-js/pure'
```

`/pure` es la misma API sin el efecto de importación: el script solo se pide en la primera llamada a `loadStripe()`. Además, en `checkout-dialog.tsx`, `StripePayment` pasa a `lazy(() => import('@/components/stripe-payment'))` con un `<Suspense>`, para que tampoco entre `@stripe/react-stripe-js` en el bundle común.

- [ ] **Step 2: Rutas perezosas**

```tsx
const PropertyNewPage = lazy(() => import('@/routes/property-new').then((m) => ({ default: m.PropertyNewPage })))
```

Las 17 privadas en `lazy()`; **`LoginPage` se queda estática** — es la primera
pantalla, y diferirla añade un salto de red justo donde se mide el LCP.
`<Suspense fallback={<LoadingState …/>}>` envolviendo el `<Outlet/>` en
`CrmLayout`, que ya tiene el componente.

**El `<Suspense>` va dentro de `CrmLayout`, no encima del router.** Encima, la
cabecera y el sidebar se desmontarían en cada navegación: parpadeo de chrome, y
las transiciones de vista (`app-header`, `app-sidebar`) animando contra la nada.
Dentro del `<Outlet/>`, solo cambia el panel de contenido, que es lo que ya
pasa hoy.

**Sin fallo de carga, no hay pantalla.** Un chunk que no descarga (red caída a
media navegación, deploy que rotó los hashes con la pestaña abierta) deja a
React con una promesa rechazada y el árbol en blanco. `RequireAuth` ya es el
sitio natural para un error boundary; si no lo tiene, añadirlo con un
«Recargar» — es la diferencia entre una pantalla blanca y un botón.

- [ ] **Step 3: El mapa, solo donde se usa**

`property-map.tsx` (Leaflet) y `location-picker.tsx` ya son componentes aparte; con las rutas en `lazy()` salen del bundle inicial solos. Verificar, no suponer.

- [ ] **Step 4: Verificar el presupuesto**

```bash
npm run build
```

Comprobar en la salida de Vite: el chunk de entrada por debajo de **200 KB
comprimidos**. Luego en DevTools → Network con caché desactivada, en `/login`:
**cero** peticiones a `js.stripe.com`, cero Leaflet, cero `maps.googleapis.com`.
Ese es el criterio de aceptación literal de §10.

Y el otro lado, que es el que se rompe: **abrir el checkout y pagar de
verdad** en modo test. `/pure` cambia cuándo se carga el script de Stripe, no
si carga; si `stripeFor()` se llamara antes de tiempo en algún camino, el pago
falla y el bundle sale precioso. Recorrer también `/plan` → seleccionar plan →
tarjeta de prueba → confirmación. `stripe-loader.test.ts` ya existe: tiene que
seguir pasando sin tocarlo.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/lib/crm/stripe-loader.ts src/components/checkout-dialog.tsx src/components/crm-layout.tsx
git commit -m "perf: rutas perezosas y Stripe fuera del bundle inicial"
```

---

## Task 15: Caché de los activos con hash

**Files:**
- Create: `Caddyfile` (raíz del repo CRM)
- Modify: `README.md` § Deploy

El despliegue es estático en Railway y **no hay ningún archivo de configuración en el repo** — el README (L166‑180) lo explica y advierte de no concluir «roto» mirando un `ls`. Railway sirve con Caddy; un `Caddyfile` en la raíz es lo que le deja poner cabeceras sin dejar de ser un sitio estático.

- [ ] **Step 1: El `Caddyfile`**

```
:{$PORT}

root * dist
encode gzip zstd

# Activos con hash en el nombre: un cambio de contenido cambia la URL, así
# que el navegador nunca necesita revalidar. Un año e immutable.
@hashed path /assets/*
header @hashed Cache-Control "public, max-age=31536000, immutable"

# index.html NO: es el único archivo cuya URL no cambia, y cachearlo sirve
# la app vieja apuntando a chunks que ya no existen.
@html path / /index.html
header @html Cache-Control "no-cache"

try_files {path} /index.html
file_server
```

- [ ] **Step 2: Verificar en producción tras el deploy**

```bash
curl -sI https://crm.rentafacilrd.com/assets/<un-fichero-con-hash>.js | grep -i cache-control
# esperado: public, max-age=31536000, immutable
curl -sI https://crm.rentafacilrd.com/ | grep -i cache-control
# esperado: no-cache
curl -sI https://crm.rentafacilrd.com/leads/123 | head -1
# esperado: HTTP/2 200  ← el fallback SPA sigue vivo
```

La tercera es la que importa: un `Caddyfile` mal puesto rompe el fallback y solo se nota con un F5 en una ruta profunda.

- [ ] **Step 3: Commit**

```bash
git add Caddyfile README.md
git commit -m "perf(deploy): caché anual e immutable para los activos con hash"
```

### Advertencia: esta es la tarea que más fácil rompe producción

Hoy **no hay ningún archivo de configuración de despliegue en el repo** y el
sitio funciona: el fallback SPA lo resuelve Railway por su cuenta
(README L166‑180, verificado el 2026‑08‑06). Añadir un `Caddyfile` **cambia el
provider de despliegue**: pasa de «sitio estático gestionado» a «Caddy que
configuras tú». A partir de ese commit, todo lo que Railway hacía solo pasa a
ser responsabilidad de este archivo — incluido el `try_files` sin el cual un F5
en `/leads/123` devuelve 404.

El README ya avisa de que dar esto por roto mirando un `ls` fue un error de
método cometido dos veces. La versión de ese error en esta tarea es dar por
bueno el `Caddyfile` porque el commit pasó CI.

Por eso:

- [ ] **Step 4: Desplegar a un entorno de prueba primero**, no a `crm.rentafacilrd.com`. Railway permite un servicio duplicado apuntando a la misma rama.
- [ ] **Step 5: Pasar los tres `curl` del paso 2 contra ese entorno.** El tercero —`/leads/123` → 200— es el que decide. Si devuelve 404, el `Caddyfile` está mal y **el sitio se habría quedado sin rutas profundas**.
- [ ] **Step 6: Confirmar que `PORT` llega.** `:{$PORT}` sin la variable hace que Caddy no arranque y el servicio quede caído, no lento.
- [ ] **Step 7: Rollback documentado.** Si algo falla en producción, borrar el `Caddyfile` y redesplegar devuelve el comportamiento de hoy. Escribirlo en el README junto al resto del apartado de deploy.

**Si Railway ignora el `Caddyfile`** (depende del provider configurado en el
panel del proyecto), la alternativa es Nixpacks con `caddy` explícito.
Comprobarlo en el panel **antes** de dar la tarea por hecha: la verificación es
el `curl` contra el entorno de prueba, no el commit.

**Coste/beneficio, por si prefieres saltártela:** esta tarea ahorra
revalidaciones en visitas repetidas. No mueve el arranque en frío, que es lo
que mide la auditoría. Es la de menor beneficio y mayor riesgo de las 18; si
hay que dejar una fuera, es ésta.

---

## Task 16: Endpoint mínimo de proveedores de acceso

**Files (repo `rentalfacilrdpanel`):**
- Modify: `routes/api.php:509` (zona pública)
- Modify: `app/Http/Controllers/ApiController.php`
- Test: `tests/Feature/Api/AuthProvidersTest.php`

**Files (CRM):**
- Modify: `src/lib/crm/settings.ts:19`

`/api/web-settings` devuelve 57 campos y ~58 KB sin comprimir, con `no-cache, private`, para leer **un booleano** que decide si se pinta el botón de Google.

- [ ] **Step 1: Escribir el test que falla**

```php
public function test_devuelve_solo_la_bandera_de_google(): void
{
    Setting::query()->updateOrCreate(['type' => 'social_login'], ['data' => '1']);

    $this->getJson('/api/auth/providers')
        ->assertOk()
        ->assertExactJson(['error' => false, 'data' => ['google' => true]]);
}

public function test_se_puede_cachear_en_el_borde(): void
{
    $this->getJson('/api/auth/providers')
        ->assertHeader('Cache-Control', 'max-age=300, public');
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `php artisan test --filter=AuthProvidersTest` → FAIL, 404.

- [ ] **Step 3: Implementar**

Ruta pública, sin `auth:sanctum`, sin sesión. Lee el mismo `Setting` que `getWebSettings` (extraer el lector a un método privado compartido, no duplicar la consulta). Respuesta de ~40 bytes, `Cache-Control: public, max-age=300` — es público y cambia una vez al año.

- [ ] **Step 4: Verificar que pasa**

Run: `php artisan test --filter=AuthProvidersTest` → PASS.

- [ ] **Step 5: Consumirlo desde el CRM**

`isSocialLoginEnabled()` pasa a pedir `auth/providers`. **Mantener el estado de error con Reintentar** que ya tiene `login.tsx`: hoy, si la petición falla, el botón sencillamente no aparece y el agente no sabe por qué.

- [ ] **Step 6: Commit**

Dos commits, un repo cada uno.

```bash
# panel
./vendor/bin/pint --dirty && git add routes app tests
git commit -m "feat(api): endpoint mínimo de proveedores de acceso"
# crm
git add src/lib/crm/settings.ts src/routes/login.tsx
git commit -m "perf(login): leer la bandera de Google del endpoint mínimo"
```

---

## Task 17: Caché de datos entre rutas

**Files:**
- Modify: `src/lib/use-resource.ts`
- Create: `src/lib/resource-cache.ts` + `.test.ts`

`use-resource.ts` es un `useEffect` pelado: cada montaje vuelve a pedir. Volver de un lead a la lista recarga la lista entera y se ve el esqueleto otra vez.

**Alcance:** un `Map` a nivel de módulo con clave y `staleTime`, dentro de `useResource`. **No** entra TanStack Query: son ~13 KB y una migración de las 18 pantallas para lo que aquí son 40 líneas. Si más adelante hacen falta mutaciones optimistas y sincronización de ventanas, esa es la conversación para cambiar de opinión.

- [ ] **Step 1: Escribir el test que falla**

```ts
test('una entrada fresca se sirve sin volver a pedir', () => {
  const cache = new ResourceCache()
  cache.set('leads', { items: [] }, 1000)
  expect(cache.get('leads', 1100, 30_000)).toEqual({ items: [] })
})

test('una entrada rancia se ignora', () => {
  const cache = new ResourceCache()
  cache.set('leads', { items: [] }, 1000)
  expect(cache.get('leads', 40_000, 30_000)).toBeNull()
})

test('invalidate borra por prefijo: publicar una propiedad caduca sus listas', () => {
  const cache = new ResourceCache()
  cache.set('properties?page=1', { items: [] }, 1000)
  cache.set('properties?page=2', { items: [] }, 1000)
  cache.set('leads', { items: [] }, 1000)
  cache.invalidate('properties')
  expect(cache.get('properties?page=1', 1100, 30_000)).toBeNull()
  expect(cache.get('leads', 1100, 30_000)).not.toBeNull()
})
```

- [ ] **Step 2: Ejecutar y verificar que falla** → FAIL.

- [ ] **Step 3: Implementar** `ResourceCache` (get/set/invalidate por prefijo), `staleTime` de 30 s por defecto.

- [ ] **Step 4: Verificar que pasa** → PASS.

- [ ] **Step 5: Cablear en `useResource`**

`useResource(fetcher, deps, { key })`. Con clave y entrada fresca: pintar de
inmediato y revalidar en segundo plano (`stale-while-revalidate`). Sin clave:
comportamiento de hoy, **intacto**.

**Hay 37 llamadas a `useResource` en el árbol.** El tercer parámetro es
opcional y la rama sin clave no debe tocar la caché en absoluto —ni leer ni
escribir—, de modo que 37 sitios sigan comportándose exactamente igual y las
claves se añadan de una en una, pantalla a pantalla, cada una con su propia
verificación. Migrarlas todas en este commit convierte un fallo de caché en 37
regresiones a la vez.

Empezar por dos: `/leads` y `/properties`. Son las que más se visitan y las que
motivaron el hallazgo.

**Invalidar tras escribir**: publicar propiedad, mover lead, completar tarea. Sin esto, la caché es un bug: el agente publica y no ve su anuncio.

- [ ] **Step 6: Verificación manual**

Leads → un lead → atrás: la lista aparece al instante, sin esqueleto. Publicar
una propiedad: **aparece arriba de la lista** (si no, falta la invalidación y la
caché es un bug, no una mejora). Esperar 30 s y volver: revalida. Y una pantalla
que no se haya migrado —Tareas, por ejemplo— sigue comportándose como antes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/resource-cache.ts src/lib/resource-cache.test.ts src/lib/use-resource.ts src/routes
git commit -m "perf: caché de 30s con revalidación en segundo plano entre rutas"
```

---

## Task 18: PWA básica

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`
- Modify: `index.html`

Última por una razón: sin las 17 anteriores, instalar el shell solo hace que un CRM incómodo tenga icono propio.

- [ ] **Step 1: Manifest e iconos**

`name`, `short_name: "RentaFácil"`, `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` = `#f5f5f4` y `#087c7c` (los del `index.css`), iconos 192 y 512 `maskable`. Generar desde `public/logo.svg`.

- [ ] **Step 2: Enlazar en `index.html`**

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#087c7c" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

- [ ] **Step 3: Sin service worker**

Deliberado, y hay que escribirlo en el README. §8 de la auditoría lo dice: no cachear leads ni teléfonos sin una política explícita de expiración y borrado al cerrar sesión. Un SW que cachea `/api` filtra la cartera de un asesor al siguiente que use el teléfono. Un SW que no cachea `/api` no aporta nada que la Task 15 no dé ya.

- [ ] **Step 4: Verificación manual**

Chrome Android → menú → «Instalar app»: se instala, abre sin barra de URL, el color de la barra de estado es el de marca. Lighthouse → Installable: verde.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.webmanifest public/icon-192.png public/icon-512.png index.html README.md
git commit -m "feat(pwa): manifest e iconos, sin service worker"
```

---

# Regresión final

- [ ] Samsung Galaxy S24 Ultra / Chrome — recorrido completo con datos: crear propiedad y proyecto de punta a punta (tipologías, unidades, imágenes, ubicación, precios, disponibilidad), mover un lead, completar una tarea, buscar una propiedad.
- [ ] iPhone reciente / Safari — el mismo recorrido, más el login por redirect.
- [ ] 320 px y tamaño de texto aumentado al 200 %.
- [ ] Cero scroll horizontal del `body` en 320/360/390/412/768.
- [ ] `web-vitals` en producción por ruta y tipo de dispositivo: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 en p75.

## Cobertura de la auditoría

| # | Hallazgo | Tarea |
|---|---|---|
| P0 | Mapa roto | 1 |
| P0 | Pipeline no táctil | 5 |
| P0 | Controles y texto pequeños | 3 |
| P0 | Login Google por popup | 4 |
| P0 | Alta sin borrador | 8 |
| P0 | Publicar con obligatorios vacíos | 2 |
| P1 | Menú empuja la pantalla | 6 |
| P1 | Navegación diaria escondida | 6 |
| P1 | Agencia no autorizada | 7 |
| P1 | Agencia no adaptada | 10 |
| P1 | Mapa poco práctico | 12 |
| P1 | Filtros en varias filas | 13 |
| P1 | Recursos innecesarios al entrar | 14 |
| P1 | Caché estática sin política | 15 |
| P1 | Endpoint excesivo para Google | 16 |
| P2 | Sin caché entre rutas | 17 |
| P2 | Checkboxes difíciles de tocar | 9 |
| P2 | Error final poco guiado | 2 (paso 6) |
| P2 | Cabecera saturada | 13 (paso 2) |
| P2 | No es instalable | 18 |
| §5 | Fotos frágiles en móvil | 11 |

## Fuera de alcance, con motivo

- **«Paqueo Sin Techo»** — no es código: es el `name` guardado en `parameters` (`database/data/production_export.php:862`), y `2026_07_15_000005` lo documenta como *«confirmed typo, matches stored parameter name»*. Se arregla con un UPDATE en datos, y hay que revisar antes qué consulta ese nombre.
- **`agency_id NOT NULL`** — se intentó y se revirtió: `2026_08_31_000004` falló en producción (MySQL 1832) y `2026_09_01_000001` la devolvió a nullable. Documentado en `AgencyContext.php:165`. Quien consulte por `agency_id` cuenta con el NULL.
- **Borrador en backend** — Task 8 lo deja en local, con el motivo escrito allí.
- **TanStack Query** — Task 17, ídem.
- **Service worker** — Task 18, paso 3.
