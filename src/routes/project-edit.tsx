import { useNavigate, useParams } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { Link } from 'react-router'
import { ProjectFormView } from '@/components/project-form'
import { useResource } from '@/lib/use-resource'
import { fetchProjectForEdit, updateProject } from '@/lib/crm/update-project'

/**
 * Editing a project. Deliberately NOT behind PlanGate: the update branch of
 * post_project consumes no listing slot, and an agent whose package lapsed must
 * still be able to correct what they already published.
 */
export function ProjectEditPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const { t } = useI18n()
  const navigate = useNavigate()

  // Same guard as the detail screen: the route pattern does not constrain :id,
  // so /projects/abc/edit is reachable and must not reach the API.
  const resource = useResource(
    (signal) =>
      Number.isInteger(projectId) ? fetchProjectForEdit(projectId, signal) : Promise.resolve(null),
    [projectId],
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

  if (resource.data === null) {
    return (
      <EmptyState
        title={t('error.notFound')}
        action={
          <Link to="/projects" viewTransition>
            <Button>{t('common.back')}</Button>
          </Link>
        }
      />
    )
  }

  const back = () => void navigate(`/projects/${projectId}`)

  return (
    <ProjectFormView
      title={t('editProject.title')}
      subtitle={t('editProject.subtitle')}
      initialForm={resource.data.form}
      currentImage={resource.data.image}
      requireImage={false}
      submitLabel="editProject.save"
      onCancel={back}
      onSubmit={async (body) => {
        await updateProject(projectId, body)
        back()
      }}
    />
  )
}
