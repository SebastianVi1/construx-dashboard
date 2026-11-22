import { describe, expect, it } from 'bun:test'
import type { GuideStepEntry } from '../../../features/guide/catalog'
import type { TourStepEntry } from '../../../features/guide/tourCatalog'
import { cssLengthPx, tourSelector, tourStops, waitForTarget, type TargetRoot } from '../../../features/guide/tour'

/** An element as the wait sees it: rendered when it has a layout box. */
function fakeElement(rendered = true): Element {
  return { getClientRects: () => (rendered ? [{}] : []) } as unknown as Element
}

/** A page whose elements for `selector` can be added later. */
function fakeRoot(selector: string) {
  const elements: Element[] = []
  const root: TargetRoot = {
    querySelectorAll: (asked: string) => (asked === selector ? [...elements] : []),
  }
  return { root, add: (element: Element) => elements.push(element) }
}

const selector = '[data-tour="site-create"]'

describe('tourSelector', () => {
  it('finds a target by its data-tour value', () => {
    expect(tourSelector('site-create')).toBe(selector)
  })
})

describe('tourStops', () => {
  it('reads a guided tour entry and uses its step and target texts', () => {
    const entry: TourStepEntry = {
      id: 'tour-site', page: 'sites', requires: ['hasCompany'], tourTargets: ['site-create-save'], textKey: 'site',
    }
    expect(tourStops([entry], {
      steps: { site: { title: 'Create a Site', body: 'Start here.' } },
      targets: { 'site-create-save': { title: 'Save the Site', body: 'Finish the form.' } },
    })).toEqual([{ target: 'site-create-save', title: 'Save the Site', body: 'Finish the form.' }])
    expect(tourStops([entry], {
      steps: { site: { title: 'Create a Site', body: 'Start here.' } },
      targets: {},
    })).toEqual([{ target: 'site-create-save', title: 'Create a Site', body: 'Start here.' }])
  })

  const step = (id: string, textKey: string, tourTargets: string[]) =>
    ({ id, sections: ['owner'], requires: [], page: 'sites', chapter: 'sites', tourTargets, textKey }) as unknown as GuideStepEntry
  const texts = {
    steps: {
      createSite: { title: 'Create your first site', body: 'Everything starts here.' },
      openSite: { title: 'Open your site', body: 'Find the site you run.' },
    },
    targets: { 'site-list': { title: 'Your sites', body: 'Pick one to open it.' } },
  }

  it('highlights every target of every step in order, with its own text or else its step\'s', () => {
    const stops = tourStops([step('create-site', 'createSite', ['site-create']), step('open-site', 'openSite', ['site-list'])], texts)
    expect(stops).toEqual([
      { target: 'site-create', title: 'Create your first site', body: 'Everything starts here.' },
      { target: 'site-list', title: 'Your sites', body: 'Pick one to open it.' },
    ])
  })

  it('highlights a target shared by two steps once, with the first step\'s text', () => {
    const stops = tourStops([step('create-site', 'createSite', ['site-create']), step('open-site', 'openSite', ['site-create'])], texts)
    expect(stops).toEqual([{ target: 'site-create', title: 'Create your first site', body: 'Everything starts here.' }])
  })

  it('has nothing to show for steps without targets', () => {
    expect(tourStops([step('create-site', 'createSite', [])], texts)).toEqual([])
  })
})

describe('waitForTarget', () => {
  it('resolves to the target once it appears', async () => {
    const page = fakeRoot(selector)
    const target = fakeElement()
    setTimeout(() => page.add(target), 20)
    expect(await waitForTarget(selector, { root: page.root, timeoutMs: 500, intervalMs: 5 })).toBe(target)
  })

  it('resolves to null after the timeout when the target never appears', async () => {
    const page = fakeRoot(selector)
    const started = Date.now()
    expect(await waitForTarget(selector, { root: page.root, timeoutMs: 40, intervalMs: 5 })).toBeNull()
    expect(Date.now() - started).toBeGreaterThanOrEqual(35)
  })

  it('does not count a target that is in the page but not shown', async () => {
    const page = fakeRoot(selector)
    page.add(fakeElement(false))
    expect(await waitForTarget(selector, { root: page.root, timeoutMs: 30, intervalMs: 5 })).toBeNull()
  })

  it('picks the shown one when several elements carry the target', async () => {
    const page = fakeRoot(selector)
    const shown = fakeElement()
    page.add(fakeElement(false))
    page.add(shown)
    expect(await waitForTarget(selector, { root: page.root, timeoutMs: 30, intervalMs: 5 })).toBe(shown)
  })

  it('stops waiting and resolves to null when cancelled', async () => {
    const page = fakeRoot(selector)
    const cancel = new AbortController()
    setTimeout(() => cancel.abort(), 10)
    setTimeout(() => page.add(fakeElement()), 30)
    const started = Date.now()
    const found = await waitForTarget(selector, { root: page.root, timeoutMs: 1000, intervalMs: 5, signal: cancel.signal })
    expect(found).toBeNull()
    expect(Date.now() - started).toBeLessThan(500)
  })
})

describe('cssLengthPx', () => {
  it('reads rem against the root font size, and px as is', () => {
    expect(cssLengthPx('0.5rem', 16, 8)).toBe(8)
    expect(cssLengthPx(' 0.75rem', 20, 8)).toBe(15)
    expect(cssLengthPx('10px', 16, 8)).toBe(10)
  })

  it('falls back when the token is missing or not a length it reads', () => {
    expect(cssLengthPx('', 16, 8)).toBe(8)
    expect(cssLengthPx('var(--other)', 16, 8)).toBe(8)
    expect(cssLengthPx('1em', 16, 8)).toBe(8)
    expect(cssLengthPx('0.5rem', Number.NaN, 8)).toBe(8)
  })
})
