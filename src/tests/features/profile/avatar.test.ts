import { describe, expect, mock, test } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import { ImageCompressionError } from '../../../lib/image'
import { StorageUploadError } from '../../../features/plans/plansApi'
import {
  avatarErrorKind,
  avatarFileProblem,
  AvatarTooLargeError,
  MAX_AVATAR_BYTES,
  MAX_AVATAR_ORIGINAL_BYTES,
  profileSchema,
  removeAvatar,
  uploadAvatar,
} from '../../../features/profile/profileApi'

const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }
const ticket = { key: 'users/u-1/avatar/a', uploadUrl: 'https://bucket.test/put', headers: { 'Content-Type': 'image/png' }, expiresAt: '2026-11-08T10:10:00Z' }
const saved = { fullName: 'Ada', phoneNumber: null, trade: null, avatarUrl: 'https://bucket.test/view' }

function stubApi() {
  const get = mock(async () => csrfOk)
  const post = mock<(url: string, body?: unknown) => Promise<unknown>>(async () => ({ status: 201, data: ticket }))
  const put = mock<(url: string, body?: unknown) => Promise<unknown>>(async () => ({ status: 200, data: saved }))
  const del = mock<(url: string) => Promise<unknown>>(async () => ({ status: 204, data: '' }))
  const client = { get, post, put, patch: put, delete: del }
  configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
  return { post, put, del }
}

describe('avatarFileProblem', () => {
  test('accepts JPEG, PNG and WebP up to 20 MB before compressing', () => {
    expect(avatarFileProblem({ type: 'image/webp', size: MAX_AVATAR_ORIGINAL_BYTES })).toBeNull()
  })

  test('rejects other types and larger files', () => {
    expect(avatarFileProblem({ type: 'image/gif', size: 10 })).toBe('fileType')
    expect(avatarFileProblem({ type: 'image/png', size: MAX_AVATAR_ORIGINAL_BYTES + 1 })).toBe('tooLarge')
  })
})

describe('uploadAvatar', () => {
  test('compresses, presigns, sends the compressed bytes to storage, then saves the key', async () => {
    const api = stubApi()
    const send = mock<(ticket: unknown, body: Blob) => Promise<void>>(async () => {})
    const original = new File(['a large png'], 'me.png', { type: 'image/png' })
    const compressed = new File(['webp'], 'me.webp', { type: 'image/webp' })
    const compress = mock<(file: File) => Promise<File>>(async () => compressed)

    const profile = await uploadAvatar(original, { compress, send })

    expect(compress.mock.calls[0]?.[0]).toBe(original)
    expect(api.post.mock.calls[0]?.[0]).toBe('/api/profile/avatar/uploads')
    expect(api.post.mock.calls[0]?.[1]).toEqual({ contentType: 'image/webp', sizeBytes: 4 })
    expect(send.mock.calls[0]?.[0]).toEqual(ticket)
    expect(send.mock.calls[0]?.[1]).toBe(compressed)
    expect(api.put.mock.calls[0]?.[0]).toBe('/api/profile/avatar')
    expect(api.put.mock.calls[0]?.[1]).toEqual({ key: ticket.key })
    expect(profile.avatarUrl).toBe('https://bucket.test/view')
  })

  test('does not save the key when storage rejects the upload', async () => {
    const api = stubApi()
    const send = mock<(ticket: unknown, body: Blob) => Promise<void>>(async () => {
      throw new StorageUploadError(403)
    })

    const file = new File(['x'], 'x.png', { type: 'image/png' })
    await expect(uploadAvatar(file, { compress: async (f) => f, send })).rejects.toBeInstanceOf(StorageUploadError)
    expect(api.put).not.toHaveBeenCalled()
  })

  test('does not ask the API when the photo cannot be compressed', async () => {
    const api = stubApi()
    const compress = async (): Promise<File> => {
      throw new ImageCompressionError()
    }

    await expect(uploadAvatar(new File(['x'], 'x.png', { type: 'image/png' }), { compress })).rejects.toBeInstanceOf(
      ImageCompressionError,
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  test('refuses a photo still over 5 MB after compressing, before asking the API', async () => {
    const api = stubApi()
    const big = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], 'big.png', { type: 'image/png' })

    await expect(uploadAvatar(big, { compress: async (f) => f })).rejects.toBeInstanceOf(AvatarTooLargeError)
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('removeAvatar', () => {
  test('deletes the photo', async () => {
    const api = stubApi()
    await removeAvatar()
    expect(api.del.mock.calls[0]?.[0]).toBe('/api/profile/avatar')
  })
})

describe('avatarErrorKind and profileSchema', () => {
  test('maps storage and API failures', () => {
    expect(avatarErrorKind(new ImageCompressionError())).toBe('compressFailed')
    expect(avatarErrorKind(new AvatarTooLargeError())).toBe('tooLarge')
    expect(avatarErrorKind(new StorageUploadError(0))).toBe('uploadFailed')
    expect(avatarErrorKind(new ApiError(400))).toBe('invalid')
    expect(avatarErrorKind(new ApiError(401))).toBe('session')
    expect(avatarErrorKind(new Error('x'))).toBe('generic')
  })

  test('treats a missing avatarUrl as no photo', () => {
    expect(profileSchema.parse({ fullName: null, phoneNumber: null, trade: null }).avatarUrl).toBeNull()
  })
})
