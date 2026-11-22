import { useEffect, useEffectEvent, useState } from 'react'
import { useTourForm } from '../guide'

/** Which "Add site" dialog is open: blank from the page, or pre-filled by the guided tour. */
export type CreateSiteMode = 'blank' | 'tour'

export type CreateSiteDialogState = {
  mode: CreateSiteMode | null
  /** "Add site" on the page: always blank, and never reported to the tour. */
  openBlank: () => void
  /** The dialog's close (Cancel, Esc, close button). A tour-opened one tells the tour it closed unsaved. */
  close: () => void
  /** Passed to the tour-opened dialog only: a failed save shows "Not saved yet" in the tour. */
  onFailed: (() => void) | undefined
}

/**
 * The "Add site" dialog of `SitesPage`, kept in step with the guided tour
 * (`useTourForm('site')`) while rendering, so no effect is needed to open or
 * close it:
 * - the tour asks for its pre-filled form: open it in tour mode (replacing a blank one);
 * - the tour stops running the step ("Leave tour", a save, another step): close a
 *   tour-opened dialog without reporting it.
 * Only "the form is open" goes back to the tour from an effect, because it updates
 * the guide's provider, which can't happen while this page renders.
 */
export function useCreateSiteDialog(canCreate: boolean): CreateSiteDialogState {
  const tourForm = useTourForm('site')
  const [mode, setMode] = useState<CreateSiteMode | null>(null)

  if (tourForm.requested && canCreate && mode !== 'tour') setMode('tour')
  else if (mode === 'tour' && !tourForm.running) setMode(null)

  const reportOpened = useEffectEvent(() => tourForm.opened())
  const tourOpen = mode === 'tour'
  const requested = tourForm.requested
  useEffect(() => {
    if (tourOpen && requested) reportOpened()
  }, [tourOpen, requested])

  return {
    mode,
    openBlank: () => setMode('blank'),
    close: () => {
      if (mode === 'tour') tourForm.closed()
      setMode(null)
    },
    onFailed: mode === 'tour' ? tourForm.failed : undefined,
  }
}
