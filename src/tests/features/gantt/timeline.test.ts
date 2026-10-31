import { describe, expect, it } from 'bun:test'
import { barPosition, buildRange, DAY_MS, dayScale, endsAfterSite, siteWindow, ticks, xOf } from '../../../features/gantt/timeline'

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString()
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime()
const noSite = { startDate: null, expectedEndDate: null }

describe('buildRange', () => {
  it('covers every phase from its start day to its due day, padded by a week on each side', () => {
    const range = buildRange(
      [
        { startAt: at(2027, 1, 10, 8), dueAt: at(2027, 1, 20, 18) },
        { startAt: at(2027, 1, 5, 8), dueAt: at(2027, 2, 2, 9) },
      ],
      noSite,
      new Date(2027, 0, 12),
    )
    expect(range).toEqual({ start: day(2026, 12, 29), end: day(2027, 2, 10) })
  })

  it('stretches to the site window and to today', () => {
    const range = buildRange(
      [{ startAt: at(2027, 1, 10), dueAt: at(2027, 1, 20) }],
      { startDate: '2027-01-01', expectedEndDate: '2027-03-01' },
      new Date(2027, 3, 1, 15),
    )
    expect(range).toEqual({ start: day(2026, 12, 25), end: day(2027, 4, 9) })
  })

  it('without phases or site dates shows the weeks around today', () => {
    expect(buildRange([], noSite, new Date(2027, 0, 12, 10))).toEqual({
      start: day(2027, 1, 5),
      end: day(2027, 2, 12),
    })
  })
})

describe('barPosition', () => {
  const range = { start: day(2027, 1, 1), end: day(2027, 3, 1) }

  it('places a bar from its start day through its due day at each zoom', () => {
    expect(dayScale).toEqual({ day: 40, week: 16, month: 5 })
    expect(barPosition(at(2027, 1, 3, 8), at(2027, 1, 5, 18), range, 'day')).toEqual({ left: 80, width: 120 })
    expect(barPosition(at(2027, 1, 3, 8), at(2027, 1, 5, 18), range, 'week')).toEqual({ left: 32, width: 48 })
    expect(barPosition(at(2027, 1, 3, 8), at(2027, 1, 5, 18), range, 'month')).toEqual({ left: 10, width: 15 })
  })

  it('gives a one-day task a one-day bar', () => {
    expect(barPosition(at(2027, 1, 2, 9), at(2027, 1, 2, 9), range, 'day')).toEqual({ left: 40, width: 40 })
  })

  it('xOf measures any instant from the range start', () => {
    expect(xOf(day(2027, 1, 2) + DAY_MS / 2, range, 'day')).toBe(60)
  })
})

describe('ticks', () => {
  it('day zoom labels every day, naming the month on its first day and at the start', () => {
    const range = { start: day(2027, 1, 30), end: day(2027, 2, 3) }
    expect(ticks(range, 'day', 'en-US')).toEqual([
      { left: 0, label: 'Jan 30' },
      { left: 40, label: '31' },
      { left: 80, label: 'Feb 1' },
      { left: 120, label: '2' },
    ])
  })

  it('week zoom labels every Monday', () => {
    const range = { start: day(2027, 1, 1), end: day(2027, 1, 20) }
    expect(ticks(range, 'week', 'en-US')).toEqual([
      { left: 16 * 3, label: 'Jan 4' },
      { left: 16 * 10, label: 'Jan 11' },
      { left: 16 * 17, label: 'Jan 18' },
    ])
  })

  it('month zoom labels the first of every month, localized', () => {
    const range = { start: day(2026, 12, 20), end: day(2027, 2, 15) }
    expect(ticks(range, 'month', 'es-MX').map((tick) => tick.left)).toEqual([5 * 12, 5 * 43])
    expect(ticks(range, 'month', 'en-US').map((tick) => tick.label)).toEqual(['Jan 2027', 'Feb 2027'])
  })
})

describe('site window', () => {
  const range = { start: day(2027, 1, 1), end: day(2027, 3, 1) }

  it('spans the site from its start day through its expected end day', () => {
    expect(siteWindow({ startDate: '2027-01-03', expectedEndDate: '2027-01-05' }, range, 'day')).toEqual({
      left: 80,
      width: 120,
    })
  })

  it('runs to the edge of the range when one date is missing, and is absent without dates', () => {
    expect(siteWindow({ startDate: '2027-02-28', expectedEndDate: null }, range, 'day')).toEqual({ left: 58 * 40, width: 40 })
    expect(siteWindow({ startDate: null, expectedEndDate: '2027-01-01' }, range, 'day')).toEqual({ left: 0, width: 40 })
    expect(siteWindow(noSite, range, 'day')).toBeNull()
  })

  it('flags a phase that ends after the expected end day', () => {
    const site = { startDate: null, expectedEndDate: '2027-03-01' }
    expect(endsAfterSite({ dueAt: at(2027, 3, 1, 23) }, site)).toBe(false)
    expect(endsAfterSite({ dueAt: at(2027, 3, 2, 0) }, site)).toBe(true)
    expect(endsAfterSite({ dueAt: at(2030, 1, 1) }, noSite)).toBe(false)
  })
})
