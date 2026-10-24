import type { Question } from '../../components/modal'

export type OnboardingAnswers = Record<string, string>

/**
 * Additional-information questions collected after registration. Replace with
 * the real questions (backend/config) once that contract is defined — the
 * modal and store consume any `Question[]`, so swapping data needs no changes.
 */
export const onboardingQuestions: Question[] = [
  {
    id: 'role',
    title: 'What best describes your role?',
    options: [
      { id: 'owner', label: 'Owner / Developer' },
      { id: 'contractor', label: 'General contractor' },
      { id: 'architect', label: 'Architect / Engineer' },
      { id: 'subcontractor', label: 'Subcontractor' },
    ],
  },
]

export function isOnboardingComplete(questions: Question[], answers: OnboardingAnswers): boolean {
  return questions.every((question) => Boolean(answers[question.id]))
}
