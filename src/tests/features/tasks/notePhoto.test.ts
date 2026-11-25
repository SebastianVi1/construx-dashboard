import { describe, expect, it } from 'bun:test'
import { uploadNotePhoto } from '../../../features/tasks/notePhoto'
import { progressNoteMaxPhotos } from '../../../features/tasks/progressNotesApi'
import { PhotoTooLargeError, MAX_PHOTO_BYTES } from '../../../features/floor-plans/pinPhoto'

const at = { organizationId: 'o1', siteId: 's1', goalId: 'g1' }
const file = (size: number, type = 'image/jpeg') => new File([new Uint8Array(size)], 'site.jpg', { type })
const ticket = { key: 'orgs/k1', uploadUrl: 'https://s3/put', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: 'x' }

describe('uploadNotePhoto', () => {
  it('allows the five photos a note holds', () => {
    expect(progressNoteMaxPhotos).toBe(5)
  })

  it('shrinks to a JPEG or PNG, asks the task for a ticket, sends it and returns the key', async () => {
    const small = file(2000)
    const asked: unknown[][] = []
    const sent: Blob[] = []
    const key = await uploadNotePhoto(at, 't1', file(9_000_000, 'image/webp'), {
      compress: async (_file, accepted) => {
        expect(accepted).toEqual(['image/jpeg', 'image/png'])
        return small
      },
      request: async (...args) => {
        asked.push(args)
        return ticket
      },
      send: async (_ticket, body) => {
        sent.push(body)
      },
    })
    expect(key).toBe('orgs/k1')
    expect(asked).toEqual([[at, 't1', 'image/jpeg', 2000]])
    expect(sent[0]).toBe(small)
  })

  it('refuses a photo still over 5 MB after shrinking, before asking the API', async () => {
    let asked = false
    const upload = uploadNotePhoto(at, 't1', file(10), {
      compress: async () => file(MAX_PHOTO_BYTES + 1),
      request: async () => {
        asked = true
        return ticket
      },
      send: async () => {},
    })
    await expect(upload).rejects.toBeInstanceOf(PhotoTooLargeError)
    expect(asked).toBe(false)
  })
})
