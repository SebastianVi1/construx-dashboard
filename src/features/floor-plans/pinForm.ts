import { TEXT_LIMITS } from '../../components/form'
import { MAX_PIN_PHOTOS } from './pinPhoto'
import type { Pin, PinKind } from './pinsApi'

export const PIN_TITLE_MAX = TEXT_LIMITS.pinTitle
export const PIN_DESCRIPTION_MAX = TEXT_LIMITS.longText

export type PinValues = {
  kind: PinKind
  title: string
  description: string
  /** Empty string: nobody. */
  assigneeMembershipId: string
  /** Photos picked so far, uploaded or not. */
  photoCount: number
}

export type PinErrorKey = 'titleRequired' | 'titleMax' | 'descriptionMax' | 'photoRequired' | 'photoLimit'
export type PinErrors = Partial<Record<'title' | 'description' | 'photos', PinErrorKey>>

/** The rules the API applies to a new pin, so the form can show them before anything is uploaded. */
export function pinErrors(values: PinValues): PinErrors {
  const errors: PinErrors = {}
  const title = values.title.trim()
  if (values.kind === 'ISSUE' && title.length === 0) errors.title = 'titleRequired'
  else if (title.length > PIN_TITLE_MAX) errors.title = 'titleMax'
  if (values.description.trim().length > PIN_DESCRIPTION_MAX) errors.description = 'descriptionMax'
  if (values.kind === 'PHOTO' && values.photoCount === 0) errors.photos = 'photoRequired'
  else if (values.photoCount > MAX_PIN_PHOTOS) errors.photos = 'photoLimit'
  return errors
}

/** The text fields as the API takes them: trimmed, blanks as null, no assignee on a progress photo. */
export function pinInput(values: PinValues): {
  title: string | null
  description: string | null
  assigneeMembershipId: string | null
} {
  return {
    title: values.title.trim() || null,
    description: values.description.trim() || null,
    assigneeMembershipId: values.kind === 'ISSUE' && values.assigneeMembershipId ? values.assigneeMembershipId : null,
  }
}

/** Closed issues clutter the plan, so they show only on request; progress photos always show. */
export function visiblePins(pins: Pin[], { showClosed }: { showClosed: boolean }): Pin[] {
  return showClosed ? pins : pins.filter((pin) => pin.status !== 'CLOSED')
}

/** The nearest point on the plan image, for a tap that lands just outside it. */
export function clampToBounds(x: number, y: number, width: number, height: number): [number, number] {
  return [Math.min(Math.max(x, 0), width), Math.min(Math.max(y, 0), height)]
}
