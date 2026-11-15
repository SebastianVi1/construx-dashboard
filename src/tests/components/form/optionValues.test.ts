import { describe, expect, it } from 'bun:test'
import { selectedOptionValues, toggleOptionValue } from '../../../components/form/optionValues'

describe('checkbox-group field values', () => {
  it('reads selected values and treats malformed data as empty', () => {
    expect(selectedOptionValues('["member-1","member-2"]')).toEqual(['member-1', 'member-2'])
    expect(selectedOptionValues('not-json')).toEqual([])
    expect(selectedOptionValues('[1]')).toEqual([])
  })

  it('toggles a choice without changing the order of the others', () => {
    expect(toggleOptionValue('["member-1","member-2"]', 'member-1')).toBe('["member-2"]')
    expect(toggleOptionValue('["member-1"]', 'member-2')).toBe('["member-1","member-2"]')
  })
})
