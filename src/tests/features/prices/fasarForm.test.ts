import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { AxiosInstance } from 'axios'
import { ApiError, configureHttp } from '../../../lib/http'
import {
  emptyFasarValues,
  fasarBody,
  fasarValuesFrom,
  fsrIsComputed,
  laborFsrBadge,
  validateFasar,
  workingDays,
  type FasarValues,
} from '../../../features/prices/fasarForm'
import { fasarWriteErrorKind, getFasar, replaceFasar, type Fasar } from '../../../features/prices/pricesApi'

const stored: Fasar = {
  status: 'COMPLETE',
  source: 'MANUAL',
  version: 2,
  year: 2026,
  uma: '86.8800',
  minimumWage: '248.93',
  sumEmployerAndWorker: false,
  days: { calendar: '365', sundays: '52', workedSundays: '0', vacation: '6', mondays: '0', holidays: '7.5', weather: '6', custom: '2', leaveSick: '3', union: '0', bonus: '15' },
  premiums: { vacationPct: '0.25', sundayPct: '0.25', otherChargesPct: '0' },
  caps: { excessThresholdUma: '3', sbcCapUma: '25', factorRounding: 6 },
  contributions: [
    { concept: 'RISK', employerRate: '0.0758875', workerRate: '0' },
    { concept: 'EXCESS_3_UMA', employerRate: '0.011', workerRate: '0.004' },
  ],
  derived: { tp: '381.5', tl: '288.5', tpOverTl: '1.32235702', fsbc: '1.04520548' },
  laborCategories: { total: 3, computed: 3, mismatches: 1 },
  updatedAt: '2026-11-17T10:00:00Z',
  updatedBy: { membershipId: 'm-1', fullName: 'Ana Pérez' },
}

const none: Fasar = {
  status: 'NONE',
  source: null,
  version: null,
  year: null,
  uma: null,
  minimumWage: null,
  sumEmployerAndWorker: null,
  days: null,
  premiums: null,
  caps: null,
  contributions: null,
  derived: null,
  laborCategories: null,
  updatedAt: null,
  updatedBy: null,
}

function filled(): FasarValues {
  return fasarValuesFrom(stored, 2026)
}

describe('FASAR form', () => {
  it('starts a new set with the usual day counts and zero rates', () => {
    const values = fasarValuesFrom(none, 2027)
    expect(values.year).toBe('2027')
    expect(values.days.calendar).toBe('365')
    expect(values.days.sundays).toBe('52')
    expect(values.days.bonus).toBe('15')
    expect(values.contributions.DAYCARE).toEqual({ employerRate: '0', workerRate: '0' })
    expect(values.uma).toBe('')
  })

  it('fills the form from the stored set, keeping missing concepts at zero', () => {
    const values = filled()
    expect(values.uma).toBe('86.8800')
    expect(values.sumEmployerAndWorker).toBe(false)
    expect(values.days.holidays).toBe('7.5')
    expect(values.contributions.RISK.employerRate).toBe('0.0758875')
    expect(values.contributions.INFONAVIT.employerRate).toBe('0')
    expect(values.factorRounding).toBe('6')
  })

  it('accepts a complete set', () => {
    expect(validateFasar(filled())).toEqual({})
  })

  it('reports missing, malformed and out-of-range values per field', () => {
    const values = filled()
    values.uma = ''
    values.minimumWage = '12.345'
    values.days.weather = 'x'
    values.vacationPct = '1.5'
    values.contributions.RISK.workerRate = '0.123456789'
    values.factorRounding = '9'
    values.year = '26'
    expect(validateFasar(values)).toEqual({
      uma: 'required',
      minimumWage: 'decimals',
      'days.weather': 'invalid',
      vacationPct: 'fraction',
      'contributions.RISK.workerRate': 'decimals',
      factorRounding: 'rounding',
      year: 'invalid',
    })
  })

  it('refuses days off that leave no working days', () => {
    const values = filled()
    values.days.sundays = '345'
    expect(workingDays(values)).toBe(-4.5)
    expect(validateFasar(values)).toEqual({ days: 'noWorkingDays' })
  })

  it('counts the working days (Tl) of the worked example', () => {
    expect(workingDays(filled())).toBe(288.5)
    expect(workingDays(emptyFasarValues(2026))).toBe(313)
  })

  it('builds the full replacement body with all twelve concepts and plain decimals', () => {
    const values = filled()
    values.uma = '86.8800'
    values.minimumWage = '248.9'
    const body = fasarBody(values)
    expect(body.year).toBe(2026)
    expect(body.uma).toBe('86.88')
    expect(body.minimumWage).toBe('248.90')
    expect(body.sumEmployerAndWorker).toBe(false)
    expect(body.days.holidays).toBe('7.5')
    expect(body.caps).toEqual({ excessThresholdUma: '3', sbcCapUma: '25', factorRounding: 6 })
    expect(body.contributions).toHaveLength(12)
    expect(body.contributions[0]).toEqual({ concept: 'RISK', employerRate: '0.0758875', workerRate: '0' })
    expect(body.contributions[11].concept).toBe('OTHER_CHARGES')
  })
})

