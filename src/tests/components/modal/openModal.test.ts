import { describe, expect, it } from 'bun:test'
import { isModalOpen } from '../../../components/modal/openModal'

describe('isModalOpen', () => {
  it('reports an open modal when its overlay is present', () => {
    const queried: string[] = []
    const root = {
      querySelector: (selector: string) => {
        queried.push(selector)
        return {} as Element
      },
    }
    expect(isModalOpen(root)).toBe(true)
    expect(queried).toEqual(['.modal-overlay'])
  })

  it('reports no open modal when the overlay is absent', () => {
    expect(isModalOpen({ querySelector: () => null })).toBe(false)
  })
})
