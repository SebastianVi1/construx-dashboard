import type { Scope } from '../permissions/can'
import type { CatalogAction, Grant, PermissionCatalog } from './rolesApi'

/**
 * Pure rules of the Permissions editor (roles contract §4 and §8.3). The
 * server validates every save; these only keep the draft valid while someone
 * edits it, so a save does not fail on a missing requirement.
 */

/** The scope a role holds per action; null or missing = None. */
export type GrantMap = Record<string, Scope | null>

const scopeRank: Record<Scope, number> = { OWN: 1, PROJECT: 2, ORGANIZATION: 3 }

function rank(scope: Scope | null | undefined): number {
  return scope ? scopeRank[scope] : 0
}

function maxScope(a: Scope, b: Scope): Scope {
  return rank(a) >= rank(b) ? a : b
}

type Requirement = CatalogAction['requires'][number]

/** The scope `requirement` must reach when its dependent is granted at `scope`. */
function neededScope(requirement: Requirement, scope: Scope): Scope {
  if (requirement.minScope === 'SAME') return scope
  if (requirement.minScope === 'PROJECT') return maxScope(scope, 'PROJECT')
  return 'ORGANIZATION'
}

/** The narrowest scope `action` allows that reaches `needed` (the widest one if none does). */
function narrowestAllowedFrom(action: CatalogAction | undefined, needed: Scope): Scope {
  const allowed = action?.scopes ?? [needed]
  return [...allowed].sort((a, b) => rank(a) - rank(b)).find((scope) => rank(scope) >= rank(needed)) ?? allowed[allowed.length - 1]
}

export type ScopeChange = {
  grants: GrantMap
  /** Requirements switched on because of the change (were None). */
  turnedOn: string[]
  /** Requirements already on that had to reach further. */
  raised: string[]
  /** Dependents kept on at a narrower scope. */
  lowered: string[]
  /** Dependents switched off. */
  turnedOff: string[]
}

/**
 * Sets `action` to `scope` (null = None). Raising or switching on also raises
 * what it requires to the minimum scope. Lowering or switching off cascades to
 * whatever depends on it: each dependent is lowered to the widest scope the new
 * requirement still allows, or switched off when none is left.
 */
export function setScope(catalog: PermissionCatalog, grants: GrantMap, action: string, scope: Scope | null): ScopeChange {
  const byAction = new Map(catalog.actions.map((entry) => [entry.action, entry]))
  const next: GrantMap = { ...grants }
  const change: ScopeChange = { grants: next, turnedOn: [], raised: [], lowered: [], turnedOff: [] }
  const before = grants[action] ?? null
  if (rank(scope) === rank(before)) return change
  next[action] = scope

  if (rank(scope) > rank(before)) {
    const queue: string[] = [action]
    while (queue.length > 0) {
      const current = queue.shift() as string
      const held = next[current]
      if (!held) continue
      for (const requirement of byAction.get(current)?.requires ?? []) {
        const target = narrowestAllowedFrom(byAction.get(requirement.action), neededScope(requirement, held))
        const has = next[requirement.action] ?? null
        if (rank(has) >= rank(target)) continue
        next[requirement.action] = target
        const list = has ? change.raised : change.turnedOn
        if (!list.includes(requirement.action)) list.push(requirement.action)
        queue.push(requirement.action)
      }
    }
  } else {
    const queue: string[] = [action]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const dependent of catalog.actions) {
        const held = next[dependent.action]
        if (!held) continue
        const requirement = dependent.requires.find((entry) => entry.action === current)
        if (!requirement) continue
        const ceiling = widestWithin(dependent, held, requirement, next[current] ?? null)
        if (ceiling === held) continue
        next[dependent.action] = ceiling
        change.lowered = change.lowered.filter((name) => name !== dependent.action)
        if (ceiling) change.lowered.push(dependent.action)
        else change.turnedOff.push(dependent.action)
        queue.push(dependent.action)
      }
    }
  }
  return change
}

/**
 * The widest scope up to `held` at which `dependent` still has `requirement`
 * met by `available`; null when even its narrowest scope needs more.
 */
function widestWithin(dependent: CatalogAction, held: Scope, requirement: Requirement, available: Scope | null): Scope | null {
  const candidates = dependent.scopes
    .filter((scope) => rank(scope) <= rank(held))
    .sort((a, b) => rank(b) - rank(a))
  return candidates.find((scope) => rank(available) >= rank(neededScope(requirement, scope))) ?? null
}

/** A role's grant list as an editor map. */
export function fromGrants(list: Grant[]): GrantMap {
  return Object.fromEntries(list.map((grant) => [grant.action, grant.scope]))
}

/** The grant list a save sends: every action that is on (None is left out). */
export function toGrants(map: GrantMap): Grant[] {
  return Object.entries(map).flatMap(([action, scope]) => (scope ? [{ action, scope }] : []))
}

/** True when the role holds no permission at all (valid, but its members see nothing). */
export function isEmpty(map: GrantMap): boolean {
  return Object.values(map).every((scope) => !scope)
}

export type GrantDiff = { action: string; from: Scope | null; to: Scope | null }

/**
 * Every action whose scope differs between two sets, in catalog order (actions
 * the catalog does not know come last). Used for the restore preview and to
 * list what a lowering will change.
 */
export function diffGrants(from: GrantMap, to: GrantMap, catalog?: PermissionCatalog): GrantDiff[] {
  const order = new Map(catalog?.actions.map((entry, index) => [entry.action, index]))
  const actions = [...new Set([...Object.keys(from), ...Object.keys(to)])]
  return actions
    .filter((action) => (from[action] ?? null) !== (to[action] ?? null))
    .sort((a, b) => (order.get(a) ?? order.size) - (order.get(b) ?? order.size))
    .map((action) => ({ action, from: from[action] ?? null, to: to[action] ?? null }))
}

export type ScopeOption = { scope: Scope | null; withinCaller: boolean }

/**
 * The choices of one action's control: None, then the scopes the catalog
 * allows, narrowest first. A scope wider than the caller's own grant would be
 * refused (`ROLE_ABOVE_CALLER`), so it is marked; `caller` null skips the check.
 */
export function scopeOptions(action: CatalogAction, caller: GrantMap | null): ScopeOption[] {
  const scopes = [...action.scopes].sort((a, b) => rank(a) - rank(b))
  const reach = caller ? rank(caller[action.action]) : Infinity
  return [{ scope: null, withinCaller: true }, ...scopes.map((scope) => ({ scope, withinCaller: rank(scope) <= reach }))]
}

/**
 * Whether one option of a scope control is out of use: all of them while a
 * save or restore is in flight (its answer replaces the draft, so an edit made
 * meanwhile would be lost), otherwise a scope wider than the caller unless the
 * role already holds it.
 */
export function optionLocked(option: ScopeOption, current: Scope | null, busy: boolean): boolean {
  return busy || (!option.withinCaller && option.scope !== current)
}
