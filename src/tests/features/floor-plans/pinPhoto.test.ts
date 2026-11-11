import { describe, expect, it } from 'bun:test'
import { MAX_PHOTO_BYTES, MAX_PIN_PHOTOS, PinPhotoTooLargeError, uploadPinPhoto } from '../../../features/floor-plans/pinPhoto'
import { StorageUploadError } from '../../../features/plans/plansApi'

const file = (size: number, type = 'image/jpeg') => new File([new Uint8Array(size)], 'site.jpg', { type })
const ticket = { key: 'pins/k1', uploadUrl: 'https://s3/put', headers: { 'Content-Type': 'image/webp' }, expiresAt: 'x' }

describe('uploadPinPhoto', () => {
  it('keeps the limits the API enforces', () => {
    expect(MAX_PIN_PHOTOS).toBe(10)
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024)
  })

  it('shrinks, asks for a ticket for the shrunk file, sends it and returns the key', async () => {
    const small = file(2000, 'image/webp')
    const asked: Array<[string, number]> = []
    const sent: Blob[] = []
    const key = await uploadPinPhoto('o1', 's1', 'fp1', file(9_000_000), {
      compress: async () => small,
      request: async (_o, _s, _p, type, size) => {
        asked.push([type, size])
        return ticket
      },
      send: async (_ticket, body) => {
        sent.push(body)
      },
    })
    expect(key).toBe('pins/k1')
    expect(asked).toEqual([['image/webp', 2000]])
    expect(sent[0]).toBe(small)
  })

  it('refuses a photo still over 5 MB after shrinking, before asking the API', async () => {
    let asked = false
    const upload = uploadPinPhoto('o1', 's1', 'fp1', file(10), {
      compress: async () => file(MAX_PHOTO_BYTES + 1),
      request: async () => {
        asked = true
        return ticket
      },
      send: async () => {},
    })
    await expect(upload).rejects.toBeInstanceOf(PinPhotoTooLargeError)
    expect(asked).toBe(false)
  })

  it('lets a failed transfer reach the form so it can offer a retry', async () => {
    const upload = uploadPinPhoto('o1', 's1', 'fp1', file(10), {
      compress: async (f) => f,
      request: async () => ticket,
      send: async () => {
        throw new StorageUploadError(0)
      },
    })
    await expect(upload).rejects.toBeInstanceOf(StorageUploadError)
  })
})
