import { api } from '@/lib/api'
import type { Envelope } from './api'
import { EMPTY_PROJECT_FORM, type ProjectForm } from './create-project'
import type { ProjectStage } from './projects'

/**
 * Editing a project from the CRM — `POST /api/post_project` with an `id`.
 *
 * `post_project` is an upsert. Its create branch requires seven fields and
 * consumes a `project_list` slot through `HelperService::updatePackageLimit`;
 * its update branch requires only `title` and skips the limit entirely, so
 * correcting a typo does not cost an agent a listing slot.
 *
 * The prefill reads `GET crm/projects/{id}`, which returns the agent's own
 * record with ownership as the only check.
 *
 * It first read the public `get-project-detail`, and that was wrong: the
 * endpoint filters `publiclyVisible()` and runs a PROJECT_ACCESS package gate,
 * so it answered `data: null` for exactly the projects an edit form exists to
 * fix — the ones still waiting on approval. The CRM's own list endpoint is no
 * good either; `ProjectResource` projects a card (title, image, city, stage,
 * prices, unit counts) and a form needs description, category, state/country,
 * the map pin, video and the meta block.
 */

const STAGES: ProjectStage[] = ['upcoming', 'under_process']

/** The slice of the project model the form prefills from. */
interface ProjectDetailRow {
  id: number
  title?: string | null
  description?: string | null
  category_id?: number | string | null
  type?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  location?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  video_link?: string | null
  slug_id?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  image?: string | null
}

export interface ProjectEditSource {
  form: ProjectForm
  /** Whatever cover the record already carries, so the field can say so. */
  image: string | null
}

/** Every field is a string in the form: an emptied input has to stay
 *  distinguishable from a zero all the way to the payload. */
const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

export function toProjectForm(row: ProjectDetailRow): ProjectForm {
  return {
    ...EMPTY_PROJECT_FORM,
    title: text(row.title),
    description: text(row.description),
    category_id: text(row.category_id),
    // `type` is the agent-controlled stage, frozen to these two by phase 4.
    // Anything else on the record is not a stage and must not be offered back
    // as if the select could round-trip it.
    type: STAGES.includes(text(row.type) as ProjectStage)
      ? (text(row.type) as ProjectStage)
      : 'upcoming',
    country: text(row.country),
    state: text(row.state),
    city: text(row.city),
    location: text(row.location),
    latitude: text(row.latitude),
    longitude: text(row.longitude),
    video_link: text(row.video_link),
    slug_id: text(row.slug_id),
    meta_title: text(row.meta_title),
    meta_description: text(row.meta_description),
    meta_keywords: text(row.meta_keywords),
  }
}

export async function fetchProjectForEdit(
  projectId: number,
  signal?: AbortSignal,
): Promise<ProjectEditSource | null> {
  const response = await api<Envelope<ProjectDetailRow | null>>(
    `crm/projects/${projectId}`,
    { signal },
  )

  const row = response.data
  if (row === undefined || row === null) return null

  return { form: toProjectForm(row), image: row.image ?? null }
}

export async function updateProject(projectId: number, body: FormData): Promise<void> {
  // The id is what turns the upsert into an update. Appended here rather than
  // in projectPayload() so the create path cannot acquire one by accident.
  body.append('id', String(projectId))

  await api<Envelope<unknown>>('post_project', { method: 'POST', body })
}
