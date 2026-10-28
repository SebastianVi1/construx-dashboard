import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider'
import { OnboardingProvider } from './features/onboarding'
import { OrganizationsProvider } from './features/organizations'
import { LocaleProvider } from './i18n'
import { ThemeProvider } from './theme'

// Onboarding and organizations read the session, so they sit inside AuthProvider.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <OnboardingProvider>
              <OrganizationsProvider>
                <App />
              </OrganizationsProvider>
            </OnboardingProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
