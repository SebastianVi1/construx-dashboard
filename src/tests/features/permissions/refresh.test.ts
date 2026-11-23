import { describe, expect, it } from 'bun:test'
import { ACCESS_REFRESH_MIN_MS, watchAccessFreshness } from '../../../features/permissions/accessRefresh'

/** A page whose visibility the test flips, with a clock it moves by hand. */
function fakePage() {
  const page = new EventTarget()
  let visible = true
  let clock = 1_000_000
  let reloads = 0
  const watcher = watchAccessFreshness({
    page,
    isVisible: () => visible,
    reload: () => {
      reloads += 1
    },
    now: () => clock,
  })
  return {
    watcher,
    reloads: () => reloads,
    advance: (ms: number) => {
      clock += ms
    },
    hide: () => {
      visible = false
      page.dispatchEvent(new Event('visibilitychange'))
    },
    show: () => {
      visible = true
      page.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

describe('watchAccessFreshness', () => {
  it('permissionsRefetchOnVisibilityAndRouteChangeAtMostEvery30s', () => {
    const page = fakePage()

    // The first load just happened: nothing to refresh yet.
    page.watcher.routeChanged()
    page.show()
    expect(page.reloads()).toBe(0)

    page.advance(ACCESS_REFRESH_MIN_MS)
    page.watcher.routeChanged()
    expect(page.reloads()).toBe(1)

    // Back to the tab right after: still inside the 30 s window.
    page.advance(10_000)
    page.hide()
    page.show()
    expect(page.reloads()).toBe(1)

    page.advance(20_000)
    page.hide()
    page.show()
    expect(page.reloads()).toBe(2)
  })

  it('does not refetch when the tab is hidden', () => {
    const page = fakePage()
    page.advance(60_000)

    page.hide()

    expect(page.reloads()).toBe(0)
  })

  it('stops listening once stopped', () => {
    const page = fakePage()
    page.advance(60_000)

    page.watcher.stop()
    page.show()
    page.watcher.routeChanged()

    expect(page.reloads()).toBe(0)
  })
})
