import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import {
  Button,
  Card,
  ErrorState,
  Field,
  FileField,
  LoadingState,
  PageHeader,
  Select,
  TextArea,
} from '@/components/ui'
import { LocationPicker } from '@/components/location-picker'
import { useResource } from '@/lib/use-resource'
import { fetchCategories } from '@/lib/crm/reference'
import {
  EMPTY_PROJECT_FORM,
  EMPTY_PROJECT_MEDIA,
  createProject,
  projectPayload,
  validateProject,
  type ProjectField,
  type ProjectForm,
  type ProjectMedia,
} from '@/lib/crm/create-project'
import type { ProjectStage } from '@/lib/crm/projects'

/**
 * Creating the project shell. Its inventory — typologies and units — is added
 * on the detail screen straight after, which is where this navigates: a project
 * with no units is the one state the projects list calls out as unfinished.
 *
 * Short enough to stay one screen rather than a wizard: post_project asks for
 * six required fields against post_property's nine plus three tier gates.
 */

const STAGES: ProjectStage[] = ['upcoming', 'under_process']

export function ProjectNewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const categories = useResource((signal) => fetchCategories(signal), [])

  const [form, setForm] = useState<ProjectForm>(EMPTY_PROJECT_FORM)
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
    const offending = validateProject(form, media)
    if (offending !== null) {
      setInvalid(offending)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const created = await createProject(projectPayload(form, media))
      // Straight to the inventory: creating a project without units is only
      // half of what the agent came to do.
      void navigate(`/projects/${created.id}`)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t('error.generic'))
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t('newProject.title')}
        subtitle={t('newProject.subtitle')}
        actions={
          <Button onClick={() => void navigate('/projects')} disabled={saving}>
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
              setForm((current) => ({
                ...current,
                latitude: lat.toFixed(7),
                longitude: lng.toFixed(7),
              }))
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
          helper={t('newProperty.imageRule')}
          error={t('newProject.error.image')}
          state={invalid === 'image' ? 'error' : 'idle'}
          disabled={saving}
          required
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
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </Card>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" state={saving ? 'loading' : 'idle'} onClick={() => void submit()}>
          {t(saving ? 'common.saving' : 'newProject.create')}
        </Button>
      </div>
    </>
  )
}
