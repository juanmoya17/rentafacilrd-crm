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

const state = {
  contacts,
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
  is_overdue: task.done_at === null && new Date(task.due_at) < new Date(),
})

const paginate = (rows, params) => {
  const offset = Number(params.get('offset') ?? 0)
  const limit = Number(params.get('limit') ?? 20)
  return rows.slice(offset, offset + limit)
}

/**
 * Returns {status, body} for a CRM path, or null when the path is not ours.
 * `path` has the /api/crm prefix already stripped.
 */
export function handleCrm(method, path, params, body) {
  // ------------------------------------------------------------------ leads
  if (path === '/leads' && method === 'GET') {
    let rows = [...state.leads]

    const stage = params.get('stage')
    if (stage) rows = rows.filter((l) => l.stage === stage)

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
    if (status === 'overdue') {
      rows = rows.filter((t) => t.done_at === null && new Date(t.due_at) < new Date())
    }
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
