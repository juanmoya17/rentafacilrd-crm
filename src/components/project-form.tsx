import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  Button,
  Card,
  ErrorState,
  Field,
  FileField,
  LinkButton,
  LoadingState,
  PageHeader,
  Select,
  TextArea,
} from '@/components/ui'
import { LocationPicker } from '@/components/location-picker'
import { reverseGeocode, type Place } from '@/lib/google-maps'
import { useResource } from '@/lib/use-resource'
import { fetchCategories } from '@/lib/crm/reference'
import {
  EMPTY_PROJECT_MEDIA,
  projectPayload,
  validateProject,
  type ProjectField,
  type ProjectForm,
  type ProjectMedia,
} from '@/lib/crm/create-project'
import type { ProjectStage } from '@/lib/crm/projects'

/**
 * The project field set, shared by the create and edit screens.
 *
 * Extracted from project-new.tsx rather than copied: the two screens post to
 * the same upsert (`post_project`), so a field added to one and forgotten in
 * the other is a field an agent can set but never correct.
 *
 * The two screens differ in exactly three ways, which is why those are props:
 * the cover image is required on create and optional on edit (the record
 * already has one), the submit label differs, and edit shows what the current
 * cover is so the agent knows they are replacing rather than adding.
 */

const STAGES: ProjectStage[] = ['upcoming', 'under_process']

export interface ProjectFormViewProps {
  title: string
  subtitle: string
  initialForm: ProjectForm
  /** Filename of the cover already on the record. Edit only. */
  currentImage?: string | null
  requireImage: boolean
  submitLabel: string
  onSubmit: (body: FormData) => Promise<void>
  onCancel: () => void
}

