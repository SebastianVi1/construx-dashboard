import { describe, expect, it } from 'bun:test'
import {
  MAX_FINAL_BYTES,
  MAX_ORIGINAL_BYTES,
  SKIP_COMPRESSION_BELOW,
  compressedFileName,
  pickSmaller,
  planFileIssue,
  planNameIssue,
  scaledSize,
  shouldCompress,
} from './planUpload'

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

  it('scaledSize: keeps the long edge at 6000 px at most, preserving the aspect ratio', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 4000, height: 3000 })
    expect(scaledSize(12000, 6000)).toEqual({ width: 6000, height: 3000 })
    expect(scaledSize(3000, 9000)).toEqual({ width: 2000, height: 6000 })
    expect(scaledSize(7001, 1)).toEqual({ width: 6000, height: 1 })
  })

  it('compressedFileName: swaps the extension for the new type', () => {
    expect(compressedFileName('Ground floor.png', 'image/webp')).toBe('Ground floor.webp')
    expect(compressedFileName('scan', 'image/webp')).toBe('scan.webp')
    expect(compressedFileName('a.b.JPG', 'image/jpeg')).toBe('a.b.jpg')
  })

  it('pickSmaller: keeps the original when compression did not help or produced an unsupported type', () => {
    const original = file('plan.png', 'image/png', 3 * MB)
    const smaller = new Blob([new Uint8Array(MB)], { type: 'image/webp' })
    const picked = pickSmaller(original, smaller)
    expect(picked).not.toBe(original)
    expect(picked.name).toBe('plan.webp')
    expect(picked.type).toBe('image/webp')
    expect(picked.size).toBe(MB)

    expect(pickSmaller(original, null)).toBe(original)
    expect(pickSmaller(original, new Blob([new Uint8Array(4 * MB)], { type: 'image/webp' }))).toBe(original)
    expect(pickSmaller(original, new Blob([new Uint8Array(MB)], { type: 'image/bmp' }))).toBe(original)
    expect(MAX_FINAL_BYTES).toBe(20 * MB)
  })
})
