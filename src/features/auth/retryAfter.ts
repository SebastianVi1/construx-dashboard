import { formatMessage } from '../../i18n/format'

type RateLimitTexts = {
  /** Generic text used when the wait time is unknown. */
  rateLimited: string
  /** Text with a `{seconds}` placeholder. */
  rateLimitedRetry: string
}

/** Rate-limit message, naming the wait from `Retry-After` when it is a positive number. */
export function rateLimitText(texts: RateLimitTexts, retryAfterSeconds?: number): string {
  if (retryAfterSeconds === undefined || !(retryAfterSeconds > 0)) return texts.rateLimited
  return formatMessage(texts.rateLimitedRetry, { seconds: Math.ceil(retryAfterSeconds) })
}
