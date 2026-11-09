import type { DeepStringify } from './defineMessages'
import type { Locale } from './locale'
import { commonMessages } from './slices/common'
import { validationMessages } from './slices/validation'
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

// Assembly only: each slice lives next to its feature (features/*/messages.ts) or in ./slices
// for shared strings, with English and Spanish side by side via defineMessages.
const en = {
  common: commonMessages.en,
  auth: authMessages.en,
  validation: validationMessages.en,
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
  common: commonMessages.es,
  auth: authMessages.es,
  validation: validationMessages.es,
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
