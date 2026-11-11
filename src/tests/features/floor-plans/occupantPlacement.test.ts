import { describe, expect, it } from 'bun:test'
import { occupantStripSize, placeOccupants, type Box } from '../../../features/floor-plans/occupantPlacement'

// Screen pixels, y grows downwards
const zone: Box = { minX: 100, minY: 100, maxX: 200, maxY: 180 }
const size = { width: 50, height: 26 }

describe('placeOccupants', () => {
  it('sits above the zone, centred, when nothing is in the way', () => {
    expect(placeOccupants(zone, size, [])).toEqual({ side: 'above', x: 150, y: 100 - 6 - 13 })
  })

  it('moves to the right when another zone touches the top edge', () => {
    const neighbour: Box = { minX: 90, minY: 20, maxX: 210, maxY: 100 }
    expect(placeOccupants(zone, size, [neighbour])).toEqual({ side: 'right', x: 200 + 6 + 25, y: 140 })
  })

  it('tries the left, then below, as the other sides fill up', () => {
    const top: Box = { minX: 90, minY: 20, maxX: 210, maxY: 100 }
    const right: Box = { minX: 200, minY: 90, maxX: 300, maxY: 190 }
    expect(placeOccupants(zone, size, [top, right]).side).toBe('left')
    const left: Box = { minX: 0, minY: 90, maxX: 100, maxY: 190 }
    expect(placeOccupants(zone, size, [top, right, left])).toEqual({ side: 'below', x: 150, y: 180 + 6 + 13 })
  })

  it('avoids a pin standing where the strip would go', () => {
    const pin: Box = { minX: 134, minY: 60, maxX: 166, maxY: 94 }
    expect(placeOccupants(zone, size, [pin]).side).toBe('right')
  })

  it('takes the side that overlaps least when every side is taken', () => {
    const around: Box[] = [
      { minX: 90, minY: 20, maxX: 210, maxY: 100 },
      { minX: 200, minY: 90, maxX: 300, maxY: 190 },
      { minX: 0, minY: 90, maxX: 100, maxY: 190 },
      // Only grazes the strip below the zone
      { minX: 170, minY: 180, maxX: 260, maxY: 260 },
    ]
    expect(placeOccupants(zone, size, around).side).toBe('below')
  })
})

describe('occupantStripSize', () => {
  it('grows by figure up to five in a row, then adds rows', () => {
    expect(occupantStripSize(1)).toEqual({ width: 26, height: 26 })
    expect(occupantStripSize(5)).toEqual({ width: 114, height: 26 })
    expect(occupantStripSize(6)).toEqual({ width: 114, height: 48 })
  })
})
