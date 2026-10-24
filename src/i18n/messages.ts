import type { Locale } from './locale'

const en = {
  common: {
    language: 'Language',
  },
  auth: {
    brandHome: 'Construx home',
    backToApp: 'Back to app',
    title: {
      signIn: 'Sign in',
      register: 'Create an account',
      checkEmail: 'Check your email',
      account: 'Your account',
      verify: 'Verify your email',
      verifySuccess: 'Email verified',
      verifyFailed: 'Verification failed',
      complete: 'Completing sign in',
    },
    description: {
      signIn: 'Enter your account details to return to your workspace.',
      register: 'Enter your details to request an account. You will verify your email before signing in.',
      checkEmail:
        'If this address can receive a verification email, follow the instructions there to finish creating your account.',
      account: 'You are signed in to Construx.',
      verify: 'Confirming your verification link…',
      verifySuccess: 'Your email address is confirmed. You can now sign in.',
      verifyFailed: 'This link is invalid or has already been used.',
      complete: 'Finishing your sign-in…',
    },
    field: {
      emailLabel: 'Email address',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'Password',
      passwordHint: 'Use at least 12 characters.',
    },
    submit: {
      signIn: 'Sign in',
      register: 'Create account',
    },
    pending: {
      signIn: 'Signing you in…',
      register: 'Creating your account…',
      verify: 'Verifying your email…',
    },
    error: {
      google: 'Google sign-in failed. Please try again or use your email and password.',
      signIn: 'We could not sign you in. Check your details and try again.',
      register: 'We could not complete your request. Please try again.',
      resend: 'We could not resend the email. Please try again.',
    },
    accepted: {
      body: 'You can return to sign in after verifying your email.',
      sent: 'Verification email sent. Check your inbox.',
      resendHint: "Didn't receive the email?",
      resendSending: 'Sending…',
      resendButton: 'Resend verification email',
      signInLink: 'Sign in',
    },
    switch: {
      toRegister: 'New to Construx?',
      toLogin: 'Already have an account?',
      registerLink: 'Create an account',
      loginLink: 'Sign in',
    },
    account: {
      checking: 'Checking your session…',
      loading: 'Loading…',
      signedInAs: 'Signed in as',
      signOut: 'Sign out',
    },
    verifyStatus: 'Verification successful.',
    verifyFailedBody:
      'The verification link is expired or was already used. Verification links work once and expire after 24 hours.',
    verifyRegisterLink: 'Create an account',
    divider: 'or',
    google: 'Continue with Google',
  },
  validation: {
    emailRequired: 'Enter your email address',
    emailInvalid: 'Enter a valid email address',
    passwordRequired: 'Enter your password',
    passwordMin: 'Use at least 12 characters',
  },
  onboarding: {
    continue: 'Continue',
  },
  home: {
    navLabel: 'Workspace',
    nav: {
      home: 'Home',
      sites: 'Sites',
      people: 'People',
      products: 'Products',
      finance: 'Finance',
      crm: 'CRM',
    },
    allSites: 'All sites',
    dataAsOf: 'Data as of {date}',
    overviewTitle: 'Workspace overview',
    overviewDescription: "Your company's sites, team, and financial position at a glance.",
    addSite: 'Add site',
    finance: 'Finance',
    noData: 'No data',
    savings: 'Savings',
    overrun: 'Overrun',
    budget: 'Budget',
    recordedCost: 'Recorded cost',
    budgetRecorded: '{percent}% of budget recorded',
    people: 'People',
    peopleCaption: '{count} team members · {assigned} assigned this week',
    sites: 'Sites',
    sitesActive: '{count} active',
    atRisk: 'At risk',
    onSchedule: 'On schedule',
    recentActivity: 'Recent activity',
  },
}

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export type Messages = DeepStringify<typeof en>

