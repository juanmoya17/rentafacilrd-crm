import { PropertyFormView } from '@/components/property-form'
import { useI18n } from '@/lib/i18n/context'
import { freeQuotaBanner } from '@/lib/crm/free-quota'
import { checkPackageLimit } from '@/lib/crm/reference'
import { useResource } from '@/lib/use-resource'

/** Publishing a listing. The wizard itself lives in property-form.tsx. */
export function PropertyNewPage() {
  const { t } = useI18n()
  // Display only: the form never blocks on this (see property-form.tsx), and a
  // failed or quota-less answer just means no banner.
  const limit = useResource((signal) => checkPackageLimit('property_list', signal).catch(() => null), [])
  const banner = limit.status === 'ready' ? freeQuotaBanner(limit.data?.free_quota) : null

  return (
    <>
      {banner !== null && (
        <p
          role={banner.tone === 'warning' ? 'alert' : 'status'}
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            banner.tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-brand-50 text-brand-800'
          }`}
        >
          {t(banner.key, banner.vars)}
        </p>
      )}
      <PropertyFormView />
    </>
  )
}
