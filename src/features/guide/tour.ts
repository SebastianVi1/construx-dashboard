import { PHONE_QUERY } from '../../lib/breakpoints'
import type { GuideStepEntry } from './catalog'

/**
 * Spotlight tours. A tour is a list of stops, one per `data-tour` target;
 * later stops wait for their target too, and clicking a highlighted control
 * moves on, so a step can lead through a tab or a dialog. driver.js loads
 * only when a tour starts (`spotlight.ts`). Pages add `data-tour` attributes
 * and catalog entries; nothing here names a page, step or target.
 */

/** How long a tour waits for a target before giving up (ticket #85: 4 s). */
export const TARGET_WAIT_MS = 4000

export type GuideText = { title: string; body: string }

/** One highlighted target and the popover shown beside it. */
export type TourStop = { target: string } & GuideText

/** Popover controls, in the current language. `progress` keeps driver.js's `{{current}}` and `{{total}}`. */
export type TourLabels = { next: string; previous: string; done: string; close: string; progress: string }

/**
 * `shown`: the spotlight is up. `fallback`: the first target never showed
 * (or there was none), so the caller shows the step's text instead.
 * `cancelled`: a newer tour or `destroyActiveTour` replaced this one.
 */
export type TourResult = 'shown' | 'fallback' | 'cancelled'

/** Where targets are looked up; `document` in the app, a fake in tests. */
export type TargetRoot = { querySelectorAll(selectors: string): ArrayLike<Element> }

export type WaitOptions = {
  timeoutMs?: number
  root?: TargetRoot
  /** How often the page is checked again. */
  intervalMs?: number
  /** Aborting stops the wait at once with null (a newer tour, or the Company changed). */
  signal?: AbortSignal
}

/** CSS selector of a `data-tour` target. Values are plain ids (`catalogProblems` checks them). */
export function tourSelector(target: string): string {
  return `[data-tour="${target}"]`
}

/**
 * The stops for some steps, in order: each target once, with its own text
 * from `texts.targets` when it has one, otherwise its step's title and body.
 */
export function tourStops(
  steps: GuideStepEntry[],
  texts: { steps: Record<string, GuideText>; targets: Partial<Record<string, GuideText>> },
): TourStop[] {
  const stops: TourStop[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    for (const target of step.tourTargets) {
      if (seen.has(target)) continue
      seen.add(target)
      stops.push({ target, ...(texts.targets[target] ?? texts.steps[step.textKey]) })
    }
  }
  return stops
}

/**
 * Wait for the first rendered element matching `selector`. Resolves with it
 * as soon as it shows, or with null after `timeoutMs` or when `signal`
 * aborts. Never rejects. Polls rather than observing mutations, so a target
 * that only becomes visible (no DOM change) is still found.
 */
export function waitForTarget(selector: string, options: WaitOptions = {}): Promise<Element | null> {
  const { timeoutMs = TARGET_WAIT_MS, root = document, intervalMs = 100, signal } = options
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (element: Element | null) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(element)
    }
    const onAbort = () => finish(null)
    const check = () => {
      if (signal?.aborted) return finish(null)
      const found = Array.from(root.querySelectorAll(selector)).find((element) => element.getClientRects().length > 0)
      if (found) return finish(found)
      if (Date.now() >= deadline) return finish(null)
      timer = setTimeout(check, intervalMs)
    }
    signal?.addEventListener('abort', onAbort)
    check()
  })
}

const CSS_LENGTH = /^(\d*\.?\d+)(rem|px)$/

/**
 * A CSS length token (`0.5rem`, `8px`) in pixels, with rem read against the
 * root font size; `fallback` for anything else (missing token, other units).
 */
export function cssLengthPx(value: string, rootFontPx: number, fallback: number): number {
  const match = CSS_LENGTH.exec(value.trim())
  if (!match) return fallback
  const px = Number(match[1]) * (match[2] === 'rem' ? rootFontPx : 1)
  return Number.isFinite(px) ? px : fallback
}

/** Phones (`PHONE_QUERY`) never get a spotlight: "Show me" only navigates there. */
export function isPhoneWidth(): boolean {
  return window.matchMedia(PHONE_QUERY).matches
}

type ActiveTour = { controller: AbortController; close?: () => void }

/** The one tour that may run; a new one replaces it. */
let active: ActiveTour | null = null

/** Close the running tour, or stop one still waiting for its target. Safe to call any time. */
export function destroyActiveTour(): void {
  const current = active
  active = null
  if (!current) return
  current.controller.abort()
  current.close?.()
}

/**
 * Start a spotlight tour over `stops`, replacing any running one. Waits up to
 * `TARGET_WAIT_MS` for the first target; if it never shows, no overlay is
 * drawn and the result is `fallback`. Never rejects. Callers skip it on
 * phones (`isPhoneWidth`).
 */
export async function startTour(stops: TourStop[], labels: TourLabels): Promise<TourResult> {
  destroyActiveTour()
  if (stops.length === 0) return 'fallback'
  const run: ActiveTour = { controller: new AbortController() }
  active = run
  try {
    const [first, spotlight] = await Promise.all([
      waitForTarget(tourSelector(stops[0].target), { signal: run.controller.signal }),
      import('./spotlight'),
    ])
    if (active !== run) return 'cancelled'
    if (!first) {
      active = null
      return 'fallback'
    }
    run.close = spotlight.openSpotlight(first, stops, labels, () => {
      if (active === run) active = null
    })
    return 'shown'
  } catch {
    // driver.js failed to load: the panel shows the text instead.
    if (active === run) active = null
    return 'fallback'
  }
}
