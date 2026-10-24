/**
 * Minimal placeholder interpolation: `formatMessage('Hi {name}', { name: 'Ada' })`
 * → `'Hi Ada'`. Unknown placeholders are left untouched so a typo in a key is
 * visible instead of silently vanishing.
 */
export function formatMessage(message: string, params: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}
