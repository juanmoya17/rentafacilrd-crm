import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '@/lib/auth-provider'
import { I18nProvider } from '@/lib/i18n/provider'
import { RequireAuth } from '@/components/require-auth'
import { CrmLayout } from '@/components/crm-layout'
import { LoginPage } from '@/routes/login'
import { DashboardPage } from '@/routes/dashboard'
import { PipelinePage } from '@/routes/pipeline'
import { LeadsPage } from '@/routes/leads'
import { LeadDetailPage } from '@/routes/lead-detail'
import { PropertiesPage } from '@/routes/properties'
import { PropertyDetailPage } from '@/routes/property-detail'
import { ProjectsPage } from '@/routes/projects'
import { ProjectDetailPage } from '@/routes/project-detail'
import { InventoryPage } from '@/routes/inventory'
import { TasksPage } from '@/routes/tasks'
import { NotificationsPage } from '@/routes/notifications'
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
          { path: '/properties/:code', element: <PropertyDetailPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/:id', element: <ProjectDetailPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
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
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
