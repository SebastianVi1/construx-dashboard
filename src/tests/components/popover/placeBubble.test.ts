import { describe, expect, it } from 'bun:test'
import { placeBubble } from '../../../components/popover/placeBubble'

const viewport = { width: 1000, height: 800 }
const bubble = { width: 300, height: 200 }

describe('placeBubble', () => {
  it('sits above the anchor, centred on it, when there is room', () => {
    const p = placeBubble({ top: 400, left: 490, width: 20, height: 20 }, bubble, viewport)
    expect(p).toEqual({ side: 'top', top: 190, left: 350, arrowLeft: 150 })
  })

  it('drops below an anchor near the top of the screen', () => {
    const p = placeBubble({ top: 40, left: 490, width: 20, height: 20 }, bubble, viewport)
    expect(p.side).toBe('bottom')
    expect(p.top).toBe(70)
  })

  it('stays inside the viewport and keeps the arrow on the anchor', () => {
    const p = placeBubble({ top: 400, left: 0, width: 20, height: 20 }, bubble, viewport)
    expect(p.left).toBe(16)
    expect(p.arrowLeft).toBe(14)
    const right = placeBubble({ top: 400, left: 975, width: 20, height: 20 }, bubble, viewport)
    expect(right.left).toBe(684)
    expect(right.arrowLeft).toBe(286 - 0)
  })

  it('picks the roomier side when it fits on neither', () => {
    const tall = { width: 300, height: 700 }
    expect(placeBubble({ top: 600, left: 490, width: 20, height: 20 }, tall, viewport).side).toBe('top')
    expect(placeBubble({ top: 100, left: 490, width: 20, height: 20 }, tall, viewport).side).toBe('bottom')
  })
})