describe('Labor category FSR markers', () => {
  it('computes the FSR only with a complete set', () => {
    expect(fsrIsComputed('COMPLETE')).toBe(true)
    expect(fsrIsComputed('PARTIAL')).toBe(false)
    expect(fsrIsComputed(null)).toBe(false)
  })

  it('marks an imported FSR as not recomputable without a complete set', () => {
    expect(laborFsrBadge({ fsrSource: 'IMPORTED', fsrMismatch: false }, 'PARTIAL')).toBe('notRecomputable')
    expect(laborFsrBadge({ fsrSource: 'IMPORTED', fsrMismatch: false }, 'NONE')).toBe('notRecomputable')
    expect(laborFsrBadge({ fsrSource: 'MANUAL', fsrMismatch: false }, 'NONE')).toBeNull()
  })

  it('flags a computed FSR that disagrees with the file', () => {
    expect(laborFsrBadge({ fsrSource: 'COMPUTED', fsrMismatch: true }, 'COMPLETE')).toBe('mismatch')
    expect(laborFsrBadge({ fsrSource: 'COMPUTED', fsrMismatch: false }, 'COMPLETE')).toBeNull()
  })
})

describe('FASAR API', () => {
  const csrfOk = { data: { headerName: 'X-XSRF-TOKEN', token: 'proof' } }

  afterEach(() => configureHttp({}))

  function stubApi(get: (url: string) => unknown, send: () => unknown = () => ({ status: 200, data: stored })) {
    const getMock = mock(async (url: string) => (url.endsWith('/auth/csrf') ? csrfOk : get(url)))
    const sendMock = mock(async () => send())
    const client = { get: getMock, post: sendMock, patch: sendMock, put: sendMock, delete: sendMock }
    configureHttp({ client: client as unknown as AxiosInstance, baseUrl: '/api' })
    return { get: getMock, send: sendMock }
  }

  it('reads the parameters, NONE included', async () => {
    const { get } = stubApi(() => ({ status: 200, data: none }))
    expect((await getFasar('org-1')).status).toBe('NONE')
    expect(get.mock.calls[0][0]).toBe('/api/organizations/org-1/fasar')
  })

  it('replaces the parameters with a PUT and reads the recomputation', async () => {
    const { send } = stubApi(
      () => undefined,
      () => ({ status: 200, data: { ...stored, recomputation: { laborCategories: 3, realWagesChanged: 2, workItemsRecomputed: 40 } } }),
    )
    const result = await replaceFasar('org-1', fasarBody(filled()))
    expect(result.recomputation).toEqual({ laborCategories: 3, realWagesChanged: 2, workItemsRecomputed: 40 })
    const call = send.mock.calls[0] as unknown as [string, unknown]
    expect(call[0]).toBe('/api/organizations/org-1/fasar')
  })

  it('tells an import in progress apart from other failures', () => {
    expect(fasarWriteErrorKind(new ApiError(409, undefined, 'IMPORT_IN_PROGRESS'))).toBe('importInProgress')
    expect(fasarWriteErrorKind(new ApiError(400, undefined, 'INVALID_ARGUMENT'))).toBe('invalid')
    expect(fasarWriteErrorKind(new ApiError(403, undefined, 'FORBIDDEN'))).toBe('forbidden')
  })
})
