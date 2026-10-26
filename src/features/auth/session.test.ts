import { describe, expect, it, mock } from 'bun:test'
import { AuthApiError } from './authApi'
import { restoreSession, shareInFlight } from './session'

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

describe('shareInFlight', () => {
  it('runs one call for concurrent callers and allows a new one afterwards', async () => {
    let release: () => void = () => {}
    const task = mock(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const shared = shareInFlight(task)

    const first = shared()
    const second = shared()
    expect(task).toHaveBeenCalledTimes(1)
    release()
    await Promise.all([first, second])

    const third = shared()
    expect(task).toHaveBeenCalledTimes(2)
    release()
    await third
  })

  it('clears the in-flight call when it fails', async () => {
    const task = mock(async () => {
      throw new AuthApiError(401)
    })
    const shared = shareInFlight(task)

    await expect(shared()).rejects.toBeInstanceOf(AuthApiError)
    await expect(shared()).rejects.toBeInstanceOf(AuthApiError)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
