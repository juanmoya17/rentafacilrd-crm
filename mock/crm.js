/**
 * Fixture server for the CRM endpoints — NOT a reimplementation of the API.
 *
 * It returns rows already shaped like CrmLeadResource and filters them, which is
 * all the screens need to be developable offline. It deliberately does not
 * reproduce the business rules (SLA clock, closed_at bookkeeping, 409s on the
 * unique indexes): those live in Laravel and are covered by its tests. Anything
 * that matters is verified against the real API, never here.
 */

const HOUR = 3_600_000
const DAY = 86_400_000
const at = (offset) => new Date(Date.now() + offset).toISOString()

const band = (score) =>
  score >= 80 ? 'hot' : score >= 60 ? 'warm' : score >= 40 ? 'mild' : 'cold'

const contacts = [
  { id: 1, name: 'María Peralta', email: 'maria.peralta@example.do', phone: '+1 809 555 0142', customer_id: 101 },
  { id: 2, name: 'José Ramírez', email: 'jramirez@example.do', phone: '+1 829 555 0187', customer_id: 102 },
  { id: 3, name: 'Ana Michel Cruz', email: 'ana.cruz@example.do', phone: '+1 809 555 0119', customer_id: 103 },
  { id: 4, name: 'Luis Fernández', email: 'lfernandez@example.do', phone: '+1 849 555 0163', customer_id: 104 },
  { id: 5, name: 'Carolina Batista', email: 'cbatista@example.do', phone: '+1 809 555 0155', customer_id: 105 },
  { id: 6, name: 'Pedro Objío', email: 'pobjio@example.do', phone: '+1 829 555 0171', customer_id: 106 },
  { id: 7, name: 'Rosa Guzmán', email: 'rguzman@example.do', phone: '+1 809 555 0128', customer_id: 107 },
  { id: 8, name: 'Frank Then', email: 'fthen@example.do', phone: '+1 849 555 0192', customer_id: 108 },
  { id: 9, name: 'Yamilet Reyes', email: 'yreyes@example.do', phone: '+1 809 555 0134', customer_id: 109 },
  { id: 10, name: 'Ramón Castillo', email: 'rcastillo@example.do', phone: '+1 829 555 0146', customer_id: 110 },
  { id: 11, name: 'Alejandra Nin', email: 'anin@example.do', phone: '+1 809 555 0177', customer_id: 111 },
  { id: 12, name: 'Héctor Made', email: 'hmade@example.do', phone: '+1 849 555 0158', customer_id: 112 },
]

const seedLeads = [
  [1, 1, 'RF0412', 'Apartamento en Piantini', 'new', 'price_drop', 92, at(4 * HOUR), null, at(-2 * HOUR)],
  [2, 2, 'RF0288', 'Local comercial en Naco', 'new', 'whatsapp', 71, at(-3 * HOUR), null, at(-2 * DAY)],
  [3, 3, 'RF0913', 'Villa en Punta Cana', 'visit', 'saved_search', 55, null, at(-8 * DAY), at(-6 * HOUR)],
  [4, 4, 'RF0412', 'Apartamento en Piantini', 'contacted', 'favorite', 78, null, at(-4 * DAY), at(-1 * DAY)],
  [5, 5, 'RF0755', 'Penthouse en Bella Vista', 'negotiation', 'direct', 88, null, at(-21 * DAY), at(-4 * HOUR)],
  [6, 6, 'RF0640', 'Casa en Arroyo Hondo', 'contacted', 'shared', 46, null, at(-10 * DAY), at(-3 * DAY)],
  [7, 7, 'RF0288', 'Local comercial en Naco', 'new', 'direct', 34, at(11 * HOUR), null, at(-30 * 60_000)],
  [8, 8, 'RF1024', 'Apartamento en Evaristo Morales', 'visit', 'saved_search', 63, null, at(-5 * DAY), at(-8 * HOUR)],
  [9, 9, 'RF0755', 'Penthouse en Bella Vista', 'won', 'favorite', 95, null, at(-39 * DAY), at(-2 * DAY)],
  [10, 10, 'RF0640', 'Casa en Arroyo Hondo', 'lost', 'whatsapp', 22, null, at(-37 * DAY), at(-15 * DAY)],
  [11, 11, 'RF0913', 'Villa en Punta Cana', 'negotiation', 'price_drop', 81, null, at(-26 * DAY), at(-12 * HOUR)],
  [12, 12, 'RF1024', 'Apartamento en Evaristo Morales', 'contacted', 'direct', 58, null, at(-7 * DAY), at(-2 * DAY)],
]

