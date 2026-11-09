import { describe, expect, it } from 'bun:test'
import {
  MAX_FINAL_BYTES,
  MAX_ORIGINAL_BYTES,
  SKIP_COMPRESSION_BELOW,
  planFileIssue,
  planNameIssue,
  shouldCompress,
} from '../../../features/plans/planUpload'

const MB = 1024 * 1024

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('plan upload rules', () => {
  it('planFileIssue: accepts JPEG, PNG and WebP up to 50 MB and rejects anything else before compressing', () => {
    expect(planFileIssue(file('a.jpg', 'image/jpeg', 10))).toBeNull()
    expect(planFileIssue(file('a.png', 'image/png', 10))).toBeNull()
    expect(planFileIssue(file('a.webp', 'image/webp', 10))).toBeNull()
    expect(planFileIssue({ type: 'image/png', size: MAX_ORIGINAL_BYTES })).toBeNull()
    expect(planFileIssue(file('a.pdf', 'application/pdf', 10))).toBe('fileType')
    expect(planFileIssue(file('a.gif', 'image/gif', 10))).toBe('fileType')
    expect(planFileIssue({ type: 'image/png', size: MAX_ORIGINAL_BYTES + 1 })).toBe('tooLarge')
    expect(planFileIssue({ type: 'image/png', size: 0 })).toBe('empty')
    expect(MAX_ORIGINAL_BYTES).toBe(50 * MB)
  })

  it('planNameIssue: the name is optional and at most 120 characters after trimming', () => {
    expect(planNameIssue('')).toBeNull()
    expect(planNameIssue(`  ${'x'.repeat(120)}  `)).toBeNull()
    expect(planNameIssue('x'.repeat(121))).toBe('nameTooLong')
  })

  it('shouldCompress: leaves files under 1.5 MB alone', () => {
    expect(SKIP_COMPRESSION_BELOW).toBe(1.5 * MB)
    expect(shouldCompress(1.5 * MB - 1)).toBe(false)
    expect(shouldCompress(1.5 * MB)).toBe(true)
  })

  it('MAX_FINAL_BYTES: the server accepts plans up to 20 MB after compressing', () => {
    expect(MAX_FINAL_BYTES).toBe(20 * MB)
  })
})
