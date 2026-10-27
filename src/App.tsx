import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { AuthCompletePage } from './features/auth/AuthCompletePage'
import { NotFoundPage } from './features/auth/NotFoundPage'
import { GuestOnly, RequireAuth } from './features/auth/RouteGuards'
import { CreateOrganizationPage, OrganizationGate, WorkspaceHome, WorkspaceLayout } from './features/organizations'

// Workspace screens load on first visit; WorkspaceLayout holds their Suspense boundary.
const SitesPage = lazy(() => import('./features/sites/SitesPage').then((module) => ({ default: module.SitesPage })))
const SiteDetailPage = lazy(() =>
  import('./features/sites/SiteDetailPage').then((module) => ({ default: module.SiteDetailPage })),
)
const MembersPage = lazy(() => import('./features/members/MembersPage').then((module) => ({ default: module.MembersPage })))
const MyTasksPage = lazy(() => import('./features/tasks/MyTasksPage').then((module) => ({ default: module.MyTasksPage })))
const MaterialsPage = lazy(() =>
  import('./features/materials/MaterialsPage').then((module) => ({ default: module.MaterialsPage })),
)
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const AcceptInvitationPage = lazy(() =>
  import('./features/invitations/AcceptInvitationPage').then((module) => ({ default: module.AcceptInvitationPage })),
)

function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      {/* Not GuestOnly: a signed-in user opening the mailed link must keep the token (D13). */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/complete" element={<AuthCompletePage />} />
      <Route path="/organizations/new" element={<RequireAuth><CreateOrganizationPage /></RequireAuth>} />
      {/* Public: a signed-out visitor is sent to sign in and brought back with the token. */}
      <Route path="/invitations/accept" element={<Suspense fallback={null}><AcceptInvitationPage /></Suspense>} />
      <Route element={<RequireAuth><OrganizationGate><WorkspaceLayout /></OrganizationGate></RequireAuth>}>
        {/* `/` picks the landing screen for the role (My tasks for a Worker). */}
        <Route index element={<WorkspaceHome />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/sites/:siteId" element={<SiteDetailPage />} />
        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/account" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
