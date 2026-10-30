import { Link, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { PropertyFormView } from '@/components/property-form'
import { useResource } from '@/lib/use-resource'
import { useAuth } from '@/lib/auth-context'
import { useAgencyRole } from '@/lib/crm/use-agency-role'
import {
  canEditProperty,
  fetchPropertyForEdit,
  propertyIdOf,
} from '@/lib/crm/update-property'

/**
 * Editing a listing — and, on a rejected one, "Corregir y reenviar" (RF-015):
 * the server sends any edited rejected listing back to review. Not behind
 * PlanGate, like project-edit: correcting what is already published consumes
 * no listing slot.
 */
export function PropertyEditPage() {
  const { code = '' } = useParams()
  const id = propertyIdOf(code)
  const { t } = useI18n()
  const { state } = useAuth()
  const { isAdmin } = useAgencyRole()

  const resource = useResource(
    (signal) => (id === null ? Promise.resolve(null) : fetchPropertyForEdit(id, signal)),
    [id],
  )

  if (resource.status === 'loading') return <LoadingState label={t('common.loading')} />
  if (resource.status === 'error') {
    return (
      <ErrorState
        message={resource.message}
        retryLabel={t('common.retry')}
        onRetry={resource.reload}
      />
    )
  }

  // A colleague's listing loads (viewing is agency-wide) but cannot be saved:
  // say so now, not after the agent has redone it.
  const editable =
    resource.data !== null && canEditProperty(isAdmin, state, resource.data.addedBy)

  if (resource.data === null || !editable) {
    return (
      <EmptyState
        title={t(resource.data === null ? 'error.notFound' : 'editProperty.notYours')}
        action={
          <Link to="/properties" viewTransition>
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    )
  }

  // Keyed on the id: a second edit route reached without unmounting must not
  // keep the first listing's form state.
  return (
    <PropertyFormView key={resource.data.id} edit={resource.data} exitTo={`/properties/${code}`} />
  )
}
