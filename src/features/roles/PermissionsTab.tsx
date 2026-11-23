import { useEffect, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { ConfirmDialog } from '../../components/modal'
import { Notice, SkeletonList } from '../../components/page'
import { formatMessage } from '../../i18n/format'
import { intlLocales, useLocale, type Locale, type Messages } from '../../i18n'
import type { Scope } from '../permissions/can'
import { useCurrentOrganization } from '../organizations/organizations-context'
import { roleLabel, usePermissions } from '../permissions'
import {
  diffGrants,
  fromGrants,
  isEmpty,
  scopeOptions,
  setScope,
  toGrants,
  type GrantDiff,
  type GrantMap,
  type ScopeChange,
} from './permissionEditor'
import {
  getCatalog,
  restoreRole,
  roleErrorKind,
  updateRole,
  type CatalogAction,
  type PermissionCatalog,
  type RoleDetail,
  type RoleDraft,
} from './rolesApi'
import { actionName, permissionGroups, readOnlyReason, roleErrorMessage } from './roleView'

type Props = {
  role: RoleDetail
  /** The server's answer to a save or restore: the page shows it from now on. */
  onSaved: (role: RoleDetail) => void
  /** Load the role again (someone else saved it first). */
  onReload: () => void
}

type Flash = 'saved' | 'restored' | 'changed' | null

/** Requirements the last change switched on or widened, shown under the row that caused them. */
type AutoNote = { action: string; turnedOn: string[]; raised: string[] }

type PendingLower = { action: string; change: ScopeChange; dependents: GrantDiff[] }

/**
 * The Permissions tab of a role (roles contract §8.3): one scope control per
 * catalog action, requirement rules from `permissionEditor`, save with the
 * role's version, and Restore defaults for a Built-in role. Read-only, with its
 * reason, when the server says the caller may not edit the role.
 */
export function PermissionsTab({ role, onSaved, onReload }: Props) {
  const { messages: m, locale } = useLocale()
  const catalog = useRemoteData('permissions:catalog', getCatalog)

  return (
    <section className="page-section" aria-labelledby="role-permissions-heading">
      {catalog.data ? (
        <PermissionsEditor role={role} catalog={catalog.data} onSaved={onSaved} onReload={onReload} m={m} locale={locale} />
      ) : (
        <>
          <div className="page-section__header">
            <h2 id="role-permissions-heading">{m.roles.role.permissions}</h2>
          </div>
          {catalog.status === 'error' ? (
            <Notice tone="error" action={{ label: m.roles.retry, onClick: catalog.reload }}>
              {m.roles.role.catalogError}
            </Notice>
          ) : (
            <SkeletonList rows={8} />
          )}
        </>
      )}
    </section>
  )
}

function PermissionsEditor({
  role,
  catalog,
  onSaved,
  onReload,
  m,
  locale,
}: Props & { catalog: PermissionCatalog; m: Messages; locale: Locale }) {
  const t = m.roles
  const e = t.editor
  const orgId = useCurrentOrganization().id
  const { access } = usePermissions()
  const [base, setBase] = useState(role)
  const [draft, setDraft] = useState<GrantMap>(() => fromGrants(role.permissions))
  const [note, setNote] = useState<AutoNote | null>(null)
  const [pendingLower, setPendingLower] = useState<PendingLower | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  // Set after ROLE_CHANGED: the reloaded role replaces the draft whatever its version.
  const [awaitingReload, setAwaitingReload] = useState(false)

  const saved = fromGrants(base.permissions)
  const changes = diffGrants(saved, draft, catalog)
  const dirty = changes.length > 0

  // A newer version (our save, a restore, or someone else's save) replaces the draft;
  // a background revalidation of the same version keeps what is being edited.
  if (role !== base) {
    setBase(role)
    setAwaitingReload(false)
    if (awaitingReload || role.version !== base.version || !dirty) {
      setDraft(fromGrants(role.permissions))
      setNote(null)
    }
  }

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const reason = readOnlyReason(role, access?.role.code ?? null)
  const editable = role.editable
  const caller = access && access.role.code !== 'OWNER' ? fromGrants(access.permissions) : null
  const defaults = role.kind === 'BUILT_IN' && role.defaults ? fromGrants(role.defaults) : null
  const restoreChanges = defaults ? diffGrants(saved, defaults, catalog) : []
  const canRestore = editable && defaults !== null && (role.customized || restoreChanges.length > 0)
  const name = (action: string) => actionName(catalog, action, locale) ?? action

  function choose(action: CatalogAction, scope: Scope | null) {
    const change = setScope(catalog, draft, action.action, scope)
    setFlash(null)
    setSaveError(null)
    if (change.lowered.length > 0 || change.turnedOff.length > 0) {
      const dependents = diffGrants(draft, change.grants, catalog).filter((diff) => diff.action !== action.action)
      setPendingLower({ action: action.action, change, dependents })
      return
    }
    setDraft(change.grants)
    setNote(change.turnedOn.length > 0 || change.raised.length > 0 ? { action: action.action, turnedOn: change.turnedOn, raised: change.raised } : null)
  }

  function draftBody(): RoleDraft {
    const permissions = toGrants(draft)
    // A Custom role keeps its name and description; a Built-in role must not send them (ROLE_NAME_FIXED).
    return role.kind === 'CUSTOM' ? { name: role.name, description: role.description?.en ?? null, permissions } : { permissions }
  }

  function failed(error: unknown, show: (message: string) => void) {
    if (roleErrorKind(error) === 'roleChanged') {
      setFlash('changed')
      setAwaitingReload(true)
      onReload()
      return
    }
    show(roleErrorMessage(error, m, catalog, locale))
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    setFlash(null)
    try {
      onSaved(await updateRole(orgId, role.code, draftBody(), role.version))
      setFlash('saved')
    } catch (error) {
      failed(error, setSaveError)
    } finally {
      setSaving(false)
    }
  }

  async function restore() {
    setRestoreError(null)
    try {
      onSaved(await restoreRole(orgId, role.code, role.version))
      setRestoring(false)
      setFlash('restored')
    } catch (error) {
      if (roleErrorKind(error) === 'roleChanged') setRestoring(false)
      failed(error, setRestoreError)
    }
  }

  function discard() {
    setDraft(saved)
    setNote(null)
    setSaveError(null)
  }

  return (
    <>
      <div className="page-section__header">
        <h2 id="role-permissions-heading">{t.role.permissions}</h2>
        {canRestore ? (
          <button
            type="button"
            className="button button--small"
            onClick={() => {
              setRestoreError(null)
              setRestoring(true)
            }}
          >
            {e.restore.button}
          </button>
        ) : null}
      </div>

      {reason ? <Notice>{t.readOnly[reason]}</Notice> : null}
      {flash === 'changed' ? <Notice>{e.changed}</Notice> : null}
      {flash === 'saved' ? <Notice tone="success">{e.saved}</Notice> : null}
      {flash === 'restored' ? <Notice tone="success">{e.restore.done}</Notice> : null}
      {isEmpty(draft) ? <Notice>{t.role.empty}</Notice> : null}

      <div className="permission-groups">
        {permissionGroups(catalog, toGrants(draft)).map((group) => (
          <section key={group.key} className="permission-group" aria-labelledby={`permission-group-${group.key}`}>
            <h3 id={`permission-group-${group.key}`}>{group.names[locale]}</h3>
            <ul className="permission-rows">
              {group.rows.map(({ action, scope }) => (
                <li key={action.action} className="permission-row" data-changed={(saved[action.action] ?? null) !== scope ? true : undefined}>
                  <span className="permission-row__text">
                    <span className="permission-row__name" id={`permission-${action.action}`}>
                      {action.names[locale]}
                    </span>
                    <span className="permission-row__description">{action.descriptions[locale]}</span>
                    {note?.action === action.action ? (
                      <span className="permission-row__note" role="status">
                        {note.turnedOn.length > 0 ? <span>{formatMessage(e.alsoTurnedOn, { actions: listOf(note.turnedOn.map(name), locale) })}</span> : null}
                        {note.raised.length > 0 ? <span>{formatMessage(e.alsoWidened, { actions: listOf(note.raised.map(name), locale) })}</span> : null}
                      </span>
                    ) : null}
                  </span>
                  {editable ? (
                    <ScopeControl action={action} scope={scope} caller={caller} onChange={(next) => choose(action, next)} m={m} />
                  ) : (
                    <span className="permission-scope" data-scope={scope ?? 'NONE'}>
                      {scope ? t.scope[scope] : t.scope.none}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {editable && (dirty || saveError) ? (
        <div className="permission-savebar" role="region" aria-label={e.unsaved}>
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="permission-savebar__row">
            <span className="permission-savebar__label">{dirty ? e.unsaved : null}</span>
            <div className="button-row">
              <button type="button" className="button" onClick={discard} disabled={saving || !dirty}>
                {e.discard}
              </button>
              <button type="button" className="button button--primary" onClick={() => void save()} disabled={saving || !dirty} aria-busy={saving}>
                {saving ? e.saving : e.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLower ? (
        <ConfirmDialog
          title={formatMessage(e.lower.title, { action: name(pendingLower.action) })}
          body={formatMessage(e.lower.body, { action: name(pendingLower.action) })}
          confirmLabel={e.lower.confirm}
          pendingLabel={e.lower.confirm}
          cancelLabel={e.lower.cancel}
          confirmTone="primary"
          error={null}
          onConfirm={async () => {
            setDraft(pendingLower.change.grants)
            setNote(null)
            setPendingLower(null)
          }}
          onClose={() => setPendingLower(null)}
        >
          <ChangeList changes={pendingLower.dependents} name={name} m={m} />
        </ConfirmDialog>
      ) : null}

      {restoring ? (
        <ConfirmDialog
          title={e.restore.title}
          body={formatMessage(e.restore.body, { role: roleLabel(role, locale) })}
          confirmLabel={e.restore.confirm}
          pendingLabel={e.restore.pending}
          cancelLabel={e.restore.cancel}
          confirmTone="primary"
          error={restoreError}
          onConfirm={restore}
          onClose={() => setRestoring(false)}
        >
          <ChangeList changes={restoreChanges} name={name} m={m} />
          {dirty ? <p className="permission-changes__warning">{e.restore.unsaved}</p> : null}
        </ConfirmDialog>
      ) : null}
    </>
  )
}

/** None plus the allowed scopes, as one radio group; scopes wider than the caller holds are disabled. */
function ScopeControl({
  action,
  scope,
  caller,
  onChange,
  m,
}: {
  action: CatalogAction
  scope: Scope | null
  caller: GrantMap | null
  onChange: (scope: Scope | null) => void
  m: Messages
}) {
  const t = m.roles
  return (
    <div className="scope-control" role="radiogroup" aria-labelledby={`permission-${action.action}`}>
      {scopeOptions(action, caller).map((option) => {
        const value = option.scope ?? 'NONE'
        const blocked = !option.withinCaller && option.scope !== scope
        return (
          <label key={value} className="scope-control__option" data-scope={value} title={blocked ? t.editor.outOfReach : undefined}>
            <input
              type="radio"
              className="visually-hidden"
              name={`scope-${action.action}`}
              value={value}
              checked={option.scope === scope}
              disabled={blocked}
              onChange={() => onChange(option.scope)}
            />
            <span>{option.scope ? t.scope[option.scope] : t.scope.none}</span>
          </label>
        )
      })}
    </div>
  )
}

/** "Edit plans: Whole company → Assigned sites", one line per changed permission. */
function ChangeList({ changes, name, m }: { changes: GrantDiff[]; name: (action: string) => string; m: Messages }) {
  const t = m.roles
  const label = (scope: Scope | null) => (scope ? t.scope[scope] : t.scope.none)
  return (
    <dl className="permission-changes">
      {changes.map((change) => (
        <div key={change.action} className="permission-changes__row">
          <dt>{name(change.action)}</dt>
          <dd>
            <span className="permission-changes__from">{label(change.from)}</span>
            <span aria-hidden="true">→</span>
            <span className="visually-hidden">{t.editor.to}</span>
            <span data-scope={change.to ?? 'NONE'}>{label(change.to)}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function listOf(names: string[], locale: Locale): string {
  return new Intl.ListFormat(intlLocales[locale], { style: 'long', type: 'conjunction' }).format(names)
}
