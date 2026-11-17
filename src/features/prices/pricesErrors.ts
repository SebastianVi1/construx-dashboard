import { ApiError } from '../../lib/http'

export type PricesLoadKind = 'generic' | 'forbidden' | 'session' | 'notFound'

/** Which message a failed catalog read shows. */
export function pricesLoadKind(error: unknown): PricesLoadKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}
