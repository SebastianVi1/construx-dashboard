const defaultApiBaseUrl = '/api'

export function getApiBaseUrl(value = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl) {
  const baseUrl = value.trim().replace(/\/+$/, '')

  if (baseUrl.startsWith('/') && !baseUrl.startsWith('//') && !baseUrl.includes('?') && !baseUrl.includes('#')) {
    return baseUrl
  }

  try {
    const url = new URL(baseUrl)
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username && !url.password && !url.search && !url.hash &&
      !url.pathname.includes('..')
    ) {
      return baseUrl
    }
  } catch {
    // Invalid public configuration is reported at the request boundary.
  }

  throw new Error('VITE_API_BASE_URL must be a path or an HTTP(S) URL without credentials, query, or fragment')
}

/**
 * Full URL of the backend's Google OAuth start endpoint, or an empty string
 * when OAuth is not configured. A missing or malformed value returns '' so a
 * broken configuration simply hides the button instead of crashing the app.
 */
export function getOAuth2AuthorizationUrl(
  value = import.meta.env.VITE_OAUTH2_AUTHORIZATION_URL ?? '',
): string {
  const url = value.trim()
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash
    ) {
      return url
    }
  } catch {
    // Invalid configuration is treated as unset.
  }
  return ''
}
