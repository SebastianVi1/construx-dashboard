import { describe, expect, it } from 'bun:test'
import { questionSchema } from '../../../components/modal/question'

describe('questionSchema', () => {
  it('accepts a valid single-select question', () => {
    const result = questionSchema.safeParse({
      id: 'role',
      title: 'What best describes your role?',
      options: [
        { id: 'owner', label: 'Owner / Developer' },
        { id: 'contractor', label: 'General contractor' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an optional description', () => {
    expect(
      questionSchema.safeParse({
        id: 'role',
        title: 'Role',
        description: 'Pick the closest match.',
        options: [{ id: 'a', label: 'A' }],
      }).success,
    ).toBe(true)
  })

  it('rejects a question without options', () => {
    expect(questionSchema.safeParse({ id: 'role', title: 'Role', options: [] }).success).toBe(false)
  })

  it('rejects duplicate option ids', () => {
    expect(
      questionSchema.safeParse({
        id: 'role',
        title: 'Role',
        options: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects an empty title or option label', () => {
    expect(questionSchema.safeParse({ id: 'role', title: '', options: [{ id: 'a', label: 'A' }] }).success).toBe(false)
    expect(questionSchema.safeParse({ id: 'role', title: 'Role', options: [{ id: 'a', label: '' }] }).success).toBe(false)
  })
})
