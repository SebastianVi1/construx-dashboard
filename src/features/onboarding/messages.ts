import { defineMessages } from '../../i18n/defineMessages'

export const onboardingMessages = defineMessages({
  en: {
    continue: 'Continue',
    finish: 'Save answer',
    saving: 'Saving…',
    skip: 'Skip',
    openProfile: 'Complete your profile',
    saveError: 'We could not save your answer. Check your connection and try again.',
    intent: {
      title: 'How will you use Construx?',
      description: 'This decides what we set up for you first. It does not change your permissions.',
      runCompany: 'I run a company',
      workerOrInvited: "I'm a worker or I was invited",
    },
    businessType: {
      title: 'What best describes your business?',
      description: 'Optional. Skip it if none of these fit.',
      ownerDeveloper: 'Owner / Developer',
      generalContractor: 'General contractor',
      architectEngineer: 'Architect / Engineer',
      subcontractor: 'Subcontractor',
    },
  },
  es: {
    continue: 'Continuar',
    finish: 'Guardar respuesta',
    saving: 'Guardando…',
    skip: 'Omitir',
    openProfile: 'Completa tu perfil',
    saveError: 'No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.',
    intent: {
      title: '¿Cómo vas a usar Construx?',
      description: 'Esto define qué preparamos primero para ti. No cambia tus permisos.',
      runCompany: 'Dirijo una empresa',
      workerOrInvited: 'Soy trabajador o me invitaron',
    },
    businessType: {
      title: '¿Qué describe mejor tu negocio?',
      description: 'Opcional. Omítelo si ninguna opción encaja.',
      ownerDeveloper: 'Propietario / Desarrollador',
      generalContractor: 'Contratista general',
      architectEngineer: 'Arquitecto / Ingeniero',
      subcontractor: 'Subcontratista',
    },
  },
})
