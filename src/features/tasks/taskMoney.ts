import { canPerform, type MyAccess } from '../permissions/can'
import type { Task } from './tasksApi'
import { isLead } from './teamRules'

/** UI affordances only: the server rechecks membership and the current Lead on every request. */
export function taskMoneyActions(access: MyAccess | null, task: Task) {
  const lead = isLead(task, access?.membershipId ?? null)
  const manager = canPerform(access, 'MANAGE_BUDGET', task.projectId)
  return {
    lead,
    view: lead || canPerform(access, 'VIEW_BUDGET', task.projectId),
    record: lead || manager,
    /** Charging the Catalog also needs VIEW_PRICES (docs/pricing.md §6.5). */
    chargeCatalog: canPerform(access, 'VIEW_PRICES'),
    manage: (createdByMembershipId: string | null | undefined) =>
      manager || (lead && createdByMembershipId === access?.membershipId),
  }
}
