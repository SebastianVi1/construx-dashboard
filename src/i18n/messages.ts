import type { DeepStringify } from './defineMessages'
import type { Locale } from './locale'
import { rolesMessages } from '../features/permissions/messages'
import { authMessages } from '../features/auth/messages'
import { onboardingMessages } from '../features/onboarding/messages'
import { organizationsMessages, workspaceMessages } from '../features/organizations/messages'
import { documentsMessages } from '../features/documents/messages'
import { profileMessages } from '../features/profile/messages'
import { sitesMessages } from '../features/sites/messages'
import { reportsMessages } from '../features/reports/messages'
import { plansMessages } from '../features/plans/messages'
import { floorPlansMessages } from '../features/floor-plans/messages'
import { financeMessages } from '../features/finance/messages'
import { excelMessages } from '../features/excel/messages'
import { materialsMessages } from '../features/materials/messages'
import { membersMessages } from '../features/members/messages'
import { goalsMessages, phasesPageMessages } from '../features/goals/messages'
import { ganttMessages } from '../features/gantt/messages'
import { tasksMessages } from '../features/tasks/messages'
import { invitationsMessages } from '../features/invitations/messages'
import { homeMessages } from '../features/home/messages'
import { orgFinanceMessages } from '../features/org-finance/messages'
import { crewsMessages, equipmentMessages } from '../features/crews/messages'

const en = {
  common: {
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
  },
  auth: authMessages.en,
  validation: {
    nameRequired: 'Enter your name',
    nameMax: 'Use at most 100 characters',
    emailRequired: 'Enter your email address',
    emailInvalid: 'Enter a valid email address',
    passwordRequired: 'Enter your password',
    passwordMin: 'Use at least 12 characters',
    passwordMax: 'Use at most 72 characters',
    passwordMismatch: 'The passwords do not match',
  },
  onboarding: onboardingMessages.en,
  organizations: organizationsMessages.en,
  workspace: workspaceMessages.en,
  documents: documentsMessages.en,
  profile: profileMessages.en,
  roles: rolesMessages.en,
  sites: sitesMessages.en,
  reports: reportsMessages.en,
  plans: plansMessages.en,
  floorPlans: floorPlansMessages.en,
  finance: financeMessages.en,
  excel: excelMessages.en,
  materials: materialsMessages.en,
  members: membersMessages.en,
  goals: goalsMessages.en,
  phasesPage: phasesPageMessages.en,
  gantt: ganttMessages.en,
  tasks: tasksMessages.en,
  invitations: invitationsMessages.en,
  home: homeMessages.en,
  orgFinance: orgFinanceMessages.en,
  crews: crewsMessages.en,
  equipment: equipmentMessages.en,
}

export type Messages = DeepStringify<typeof en>

const es: Messages = {
  common: {
    language: 'Idioma',
    theme: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
  },
  auth: authMessages.es,
  validation: {
    nameRequired: 'Ingresa tu nombre',
    nameMax: 'Usa como máximo 100 caracteres',
    emailRequired: 'Ingresa tu correo electrónico',
    emailInvalid: 'Ingresa un correo electrónico válido',
    passwordRequired: 'Ingresa tu contraseña',
    passwordMin: 'Usa al menos 12 caracteres',
    passwordMax: 'Usa como máximo 72 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
  },
  onboarding: onboardingMessages.es,
  organizations: organizationsMessages.es,
  workspace: workspaceMessages.es,
  documents: documentsMessages.es,
  profile: profileMessages.es,
  roles: rolesMessages.es,
  sites: sitesMessages.es,
  reports: reportsMessages.es,
  plans: plansMessages.es,
  floorPlans: floorPlansMessages.es,
  finance: financeMessages.es,
  excel: excelMessages.es,
  materials: materialsMessages.es,
  members: membersMessages.es,
  goals: goalsMessages.es,
  phasesPage: phasesPageMessages.es,
  gantt: ganttMessages.es,
  tasks: tasksMessages.es,
  invitations: invitationsMessages.es,
  home: homeMessages.es,
  orgFinance: orgFinanceMessages.es,
  crews: crewsMessages.es,
  equipment: equipmentMessages.es,
}

export const messages: Record<Locale, Messages> = { en, es }
