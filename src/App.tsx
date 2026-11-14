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
import { RequireWorkbooks } from './features/excel/RequireWorkbooks'
import { CreateOrganizationPage, OrganizationGate, WorkspaceHome, WorkspaceLayout } from './features/organizations'

// Workspace screens load on first visit; WorkspaceLayout holds their Suspense boundary.
const SitesPage = lazy(() => import('./features/sites/SitesPage').then((module) => ({ default: module.SitesPage })))
const SiteDetailPage = lazy(() =>
  import('./features/sites/SiteDetailPage').then((module) => ({ default: module.SiteDetailPage })),
)
const PhasesPage = lazy(() => import('./features/goals/PhasesPage').then((module) => ({ default: module.PhasesPage })))
const MembersPage = lazy(() => import('./features/members/MembersPage').then((module) => ({ default: module.MembersPage })))
const TaskDetailPage = lazy(() => import('./features/tasks/TaskDetailPage').then((module) => ({ default: module.TaskDetailPage })))
const MyTasksPage = lazy(() => import('./features/tasks/MyTasksPage').then((module) => ({ default: module.MyTasksPage })))
const MaterialsPage = lazy(() =>
  import('./features/materials/MaterialsPage').then((module) => ({ default: module.MaterialsPage })),
)
const MaterialDetailPage = lazy(() =>
  import('./features/materials/MaterialDetailPage').then((module) => ({ default: module.MaterialDetailPage })),
)
const ExcelLibraryPage = lazy(() =>
  import('./features/excel/ExcelLibraryPage').then((module) => ({ default: module.ExcelLibraryPage })),
)
const ExcelEditorPage = lazy(() =>
  import('./features/excel/ExcelEditorPage').then((module) => ({ default: module.ExcelEditorPage })),
)
const OrgFinancePage = lazy(() =>
  import('./features/org-finance/OrgFinancePage').then((module) => ({ default: module.OrgFinancePage })),
)
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const AcceptInvitationPage = lazy(() =>
  import('./features/invitations/AcceptInvitationPage').then((module) => ({ default: module.AcceptInvitationPage })),
)
const DocumentsPage = lazy(() =>
  import('./features/documents/DocumentsPage').then((module) => ({ default: module.DocumentsPage })),
)
const SiteDocumentsPage = lazy(() =>
  import('./features/documents/SiteDocumentsPage').then((module) => ({ default: module.SiteDocumentsPage })),
)
const DocumentFolderPage = lazy(() =>
  import('./features/documents/DocumentFolderPage').then((module) => ({ default: module.DocumentFolderPage })),
)
const SitePlansPage = lazy(() =>
  import('./features/plans/SitePlansPage').then((module) => ({ default: module.SitePlansPage })),
)
const SitePlanFolderPage = lazy(() =>
  import('./features/plans/SitePlanFolderPage').then((module) => ({ default: module.SitePlanFolderPage })),
)
const SiteFloorPlansPage = lazy(() =>
  import('./features/floor-plans/SiteFloorPlansPage').then((module) => ({ default: module.SiteFloorPlansPage })),
)
const FloorPlanPage = lazy(() =>
  import('./features/floor-plans/FloorPlanPage').then((module) => ({ default: module.FloorPlanPage })),
)
const AttendancePage = lazy(() =>
  import('./features/attendance/AttendancePage').then((module) => ({ default: module.AttendancePage })),
)
const CrewsPage = lazy(() =>
  import('./features/crews/CrewsPage').then((module) => ({ default: module.CrewsPage })),
)
const EquipmentPage = lazy(() =>
  import('./features/crews/EquipmentPage').then((module) => ({ default: module.EquipmentPage })),
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
        {/* `/` picks the landing screen for the role: Finance with company-wide VIEW_BUDGET, My tasks for a Worker. */}
        <Route index element={<WorkspaceHome />} />
        <Route path="/finance" element={<OrgFinancePage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/sites/:siteId" element={<SiteDetailPage />} />
        <Route path="/sites/:siteId/phases" element={<PhasesPage />} />
        <Route path="/sites/:siteId/phases/:goalId/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/materials/:materialId" element={<MaterialDetailPage />} />
        <Route path="/excel" element={<RequireWorkbooks><ExcelLibraryPage /></RequireWorkbooks>} />
        <Route path="/excel/folders/:folderId" element={<RequireWorkbooks><ExcelLibraryPage /></RequireWorkbooks>} />
        <Route path="/excel/:fileId" element={<RequireWorkbooks><ExcelEditorPage /></RequireWorkbooks>} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/sites/:siteId" element={<SiteDocumentsPage />} />
        <Route path="/documents/sites/:siteId/folders/:folderId" element={<DocumentFolderPage />} />
        <Route path="/sites/:siteId/plans" element={<SitePlansPage />} />
        <Route path="/sites/:siteId/plans/folders/:folderId" element={<SitePlanFolderPage />} />
        <Route path="/sites/:siteId/floor-plans" element={<SiteFloorPlansPage />} />
        <Route path="/sites/:siteId/floor-plans/:floorPlanId" element={<FloorPlanPage />} />
        <Route path="/sites/:siteId/attendance" element={<AttendancePage />} />
        <Route path="/crews" element={<CrewsPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/account" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