export function ProjectFormView({
  title,
  subtitle,
  initialForm,
  currentImage = null,
  requireImage,
  submitLabel,
  onSubmit,
  onCancel,
}: ProjectFormViewProps) {
  const { t } = useI18n()
  const categories = useResource((signal) => fetchCategories(signal), [])

  const [form, setForm] = useState<ProjectForm>(initialForm)
  const [media, setMedia] = useState<ProjectMedia>(EMPTY_PROJECT_MEDIA)
  const [invalid, setInvalid] = useState<ProjectField | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (categories.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (categories.status === 'error') {
    return (
      <ErrorState
        message={categories.message}
        retryLabel={t('common.retry')}
        onRetry={categories.reload}
      />
    )
  }

  const set = <K extends keyof ProjectForm>(name: K, value: ProjectForm[K]) => {
    setForm((current) => ({ ...current, [name]: value }))
    if (invalid === name) setInvalid(null)
  }

  /** A moved pin lands here. Only non-empty parts overwrite — a rural pin with
   *  no locality must not blank the city the agent typed by hand. Same rule as
   *  the property wizard's applyPlace, and the same reason. */
  const applyPlace = (place: Place) => {
    setForm((current) => ({
      ...current,
      // "Zona" is a sector, not an address: place.label is the whole formatted
      // line ("Av. Winston Churchill 1099, Santo Domingo, …") and reads as
      // nonsense in this field. Fall back to nothing rather than to the label.
      location: place.zone || current.location,
      city: place.city || current.city,
      state: place.state || current.state,
      country: place.country || current.country,
      latitude: place.lat.toFixed(7),
      longitude: place.lng.toFixed(7),
    }))
    setInvalid((current) =>
      current === 'country' || current === 'state' || current === 'city' ? null : current,
    )
  }

  const field = (name: keyof ProjectForm, label: string, helper?: string) => (
    <Field
      id={`project-${name}`}
      label={label}
      value={form[name]}
      onChange={(value) => set(name, value as ProjectForm[typeof name])}
      helper={helper}
      error={t(`newProject.error.${name}` as 'newProject.error.title')}
      state={invalid === name ? 'error' : 'idle'}
      disabled={saving}
    />
  )

  const submit = async () => {
    const offending = validateProject(form, media, requireImage)
    if (offending !== null) {
      setInvalid(offending)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSubmit(projectPayload(form, media))
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('error.generic'))
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={onCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
        }
      />

      <Card className="grid gap-4 p-4">
        {field('title', t('newProject.name'))}

        <TextArea
          id="project-description"
          label={t('newProperty.description')}
          value={form.description}
          onChange={(value) => set('description', value)}
          state={invalid === 'description' ? 'error' : 'idle'}
          error={t('newProject.error.description')}
          disabled={saving}
          required
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="project-category"
            label={t('newProperty.category')}
            value={form.category_id}
            onChange={(value) => set('category_id', value)}
            disabled={saving}
            options={[
              { value: '', label: '—' },
              ...categories.data.map((entry) => ({
                value: String(entry.id),
                label: entry.translated_name ?? entry.category,
              })),
            ]}
          />
          <Select
            id="project-type"
            label={t('newProject.stage')}
            value={form.type}
            onChange={(value) => set('type', value as ProjectStage)}
            disabled={saving}
            options={STAGES.map((stage) => ({
              value: stage,
              label: t(`projectStage.${stage}` as 'projectStage.upcoming'),
            }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {field('country', t('newProperty.country'))}
          {field('state', t('newProperty.state'))}
          {field('city', t('common.city'))}
        </div>

        {field('location', t('newProject.location'), t('newProject.locationHint'))}

        <div>
          <p className="mb-1 text-sm font-medium text-ink-2">{t('newProperty.pin')}</p>
          <LocationPicker
            label={t('newProperty.pin')}
            lat={form.latitude === '' ? null : Number(form.latitude)}
            lng={form.longitude === '' ? null : Number(form.longitude)}
            onChange={(lat, lng) => {
              // The pin is authoritative for the coordinates immediately; the
              // address catches up when the lookup returns, so a slow or failed
              // geocode never costs the agent the pin they placed.
              setForm((current) => ({
                ...current,
                latitude: lat.toFixed(7),
                longitude: lng.toFixed(7),
              }))
              void reverseGeocode(lat, lng).then((place) => {
                if (place !== null) applyPlace(place)
              })
            }}
          />
          <p className="mt-1 min-h-[1lh] text-xs text-muted">
            {form.latitude === ''
              ? t('newProject.pinOptional')
              : `${form.latitude}, ${form.longitude}`}
          </p>
        </div>

        <FileField
          id="project-image"
          label={t('newProject.coverImage')}
          accept="image/jpeg,image/png"
          files={media.image === null ? [] : [media.image]}
          onChange={(files) => {
            setMedia((current) => ({ ...current, image: files[0] ?? null }))
            if (invalid === 'image') setInvalid(null)
          }}
          helper={
            requireImage || currentImage === null
              ? t('newProperty.imageRule')
              : t('editProject.imageKept')
          }
          error={t('newProject.error.image')}
          state={invalid === 'image' ? 'error' : 'idle'}
          disabled={saving}
          required={requireImage}
        />

        <FileField
          id="project-gallery"
          label={t('newProperty.gallery')}
          accept="image/jpeg,image/png"
          multiple
          files={media.gallery_images}
          onChange={(files) => {
            setMedia((current) => ({ ...current, gallery_images: files }))
          }}
          disabled={saving}
        />

        <FileField
          id="project-documents"
          label={t('newProperty.documents')}
          accept=".pdf,.doc,.docx,.txt"
          multiple
          files={media.documents}
          onChange={(files) => {
            setMedia((current) => ({ ...current, documents: files }))
          }}
          disabled={saving}
        />

        {field('video_link', t('newProperty.videoLink'), t('newProject.videoHint'))}
        {field('slug_id', t('newProperty.slug'), t('newProperty.slugHint'))}

        <div className="grid gap-3 border-t border-rule pt-4">
          {field('meta_title', t('newProperty.metaTitle'))}
          <TextArea
            id="project-meta-description"
            label={t('newProperty.metaDescription')}
            value={form.meta_description}
            onChange={(value) => set('meta_description', value)}
            rows={3}
            disabled={saving}
          />
          {field('meta_keywords', t('newProperty.metaKeywords'), t('newProperty.metaKeywordsHint'))}
        </div>

        {error !== null && (
          <div role="alert" className="grid gap-1">
            <p className="text-xs text-error">{error}</p>
            <LinkButton to="/plan">{t('gate.seePlans')}</LinkButton>
          </div>
        )}
      </Card>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" state={saving ? 'loading' : 'idle'} onClick={() => void submit()}>
          {t(saving ? 'common.saving' : (submitLabel as 'newProject.create'))}
        </Button>
      </div>
    </>
  )
}
