import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { cssLengthPx, TARGET_WAIT_MS, tourSelector, type TourLabels, type TourStop } from './tour'
import './tour.css'

/** driver.js renders popover text as HTML; ours is plain text. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** The `--cx-radius-md` token in pixels, so the spotlight's hole matches the controls it frames. */
function radiusMdPx(): number {
  const root = getComputedStyle(document.documentElement)
  return cssLengthPx(root.getPropertyValue('--cx-radius-md'), parseFloat(root.fontSize), 8)
}

/**
 * Draw the spotlight with driver.js, starting on `first` (already found).
 * Later stops wait up to `TARGET_WAIT_MS` for their target. Clicking the
 * highlighted control moves on; past the last stop the tour closes, so a
 * dialog it opens is never under the overlay. Returns the function that
 * closes it; `onEnd` runs however it ends.
 * Loaded only by `startTour` (dynamic import) so driver.js stays out of the main bundle.
 */
export function openSpotlight(first: Element, stops: TourStop[], labels: TourLabels, onEnd: () => void): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const single = stops.length === 1
  const steps: DriveStep[] = stops.map((stop, index) => ({
    element: index === 0 ? first : tourSelector(stop.target),
    advanceOn: 'click',
    popover: { title: escapeHtml(stop.title), description: escapeHtml(stop.body) },
  }))

  const tour = driver({
    steps,
    animate: !reduceMotion,
    smoothScroll: !reduceMotion,
    overlayColor: 'var(--cx-canvas)',
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: radiusMdPx(),
    popoverOffset: 12,
    popoverClass: 'guide-tour',
    waitForElement: TARGET_WAIT_MS,
    showProgress: !single,
    showButtons: single ? ['next', 'close'] : ['next', 'previous', 'close'],
    progressText: labels.progress,
    nextBtnText: labels.next,
    prevBtnText: labels.previous,
    doneBtnText: labels.done,
    closeBtnLabel: labels.close,
    onDestroyed: () => {
      window.removeEventListener('popstate', close)
      onEnd()
    },
  })

  // Browser back leaves the page the tour points at.
  function close() {
    if (tour.isActive()) tour.destroy()
  }
  window.addEventListener('popstate', close)

  tour.drive()
  return close
}
