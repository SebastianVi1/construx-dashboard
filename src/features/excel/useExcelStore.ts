import { useEffect, useState } from 'react'
import type { Messages } from '../../i18n'
import { useAuth } from '../auth/auth-context'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { ExcelWorkerError } from './excelWorkerClient'
import type { ExcelStore, Owner } from './excelStore'
import { ExcelStoreError, openExcelStore } from './excelStore'

/** The signed-in user in the selected company: workbooks are kept apart per pair. */
export function useExcelOwner(): Owner {
  const { user } = useAuth()
  const organization = useCurrentOrganization()
  return { userId: String(user?.id ?? ''), organizationId: organization.id }
}

/** Opens browser storage once; `failed` when IndexedDB is blocked (private windows, blocked site data). */
export function useExcelStore(): { store: ExcelStore | null; failed: boolean } {
  const [state, setState] = useState<{ store: ExcelStore | null; failed: boolean }>({ store: null, failed: false })
  useEffect(() => {
    let active = true
    openExcelStore()
      .then((store) => {
        if (active) setState({ store, failed: false })
      })
      .catch(() => {
        if (active) setState({ store: null, failed: true })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

/** The message for a failed store, worker or export call. */
export function excelErrorMessage(error: unknown, t: Messages['excel']): string {
  if (error instanceof ExcelStoreError) return error.reason === 'quota' ? t.quotaFailed : t.storeFailed
  if (error instanceof ExcelWorkerError && error.reason === 'unreadable') return t.issues.unreadable
  return t.exportFailed
}
