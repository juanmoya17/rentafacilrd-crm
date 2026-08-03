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
import {
  checkPackageLimit,
  fetchCategories,
  fetchFacilities,
  fetchLanguages,
  type Category,
  type CategoryParameter,
  type Language,
  type OutdoorFacility,
} from '@/lib/crm/reference'
import {
  CONDITIONS,
  EMPTY_PROPERTY_FORM,
  EMPTY_PROPERTY_MEDIA,
  RENT_DURATIONS,
  createProperty,
  propertyPayload,
  stepOf,
  validateProperty,
  type FacilityDistances,
  type ParameterValues,
  type PropertyField,
  type PropertyForm,
  type PropertyMedia,
  type PropertyStep,
  type TranslationValues,
} from '@/lib/crm/create-property'

/**
 * The listing wizard — full parity with the Flutter app's flow, because a
 * listing created here has to be indistinguishable from one created there.
 * Same seven groups of fields, same endpoint, same rules.
 *
 * One deliberate asymmetry with the website: the `property_list` slot check is
 * NOT run up front. `check-package-limit` resolves that feature through the
 * legacy UserPackageLimit machinery, while post_property enforces it through
 * PropertyLimitService (a live count, plus the `launch_unlimited_listings`
 * override). The two can disagree, and blocking the form on the weaker of the
 * two would refuse a listing the server would happily accept. The gallery and
 * media_rich checks below are safe to pre-run: those map to the exact same
 * PackageFeature lookups the handler uses.
 */

const STEPS: PropertyStep[] = [
  'category',
  'details',
  'parameters',
  'facilities',
  'location',
  'media',
  'seo',
]

interface Reference {
  categories: Category[]
  facilities: OutdoorFacility[]
  languages: Language[]
  galleryLimit: number | null
  mediaRich: boolean
}

async function loadReference(signal: AbortSignal): Promise<Reference> {
  // Categories and facilities are hard requirements — without a category there
  // is no listing to make, and an empty facilities step would read as "there
  // are none" rather than "we could not load them".
  //
  // The other three only shape the form, and the server enforces both tier
  // gates again on submit. So a failure there degrades to the permissive
  // default and lets the server be the judge, rather than blocking a listing
  // over a pre-check. Same posture as the website's `.catch(() => {})`.
  const [categories, facilities, languages, gallery, media] = await Promise.all([
    fetchCategories(signal),
    fetchFacilities(signal),
    fetchLanguages(signal).catch(() => []),
    checkPackageLimit('gallery_photos', signal).catch(() => null),
    checkPackageLimit('media_rich', signal).catch(() => null),
  ])

  return {
    categories,
    facilities,
    languages,
    // Absent means unlimited on this tier — not zero, which would refuse every
    // photo. Only a real number caps anything.
    galleryLimit: gallery?.limit ?? null,
    mediaRich: media?.feature_available ?? true,
  }
}

function labelOf(item: { name?: string; category?: string; translated_name?: string | null }): string {
  return item.translated_name ?? item.category ?? item.name ?? ''
}

/* ------------------------------------------------------------- parameters */

