import { describe, expect, it } from 'bun:test'
import { clampToBounds, pinErrors, pinInput, pinVariant, visiblePins } from '../../../features/floor-plans/pinForm'
import type { Pin } from '../../../features/floor-plans/pinsApi'

const values = { kind: 'ISSUE' as const, title: 'Cracked tile', description: '', assigneeMembershipId: '', photoCount: 0 }

describe('pinErrors', () => {
  it('accepts an issue with a title and no photo', () => {
    expect(pinErrors(values)).toEqual({})
  })

  it('requires a title on an issue but not on a progress photo', () => {
    expect(pinErrors({ ...values, title: '   ' })).toEqual({ title: 'titleRequired' })
    expect(pinErrors({ ...values, kind: 'PHOTO', title: '', photoCount: 1 })).toEqual({})
  })

  it('limits the title to 120 and the description to 500 characters', () => {
    expect(pinErrors({ ...values, title: 'a'.repeat(120) })).toEqual({})
    expect(pinErrors({ ...values, title: 'a'.repeat(121) })).toEqual({ title: 'titleMax' })
    expect(pinErrors({ ...values, description: 'a'.repeat(501) })).toEqual({ description: 'descriptionMax' })
  })

  it('requires a photo on a progress photo', () => {
    expect(pinErrors({ ...values, kind: 'PHOTO', photoCount: 0 })).toEqual({ photos: 'photoRequired' })
  })

  it('allows at most 10 photos', () => {
    expect(pinErrors({ ...values, photoCount: 10 })).toEqual({})
    expect(pinErrors({ ...values, photoCount: 11 })).toEqual({ photos: 'photoLimit' })
  })
})

describe('pinInput', () => {
  it('trims text and turns blanks into null', () => {
    expect(pinInput({ ...values, title: '  Leak ', description: '  ', assigneeMembershipId: '' })).toEqual({
      title: 'Leak',
      description: null,
      assigneeMembershipId: null,
    })
  })

  it('never sends an assignee for a progress photo', () => {
    expect(pinInput({ ...values, kind: 'PHOTO', title: '', assigneeMembershipId: 'm1' }).assigneeMembershipId).toBeNull()
  })
})

describe('visiblePins', () => {
  const pin = (id: string, kind: Pin['kind'], status: Pin['status']) => ({ id, kind, status }) as Pin
  const pins = [pin('a', 'ISSUE', 'OPEN'), pin('b', 'ISSUE', 'RESOLVED'), pin('c', 'ISSUE', 'CLOSED'), pin('d', 'PHOTO', null)]

  it('hides closed issues unless asked, and never hides progress photos', () => {
    expect(visiblePins(pins, { showClosed: false }).map((p) => p.id)).toEqual(['a', 'b', 'd'])
    expect(visiblePins(pins, { showClosed: true }).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('clampToBounds', () => {
  it('pulls a point back onto the plan image', () => {
    expect(clampToBounds(-5, 9999, 100, 50)).toEqual([0, 50])
    expect(clampToBounds(40, 20, 100, 50)).toEqual([40, 20])
  })
})

describe('pinVariant', () => {
  it('colours issues by status and photos on their own', () => {
    expect(pinVariant({ kind: 'ISSUE', status: 'OPEN' })).toBe('issue-open')
    expect(pinVariant({ kind: 'ISSUE', status: 'RESOLVED' })).toBe('issue-resolved')
    expect(pinVariant({ kind: 'ISSUE', status: 'CLOSED' })).toBe('issue-closed')
    expect(pinVariant({ kind: 'PHOTO', status: null })).toBe('photo')
  })
})
