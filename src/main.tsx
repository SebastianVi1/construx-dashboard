import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider'
import { OnboardingProvider } from './features/onboarding'
import { LocaleProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <OnboardingProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </OnboardingProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
