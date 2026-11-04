import { canPerform, type MyAccess } from '../permissions/can'
import { landingPath } from '../permissions/landing'

/** The company roll-up spans every site, so it needs VIEW_BUDGET at ORGANIZATION scope. */
export function seesOrgFinance(access: MyAccess | null): boolean {
  return canPerform(access, 'VIEW_BUDGET')
}

/** `/` after sign-in: the finance dashboard for company-wide finance roles, the role landing screen otherwise. */
export function workspaceHomePath(access: MyAccess | null): '/finance' | '/tasks' | '/sites' {
  return seesOrgFinance(access) ? '/finance' : landingPath(access)
}
