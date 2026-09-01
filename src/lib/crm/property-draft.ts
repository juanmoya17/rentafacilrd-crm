import type {
  FacilityDistances,
  ParameterValues,
  PropertyForm,
  PropertyStep,
  TranslationValues,
} from './create-property'

/**
 * The eight-step listing wizard, kept across a reload.
 *
 * Local only, deliberately. A backend draft means a table, endpoints, an
 * expiry policy and cross-device merging, and it solves none of the case that
 * actually loses work: same phone, same session, an incoming call or a tab the
 * OS reclaimed. If continuing on another device ever comes up, that is when to
 * build it.
 *
 * Photos are NOT here — see droppedFiles. They are the other half of the
 * problem and they belong to the upload-on-pick change, not to this one.
 */
export interface PropertyDraft {
  form: PropertyForm
  parameters: ParameterValues
  facilities: FacilityDistances
  translations: TranslationValues
  step: PropertyStep | 'review'
}

export interface RestoredDraft extends PropertyDraft {
  savedAt: number
  /** A File parameter was left behind and has to be attached again. */
  droppedFiles: boolean
}

export const DRAFT_KEY = 'rf.property-draft'

/**
 * Bumped whenever PropertyForm changes shape. A draft from an older build
 * restores fields that no longer exist and misses ones that now do, which
 * surfaces as a form that looks filled and fails validation for reasons the
 * agent cannot see.
 */
const VERSION = 1

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * A File cannot survive JSON — `JSON.stringify(new File(...))` is `{}` — and an
 * empty object restored into a file parameter reads as filled to everything
 * downstream. Dropped on the way out and reported on the way back in.
 */
function withoutFiles(parameters: ParameterValues): {
  kept: ParameterValues
  dropped: boolean
} {
  const entries = Object.entries(parameters)
  const kept = entries.filter(([, value]) => !(value instanceof File))

  return {
    kept: Object.fromEntries(kept) as ParameterValues,
    dropped: kept.length !== entries.length,
  }
}

export function serializeDraft(draft: PropertyDraft, savedAt: number): string {
  const { kept, dropped } = withoutFiles(draft.parameters)

  return JSON.stringify({ ...draft, parameters: kept, droppedFiles: dropped, version: VERSION, savedAt })
}

/**
 * `null` for anything unusable: absent, corrupt, from another build, or stale.
 * Never throws — this runs on the first render of the wizard, and a screen that
 * will not mount is a worse outcome than a draft that is quietly forgotten.
 */
export function readDraft(raw: string | null, now: number): RestoredDraft | null {
  if (raw === null || raw === '') return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const draft = parsed as Partial<RestoredDraft> & { version?: number }
    if (draft.version !== VERSION) return null
    if (typeof draft.savedAt !== 'number' || now - draft.savedAt > MAX_AGE_MS) return null
    if (typeof draft.form !== 'object' || draft.form === null) return null

    return {
      form: draft.form,
      parameters: draft.parameters ?? {},
      facilities: draft.facilities ?? {},
      translations: draft.translations ?? {},
      step: draft.step ?? 'category',
      savedAt: draft.savedAt,
      droppedFiles: draft.droppedFiles === true,
    }
  } catch {
    return null
  }
}

/** Storage throws in private mode and under "block all site data". */
export function loadDraft(now: number): RestoredDraft | null {
  try {
    return readDraft(window.localStorage.getItem(DRAFT_KEY), now)
  } catch {
    return null
  }
}

export function saveDraft(draft: PropertyDraft, now: number): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, serializeDraft(draft, now))
  } catch {
    // Full quota or blocked storage. Autosave is a safety net; failing to set
    // it must never interrupt someone in the middle of the form.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to clear if it was never writable.
  }
}