/** One category parameter, rendered as whatever `type_of_parameter` says. */
function ParameterInput({
  parameter,
  value,
  onChange,
  invalid,
  disabled,
}: {
  parameter: CategoryParameter
  value: string | string[] | File | undefined
  onChange: (value: string | string[] | File) => void
  invalid: boolean
  disabled: boolean
}) {
  const id = `param-${parameter.id}`
  const label = labelOf(parameter)
  const options = parameter.translated_option_value ?? []
  const text = typeof value === 'string' ? value : ''

  switch (parameter.type_of_parameter) {
    case 'textarea':
      return (
        <TextArea
          id={id}
          label={label}
          value={text}
          onChange={onChange}
          rows={3}
          state={invalid ? 'error' : 'idle'}
          disabled={disabled}
          required={parameter.is_required === 1}
        />
      )

    case 'number':
      return (
        <Field
          id={id}
          label={label}
          value={text}
          onChange={onChange}
          inputMode="decimal"
          state={invalid ? 'error' : 'idle'}
          disabled={disabled}
          required={parameter.is_required === 1}
        />
      )

    case 'dropdown':
      return (
        <Select
          id={id}
          label={label}
          value={text}
          onChange={onChange}
          disabled={disabled}
          options={[
            { value: '', label: '—' },
            ...options.map((option) => ({
              value: option.value,
              label: option.translated ?? option.value,
            })),
          ]}
        />
      )

    case 'radiobutton':
      return (
        <fieldset disabled={disabled}>
          <legend className="text-sm font-medium text-ink-2">{label}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {options.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors duration-(--duration-fast) ease-out ${
                  text === option.value
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-rule-2 bg-surface-raised text-ink-2 hover:bg-surface-sunken'
                }`}
              >
                <input
                  type="radio"
                  name={id}
                  value={option.value}
                  checked={text === option.value}
                  onChange={() => onChange(option.value)}
                  className="sr-only"
                />
                {option.translated ?? option.value}
              </label>
            ))}
          </div>
        </fieldset>
      )

    case 'checkbox': {
      // Multi-select. Joined with commas on the wire — one string column.
      const selected = Array.isArray(value) ? value : []
      return (
        <fieldset disabled={disabled}>
          <legend className="text-sm font-medium text-ink-2">{label}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {options.map((option) => {
              const on = selected.includes(option.value)
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors duration-(--duration-fast) ease-out ${
                    on
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-rule-2 bg-surface-raised text-ink-2 hover:bg-surface-sunken'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      onChange(
                        on
                          ? selected.filter((entry) => entry !== option.value)
                          : [...selected, option.value],
                      )
                    }}
                    className="sr-only"
                  />
                  {option.translated ?? option.value}
                </label>
              )
            })}
          </div>
        </fieldset>
      )
    }

    case 'file':
      return (
        <FileField
          id={id}
          label={label}
          accept="image/jpeg,image/png"
          files={value instanceof File ? [value] : []}
          onChange={(files) => {
            const picked = files[0]
            if (picked !== undefined) onChange(picked)
          }}
          state={invalid ? 'error' : 'idle'}
          disabled={disabled}
        />
      )

    default:
      return (
        <Field
          id={id}
          label={label}
          value={text}
          onChange={onChange}
          state={invalid ? 'error' : 'idle'}
          disabled={disabled}
          required={parameter.is_required === 1}
        />
      )
  }
}

/* ------------------------------------------------------------------ page */

export function PropertyNewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const reference = useResource((signal) => loadReference(signal), [])

  const [step, setStep] = useState<PropertyStep | 'review'>('category')
  const [form, setForm] = useState<PropertyForm>(EMPTY_PROPERTY_FORM)
  const [media, setMedia] = useState<PropertyMedia>(EMPTY_PROPERTY_MEDIA)
  const [parameters, setParameters] = useState<ParameterValues>({})
  const [facilities, setFacilities] = useState<FacilityDistances>({})
  const [translations, setTranslations] = useState<TranslationValues>({})
  const [invalid, setInvalid] = useState<PropertyField | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (reference.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (reference.status === 'error') {
    return (
      <ErrorState
        message={reference.message}
        retryLabel={t('common.retry')}
        onRetry={reference.reload}
      />
    )
  }

  const { categories, facilities: allFacilities, languages, galleryLimit, mediaRich } = reference.data
  const category = categories.find((entry) => String(entry.id) === form.category_id) ?? null
  const categoryParameters = category?.parameter_types ?? []

  const set = <K extends keyof PropertyForm>(field: K, value: PropertyForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (invalid === field) setInvalid(null)
  }

  const field = (
    name: keyof PropertyForm,
    label: string,
    extras: { inputMode?: 'numeric' | 'decimal'; helper?: string; required?: boolean } = {},
  ) => (
    <Field
      id={`property-${name}`}
      label={label}
      value={form[name]}
      onChange={(value) => set(name, value as PropertyForm[typeof name])}
      inputMode={extras.inputMode}
      helper={extras.helper}
      error={t(`newProperty.error.${name}` as 'newProperty.error.title')}
      state={invalid === name ? 'error' : 'idle'}
      disabled={saving}
      required={extras.required}
    />
  )

  const submit = async () => {
    const offending = validateProperty(
      form,
      media,
      parameters,
      categoryParameters,
      galleryLimit,
      mediaRich,
    )
    if (offending !== null) {
      setInvalid(offending)
      setStep(stepOf(offending))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createProperty(propertyPayload(form, media, parameters, facilities, translations))
      // No success toast by design (see toast-context): the listing appearing
      // at the top of the list IS the confirmation.
      void navigate('/properties')
    } catch (caught: unknown) {
      // Verbatim — the server's own wording is what distinguishes "you are out
      // of listing slots" from "your plan has no 3D images".
      setError(caught instanceof Error ? caught.message : t('error.generic'))
      setSaving(false)
    }
  }

  const stepIndex = step === 'review' ? STEPS.length : STEPS.indexOf(step)
  const goTo = (index: number) => {
    setStep(index >= STEPS.length ? 'review' : (STEPS[index] as PropertyStep))
  }

  return (
    <>
      <PageHeader
        title={t('newProperty.title')}
        subtitle={t('newProperty.subtitle')}
        actions={
          <Button onClick={() => void navigate('/properties')} disabled={saving}>
            {t('common.cancel')}
          </Button>
        }
      />

      {/* The step list is navigation, not a progress bar: every step stays
          reachable, because an agent who spots a typo in step 2 while on step 6
          should not have to walk back through four screens. */}
      <nav aria-label={t('newProperty.steps')} className="mb-4 flex flex-wrap gap-1.5">
        {[...STEPS, 'review' as const].map((entry, index) => (
          <button
            key={entry}
            type="button"
            onClick={() => setStep(entry)}
            aria-current={entry === step ? 'step' : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-(--duration-fast) ease-out ${
              entry === step
                ? 'bg-brand-600 text-white'
                : 'bg-surface-sunken text-ink-2 hover:bg-rule'
            }`}
          >
            <span className="font-mono text-muted">{index + 1}. </span>
            {t(`newProperty.step.${entry}` as 'newProperty.step.category')}
          </button>
        ))}
      </nav>

      <Card className="p-4">
        {step === 'category' && (
          <div className="grid gap-4">
            <Select
              id="property-category"
              label={t('newProperty.category')}
              value={form.category_id}
              onChange={(value) => set('category_id', value)}
              disabled={saving}
              helper={t('newProperty.categoryHint')}
              options={[
                { value: '', label: '—' },
                ...categories.map((entry) => ({
                  value: String(entry.id),
                  label: labelOf(entry),
                })),
              ]}
            />

            <Select
              id="property-operation"
              label={t('common.operation')}
              value={form.property_type}
              onChange={(value) => set('property_type', value === '1' ? '1' : '0')}
              disabled={saving}
              options={[
                { value: '0', label: t('operation.sell') },
                { value: '1', label: t('operation.rent') },
              ]}
            />

            {/* Only rent has a duration, and the server makes it required —
                showing it for a sale would be a field that cannot be right. */}
            {form.property_type === '1' && (
              <Select
                id="property-rentduration"
                label={t('newProperty.rentDuration')}
                value={form.rentduration}
                onChange={(value) => set('rentduration', value)}
                disabled={saving}
                options={RENT_DURATIONS.map((duration) => ({
                  value: duration,
                  label: t(`rentDuration.${duration}` as 'rentDuration.Monthly'),
                }))}
              />
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="grid gap-4">
            {field('title', t('newProperty.listingTitle'), { required: true })}
            <TextArea
              id="property-description"
              label={t('newProperty.description')}
              value={form.description}
              onChange={(value) => set('description', value)}
              state={invalid === 'description' ? 'error' : 'idle'}
              error={t('newProperty.error.description')}
              disabled={saving}
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {field('price', t('common.price'), { inputMode: 'decimal', required: true })}
              <Select
                id="property-condition"
                label={t('newProperty.condition')}
                value={form.condition}
                onChange={(value) => set('condition', value as PropertyForm['condition'])}
                disabled={saving}
                options={[
                  { value: '', label: '—' },
                  ...CONDITIONS.map((condition) => ({
                    value: condition,
                    label: t(`condition.${condition}` as 'condition.a_estrenar'),
                  })),
                ]}
              />
              {field('area', t('newProperty.builtArea'), { inputMode: 'decimal' })}
              {field('land_area', t('newProperty.landArea'), { inputMode: 'decimal' })}
            </div>

            {field('slug_id', t('newProperty.slug'), { helper: t('newProperty.slugHint') })}

            {/* Per-language copy. The main title/description above are what the
                listing falls back to, exactly as in the app. */}
            {languages.length > 0 && (
              <div className="grid gap-3 border-t border-rule pt-4">
                <h2 className="text-sm font-semibold text-ink">{t('newProperty.translations')}</h2>
                {languages.map((language) => {
                  const copy = translations[language.id] ?? { title: '', description: '' }
                  const update = (key: 'title' | 'description', value: string) => {
                    setTranslations((current) => ({
                      ...current,
                      [language.id]: { ...copy, [key]: value },
                    }))
                  }
                  return (
                    <div key={language.id} className="grid gap-3">
                      <Field
                        id={`translation-title-${language.id}`}
                        label={`${t('newProperty.listingTitle')} · ${language.name}`}
                        value={copy.title}
                        onChange={(value) => update('title', value)}
                        disabled={saving}
                      />
                      <TextArea
                        id={`translation-description-${language.id}`}
                        label={`${t('newProperty.description')} · ${language.name}`}
                        value={copy.description}
                        onChange={(value) => update('description', value)}
                        rows={3}
                        disabled={saving}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {step === 'parameters' && (
          <div className="grid gap-4">
            {category === null ? (
              <p className="text-sm text-muted">{t('newProperty.pickCategoryFirst')}</p>
            ) : categoryParameters.length === 0 ? (
              <p className="text-sm text-muted">{t('newProperty.noParameters')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {categoryParameters.map((parameter) => (
                  <ParameterInput
                    key={parameter.id}
                    parameter={parameter}
                    value={parameters[parameter.id]}
                    onChange={(value) => {
                      setParameters((current) => ({ ...current, [parameter.id]: value }))
                      if (invalid === `param:${parameter.id}`) setInvalid(null)
                    }}
                    invalid={invalid === `param:${parameter.id}`}
                    disabled={saving}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'facilities' && (
          <div className="grid gap-3">
            <p className="text-sm text-muted">{t('newProperty.facilitiesHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {allFacilities.map((facility) => {
                const picked = facility.id in facilities
                return (
                  <div key={facility.id} className="flex items-end gap-2">
                    <label className="flex flex-1 items-center gap-2 text-sm text-ink-2">
                      <input
                        type="checkbox"
                        checked={picked}
                        disabled={saving}
                        onChange={() => {
                          setFacilities((current) => {
                            const next = { ...current }
                            if (picked) delete next[facility.id]
                            // '' becomes the neutral '0.0' in the payload: the
                            // handler drops a facility whose distance is empty.
                            else next[facility.id] = ''
                            return next
                          })
                        }}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {labelOf(facility)}
                    </label>
                    {picked && (
                      <div className="w-24">
                        <Field
                          id={`facility-${facility.id}`}
                          label={t('newProperty.distanceKm')}
                          value={facilities[facility.id] ?? ''}
                          onChange={(value) => {
                            setFacilities((current) => ({ ...current, [facility.id]: value }))
                          }}
                          inputMode="decimal"
                          disabled={saving}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 'location' && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {field('country', t('newProperty.country'))}
              {field('state', t('newProperty.state'))}
              {field('city', t('common.city'))}
            </div>
            {field('address', t('newProperty.address'), { required: true })}
            {field('client_address', t('newProperty.clientAddress'), {
              helper: t('newProperty.clientAddressHint'),
            })}

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
                  if (invalid === 'latitude') setInvalid(null)
                }}
              />
              <p
                className={`mt-1 min-h-[1lh] text-xs ${invalid === 'latitude' ? 'text-error' : 'text-muted'}`}
              >
                {form.latitude === ''
                  ? t('newProperty.pinHint')
                  : `${form.latitude}, ${form.longitude}`}
              </p>
            </div>
          </div>
        )}

        {step === 'media' && (
          <div className="grid gap-4">
            <FileField
              id="property-title-image"
              label={t('newProperty.titleImage')}
              accept="image/jpeg,image/png"
              files={media.title_image === null ? [] : [media.title_image]}
              onChange={(files) => {
                setMedia((current) => ({ ...current, title_image: files[0] ?? null }))
                if (invalid === 'title_image') setInvalid(null)
              }}
              helper={t('newProperty.imageRule')}
              error={t('newProperty.error.title_image')}
              state={invalid === 'title_image' ? 'error' : 'idle'}
              disabled={saving}
              required
            />

            <FileField
              id="property-gallery"
              label={
                galleryLimit === null
                  ? t('newProperty.gallery')
                  : t('newProperty.galleryLimited', { count: galleryLimit })
              }
              accept="image/jpeg,image/png"
              multiple
              files={media.gallery_images}
              onChange={(files) => {
                setMedia((current) => ({ ...current, gallery_images: files }))
                if (invalid === 'gallery_images') setInvalid(null)
              }}
              helper={t('newProperty.imageRule')}
              error={t('newProperty.error.gallery_images')}
              state={invalid === 'gallery_images' ? 'error' : 'idle'}
              disabled={saving}
            />

            {/* Locked tiers hide these two rather than letting the agent fill
                them in for a `media_rich_locked` refusal at the end. */}
            {mediaRich ? (
              <>
                <FileField
                  id="property-3d"
                  label={t('newProperty.threeD')}
                  accept="image/jpeg,image/png,image/gif"
                  files={media.three_d_image === null ? [] : [media.three_d_image]}
                  onChange={(files) => {
                    setMedia((current) => ({ ...current, three_d_image: files[0] ?? null }))
                    if (invalid === 'three_d_image') setInvalid(null)
                  }}
                  error={t('newProperty.error.three_d_image')}
                  state={invalid === 'three_d_image' ? 'error' : 'idle'}
                  disabled={saving}
                />
                {field('video_link', t('newProperty.videoLink'), {
                  helper: t('newProperty.videoHint'),
                })}
              </>
            ) : (
              <p className="rounded-md border border-dashed border-rule-2 px-3 py-2 text-xs text-muted">
                {t('newProperty.mediaLocked')}
              </p>
            )}

            <FileField
              id="property-documents"
              label={t('newProperty.documents')}
              accept=".pdf,.doc,.docx,.txt"
              multiple
              files={media.documents}
              onChange={(files) => {
                setMedia((current) => ({ ...current, documents: files }))
                if (invalid === 'documents') setInvalid(null)
              }}
              helper={t('newProperty.documentRule')}
              error={t('newProperty.error.documents')}
              state={invalid === 'documents' ? 'error' : 'idle'}
              disabled={saving}
            />
          </div>
        )}

        {step === 'seo' && (
          <div className="grid gap-4">
            {field('meta_title', t('newProperty.metaTitle'))}
            <TextArea
              id="property-meta-description"
              label={t('newProperty.metaDescription')}
              value={form.meta_description}
              onChange={(value) => set('meta_description', value)}
              rows={3}
              disabled={saving}
            />
            {field('meta_keywords', t('newProperty.metaKeywords'), {
              helper: t('newProperty.metaKeywordsHint'),
            })}
            <FileField
              id="property-meta-image"
              label={t('newProperty.metaImage')}
              accept="image/jpeg,image/png"
              files={media.meta_image === null ? [] : [media.meta_image]}
              onChange={(files) => {
                setMedia((current) => ({ ...current, meta_image: files[0] ?? null }))
              }}
              disabled={saving}
            />
          </div>
        )}

        {step === 'review' && (
          <ReviewStep
            form={form}
            media={media}
            categoryLabel={category === null ? '—' : labelOf(category)}
          />
        )}

        {error !== null && (
          <p role="alert" className="mt-4 text-xs text-error">
            {error}
          </p>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => goTo(stepIndex - 1)} disabled={saving || stepIndex === 0}>
          {t('common.back')}
        </Button>

        {step === 'review' ? (
          <Button
            variant="primary"
            state={saving ? 'loading' : 'idle'}
            onClick={() => void submit()}
          >
            {t(saving ? 'newProperty.publishing' : 'newProperty.publish')}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => goTo(stepIndex + 1)} disabled={saving}>
            {t('newProperty.next')}
          </Button>
        )}
      </div>
    </>
  )
}

/** Read-only recap. Nothing here is editable — the step list is one click away. */
function ReviewStep({
  form,
  media,
  categoryLabel,
}: {
  form: PropertyForm
  media: PropertyMedia
  categoryLabel: string
}) {
  const { t, formatCurrency } = useI18n()

  const rows: [string, string][] = [
    [t('newProperty.category'), categoryLabel],
    [t('common.operation'), t(form.property_type === '1' ? 'operation.rent' : 'operation.sell')],
    [t('newProperty.listingTitle'), form.title || '—'],
    [t('common.price'), form.price === '' ? '—' : formatCurrency(Number(form.price))],
    [t('common.city'), form.city || '—'],
    [t('newProperty.address'), form.address || '—'],
    [
      t('newProperty.pin'),
      form.latitude === '' ? '—' : `${form.latitude}, ${form.longitude}`,
    ],
    [
      t('newProperty.photos'),
      String((media.title_image === null ? 0 : 1) + media.gallery_images.length),
    ],
  ]

  return (
    <dl className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-rule pb-2">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="text-sm font-medium text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted">{t('newProperty.reviewNote')}</p>
    </dl>
  )
}
