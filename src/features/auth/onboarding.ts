import type { Question } from '../../components/modal'

/**
 * Placeholder onboarding question shown right after registration. Replace with
 * the real additional-information questions (from the backend or product
 * config) once that contract is defined. The modal consumes any `Question`, so
 * swapping this out needs no component changes.
 */
export const onboardingQuestion: Question = {
  id: 'role',
  title: 'What best describes your role?',
  options: [
    { id: 'owner', label: 'Owner / Developer' },
    { id: 'contractor', label: 'General contractor' },
    { id: 'architect', label: 'Architect / Engineer' },
    { id: 'subcontractor', label: 'Subcontractor' },
  ],
}
