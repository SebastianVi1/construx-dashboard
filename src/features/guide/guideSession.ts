/**
 * Whether the member has opened the guide in this browser tab's session. Until
 * they have, the launcher glows now and then to be noticed; a reload keeps the
 * answer, a new tab starts over. Kept in `sessionStorage`, never sent anywhere.
 */

/** Subset of `Storage` this needs; tests pass a fake. */
export type GuideSessionStorage = Pick<Storage, 'getItem' | 'setItem'>

export const GUIDE_OPENED_KEY = 'construx.guide.opened'

function sessionStore(): GuideSessionStorage | undefined {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

/** True once `rememberGuideOpened` ran in this session. False when storage is missing or blocked. Never throws. */
export function guideOpenedThisSession(storage: GuideSessionStorage | undefined = sessionStore()): boolean {
  try {
    return storage?.getItem(GUIDE_OPENED_KEY) === '1'
  } catch {
    return false
  }
}

/** Record that the guide was opened. A failed write is ignored (the glow then stops for this page only). Never throws. */
export function rememberGuideOpened(storage: GuideSessionStorage | undefined = sessionStore()): void {
  try {
    storage?.setItem(GUIDE_OPENED_KEY, '1')
  } catch {
    // Blocked storage: nothing to keep.
  }
}
