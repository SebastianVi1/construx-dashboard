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
