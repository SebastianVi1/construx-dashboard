import { describe, expect, it } from 'bun:test'
import { createGuideSaves } from '../../../features/guide/guideSaves'
import type { GuideStepStatus } from '../../../features/guide/guideApi'

type Sent = ['step', string, GuideStepStatus] | ['dismiss', boolean]

/** A fake server: records each save and fails while `offline` is set. */
function fakeServer() {
  const sent: Sent[] = []
  const server = {
    offline: false,
    sent,
    markStep: async (stepId: string, status: GuideStepStatus) => {
      sent.push(['step', stepId, status])
      if (server.offline) throw new Error('offline')
    },
    setDismissed: async (dismissed: boolean) => {
      sent.push(['dismiss', dismissed])
      if (server.offline) throw new Error('offline')
    },
  }
  return server
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('guide saves', () => {
  it('sends a step save and a dismiss save right away', async () => {
    const server = fakeServer()
    const saves = createGuideSaves(server)

    saves.step('create-site', 'COMPLETED')
    saves.dismiss(false)
    await settle()

    expect(server.sent).toEqual([
      ['step', 'create-site', 'COMPLETED'],
      ['dismiss', false],
    ])
  })

  it('retries a failed save once, on the next retry, and not again after it succeeds', async () => {
    const server = fakeServer()
    const saves = createGuideSaves(server)
    server.offline = true
    saves.step('create-site', 'COMPLETED')
    saves.dismiss(true)
    await settle()

    server.offline = false
    saves.retryFailed()
    await settle()
    saves.retryFailed()
    await settle()

    expect(server.sent).toEqual([
      ['step', 'create-site', 'COMPLETED'],
      ['dismiss', true],
      ['step', 'create-site', 'COMPLETED'],
      ['dismiss', true],
    ])
  })

  it('keeps a save that fails again for the following retry', async () => {
    const server = fakeServer()
    const saves = createGuideSaves(server)
    server.offline = true
    saves.step('create-site', 'SKIPPED')
    await settle()
    saves.retryFailed()
    await settle()

    server.offline = false
    saves.retryFailed()
    await settle()

    expect(server.sent).toEqual([
      ['step', 'create-site', 'SKIPPED'],
      ['step', 'create-site', 'SKIPPED'],
      ['step', 'create-site', 'SKIPPED'],
    ])
  })

  it('a newer save of the same step replaces the failed one, so a retry never undoes it', async () => {
    const server = fakeServer()
    const saves = createGuideSaves(server)
    server.offline = true
    saves.step('create-site', 'SKIPPED')
    await settle()

    server.offline = false
    saves.step('create-site', 'COMPLETED')
    await settle()
    saves.retryFailed()
    await settle()

    expect(server.sent).toEqual([
      ['step', 'create-site', 'SKIPPED'],
      ['step', 'create-site', 'COMPLETED'],
    ])
  })

  it('does nothing on retry when nothing failed', async () => {
    const server = fakeServer()
    createGuideSaves(server).retryFailed()
    await settle()
    expect(server.sent).toEqual([])
  })
})
