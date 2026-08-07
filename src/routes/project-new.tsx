import { useNavigate } from 'react-router'
import { useI18n } from '@/lib/i18n/context'
import { ProjectFormView } from '@/components/project-form'
import { PlanGate } from '@/components/plan-gate'
import { EMPTY_PROJECT_FORM, createProject } from '@/lib/crm/create-project'

/**
 * Creating the project shell. Its inventory — typologies and units — is added
 * on the detail screen straight after, which is where this navigates: a project
 * with no units is the one state the projects list calls out as unfinished.
 *
 * The fields live in ProjectFormView, shared with the edit screen, because both
 * post to the same upsert and a field present on one and missing from the other
 * is a field an agent can set but never correct.
 */
function ProjectNewForm() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <ProjectFormView
      title={t('newProject.title')}
      subtitle={t('newProject.subtitle')}
      initialForm={EMPTY_PROJECT_FORM}
      requireImage
      submitLabel="newProject.create"
      onCancel={() => void navigate('/projects')}
      onSubmit={async (body) => {
        const created = await createProject(body)
        void navigate(`/projects/${created.id}`)
      }}
    />
  )
}

export function ProjectNewPage() {
  return (
    <PlanGate feature="project_list">
      <ProjectNewForm />
    </PlanGate>
  )
}
