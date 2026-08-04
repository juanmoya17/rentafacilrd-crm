import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Pencil, Sparkles } from 'lucide-react'
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
import { AddressSearch } from '@/components/address-search'
import { PhotoInput } from '@/components/photo-input'
import { useObjectUrls } from '@/lib/use-object-urls'
import { reverseGeocode, type Place } from '@/lib/google-maps'
import { useResource } from '@/lib/use-resource'
import {
  affirmativeOption,
  isAreaParameter,
  checkPackageLimit,
  fetchCategories,
  fetchFacilities,
  fetchLanguages,
  type Category,
  type CategoryParameter,
  type Language,
  type OutdoorFacility,
} from '@/lib/crm/reference'
import { canGenerateDescription, generateDescription } from '@/lib/crm/ai-description'
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
 * two would refuse a listing the server would happily accept. The gallery,
 * media_rich and ai_description checks ARE safe to pre-run: those map to the
 * same PackageFeature lookups their handlers use.
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

/** Parameters that render as a set of choices earn a full row — an amenity
 *  list wrapped into a half-width column is the thing that reads as broken. */
const WIDE_PARAMETERS = ['checkbox', 'radiobutton', 'textarea']

interface Reference {
  categories: Category[]
  facilities: OutdoorFacility[]
  languages: Language[]
  galleryLimit: number | null
  mediaRich: boolean
  aiDescription: boolean
}

async function loadReference(signal: AbortSignal): Promise<Reference> {
  // Categories and facilities are hard requirements — without a category there
  // is no listing to make, and an empty facilities step would read as "there
  // are none" rather than "we could not load them".
  //
  // The other four only shape the form, and every gate is enforced again by
  // the server on submit. So a failure there degrades to the permissive default
  // and lets the server be the judge, rather than blocking a listing over a
  // pre-check. Same posture as the website's `.catch(() => {})`.
  const [categories, facilities, languages, gallery, media, ai] = await Promise.all([
    fetchCategories(signal),
    fetchFacilities(signal),
    fetchLanguages(signal).catch(() => []),
    checkPackageLimit('gallery_photos', signal).catch(() => null),
    checkPackageLimit('media_rich', signal).catch(() => null),
    checkPackageLimit('ai_description', signal).catch(() => null),
  ])

  return {
    categories,
    facilities,
    languages,
    // Absent means unlimited on this tier — not zero, which would refuse every
    // photo. Only a real number caps anything.
    galleryLimit: gallery?.limit ?? null,
    mediaRich: media?.feature_available ?? true,
    // Permissive on a failed pre-check, like the other two: a false lock would
    // hide a feature the plan actually has, where the optimistic path just
    // costs one request that comes back with the server's own refusal.
    aiDescription: ai?.feature_available ?? true,
  }
}

function labelOf(item: {
  name?: string
  category?: string
  translated_name?: string | null
}): string {
  return item.translated_name ?? item.category ?? item.name ?? ''
}

/* ------------------------------------------------------------------- tags */

/** The chip used by every multi/single choice in the wizard. One place, so a
 *  selected amenity and a selected nearby place cannot drift apart. */
