import type { Question } from '../../components/modal'
import type { Messages } from '../../i18n'

/**
 * The two onboarding questions. Option ids are the backend enum values of
 * `PUT /api/onboarding`, so a selected id is sent as is.
 */
export function makeIntentQuestion(m: Messages['onboarding']): Question {
  return {
    id: 'intent',
    title: m.intent.title,
    description: m.intent.description,
    options: [
      { id: 'RUN_COMPANY', label: m.intent.runCompany },
      { id: 'WORKER_OR_INVITED', label: m.intent.workerOrInvited },
    ],
  }
}

export function makeBusinessTypeQuestion(m: Messages['onboarding']): Question {
  return {
    id: 'businessType',
    title: m.businessType.title,
    description: m.businessType.description,
    options: [
      { id: 'OWNER_DEVELOPER', label: m.businessType.ownerDeveloper },
      { id: 'GENERAL_CONTRACTOR', label: m.businessType.generalContractor },
      { id: 'ARCHITECT_ENGINEER', label: m.businessType.architectEngineer },
      { id: 'SUBCONTRACTOR', label: m.businessType.subcontractor },
    ],
  }
}
