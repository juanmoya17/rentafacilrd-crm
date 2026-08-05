import { StrictMode } from 'react'
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
import { DashboardPage } from '@/routes/dashboard'
import { PipelinePage } from '@/routes/pipeline'
import { LeadsPage } from '@/routes/leads'
import { LeadDetailPage } from '@/routes/lead-detail'
import { PropertiesPage } from '@/routes/properties'
import { PropertyNewPage } from '@/routes/property-new'
import { PropertyDetailPage } from '@/routes/property-detail'
import { ProjectsPage } from '@/routes/projects'
import { ProjectNewPage } from '@/routes/project-new'
import { ProjectDetailPage } from '@/routes/project-detail'
import { InventoryPage } from '@/routes/inventory'
import { TasksPage } from '@/routes/tasks'
import { NotificationsPage } from '@/routes/notifications'
import { PlanPage } from '@/routes/plan'
import { SettingsPage } from '@/routes/settings'
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
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
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
