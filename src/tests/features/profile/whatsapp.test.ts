import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  changeWhatsAppLanguage,
  createLinkCode,
  getWhatsAppStatus,
  unlinkWhatsApp,
  whatsappErrorKind,
} from '../../../features/profile/whatsappApi'
import {
  checkWhatsAppLink,
  formatCountdown,
  linkProgress,
  maskNumber,
  qrPath,
  secondsLeft,
} from '../../../features/profile/whatsappLink'
import { recordGuideMarks } from '../../support/guideMarks'

const csrfHeaders = {
  withCredentials: true,
  headers: { 'X-XSRF-TOKEN': 'proof', Accept: 'application/problem+json, application/json' },
}
const unlinked = { linked: false, number: null, language: null, linkedAt: null, construxNumber: '+15550000001' }
const linked = {
  linked: true,
  number: '+525512345678',
  language: 'es' as const,
  linkedAt: '2026-11-24T10:00:00Z',
  construxNumber: '+15550000001',
}
const code = {
  code: 'CX-4821',
  expiresAt: '2026-11-24T10:10:00Z',
  construxNumber: '+15550000001',
  waMeUrl: 'https://wa.me/15550000001?text=CX-4821',
}
const marks = recordGuideMarks()
afterEach(() => mock.restore())

function withCsrf(handlers: Record<string, unknown>) {
  const get = mock(async () => ({ data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }))
  configureHttp({ baseUrl: '/api', client: { get, ...handlers } as unknown as AxiosInstance })
}

describe('whatsapp api', () => {
  it('reads the link status, linked or not', async () => {
    const get = mock(async () => ({ status: 200, data: unlinked }))
    configureHttp({ baseUrl: '/api', client: { get } as unknown as AxiosInstance })
    expect(await getWhatsAppStatus()).toEqual(unlinked)
    expect((get.mock.calls[0] as unknown as [string])[0]).toBe('/api/profile/whatsapp')
  })

  it('asks for a link code in the dashboard language', async () => {
    const post = mock(async () => ({ status: 201, data: code }))
    withCsrf({ post })
    expect(await createLinkCode('es')).toEqual(code)
    expect(post.mock.calls[0] as unknown as unknown[]).toEqual(['/api/profile/whatsapp/link-code', { language: 'es' }, csrfHeaders])
  })

  it('changes the bot language and unlinks', async () => {
    const put = mock(async () => ({ status: 200, data: { ...linked, language: 'en' } }))
    const del = mock(async () => ({ status: 204, data: '' }))
    withCsrf({ put, delete: del })
    expect((await changeWhatsAppLanguage('en')).language).toBe('en')
    expect(put.mock.calls[0] as unknown as unknown[]).toEqual(['/api/profile/whatsapp/language', { language: 'en' }, csrfHeaders])
    await unlinkWhatsApp()
    expect((del.mock.calls[0] as unknown as [string])[0]).toBe('/api/profile/whatsapp')
  })

  it('tells a number that is no longer linked from other failures', () => {
    expect(whatsappErrorKind(new ApiError(404, undefined, 'WHATSAPP_NOT_LINKED'))).toBe('notLinked')
    expect(whatsappErrorKind(new ApiError(401))).toBe('session')
    expect(whatsappErrorKind(new ApiError(500))).toBe('generic')
    expect(whatsappErrorKind(new Error('offline'))).toBe('generic')
  })
})

describe('maskNumber', () => {
  it('hides every digit but the last four', () => {
    expect(maskNumber('+525512345678')).toBe('•••• 5678')
    expect(maskNumber('+1234')).toBe('•••• 1234')
  })
})

describe('countdown', () => {
  const now = Date.parse('2026-11-24T10:00:00Z')

  it('counts whole seconds down to zero', () => {
    expect(secondsLeft('2026-11-24T10:10:00Z', now)).toBe(600)
    expect(secondsLeft('2026-11-24T10:00:00.400Z', now)).toBe(1)
    expect(secondsLeft('2026-11-24T09:59:00Z', now)).toBe(0)
  })

  it('shows minutes and seconds', () => {
    expect(formatCountdown(600)).toBe('10:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(0)).toBe('0:00')
  })
})

describe('linkProgress', () => {
  const now = Date.parse('2026-11-24T10:05:00Z')

  it('keeps polling while the code is alive and stops once linked or expired', () => {
    expect(linkProgress(unlinked, code.expiresAt, now)).toBe('waiting')
    expect(linkProgress(linked, code.expiresAt, now)).toBe('linked')
    expect(linkProgress(unlinked, code.expiresAt, Date.parse('2026-11-24T10:10:00Z'))).toBe('expired')
    expect(linkProgress(linked, code.expiresAt, Date.parse('2026-11-24T10:10:00Z'))).toBe('linked')
  })
})

describe('checkWhatsAppLink', () => {
  it('ticks the guide step once the number is linked', async () => {
    expect(await checkWhatsAppLink('org-1', async () => linked)).toEqual(linked)
    expect(marks).toEqual([{ stepId: 'link-whatsapp', organizationId: 'org-1' }])
  })

  it('marks nothing while unlinked or when the check fails', async () => {
    expect(await checkWhatsAppLink('org-1', async () => unlinked)).toEqual(unlinked)
    await expect(checkWhatsAppLink('org-1', async () => { throw new ApiError(500) })).rejects.toThrow()
    expect(marks).toEqual([])
  })
})

describe('qrPath', () => {
  it('draws one unit square per dark module', () => {
    expect(qrPath([[true, false], [false, true]])).toBe('M0 0h1v1h-1zM1 1h1v1h-1z')
    expect(qrPath([[false]])).toBe('')
  })
})
