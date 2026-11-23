import type { CatalogAction, PermissionCatalog } from '../../features/roles/rolesApi'

type Scope = CatalogAction['scopes'][number]
type Requirement = CatalogAction['requires'][number]

const companyOnly: Scope[] = ['ORGANIZATION']
const sites: Scope[] = ['PROJECT', 'ORGANIZATION']
const tasks: Scope[] = ['OWN', 'PROJECT', 'ORGANIZATION']

const onSites: Requirement = { action: 'VIEW_PROJECT', minScope: 'PROJECT' }
const same = (action: string): Requirement => ({ action, minScope: 'SAME' })

function entry(action: string, group: string, en: string, es: string, scopes: Scope[], requires: Requirement[] = []): CatalogAction {
  return { action, group, names: { en, es }, descriptions: { en: `${en}.`, es: `${es}.` }, scopes, requires }
}

/**
 * The permission catalog as `GET /api/permissions/catalog` serves it (roles
 * contract §4 and §5.10): the 16 actions, their allowed scopes and requirements.
 */
export const permissionCatalog: PermissionCatalog = {
  groups: [
    { key: 'COMPANY', names: { en: 'Company', es: 'Empresa' } },
    { key: 'SITES', names: { en: 'Sites', es: 'Obras' } },
    { key: 'PHASES', names: { en: 'Phases', es: 'Fases' } },
    { key: 'TASKS', names: { en: 'Tasks', es: 'Tareas' } },
    { key: 'PRICES', names: { en: 'Prices', es: 'Precios' } },
    { key: 'BUDGETS', names: { en: 'Budgets', es: 'Presupuestos' } },
    { key: 'PLANS', names: { en: 'Plans', es: 'Planos' } },
  ],
  actions: [
    entry('MANAGE_ORGANIZATION', 'COMPANY', 'Edit company', 'Editar empresa', companyOnly),
    entry('MANAGE_ROLES', 'COMPANY', 'Manage roles', 'Gestionar roles', companyOnly),
    entry('MANAGE_MEMBERS', 'COMPANY', 'Manage members', 'Gestionar miembros', companyOnly),
    entry('VIEW_PROJECT', 'SITES', 'View sites', 'Ver obras', sites),
    entry('MANAGE_PROJECT', 'SITES', 'Edit sites', 'Editar obras', sites, [same('VIEW_PROJECT')]),
    entry('VIEW_GOAL', 'PHASES', 'View phases', 'Ver fases', sites, [onSites]),
    entry('MANAGE_GOAL', 'PHASES', 'Edit phases', 'Editar fases', sites, [same('VIEW_GOAL'), onSites]),
    entry('VIEW_ACTIVITY', 'TASKS', 'View tasks', 'Ver tareas', tasks, [onSites]),
    entry('MANAGE_ACTIVITY', 'TASKS', 'Edit tasks', 'Editar tareas', tasks, [same('VIEW_ACTIVITY'), onSites]),
    entry('ASSIGN_ACTIVITY', 'TASKS', 'Assign tasks', 'Asignar tareas', sites, [same('VIEW_ACTIVITY'), onSites]),
    entry('VIEW_PRICES', 'PRICES', 'View prices', 'Ver precios', companyOnly),
    entry('MANAGE_PRICES', 'PRICES', 'Edit prices', 'Editar precios', companyOnly, [same('VIEW_PRICES')]),
    entry('VIEW_BUDGET', 'BUDGETS', 'View budgets', 'Ver presupuestos', companyOnly),
    entry('MANAGE_BUDGET', 'BUDGETS', 'Edit budgets', 'Editar presupuestos', companyOnly, [same('VIEW_BUDGET')]),
    entry('VIEW_PLAN', 'PLANS', 'View plans', 'Ver planos', sites, [onSites]),
    entry('MANAGE_PLAN', 'PLANS', 'Edit plans', 'Editar planos', sites, [same('VIEW_PLAN'), onSites]),
  ],
}
