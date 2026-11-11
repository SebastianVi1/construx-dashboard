import { z } from 'zod'
import type { ExchangeRate } from './money'

/** Public, keyless and CORS-enabled; the European Central Bank reference rate. */
export const EXCHANGE_RATE_URL = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=MXN'

export const EXCHANGE_RATE_STORAGE_KEY = 'construx.exchangeRate'

/** The rate is published once a day, so a cached one is reused for a day. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

const responseSchema = z
  .array(z.object({ date: z.string(), quote: z.literal('MXN'), rate: z.number().positive() }))
  .min(1)

const cachedSchema = z.object({
  mxnPerUsd: z.number().positive(),
  date: z.string(),
  fetchedAt: z.number(),
})

export type CachedRate = z.infer<typeof cachedSchema>

export async function fetchExchangeRate(fetchImpl: typeof fetch = fetch): Promise<ExchangeRate> {
  const response = await fetchImpl(EXCHANGE_RATE_URL)
  if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`)
  const [latest] = responseSchema.parse(await response.json())
  return { mxnPerUsd: latest.rate, date: latest.date }
}

/** A stored rate, or null when it is missing or not in the expected shape. */
export function parseCachedRate(raw: string | null): CachedRate | null {
  if (!raw) return null
  try {
    const parsed = cachedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function isFresh(cached: CachedRate, now: number): boolean {
  return now - cached.fetchedAt < MAX_AGE_MS
}
