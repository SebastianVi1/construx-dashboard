import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { AuthCompletePage } from './features/auth/AuthCompletePage'
import { AccountPage } from './features/auth/AccountPage'
import { NotFoundPage } from './features/auth/NotFoundPage'
import { GuestOnly, RequireAuth } from './features/auth/RouteGuards'
import { CreateOrganizationPage, OrganizationGate, WorkspaceLayout } from './features/organizations'

// Workspace screens load on first visit; WorkspaceLayout holds their Suspense boundary.
const SitesPage = lazy(() => import('./features/sites/SitesPage').then((module) => ({ default: module.SitesPage })))
const SiteDetailPage = lazy(() =>
  import('./features/sites/SiteDetailPage').then((module) => ({ default: module.SiteDetailPage })),
)
const MembersPage = lazy(() => import('./features/members/MembersPage').then((module) => ({ default: module.MembersPage })))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sites" replace />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      {/* Not GuestOnly: a signed-in user opening the mailed link must keep the token (D13). */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/complete" element={<AuthCompletePage />} />
      <Route path="/account" element={<RequireAuth><OrganizationGate><AccountPage /></OrganizationGate></RequireAuth>} />
      <Route path="/organizations/new" element={<RequireAuth><CreateOrganizationPage /></RequireAuth>} />
      <Route element={<RequireAuth><OrganizationGate><WorkspaceLayout /></OrganizationGate></RequireAuth>}>
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/sites/:siteId" element={<SiteDetailPage />} />
        <Route path="/members" element={<MembersPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
