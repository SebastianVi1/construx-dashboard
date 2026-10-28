import { describe, expect, it } from 'bun:test'
import {
  clampPhaseResize,
  clampTaskMove,
  clampTaskResize,
  createClickGuard,
  phaseMove,
  pxToDays,
  shiftInstant,
} from './drag'

const at = (d: number, h = 0) => new Date(2027, 0, d, h).toISOString()
const phase = { startAt: at(1, 8), dueAt: at(31, 18) }

describe('pxToDays', () => {
  it('snaps a pointer distance to whole days at the zoom scale', () => {
    expect(pxToDays(59, 'day')).toBe(1)
    expect(pxToDays(61, 'day')).toBe(2)
    expect(pxToDays(-61, 'day')).toBe(-2)
    expect(pxToDays(7, 'week')).toBe(0)
    expect(pxToDays(9, 'week')).toBe(1)
    expect(pxToDays(2, 'month')).toBe(0)
    expect(Object.is(pxToDays(-2, 'day'), 0)).toBe(true)
  })
})

describe('shiftInstant', () => {
  it('moves an instant by whole days', () => {
    expect(shiftInstant('2027-01-10T08:00:00.000Z', 3)).toBe('2027-01-13T08:00:00.000Z')
    expect(shiftInstant('2027-01-10T08:00:00.000Z', -10)).toBe('2026-12-31T08:00:00.000Z')
  })
})

describe('clampTaskMove', () => {
  const task = { startAt: at(10, 8), dueAt: at(12, 18) }

  it('keeps the moved task inside its phase', () => {
    expect(clampTaskMove(task, phase, 5)).toBe(5)
    expect(clampTaskMove(task, phase, -9)).toBe(-9)
    expect(clampTaskMove(task, phase, -20)).toBe(-9)
    expect(clampTaskMove(task, phase, 19)).toBe(19)
    expect(clampTaskMove(task, phase, 40)).toBe(19)
  })

  it('stops a day short when the time of day would cross the phase edge', () => {
    const early = { startAt: at(3, 7), dueAt: at(4, 7) }
    expect(clampTaskMove(early, phase, -2)).toBe(-1)
  })

  it('does not move a task that already fills its phase', () => {
    expect(clampTaskMove(phase, phase, 3)).toBe(0)
  })
})

describe('clampTaskResize', () => {
  const task = { startAt: at(10, 8), dueAt: at(12, 18) }

  it('moves the start between the phase start and the due', () => {
    expect(clampTaskResize(task, phase, 'start', -4)).toBe(-4)
    expect(clampTaskResize(task, phase, 'start', -30)).toBe(-9)
    expect(clampTaskResize(task, phase, 'start', 2)).toBe(2)
    expect(clampTaskResize(task, phase, 'start', 5)).toBe(2)
  })

  it('moves the due between the start and the phase due', () => {
    expect(clampTaskResize(task, phase, 'end', 10)).toBe(10)
    expect(clampTaskResize(task, phase, 'end', 30)).toBe(19)
    expect(clampTaskResize(task, phase, 'end', -2)).toBe(-2)
    expect(clampTaskResize(task, phase, 'end', -5)).toBe(-2)
  })
})

describe('clampPhaseResize', () => {
  const tasks = [
    { startAt: at(5, 8), dueAt: at(8, 18) },
    { startAt: at(9, 8), dueAt: at(20, 12) },
  ]

  it('stops the start at the earliest task start, free to move earlier', () => {
    expect(clampPhaseResize(phase, tasks, 'start', 4)).toBe(4)
    expect(clampPhaseResize(phase, tasks, 'start', 6)).toBe(4)
    expect(clampPhaseResize(phase, tasks, 'start', -12)).toBe(-12)
  })

  it('stops the due at the latest task due, free to move later', () => {
    expect(clampPhaseResize(phase, tasks, 'end', -11)).toBe(-11)
    expect(clampPhaseResize(phase, tasks, 'end', -15)).toBe(-11)
    expect(clampPhaseResize(phase, tasks, 'end', 7)).toBe(7)
  })

  it('an empty phase stops where it would start after it ends', () => {
    expect(clampPhaseResize(phase, [], 'start', 40)).toBe(30)
    expect(clampPhaseResize(phase, [], 'end', -40)).toBe(-30)
  })
})

describe('phaseMove', () => {
  it('turns a body drag into the days for the shift call, or null when it snaps to zero', () => {
    expect(phaseMove(85, 'day')).toBe(2)
    expect(phaseMove(-33, 'week')).toBe(-2)
    expect(phaseMove(10, 'day')).toBeNull()
  })
})

describe('createClickGuard', () => {
  it('swallows only the mouse click that ends a drag', () => {
    const guard = createClickGuard()
    guard.press()
    guard.dragged()
    expect(guard.swallow(1)).toBe(true)
    expect(guard.swallow(1)).toBe(false)
  })

  it('lets the next tap through after a touch drag, which fires no click', () => {
    const guard = createClickGuard()
    guard.press()
    guard.dragged()
    guard.press()
    expect(guard.swallow(1)).toBe(false)
  })

  it('never swallows a keyboard click (Enter or Space reports detail 0)', () => {
    const guard = createClickGuard()
    guard.press()
    guard.dragged()
    expect(guard.swallow(0)).toBe(false)
    expect(guard.swallow(1)).toBe(false)
  })
})