const es: Messages = {
  common: {
    language: 'Idioma',
  },
  auth: {
    brandHome: 'Inicio de Construx',
    backToApp: 'Volver a la aplicación',
    title: {
      signIn: 'Iniciar sesión',
      register: 'Crear una cuenta',
      checkEmail: 'Revisa tu correo',
      account: 'Tu cuenta',
      verify: 'Verifica tu correo',
      verifySuccess: 'Correo verificado',
      verifyFailed: 'Falló la verificación',
      complete: 'Completando inicio de sesión',
    },
    description: {
      signIn: 'Ingresa los datos de tu cuenta para volver a tu espacio de trabajo.',
      register: 'Ingresa tus datos para solicitar una cuenta. Verificarás tu correo antes de iniciar sesión.',
      checkEmail:
        'Si esta dirección puede recibir un correo de verificación, sigue las instrucciones para terminar de crear tu cuenta.',
      account: 'Iniciaste sesión en Construx.',
      verify: 'Confirmando tu enlace de verificación…',
      verifySuccess: 'Tu correo está confirmado. Ya puedes iniciar sesión.',
      verifyFailed: 'Este enlace no es válido o ya fue usado.',
      complete: 'Finalizando tu inicio de sesión…',
    },
    field: {
      emailLabel: 'Correo electrónico',
      emailPlaceholder: 'tu@ejemplo.com',
      passwordLabel: 'Contraseña',
      passwordHint: 'Usa al menos 12 caracteres.',
    },
    submit: {
      signIn: 'Iniciar sesión',
      register: 'Crear cuenta',
    },
    pending: {
      signIn: 'Iniciando sesión…',
      register: 'Creando tu cuenta…',
      verify: 'Verificando tu correo…',
    },
    error: {
      google: 'Falló el inicio de sesión con Google. Inténtalo de nuevo o usa tu correo y contraseña.',
      signIn: 'No pudimos iniciar tu sesión. Revisa tus datos e inténtalo de nuevo.',
      register: 'No pudimos completar tu solicitud. Inténtalo de nuevo.',
      resend: 'No pudimos reenviar el correo. Inténtalo de nuevo.',
    },
    accepted: {
      body: 'Puedes volver a iniciar sesión después de verificar tu correo.',
      sent: 'Correo de verificación enviado. Revisa tu bandeja de entrada.',
      resendHint: '¿No recibiste el correo?',
      resendSending: 'Enviando…',
      resendButton: 'Reenviar correo de verificación',
      signInLink: 'Iniciar sesión',
    },
    switch: {
      toRegister: '¿Eres nuevo en Construx?',
      toLogin: '¿Ya tienes una cuenta?',
      registerLink: 'Crear una cuenta',
      loginLink: 'Iniciar sesión',
    },
    account: {
      checking: 'Verificando tu sesión…',
      loading: 'Cargando…',
      signedInAs: 'Sesión iniciada como',
      signOut: 'Cerrar sesión',
    },
    verifyStatus: 'Verificación exitosa.',
    verifyFailedBody:
      'El enlace de verificación venció o ya fue usado. Los enlaces funcionan una sola vez y vencen a las 24 horas.',
    verifyRegisterLink: 'Crear una cuenta',
    divider: 'o',
    google: 'Continuar con Google',
  },
  validation: {
    emailRequired: 'Ingresa tu correo electrónico',
    emailInvalid: 'Ingresa un correo electrónico válido',
    passwordRequired: 'Ingresa tu contraseña',
    passwordMin: 'Usa al menos 12 caracteres',
  },
  onboarding: {
    continue: 'Continuar',
  },
  home: {
    navLabel: 'Espacio de trabajo',
    nav: {
      home: 'Inicio',
      sites: 'Obras',
      people: 'Personas',
      products: 'Productos',
      finance: 'Finanzas',
      crm: 'CRM',
    },
    allSites: 'Todas las obras',
    dataAsOf: 'Datos al {date}',
    overviewTitle: 'Resumen del espacio de trabajo',
    overviewDescription: 'Las obras, el equipo y la posición financiera de tu empresa de un vistazo.',
    addSite: 'Agregar obra',
    finance: 'Finanzas',
    noData: 'Sin datos',
    savings: 'Ahorro',
    overrun: 'Sobrecosto',
    budget: 'Presupuesto',
    recordedCost: 'Costo registrado',
    budgetRecorded: '{percent}% del presupuesto registrado',
    people: 'Personas',
    peopleCaption: '{count} miembros del equipo · {assigned} asignados esta semana',
    sites: 'Obras',
    sitesActive: '{count} activas',
    atRisk: 'En riesgo',
    onSchedule: 'En plazo',
    recentActivity: 'Actividad reciente',
  },
}

export const messages: Record<Locale, Messages> = { en, es }
