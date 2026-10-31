import { describe, expect, it } from 'bun:test'
import type { ExcelRecord } from '../../../features/excel/excelModel'
import type { SaveState } from '../../../features/excel/excelSaveQueue'
import { createSaveQueue } from '../../../features/excel/excelSaveQueue'
import { ExcelStoreError } from '../../../features/excel/excelStore'

const record = (id: string) => ({ id }) as ExcelRecord

/** A queue whose timer only fires when the test calls `run()`. */
function setup(save: (record: ExcelRecord) => Promise<void>) {
  let scheduled: (() => void) | null = null
  const states: SaveState[] = []
  const queue = createSaveQueue({
    save,
    schedule: (run) => {
      scheduled = run
      return () => {
        scheduled = null
      }
    },
    onState: (state) => states.push(state),
  })
  const run = async () => {
    const task = scheduled
    scheduled = null
    task?.()
    await Bun.sleep(0)
  }
  return { queue, run, states }
}

describe('createSaveQueue', () => {
  it('saves only the latest record after the delay', async () => {
    const saved: string[] = []
    const { queue, run, states } = setup(async (item) => {
      saved.push(item.id)
    })
    queue.push(record('r1'))
    queue.push(record('r2'))
    expect(queue.hasUnsaved()).toBe(true)
    await run()
    expect(saved).toEqual(['r2'])
    expect(states.at(-1)).toBe('idle')
    expect(queue.hasUnsaved()).toBe(false)
  })

  it('reports a failure and keeps the edit unsaved', async () => {
    const { queue, run, states } = setup(async () => {
      throw new ExcelStoreError('quota')
    })
    queue.push(record('r1'))
    await run()
    expect(states.at(-1)).toBe('error')
    expect(queue.hasUnsaved()).toBe(true)
  })

  it('retries the newest record on the next push', async () => {
    let fail = true
    const saved: string[] = []
    const { queue, run, states } = setup(async (item) => {
      if (fail) throw new ExcelStoreError('quota')
      saved.push(item.id)
    })
    queue.push(record('r1'))
    await run()
    fail = false
    queue.push(record('r3'))
    await run()
    expect(saved).toEqual(['r3'])
    expect(states.at(-1)).toBe('idle')
    expect(queue.hasUnsaved()).toBe(false)
  })

  it('flush saves immediately', async () => {
    const saved: string[] = []
    const { queue } = setup(async (item) => {
      saved.push(item.id)
    })
    queue.push(record('r1'))
    await queue.flush()
    expect(saved).toEqual(['r1'])
    expect(queue.hasUnsaved()).toBe(false)
  })
})
