/* eslint-disable react/only-export-components -- main.tsx es el punto de
   entrada: no exporta nada, así que Fast Refresh nunca actuó sobre él. La
   regla se dispara por los `const X = lazy(...)` de abajo, que están aquí
   justamente porque son la definición del router. */
import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { MotionConfig } from 'motion/react'
import { AuthProvider } from '@/lib/auth-provider'
import { I18nProvider } from '@/lib/i18n/provider'
import { RequireAuth } from '@/components/require-auth'
import { ToastProvider } from '@/components/toast'
import { CrmLayout } from '@/components/crm-layout'
import { LoginPage } from '@/routes/login'

/**
 * Every private screen is its own chunk.
 *
 * LoginPage stays static on purpose: it is the first paint, and deferring it
 * would add a round trip exactly where LCP is measured. Everything behind
 * RequireAuth is downloaded when the agent goes there — the whole CRM used to
 * ride in one 983KB bundle, most of it screens a given session never opens.
 *
 * The <Suspense> that catches these lives inside CrmLayout, around <Outlet/>,
 * so a navigation swaps the content pane and leaves the header and sidebar
 * mounted. Put it above the router and the chrome unmounts on every route
 * change, which both flickers and leaves the view transitions animating
 * against nothing.
 */
const DashboardPage = lazy(() =>
  import('@/routes/dashboard').then((m) => ({ default: m.DashboardPage })),
)
const PipelinePage = lazy(() =>
  import('@/routes/pipeline').then((m) => ({ default: m.PipelinePage })),
)
const LeadsPage = lazy(() =>
  import('@/routes/leads').then((m) => ({ default: m.LeadsPage })),
)
const LeadDetailPage = lazy(() =>
  import('@/routes/lead-detail').then((m) => ({ default: m.LeadDetailPage })),
)
const PropertiesPage = lazy(() =>
  import('@/routes/properties').then((m) => ({ default: m.PropertiesPage })),
)
const PropertyNewPage = lazy(() =>
  import('@/routes/property-new').then((m) => ({ default: m.PropertyNewPage })),
)
const PropertyDetailPage = lazy(() =>
  import('@/routes/property-detail').then((m) => ({ default: m.PropertyDetailPage })),
)
const ProjectsPage = lazy(() =>
  import('@/routes/projects').then((m) => ({ default: m.ProjectsPage })),
)
const ProjectNewPage = lazy(() =>
  import('@/routes/project-new').then((m) => ({ default: m.ProjectNewPage })),
)
const ProjectEditPage = lazy(() =>
  import('@/routes/project-edit').then((m) => ({ default: m.ProjectEditPage })),
)
const ProjectDetailPage = lazy(() =>
  import('@/routes/project-detail').then((m) => ({ default: m.ProjectDetailPage })),
)
const InventoryPage = lazy(() =>
  import('@/routes/inventory').then((m) => ({ default: m.InventoryPage })),
)
const TasksPage = lazy(() =>
  import('@/routes/tasks').then((m) => ({ default: m.TasksPage })),
)
const NotificationsPage = lazy(() =>
  import('@/routes/notifications').then((m) => ({ default: m.NotificationsPage })),
)
const AgencyPage = lazy(() =>
  import('@/routes/agency').then((m) => ({ default: m.AgencyPage })),
)
const PlanPage = lazy(() =>
  import('@/routes/plan').then((m) => ({ default: m.PlanPage })),
)
const SettingsPage = lazy(() =>
  import('@/routes/settings').then((m) => ({ default: m.SettingsPage })),
)
import './index.css'

// /login is the ONLY public route. Everything else is a child of RequireAuth,
// so new screens are protected by default — a route has to be moved out of that
// subtree on purpose to become public.
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <CrmLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/pipeline', element: <PipelinePage /> },
          { path: '/leads', element: <LeadsPage /> },
          { path: '/leads/:id', element: <LeadDetailPage /> },
          { path: '/properties', element: <PropertiesPage /> },
          // Above /properties/:code — `new` is a literal segment and would
          // otherwise be read as an RF code and 404 against the list.
          { path: '/properties/new', element: <PropertyNewPage /> },
          { path: '/properties/:code', element: <PropertyDetailPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/new', element: <ProjectNewPage /> },
          { path: '/projects/:id', element: <ProjectDetailPage /> },
          { path: '/projects/:id/edit', element: <ProjectEditPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/agency', element: <AgencyPage /> },
          // Nadie tiene este enlace guardado — nunca hubo un Link hacia él en
          // la interfaz — pero cuesta una línea y alguien pudo marcarlo.
          { path: '/agency/profile', element: <Navigate to="/agency?tab=datos" replace /> },
          { path: '/plan', element: <PlanPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  // Unknown paths bounce through the guard, never straight into the app.
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* One switch for every motion component in the app. The per-hook
        useReducedMotion() checks cover the reveals and the lift, but the toast,
        the bulk bar, the segmented indicator and the task layout animations are
        plain motion components — without this they would keep animating for a
        user who asked for less motion, which is the half of the rule that
        always gets missed. */}
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <AuthProvider>
          {/* Above the router so a failed optimistic update can still report
              itself after a navigation started. */}
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </MotionConfig>
  </StrictMode>,
)