// Reuses the titles/cities/sectors/prices from src/lib/mock/data.ts's PROPERTIES
// (the old camelCase mock), reshaped to the real snake_case API response —
// see CrmProperty in src/lib/crm/types.ts. Two rows (RF1024, RF0821) are
// pushed into `rented` and `expired`: those two lifecycle states are new in
// the 7-value union and exist nowhere in the old mock, so nothing else
// exercises them. RF0821 also carries operation:null (a project-style
// listing) to cover the render-nothing branch.
/**
 * Placeholder photos.
 *
 * There is no photo store in the fixture, and dropping real estate
 * photography in here would make the mock look like a finished product — the
 * layout would be validated against pictures that will never exist. So each
 * "photo" is a generated SVG that says what it is: same aspect ratio, same
 * loading behaviour, no pretence. Deterministic off the code, so a listing's
 * gallery does not reshuffle on reload.
 *
 * Production sends real URLs from the media store; nothing downstream cares
 * which it got.
 */
function placeholderPhotos(code, count) {
  // A plain char-code sum collapses: every code is RF plus four digits, so the
  // sums land within a few dozen of each other and every listing came out the
  // same shade of pink. Weighting by position spreads them across the wheel.
  const seed = [...code].reduce(
    (hash, character, position) => hash + character.charCodeAt(0) * (position + 1) * 7,
    0,
  )
  return Array.from({ length: count }, (_, index) => {
    const hue = (seed + index * 53) % 360
    // The label is centred, not corner-set, because these are rendered with
    // `object-cover` into 16/9 cards, 4/3 frames and square thumbs — a
    // corner-anchored caption is cropped away by two of the three. Centre
    // survives any centre-crop.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">` +
      `<rect width="800" height="600" fill="hsl(${hue} 24% 87%)"/>` +
      `<rect y="400" width="800" height="200" fill="hsl(${hue} 22% 80%)"/>` +
      `<circle cx="150" cy="130" r="52" fill="hsl(${hue} 30% 92%)"/>` +
      `<text x="400" y="292" text-anchor="middle" font-family="ui-monospace,monospace"` +
      ` font-size="46" fill="hsl(${hue} 20% 38%)">${code}</text>` +
      `<text x="400" y="336" text-anchor="middle" font-family="ui-monospace,monospace"` +
      ` font-size="26" fill="hsl(${hue} 16% 48%)">${index + 1} / ${count} · placeholder</text>` +
      `</svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  })
}

/**
 * City centres, WGS84, with a deterministic per-listing offset so pins do not
 * stack on one point. ±0.02° is roughly ±2km — enough to read as "spread
 * across the city" at the zoom the map view opens on.
 */
const CITY_CENTRES = {
  1: [18.4861, -69.9312], // Santo Domingo
  2: [18.5601, -68.3725], // Punta Cana
  3: [19.4517, -70.697], // Santiago
}

function seedCoordinates(id, cityId) {
  const centre = CITY_CENTRES[cityId]
  if (centre === undefined) return { lat: null, lng: null }
  return {
    lat: centre[0] + (((id * 37) % 41) - 20) / 1000,
    lng: centre[1] + (((id * 53) % 41) - 20) / 1000,
  }
}

const seedProperties = [
  { id: 1, code: 'RF0412', title: 'Apartamento en Piantini', city: 'Santo Domingo', city_id: 1, price: 14_500_000, area: 210, bedrooms: 3, bathrooms: 3, lifecycle: 'published', operation: 'sell', moderation: 'approved', leads_count: 2, unanswered_leads: 1, featured_expires_at: at(2 * DAY), created_at: at(-60 * DAY) },
  { id: 2, code: 'RF0288', title: 'Local comercial en Naco', city: 'Santo Domingo', city_id: 1, price: 95_000, area: 180, bedrooms: null, bathrooms: 2, lifecycle: 'published', operation: 'rent', moderation: 'approved', leads_count: 2, unanswered_leads: 2, featured_expires_at: null, created_at: at(-45 * DAY) },
  { id: 3, code: 'RF0913', title: 'Villa en Punta Cana', city: 'Punta Cana', city_id: 2, price: 27_900_000, area: 420, bedrooms: 4, bathrooms: 5, lifecycle: 'published', operation: 'sell', moderation: 'approved', leads_count: 2, unanswered_leads: 0, featured_expires_at: at(9 * DAY), created_at: at(-90 * DAY) },
  { id: 4, code: 'RF0755', title: 'Penthouse en Bella Vista', city: 'Santo Domingo', city_id: 1, price: 18_400_000, area: 265, bedrooms: 3, bathrooms: 4, lifecycle: 'sold', operation: 'sell', moderation: 'approved', leads_count: 2, unanswered_leads: 0, featured_expires_at: null, created_at: at(-120 * DAY) },
  { id: 5, code: 'RF0640', title: 'Casa en Arroyo Hondo', city: 'Santo Domingo', city_id: 1, price: 11_200_000, area: 310, bedrooms: 4, bathrooms: 3, lifecycle: 'paused', operation: 'sell', moderation: 'approved', leads_count: 2, unanswered_leads: 0, featured_expires_at: null, created_at: at(-75 * DAY) },
  { id: 6, code: 'RF1024', title: 'Apartamento en Evaristo Morales', city: 'Santo Domingo', city_id: 1, price: 68_000, area: 120, bedrooms: 2, bathrooms: 2, lifecycle: 'rented', operation: 'rent', moderation: 'approved', leads_count: 2, unanswered_leads: 0, featured_expires_at: null, created_at: at(-30 * DAY) },
  // bedrooms/bathrooms null, not 0: a plot has no EAV rows for either, and
  // PropertySpecs.php:66 maps that absence to null on purpose so nothing
  // states "0 habitaciones" about land. This is the row that exercises
  // formatSpecs's null branch (and property-detail's em dash) in dev.
  { id: 7, code: 'RF1108', title: 'Solar en Santiago', city: 'Santiago', city_id: 3, price: 4_800_000, area: 800, bedrooms: null, bathrooms: null, lifecycle: 'rejected', operation: 'sell', moderation: 'rejected', leads_count: 0, unanswered_leads: 0, featured_expires_at: null, created_at: at(-12 * DAY) },
  // pending_ad (mock-only, not on the wire — see openAdPropertyIds below):
  // an ad was requested but is not yet approved, so it has no end_date and
  // no star, same as an unfeatured row from featured_expires_at alone.
  { id: 8, code: 'RF1130', title: 'Apartamento en Bávaro', city: 'Punta Cana', city_id: 2, price: 55_000, area: 96, bedrooms: 2, bathrooms: 2, lifecycle: 'draft', operation: 'rent', moderation: 'pending', leads_count: 0, unanswered_leads: 0, featured_expires_at: null, pending_ad: true, created_at: at(-3 * DAY) },
  { id: 9, code: 'RF0821', title: 'Apartamento en Gazcue', city: 'Santo Domingo', city_id: 1, price: 9_600_000, area: 140, bedrooms: 2, bathrooms: 2, lifecycle: 'expired', operation: null, moderation: 'approved', leads_count: 1, unanswered_leads: 0, featured_expires_at: null, created_at: at(-100 * DAY) },
]

const state = {
  contacts,
  properties: seedProperties,
  // Small on purpose (spec: "keep a small mock balance") — nine seed rows is
  // enough ids to exceed either quota in one batch call and hit the 409s.
  featureBalance: { total: 3, unlimited: false },
  publishSlots: 3,
  leads: seedLeads.map(
    ([id, contactId, code, title, stage, origin, score, slaDueAt, firstResponseAt, lastActivityAt]) => ({
      id,
      contact_id: contactId,
      property_id: id,
      property_code: code,
      property_title: title,
      property_slug: code.toLowerCase(),
      stage,
      origin,
      score,
      sla_due_at: slaDueAt,
      first_response_at: firstResponseAt,
      last_activity_at: lastActivityAt,
      closed_at: stage === 'won' || stage === 'lost' ? at(-1 * DAY) : null,
      created_at: at(-30 * DAY),
    }),
  ),
  activities: [
    { id: 1, lead_id: 1, type: 'message', body: 'Vi que bajó de precio, ¿sigue disponible para visitar este fin de semana?', occurred_at: at(-2 * HOUR), author_id: null },
    { id: 2, lead_id: 1, type: 'note', body: 'Llegó por notificación de bajada de precio. Etiquetar como caliente.', occurred_at: at(-2 * HOUR), author_id: 42 },
    { id: 3, lead_id: 3, type: 'visit', body: 'Visita realizada. Le gustó la terraza, preguntó por el mantenimiento.', occurred_at: at(-6 * HOUR), author_id: 42 },
    { id: 4, lead_id: 5, type: 'message', body: 'Enviada la oferta formal por RD$ 18,400,000.', occurred_at: at(-4 * HOUR), author_id: 42 },
  ],
  tasks: [
    { id: 1, lead_id: 3, title: 'Seguimiento post-visita — Ana Michel Cruz', due_at: at(18 * HOUR), remind_at: null, done_at: null },
    { id: 2, lead_id: 2, title: 'Responder a José Ramírez (SLA vencido)', due_at: at(-3 * HOUR), remind_at: null, done_at: null },
    { id: 3, lead_id: 5, title: 'Confirmar contraoferta con Carolina Batista', due_at: at(2 * DAY), remind_at: null, done_at: null },
    { id: 4, lead_id: 8, title: 'Coordinar segunda visita con Frank Then', due_at: at(3 * DAY), remind_at: null, done_at: null },
    { id: 5, lead_id: null, title: 'Renovar destacado de RF0412', due_at: at(2 * DAY), remind_at: null, done_at: null },
    { id: 6, lead_id: 11, title: 'Enviar planos a Alejandra Nin', due_at: at(-1 * DAY), remind_at: null, done_at: at(-20 * HOUR) },
  ],
  nextId: 100,
}

const isBreached = (lead) =>
  lead.sla_due_at !== null && lead.first_response_at === null && new Date(lead.sla_due_at) < new Date()

const isOverdueTask = (task) => task.done_at === null && new Date(task.due_at) < new Date()

function shapeLead(lead, { withTimeline = false } = {}) {
  const contact = state.contacts.find((c) => c.id === lead.contact_id) ?? null
  const shaped = {
    id: lead.id,
    stage: lead.stage,
    origin: lead.origin,
    score: lead.score,
    score_band: band(lead.score),
    contact,
    property_id: lead.property_id,
    property_title: lead.property_title,
    property_slug: lead.property_slug,
    sla_due_at: lead.sla_due_at,
    first_response_at: lead.first_response_at,
    is_sla_breached: isBreached(lead),
    last_activity_at: lead.last_activity_at,
    closed_at: lead.closed_at,
    created_at: lead.created_at,
  }

  if (withTimeline) {
    shaped.activities = state.activities
      .filter((a) => a.lead_id === lead.id)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    shaped.tasks = state.tasks
      .filter((t) => t.lead_id === lead.id)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
  }

  return shaped
}

const shapeTask = (task) => ({
  ...task,
  is_done: task.done_at !== null,
  is_overdue: isOverdueTask(task),
})

const paginate = (rows, params) => {
  const offset = Number(params.get('offset') ?? 0)
  const limit = Number(params.get('limit') ?? 20)
  return rows.slice(offset, offset + limit)
}

// ----------------------------------------------------------------- properties
const EXPIRY_WINDOW = 3 * DAY

const isExpiringFeatured = (property) => {
  if (property.featured_expires_at === null) return false
  const remaining = new Date(property.featured_expires_at).getTime() - Date.now()
  return remaining >= 0 && remaining < EXPIRY_WINDOW
}

/**
 * Photo count per listing. Default 5; the two exceptions are the point.
 * RF1130 is a draft with none — a listing with no photos yet is the normal
 * state, not an error, and it is what the empty-gallery branch is for.
 * RF1108 is a plot, which realistically gets two shots of dirt.
 */
const PHOTO_COUNTS = { RF1130: 0, RF1108: 2 }

/**
 * RF0821 is deliberately un-geocoded — an agent withholding the address until
 * a lead qualifies is a real case, so something has to exercise the null pin
 * branch on the map and the "no location" branch on the record.
 */
const UNGEOCODED = new Set(['RF0821'])

/**
 * Listing copy. Fixture prose, same standing as the fixture's titles and
 * prices. RF1130 has none — a draft the agent has not written up yet, which
 * is what the record's hidden-section branch is for.
 */
const DESCRIPTIONS = {
  RF0412:
    'Apartamento de tres habitaciones en torre con dos ascensores, planta eléctrica full y área social en el nivel 12. Piso en porcelanato, cocina modular con tope de cuarzo y dos parqueos techados. A cinco minutos de la Av. Winston Churchill.',
  RF0288:
    'Local a nivel de calle sobre avenida de alto tránsito, con vitrina corrida y baño independiente. Se entrega en obra gris terminada; el inquilino define la distribución interior. Incluye un parqueo asignado.',
  RF0913:
    'Villa de cuatro habitaciones dentro de complejo cerrado con vigilancia 24 horas, a ocho minutos de la playa. Piscina privada, gazebo con cocina exterior y cuarto de servicio independiente. Amueblada.',
  RF0755:
    'Penthouse de dos niveles con terraza propia y vista abierta al sur. Doble altura en la sala, cocina italiana y ascensor privado hasta el nivel. Cuatro parqueos y depósito en sótano.',
  RF0640:
    'Casa unifamiliar en calle cerrada, con patio de 120 m² y árboles frutales. Cuatro habitaciones, una en primer nivel con baño propio. Requiere actualización de baños; el precio ya lo refleja.',
  RF1024:
    'Apartamento de dos habitaciones en tercer nivel sin ascensor, recién pintado. Incluye línea blanca y aire acondicionado en ambas habitaciones. Un parqueo. Disponible de inmediato.',
  RF1108:
    'Solar esquinero de 800 m² con dos frentes, en zona de uso mixto. Topografía plana, sin construcciones que demoler. Servicios de agua y energía disponibles en la acera.',
  RF0821:
    'Apartamento de dos habitaciones en sector residencial consolidado, cerca de la Universidad. Edificio de cuatro niveles sin ascensor. La dirección exacta se comparte con clientes calificados.',
}

function shapeProperty(property) {
  const coordinates = UNGEOCODED.has(property.code)
    ? { lat: null, lng: null }
    : seedCoordinates(property.id, property.city_id)

  return {
    id: property.id,
    code: property.code,
    title: property.title,
    city: property.city,
    city_id: property.city_id,
    price: property.price,
    area: property.area,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    lifecycle: property.lifecycle,
    operation: property.operation,
    moderation: property.moderation,
    leads_count: property.leads_count,
    unanswered_leads: property.unanswered_leads,
    featured_expires_at: property.featured_expires_at,
    created_at: property.created_at,
    description: DESCRIPTIONS[property.code] ?? null,
    images: placeholderPhotos(property.code, PHOTO_COUNTS[property.code] ?? 5),
    lat: coordinates.lat,
    lng: coordinates.lng,
  }
}

const PROPERTY_SORTERS = {
  newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
  price_asc: (a, b) => (a.price ?? 0) - (b.price ?? 0),
  price_desc: (a, b) => (b.price ?? 0) - (a.price ?? 0),
  // No page-view counter in the fixture; leads_count is the closest proxy.
  most_viewed: (a, b) => b.leads_count - a.leads_count,
}

const paginateProperties = (rows, params) => {
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)
  const rawLimit = Number(params.get('limit') ?? 30)
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 30))
  return rows.slice(offset, offset + limit)
}

/**
 * Returns {status, body} for a CRM path, or null when the path is not ours.
 * `path` has the /api/crm prefix already stripped.
 */
export function handleCrm(method, path, params, body) {
  // -------------------------------------------------------------- properties
  if (path === '/properties/summary' && method === 'GET') {
    const rows = state.properties
    const data = {
      total: rows.length,
      published: rows.filter((p) => p.lifecycle === 'published').length,
      // Real API: CrmLead::where('stage', 'new')->count() — a lead-stage
      // count, unrelated to property.unanswered_leads (leads missing
      // first_response_at, in any stage). Approximated here as a property
      // sum for lack of a lead-level aggregate in this fixture; the two
      // numbers will not match live.
      new_leads: rows.reduce((sum, p) => sum + p.unanswered_leads, 0),
      expiring_featured: rows.filter(isExpiringFeatured).length,
      featured_balance: { ...state.featureBalance },
    }
    return { status: 200, body: { error: false, message: 'Data fetched', data, code: 200 } }
  }

  if (path === '/properties/batch' && method === 'POST') {
    const action = body.action
    const ids = Array.isArray(body.ids) ? body.ids : []

    const rows = ids.map((id) => state.properties.find((p) => p.id === id))
    if (rows.some((row) => row === undefined)) {
      return { status: 404, body: { error: true, message: 'Property not found', code: 404 } }
    }

    // All four refusals are all-or-nothing: return before mutating anything.
    if (action === 'publish') {
      const notApproved = rows.filter((p) => p.moderation !== 'approved').map((p) => p.id)
      if (notApproved.length > 0) {
        return {
          status: 409,
          body: { error: true, message: 'Some properties are not approved', data: { not_approved: notApproved }, code: 409 },
        }
      }
      const have = state.publishSlots
      if (ids.length > have) {
        return {
          status: 409,
          body: { error: true, message: 'Not enough publish slots', data: { need: ids.length, have, short: ids.length - have }, code: 409 },
        }
      }
      rows.forEach((p) => { p.lifecycle = 'published' })
      state.publishSlots -= ids.length
    } else if (action === 'feature') {
      // Real guard: PropertyAdvertisementService::openAdPropertyIds — status
      // IN (0,1), i.e. active OR pending. A pending ad has a null end_date
      // and no star, so featured_expires_at alone misses it.
      const alreadyFeatured = rows
        .filter((p) => p.featured_expires_at !== null || p.pending_ad === true)
        .map((p) => p.id)
      if (alreadyFeatured.length > 0) {
        return {
          status: 409,
          body: { error: true, message: 'Some properties are already featured', data: { already_featured: alreadyFeatured }, code: 409 },
        }
      }
      const have = state.featureBalance.total
      if (ids.length > have) {
        return {
          status: 409,
          body: { error: true, message: 'Not enough featured credits', data: { need: ids.length, have, short: ids.length - have }, code: 409 },
        }
      }
      rows.forEach((p) => { p.featured_expires_at = at(30 * DAY) })
      state.featureBalance.total -= ids.length
    } else if (action === 'pause') {
      rows.forEach((p) => { p.lifecycle = 'paused' })
    } else if (action === 'close') {
      // BulkAction::close — a sale closes as sold, a rental closes as rented.
      rows.forEach((p) => { p.lifecycle = p.operation === 'rent' ? 'rented' : 'sold' })
    } else if (action === 'delete') {
      const idSet = new Set(ids)
      state.properties = state.properties.filter((p) => !idSet.has(p.id))
    } else {
      return { status: 422, body: { error: true, message: `Unknown action "${action}"`, code: 422 } }
    }

    return { status: 200, body: { error: false, message: 'Batch applied', data: { action, affected: ids.length }, code: 200 } }
  }

  if (path === '/properties' && method === 'GET') {
    let rows = [...state.properties]

    const search = (params.get('search') ?? '').trim()
    if (search !== '') {
      // Real PropertyListQuery::parseCode matches only ^RF\d+$ exactly (then
      // looks the number up by id) and otherwise searches title/city and
      // never code — so a partial like "RF04" or a bare "0412" must NOT
      // match code as a substring. The mock's `code` isn't id-derived (it's
      // a fixture literal, not `RF`+padded id like the real API computes at
      // read time), so an exact RF#### search matches it by exact string
      // instead of by parsed id — same "exact, not substring" behaviour,
      // adapted to data that has no id<->code relationship to parse against.
      if (/^RF\d+$/i.test(search)) {
        const code = search.toUpperCase()
        rows = rows.filter((p) => p.code.toUpperCase() === code)
      } else {
        const q = search.toLowerCase()
        rows = rows.filter(
          (p) => p.title.toLowerCase().includes(q) || (p.city ?? '').toLowerCase().includes(q),
        )
      }
    }

    const lifecycle = params.get('lifecycle')
    if (lifecycle) rows = rows.filter((p) => p.lifecycle === lifecycle)

    const operation = params.get('operation')
    if (operation) rows = rows.filter((p) => p.operation === operation)

    const moderation = params.get('moderation')
    if (moderation) rows = rows.filter((p) => p.moderation === moderation)

    const isFeatured = params.get('is_featured')
    if (isFeatured === 'true') rows = rows.filter((p) => p.featured_expires_at !== null)
    if (isFeatured === 'false') rows = rows.filter((p) => p.featured_expires_at === null)

    // The KPI shortcut — same isExpiringFeatured() predicate the summary
    // count above uses, so the tile and this list agree under the mock too.
    if (params.get('featured_expiring') === 'true') rows = rows.filter(isExpiringFeatured)

    const cityId = params.get('city_id')
    if (cityId) rows = rows.filter((p) => p.city_id === Number(cityId))

    const priceMin = params.get('price_min')
    if (priceMin !== null) rows = rows.filter((p) => p.price !== null && p.price >= Number(priceMin))
    const priceMax = params.get('price_max')
    if (priceMax !== null) rows = rows.filter((p) => p.price !== null && p.price <= Number(priceMax))

    const areaMin = params.get('area_min')
    if (areaMin !== null) rows = rows.filter((p) => p.area !== null && p.area >= Number(areaMin))
    const areaMax = params.get('area_max')
    if (areaMax !== null) rows = rows.filter((p) => p.area !== null && p.area <= Number(areaMax))

    rows.sort(PROPERTY_SORTERS[params.get('sort')] ?? PROPERTY_SORTERS.newest)

    return {
      status: 200,
      body: {
        error: false,
        message: 'Data fetched',
        data: paginateProperties(rows, params).map(shapeProperty),
        code: 200,
        total: rows.length,
      },
    }
  }

  // ------------------------------------------------------------------ leads
  if (path === '/leads' && method === 'GET') {
    let rows = [...state.leads]

    const stage = params.get('stage')
    if (stage) rows = rows.filter((l) => l.stage === stage)

    const propertyId = params.get('property_id')
    if (propertyId) rows = rows.filter((l) => l.property_id === Number(propertyId))

    const origin = params.get('origin')
    if (origin) rows = rows.filter((l) => l.origin === origin)

    if (params.get('sla') === 'breached') rows = rows.filter(isBreached)
    if (params.get('open') === '1' || params.get('open') === 'true') {
      rows = rows.filter((l) => l.stage !== 'won' && l.stage !== 'lost')
    }

    const q = (params.get('q') ?? '').trim().toLowerCase()
    if (q !== '') {
      rows = rows.filter((l) => {
        const c = state.contacts.find((x) => x.id === l.contact_id)
        return (
          (c?.name ?? '').toLowerCase().includes(q) ||
          (c?.phone ?? '').includes(q) ||
          (c?.email ?? '').toLowerCase().includes(q) ||
          (l.property_code ?? '').toLowerCase().includes(q)
        )
      })
    }

    // Nulls last, newest first — same order the API returns.
    rows.sort((a, b) => {
      if (a.last_activity_at === null) return 1
      if (b.last_activity_at === null) return -1
      return new Date(b.last_activity_at) - new Date(a.last_activity_at)
    })

    return {
      status: 200,
      body: { error: false, data: paginate(rows, params).map((l) => shapeLead(l)), total: rows.length },
    }
  }

  const leadDetail = path.match(/^\/leads\/(\d+)$/)
  if (leadDetail) {
    const lead = state.leads.find((l) => l.id === Number(leadDetail[1]))
    if (!lead) return { status: 404, body: { error: true, message: 'Lead not found' } }

    if (method === 'GET') {
      return { status: 200, body: { error: false, data: shapeLead(lead, { withTimeline: true }) } }
    }
    if (method === 'PATCH') {
      lead.stage = body.stage ?? lead.stage
      lead.closed_at = ['won', 'lost'].includes(lead.stage) ? new Date().toISOString() : null
      lead.last_activity_at = new Date().toISOString()
      return { status: 200, body: { error: false, data: shapeLead(lead, { withTimeline: true }) } }
    }
  }

  const leadActivities = path.match(/^\/leads\/(\d+)\/activities$/)
  if (leadActivities && method === 'POST') {
    const lead = state.leads.find((l) => l.id === Number(leadActivities[1]))
    if (!lead) return { status: 404, body: { error: true, message: 'Lead not found' } }

    const occurredAt = body.occurred_at ?? new Date().toISOString()
    state.activities.push({
      id: ++state.nextId,
      lead_id: lead.id,
      type: body.type,
      body: body.body ?? null,
      occurred_at: occurredAt,
      author_id: 42,
    })
    lead.last_activity_at = occurredAt
    if (lead.first_response_at === null && body.type !== 'note') {
      lead.first_response_at = occurredAt
    }
    return { status: 200, body: { error: false, data: shapeLead(lead, { withTimeline: true }) } }
  }

  // ------------------------------------------------------------------ tasks
  if (path === '/tasks' && method === 'GET') {
    let rows = [...state.tasks]
    const status = params.get('status')
    if (status === 'pending') rows = rows.filter((t) => t.done_at === null)
    if (status === 'done') rows = rows.filter((t) => t.done_at !== null)
    if (status === 'overdue') rows = rows.filter(isOverdueTask)
    const leadId = params.get('lead_id')
    if (leadId) rows = rows.filter((t) => t.lead_id === Number(leadId))

    rows.sort((a, b) => new Date(a.due_at) - new Date(b.due_at))

    return {
      status: 200,
      body: { error: false, data: paginate(rows, params).map(shapeTask), total: rows.length },
    }
  }

  if (path === '/tasks' && method === 'POST') {
    const task = {
      id: ++state.nextId,
      lead_id: body.lead_id ?? null,
      title: body.title,
      due_at: body.due_at,
      remind_at: body.remind_at ?? null,
      done_at: null,
    }
    state.tasks.push(task)
    return { status: 200, body: { error: false, data: shapeTask(task) } }
  }

  const taskDetail = path.match(/^\/tasks\/(\d+)$/)
  if (taskDetail && method === 'PATCH') {
    const task = state.tasks.find((t) => t.id === Number(taskDetail[1]))
    if (!task) return { status: 404, body: { error: true, message: 'Task not found' } }

    if ('title' in body) task.title = body.title
    if ('due_at' in body) task.due_at = body.due_at
    if ('is_done' in body) task.done_at = body.is_done ? (task.done_at ?? new Date().toISOString()) : null

    return { status: 200, body: { error: false, data: shapeTask(task) } }
  }

  // ------------------------------------------------------------ action rail
  if (path === '/action-rail' && method === 'GET') {
    // Same predicates and the same seed rows the properties/leads/tasks
    // endpoints above already use, so the rail can never disagree with the
    // lists its buckets link to.
    const counts = {
      rejected: state.properties.filter((p) => p.lifecycle === 'rejected').length,
      expiring_featured: state.properties.filter(isExpiringFeatured).length,
      sla_breached: state.leads.filter(isBreached).length,
      overdue_tasks: state.tasks.filter(isOverdueTask).length,
    }

    // Omitted, not zeroed — the real endpoint's whole point.
    const buckets = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, count }))

    // Sum of all four, including the omitted ones, so total > 0 is the one
    // check a client needs for "is there anything pending at all".
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

    return {
      status: 200,
      body: { error: false, message: 'Action rail fetched', data: { buckets, total }, code: 200 },
    }
  }

  // --------------------------------------------------------------- contacts
  if (path === '/contacts' && method === 'GET') {
    let rows = [...state.contacts]
    const q = (params.get('q') ?? '').trim().toLowerCase()
    if (q !== '') {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').includes(q) ||
          (c.email ?? '').toLowerCase().includes(q),
      )
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { status: 200, body: { error: false, data: paginate(rows, params), total: rows.length } }
  }

  return null
}
