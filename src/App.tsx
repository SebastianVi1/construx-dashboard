import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { AuthCompletePage } from './features/auth/AuthCompletePage'
import { AccountPage } from './features/auth/AccountPage'
import { NotFoundPage } from './features/auth/NotFoundPage'
import { GuestOnly, RequireAuth } from './features/auth/RouteGuards'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/account" replace />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/complete" element={<AuthCompletePage />} />
      <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