function Chip({
  on,
  onToggle,
  disabled,
  children,
  input,
}: {
  on: boolean
  onToggle: () => void
  disabled: boolean
  children: React.ReactNode
  /** 'radio' collapses to one choice, 'checkbox' allows many. */
  input: 'radio' | 'checkbox'
}) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors duration-(--duration-fast) ease-out ${
        on
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-rule-2 bg-surface-raised text-ink-2 hover:bg-surface-sunken'
      } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
    >
      <input
        type={input}
        checked={on}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
      {children}
    </label>
  )
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
  const required = parameter.is_required === 1

  const legend = (
    <legend className={`text-sm font-medium ${invalid ? 'text-error' : 'text-ink-2'}`}>
      {label}
      {required && <span aria-hidden="true"> *</span>}
    </legend>
  )

  // Before the type switch, because the declared type lies here: "Área General"
  // is a `radiobutton` whose options are the range `1 metros` / `50000 metros`.
  // The app does the same — every non-checkbox parameter goes through its
  // _areaField, numeric when the name is area-like.
  if (isAreaParameter(parameter)) {
    return (
      <Field
        id={id}
        label={`${label} (m²)`}
        value={text}
        onChange={onChange}
        inputMode="decimal"
        placeholder="0"
        state={invalid ? 'error' : 'idle'}
        disabled={disabled}
        required={required}
      />
    )
  }

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
          required={required}
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
          required={required}
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
          {legend}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {options.map((option) => (
              <Chip
                key={option.value}
                input="radio"
                on={text === option.value}
                disabled={disabled}
                onToggle={() => onChange(option.value)}
              >
                {option.translated ?? option.value}
              </Chip>
            ))}
          </div>
        </fieldset>
      )

    case 'checkbox': {
      // Multi-select. Joined with commas on the wire — one string column.
      const selected = Array.isArray(value) ? value : []
      return (
        <fieldset disabled={disabled}>
          {legend}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {options.map((option) => {
              const on = selected.includes(option.value)
              return (
                <Chip
                  key={option.value}
                  input="checkbox"
                  on={on}
                  disabled={disabled}
                  onToggle={() =>
                    onChange(
                      on
                        ? selected.filter((entry) => entry !== option.value)
                        : [...selected, option.value],
                    )
                  }
                >
                  {option.translated ?? option.value}
                </Chip>
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
          required={required}
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
  const [writing, setWriting] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [confirmingRegen, setConfirmingRegen] = useState(false)

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

  const {
    categories,
    facilities: allFacilities,
    languages,
    galleryLimit,
    mediaRich,
    aiDescription,
  } = reference.data
  const category = categories.find((entry) => String(entry.id) === form.category_id) ?? null
  const categoryParameters = category?.parameter_types ?? []

  // Split once: the Si/No parameters become a tag cloud, everything else keeps
  // its own control. See affirmativeOption() for why this installation has
  // twenty booleans rather than one twenty-option amenities field.
  const booleanParameters = categoryParameters.flatMap((parameter) => {
    const yes = affirmativeOption(parameter)
    return yes === null ? [] : [{ parameter, yes }]
  })
  const booleanIds = new Set(booleanParameters.map((entry) => entry.parameter.id))
  const scalarParameters = categoryParameters.filter(
    (parameter) => !booleanIds.has(parameter.id),
  )
  const photos = [media.title_image, ...media.gallery_images].filter(
    (file): file is File => file !== null,
  )

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

  /** A picked suggestion or a moved pin both land here. Only non-empty parts
   *  overwrite — a rural pin with no locality must not blank the city the
   *  agent typed by hand. */
  const applyPlace = (place: Place) => {
    setForm((current) => ({
      ...current,
      address: place.label || current.address,
      city: place.city || current.city,
      state: place.state || current.state,
      country: place.country || current.country,
      latitude: place.lat.toFixed(7),
      longitude: place.lng.toFixed(7),
    }))
    setInvalid((current) =>
      current === 'address' || current === 'latitude' ? null : current,
    )
  }

  const write = async () => {
    setWriting(true)
    setAiError(null)
    try {
      const text = await generateDescription(
        form,
        parameters,
        categoryParameters,
        category === null ? '' : labelOf(category),
        photos,
      )
      if (text.trim() === '') throw new Error(t('newProperty.aiEmpty'))
      set('description', text)
    } catch (caught: unknown) {
      setAiError(caught instanceof Error ? caught.message : t('error.generic'))
    } finally {
      setWriting(false)
    }
  }

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

  const selectedFacilities = allFacilities.filter((facility) => facility.id in facilities)

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
            <span className="font-mono opacity-60">{index + 1}. </span>
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

            <fieldset disabled={saving}>
              <legend className="text-sm font-medium text-ink-2">{t('common.operation')}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['0', '1'] as const).map((operation) => (
                  <Chip
                    key={operation}
                    input="radio"
                    on={form.property_type === operation}
                    disabled={saving}
                    onToggle={() => set('property_type', operation)}
                  >
                    {t(operation === '1' ? 'operation.rent' : 'operation.sell')}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {/* Only rent has a duration, and the server makes it required —
                showing it for a sale would be a field that cannot be right. */}
            {form.property_type === '1' && (
              <fieldset disabled={saving}>
                <legend
                  className={`text-sm font-medium ${invalid === 'rentduration' ? 'text-error' : 'text-ink-2'}`}
                >
                  {t('newProperty.rentDuration')}
                </legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {RENT_DURATIONS.map((duration) => (
                    <Chip
                      key={duration}
                      input="radio"
                      on={form.rentduration === duration}
                      disabled={saving}
                      onToggle={() => set('rentduration', duration)}
                    >
                      {t(`rentDuration.${duration}` as 'rentDuration.Monthly')}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="grid gap-4">
            {field('title', t('newProperty.listingTitle'), { required: true })}

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
          <div className="grid gap-5">
            {category === null ? (
              <p className="text-sm text-muted">{t('newProperty.pickCategoryFirst')}</p>
            ) : (
              <>
                {/* Numbers and free text first — habitaciones, baños, parqueos
                    are what the amenity tags below qualify. */}
                {scalarParameters.length > 0 && (
                  <div className="grid items-start gap-4 sm:grid-cols-2">
                    {scalarParameters.map((parameter) => (
                      <div
                        key={parameter.id}
                        className={
                          WIDE_PARAMETERS.includes(parameter.type_of_parameter)
                            ? 'sm:col-span-2'
                            : ''
                        }
                      >
                        <ParameterInput
                          parameter={parameter}
                          value={parameters[parameter.id]}
                          onChange={(value) => {
                            setParameters((current) => ({ ...current, [parameter.id]: value }))
                            if (invalid === `param:${parameter.id}`) setInvalid(null)
                          }}
                          invalid={invalid === `param:${parameter.id}`}
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Every Si/No parameter as one tag. Twenty of them rendered as
                    labelled Si/No pairs is a wall nobody can scan; as chips it
                    is one glanceable row, and the same wire values. */}
                {booleanParameters.length > 0 && (
                  <fieldset disabled={saving}>
                    <legend className="text-sm font-semibold text-ink">
                      {t('newProperty.features')}
                    </legend>
                    <p className="mt-0.5 text-xs text-muted">{t('newProperty.featuresHint')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {booleanParameters.map(({ parameter, yes }) => {
                        const on = parameters[parameter.id] === yes
                        return (
                          <Chip
                            key={parameter.id}
                            input="checkbox"
                            on={on}
                            disabled={saving}
                            onToggle={() => {
                              setParameters((current) => {
                                const next = { ...current }
                                // Removed, not set to "No": on create the app
                                // omits an untouched checkbox entirely, and the
                                // handler skips any parameter with no value.
                                if (on) delete next[parameter.id]
                                else next[parameter.id] = yes
                                return next
                              })
                            }}
                          >
                            {labelOf(parameter)}
                          </Chip>
                        )
                      })}
                    </div>
                  </fieldset>
                )}

                {scalarParameters.length === 0 && booleanParameters.length === 0 && (
                  <p className="text-sm text-muted">{t('newProperty.noParameters')}</p>
                )}

                {/* The description lives here, after the features, because that
                    is where the app puts it — and because the AI writer reads
                    those features, so writing it earlier would waste them. */}
                <div className="border-t border-rule pt-4">
                  {/* Above the field and always rendered, exactly as the app
                      does it (set_property_parameters.dart:_descriptionSection).
                      The plan check happens on press, not on render: hiding the
                      button on a locked tier means an agent who has the feature
                      but whose pre-check failed can never reach it, and one who
                      does not have it never learns the feature exists. */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {confirmingRegen ? (
                      <>
                        <span className="text-sm text-ink-2">
                          {t('newProperty.aiOverwrite')}
                        </span>
                        <Button
                          variant="primary"
                          state={writing ? 'loading' : 'idle'}
                          onClick={() => {
                            setConfirmingRegen(false)
                            void write()
                          }}
                        >
                          {t('newProperty.aiOverwriteYes')}
                        </Button>
                        <Button onClick={() => setConfirmingRegen(false)}>
                          {t('common.cancel')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            setAiError(null)
                            if (!aiDescription) {
                              setAiError(t('newProperty.aiLocked'))
                              return
                            }
                            // Never silently replace copy the agent wrote.
                            if (form.description.trim() !== '') {
                              setConfirmingRegen(true)
                              return
                            }
                            void write()
                          }}
                          state={writing ? 'loading' : 'idle'}
                          disabled={saving || !canGenerateDescription(form, photos)}
                        >
                          {!writing && <Sparkles aria-hidden="true" className="size-4" />}
                          {t(writing ? 'newProperty.aiWriting' : 'newProperty.aiWrite')}
                        </Button>
                        <p className="text-xs text-muted">
                          {canGenerateDescription(form, photos)
                            ? t('newProperty.aiHint')
                            : t('newProperty.aiNeeds')}
                        </p>
                      </>
                    )}
                  </div>

                  <TextArea
                    id="property-description"
                    label={t('newProperty.description')}
                    value={form.description}
                    onChange={(value) => set('description', value)}
                    rows={6}
                    state={invalid === 'description' ? 'error' : 'idle'}
                    error={t('newProperty.error.description')}
                    disabled={saving || writing}
                    required
                  />

                  {aiError !== null && (
                    <p role="alert" className="mt-1 text-xs text-error">
                      {aiError}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 'facilities' && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">{t('newProperty.facilitiesHint')}</p>

            {/* Picking and measuring are two different jobs, so they are two
                different regions. An inline km field that appears inside the
                chip grid reflows every chip after it on each tick. */}
            <div className="flex flex-wrap gap-2">
              {allFacilities.map((facility) => {
                const picked = facility.id in facilities
                return (
                  <Chip
                    key={facility.id}
                    input="checkbox"
                    on={picked}
                    disabled={saving}
                    onToggle={() => {
                      setFacilities((current) => {
                        const next = { ...current }
                        if (picked) delete next[facility.id]
                        // '' becomes the neutral '0.0' in the payload: the
                        // handler drops a facility whose distance is empty.
                        else next[facility.id] = ''
                        return next
                      })
                    }}
                  >
                    {labelOf(facility)}
                  </Chip>
                )
              })}
            </div>

            {selectedFacilities.length > 0 && (
              <div className="rounded-lg border border-rule">
                <p className="border-b border-rule px-3 py-2 text-xs font-medium text-muted">
                  {t('newProperty.distancesOptional')}
                </p>
                <ul>
                  {selectedFacilities.map((facility) => (
                    <li
                      key={facility.id}
                      className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                        {labelOf(facility)}
                      </span>
                      <div className="flex w-32 shrink-0 items-center gap-1.5">
                        <input
                          id={`facility-${facility.id}`}
                          type="text"
                          inputMode="decimal"
                          value={facilities[facility.id] ?? ''}
                          disabled={saving}
                          onChange={(event) => {
                            setFacilities((current) => ({
                              ...current,
                              [facility.id]: event.target.value,
                            }))
                          }}
                          aria-label={`${labelOf(facility)} — km`}
                          placeholder="0.0"
                          className="min-h-8 w-full rounded-md border border-rule-2 bg-surface-raised px-2 py-1 text-right text-sm text-ink placeholder:text-muted disabled:opacity-55"
                        />
                        <span className="text-xs text-muted">km</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'location' && (
          <div className="grid gap-4">
            <AddressSearch
              id="property-address"
              label={t('newProperty.address')}
              value={form.address}
              onChange={(value) => set('address', value)}
              onSelect={applyPlace}
              helper={t('newProperty.addressHint')}
              error={t('newProperty.error.address')}
              invalid={invalid === 'address'}
              disabled={saving}
              placeholder={t('newProperty.addressPlaceholder')}
              emptyLabel={t('newProperty.addressEmpty')}
            />

            <div>
              <p className="mb-1 text-sm font-medium text-ink-2">{t('newProperty.pin')}</p>
              <LocationPicker
                label={t('newProperty.pin')}
                lat={form.latitude === '' ? null : Number(form.latitude)}
                lng={form.longitude === '' ? null : Number(form.longitude)}
                onChange={(lat, lng) => {
                  // The pin is authoritative for the coordinates immediately;
                  // the address catches up when the lookup returns, so a failed
                  // or slow geocode never costs the agent the pin they placed.
                  setForm((current) => ({
                    ...current,
                    latitude: lat.toFixed(7),
                    longitude: lng.toFixed(7),
                  }))
                  if (invalid === 'latitude') setInvalid(null)
                  void reverseGeocode(lat, lng).then((place) => {
                    if (place !== null) applyPlace(place)
                  })
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

            <div className="grid gap-3 sm:grid-cols-3">
              {field('country', t('newProperty.country'))}
              {field('state', t('newProperty.state'))}
              {field('city', t('common.city'))}
            </div>

            {field('client_address', t('newProperty.clientAddress'), {
              helper: t('newProperty.clientAddressHint'),
            })}
          </div>
        )}

        {step === 'media' && (
          <div className="grid gap-4">
            <PhotoInput
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
              removeLabel={t('common.delete')}
            />

            <PhotoInput
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
              helper={t('newProperty.galleryHint')}
              error={t('newProperty.error.gallery_images')}
              state={invalid === 'gallery_images' ? 'error' : 'idle'}
              disabled={saving}
              removeLabel={t('common.delete')}
            />

            {/* Locked tiers hide these two rather than letting the agent fill
                them in for a `media_rich_locked` refusal at the end. */}
            {mediaRich ? (
              <>
                <PhotoInput
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
                  removeLabel={t('common.delete')}
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
            <PhotoInput
              id="property-meta-image"
              label={t('newProperty.metaImage')}
              accept="image/jpeg,image/png"
              files={media.meta_image === null ? [] : [media.meta_image]}
              onChange={(files) => {
                setMedia((current) => ({ ...current, meta_image: files[0] ?? null }))
              }}
              disabled={saving}
              removeLabel={t('common.delete')}
            />
          </div>
        )}

        {step === 'review' && (
          <ReviewStep
            form={form}
            media={media}
            parameters={parameters}
            categoryParameters={categoryParameters}
            facilities={facilities}
            allFacilities={allFacilities}
            languages={languages}
            translations={translations}
            categoryLabel={category === null ? '—' : labelOf(category)}
            onEdit={setStep}
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

/* ---------------------------------------------------------------- review */

/** One card per step, each with the way back into it. A review that only
 *  summarises half the wizard makes the agent walk the steps to check the
 *  other half, which is the work this screen exists to save. */
function ReviewCard({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  onEdit: () => void
  editLabel: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-rule">
      <header className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-brand-700 transition-colors duration-(--duration-fast) ease-out hover:bg-surface-sunken"
        >
          <Pencil aria-hidden="true" className="size-3" />
          {editLabel}
        </button>
      </header>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="max-w-[60%] text-right text-sm font-medium text-ink [overflow-wrap:anywhere]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function TagList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <p className="text-sm text-muted">{empty}</p>

  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-2"
        >
          {value}
        </li>
      ))}
    </ul>
  )
}

function ReviewStep({
  form,
  media,
  parameters,
  categoryParameters,
  facilities,
  allFacilities,
  languages,
  translations,
  categoryLabel,
  onEdit,
}: {
  form: PropertyForm
  media: PropertyMedia
  parameters: ParameterValues
  categoryParameters: CategoryParameter[]
  facilities: FacilityDistances
  allFacilities: OutdoorFacility[]
  languages: Language[]
  translations: TranslationValues
  categoryLabel: string
  onEdit: (step: PropertyStep) => void
}) {
  const { t, formatCurrency } = useI18n()
  const edit = t('common.edit')
  const dash = '—'
  // useMemo on the array, not the hook: a fresh [] every render would revoke
  // and recreate the blob URL on every keystroke elsewhere on the page.
  const cover = useObjectUrls(
    useMemo(() => (media.title_image === null ? [] : [media.title_image]), [media.title_image]),
  )

  // Same split as the step itself: a Si/No parameter that is on reads as a
  // tag, not as the row "Piscina: Si".
  const featureTags: string[] = []
  const parameterRows: [string, string][] = []

  for (const parameter of categoryParameters) {
    const value = parameters[parameter.id]
    if (value === undefined) continue
    const label = parameter.translated_name ?? parameter.name

    const yes = affirmativeOption(parameter)
    if (yes !== null) {
      if (value === yes) featureTags.push(label)
      continue
    }

    if (value instanceof File) {
      parameterRows.push([label, value.name])
      continue
    }
    const text = Array.isArray(value) ? value.join(', ') : value
    if (text.trim() !== '') parameterRows.push([label, text])
  }

  const facilityTags = allFacilities
    .filter((facility) => facility.id in facilities)
    .map((facility) => {
      const distance = (facilities[facility.id] ?? '').trim()
      const name = facility.translated_name ?? facility.name
      return distance === '' || Number(distance) === 0 ? name : `${name} · ${distance} km`
    })

  const translated = languages.flatMap((language) => {
    const copy = translations[language.id]
    if (copy === undefined) return []
    if (copy.title.trim() === '' && copy.description.trim() === '') return []
    return [language.name]
  })

  const previewSrc = cover[0] ?? null

  return (
    <div className="grid gap-3">
      <ReviewCard title={t('newProperty.step.category')} onEdit={() => onEdit('category')} editLabel={edit}>
        <Rows
          rows={[
            [t('newProperty.category'), categoryLabel],
            [
              t('common.operation'),
              t(form.property_type === '1' ? 'operation.rent' : 'operation.sell'),
            ],
            ...(form.property_type === '1'
              ? ([
                  [
                    t('newProperty.rentDuration'),
                    t(`rentDuration.${form.rentduration}` as 'rentDuration.Monthly'),
                  ],
                ] as [string, string][])
              : []),
          ]}
        />
      </ReviewCard>

      <ReviewCard title={t('newProperty.step.details')} onEdit={() => onEdit('details')} editLabel={edit}>
        <Rows
          rows={[
            [t('newProperty.listingTitle'), form.title || dash],
            [t('common.price'), form.price === '' ? dash : formatCurrency(Number(form.price))],
            [
              t('newProperty.condition'),
              form.condition === ''
                ? dash
                : t(`condition.${form.condition}` as 'condition.a_estrenar'),
            ],
            [t('newProperty.builtArea'), form.area === '' ? dash : `${form.area} m²`],
            [t('newProperty.landArea'), form.land_area === '' ? dash : `${form.land_area} m²`],
            [
              t('newProperty.translations'),
              translated.length === 0 ? dash : translated.join(', '),
            ],
          ]}
        />
      </ReviewCard>

      <ReviewCard
        title={t('newProperty.step.parameters')}
        onEdit={() => onEdit('parameters')}
        editLabel={edit}
      >
        {parameterRows.length > 0 && <Rows rows={parameterRows} />}

        {featureTags.length > 0 && (
          <div className={parameterRows.length > 0 ? 'mt-3 border-t border-rule pt-3' : ''}>
            <TagList values={featureTags} empty={t('newProperty.reviewNothing')} />
          </div>
        )}

        {parameterRows.length === 0 && featureTags.length === 0 && (
          <p className="text-sm text-muted">{t('newProperty.reviewNothing')}</p>
        )}

        <p className="mt-3 whitespace-pre-line border-t border-rule pt-3 text-sm text-ink-2">
          {form.description === '' ? dash : form.description}
        </p>
      </ReviewCard>

      <ReviewCard
        title={t('newProperty.step.facilities')}
        onEdit={() => onEdit('facilities')}
        editLabel={edit}
      >
        <TagList values={facilityTags} empty={t('newProperty.reviewNothing')} />
      </ReviewCard>

      <ReviewCard
        title={t('newProperty.step.location')}
        onEdit={() => onEdit('location')}
        editLabel={edit}
      >
        <Rows
          rows={[
            [t('newProperty.address'), form.address || dash],
            [t('common.city'), form.city || dash],
            [t('newProperty.state'), form.state || dash],
            [t('newProperty.country'), form.country || dash],
            [
              t('newProperty.pin'),
              form.latitude === '' ? dash : `${form.latitude}, ${form.longitude}`,
            ],
            ...(form.client_address === ''
              ? []
              : ([[t('newProperty.clientAddress'), form.client_address]] as [string, string][])),
          ]}
        />
      </ReviewCard>

      <ReviewCard title={t('newProperty.step.media')} onEdit={() => onEdit('media')} editLabel={edit}>
        <div className="flex flex-wrap items-start gap-3">
          {previewSrc === null ? (
            <p className="text-sm text-muted">{t('newProperty.reviewNoPhoto')}</p>
          ) : (
            <img
              src={previewSrc}
              alt=""
              className="aspect-[4/3] w-32 shrink-0 rounded-md border border-rule object-cover"
            />
          )}
          <div className="min-w-40 flex-1">
            <Rows
              rows={[
                [t('newProperty.photos'), String((media.title_image === null ? 0 : 1) + media.gallery_images.length)],
                [t('newProperty.threeD'), media.three_d_image === null ? dash : '1'],
                [t('newProperty.videoLink'), form.video_link || dash],
                [t('newProperty.documents'), String(media.documents.length)],
              ]}
            />
          </div>
        </div>
      </ReviewCard>

      <ReviewCard title={t('newProperty.step.seo')} onEdit={() => onEdit('seo')} editLabel={edit}>
        <Rows
          rows={[
            [t('newProperty.metaTitle'), form.meta_title || dash],
            [t('newProperty.metaKeywords'), form.meta_keywords || dash],
            [t('newProperty.metaImage'), media.meta_image === null ? dash : media.meta_image.name],
          ]}
        />
      </ReviewCard>

      <p className="text-xs text-muted">{t('newProperty.reviewNote')}</p>
    </div>
  )
}
