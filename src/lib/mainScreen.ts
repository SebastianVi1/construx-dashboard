/**
 * Routes that own the workspace navigation: the screens a person lands on after
 * picking a section. Anything reached from inside one of them (a site and its
 * tabs, a detail page) is a section, so it opens without a held placeholder.
 */
const MAIN_SCREENS = new Set([
  '/finance',
  '/sites',
  '/tasks',
  '/materials',
  '/excel',
  '/documents',
  '/crews',
  '/equipment',
  '/members',
  '/account',
])

/** Whether `pathname` is a main screen, where the first load holds its skeleton long enough to read. */
export function isMainScreen(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return MAIN_SCREENS.has(path)
}
