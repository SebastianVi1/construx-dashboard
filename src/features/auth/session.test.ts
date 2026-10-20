import { describe, expect, it, mock } from 'bun:test'
import { AuthApiError } from './authApi'
import { restoreSession } from './session'

const user = { id: 1, email: 'person@example.com' }

describe('restoreSession', () => {
  it('returns the user when /me succeeds without refreshing', async () => {
    const getCurrentUser = mock(async () => user)
    const refresh = mock(async () => {})
    const result = await restoreSession(getCurrentUser, refresh)

    expect(result).toEqual({ status: 'authenticated', user })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(0)
  })

  it('refreshes once and retries /me after a 401', async () => {
    let calls = 0
    const getCurrentUser = mock(async () => {
      calls += 1
      if (calls === 1) throw new AuthApiError(401)
      return user
    })
    const refresh = mock(async () => {})
    const result = await restoreSession(getCurrentUser, refresh)

    expect(result).toEqual({ status: 'authenticated', user })
    expect(getCurrentUser).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('returns unauthenticated when refresh fails', async () => {
    const getCurrentUser = mock(async () => {
      throw new AuthApiError(401)
    })
    const refresh = mock(async () => {
      throw new AuthApiError()
    })
    const result = await restoreSession(getCurrentUser, refresh)

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('returns unauthenticated when the retry after refresh still 401s', async () => {
    const getCurrentUser = mock(async () => {
      throw new AuthApiError(401)
    })
    const refresh = mock(async () => {})
    const result = await restoreSession(getCurrentUser, refresh)

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(getCurrentUser).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on a non-401 failure', async () => {
    const getCurrentUser = mock(async () => {
      throw new AuthApiError(500)
    })
    const refresh = mock(async () => {})
    const result = await restoreSession(getCurrentUser, refresh)

    expect(result).toEqual({ status: 'unauthenticated' })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(0)
  })
})
