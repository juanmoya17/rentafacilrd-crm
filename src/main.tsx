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
        children: [{ path: '/', element: <DashboardPage /> }],
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
