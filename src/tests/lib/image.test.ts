import { describe, expect, it } from 'bun:test'
import { compressedFileName, pickSmaller, scaledSize } from '../../lib/image'

const MB = 1024 * 1024

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('image compression helpers', () => {
  it('scaledSize: keeps the long edge at maxEdge at most, preserving the aspect ratio', () => {
    expect(scaledSize(4000, 3000, 6000)).toEqual({ width: 4000, height: 3000 })
    expect(scaledSize(12000, 6000, 6000)).toEqual({ width: 6000, height: 3000 })
    expect(scaledSize(3000, 9000, 6000)).toEqual({ width: 2000, height: 6000 })
    expect(scaledSize(7001, 1, 6000)).toEqual({ width: 6000, height: 1 })
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
  })
})
