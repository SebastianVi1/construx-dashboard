import { describe, expect, it } from 'bun:test'
import type { Question } from '../../components/modal'
import { isOnboardingComplete } from './questions'

const twoQuestions: Question[] = [
  { id: 'a', title: 'A', options: [{ id: '1', label: 'One' }] },
  { id: 'b', title: 'B', options: [{ id: '1', label: 'One' }] },
]

describe('isOnboardingComplete', () => {
  it('is false when nothing is answered', () => {
    expect(isOnboardingComplete(twoQuestions, {})).toBe(false)
  })

  it('is false when only some questions are answered', () => {
    expect(isOnboardingComplete(twoQuestions, { a: '1' })).toBe(false)
  })

  it('is true when every question has an answer', () => {
    expect(isOnboardingComplete(twoQuestions, { a: '1', b: '1' })).toBe(true)
  })
})
