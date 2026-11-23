import { useEffect, useRef, useState } from 'react'
import { useRemoteData } from '../../components/data/useRemoteData'
import { Field } from '../../components/form'
import { TEXT_LIMITS } from '../../components/form/limits'
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
  optionLocked,
  scopeOptions,
  setScope,
  toGrants,
  type GrantDiff,
  type GrantMap,
  type ScopeChange,
} from './permissionEditor'
import {
  detailsChanged,
  detailsOf,
  editDraft,
  roleDetailsErrors,
  type RoleDetails,
} from './customRoles'
import {
  getCatalog,
  getRole,
  restoreRole,
  roleErrorKind,
  updateRole,
  type CatalogAction,
  type PermissionCatalog,
  type RoleDetail,
} from './rolesApi'
import { rolesChanged, summaryOf, withRole } from './rolesCache'
import {
  actionName,
  conflictNotice,
  permissionGroups,
  readOnlyReason,
  roleErrorMessage,
  saveBarShown,
  type ConflictSource,
  type TheirVersion,
} from './roleView'
import '../../components/form/form.css'

type Props = {
  role: RoleDetail
  /** A newer state of the role (our save or restore's answer, or their version after a conflict): the page shows it from now on. */
  onLoaded: (role: RoleDetail) => void
  /** The role answered 404 (deleted meanwhile): load the page again, which then says it is gone. */
  onReload: () => void
  /** Another tab of the role page is showing; the editor stays mounted to keep its draft. */
  hidden?: boolean
}

type Flash = 'saved' | 'restored' | null

/** Requirements the last change switched on or widened, shown under the row that caused them. */
type AutoNote = { action: string; turnedOn: string[]; raised: string[] }

type PendingLower = { action: string; change: ScopeChange; dependents: GrantDiff[] }

/**
 * The Permissions tab of a role (roles contract §8.3): one scope control per
 * catalog action, requirement rules from `permissionEditor`, save with the
 * role's version, and Restore defaults for a Built-in role. Read-only, with its
 * reason, when the server says the caller may not edit the role.
 */
export function PermissionsTab({ role, onLoaded, onReload, hidden = false }: Props) {
  const { messages: m, locale } = useLocale()
  const catalog = useRemoteData('permissions:catalog', getCatalog)

  return (
    <section className="page-section" aria-labelledby="role-permissions-heading" hidden={hidden}>
      {catalog.data ? (
        <PermissionsEditor role={role} catalog={catalog.data} onLoaded={onLoaded} onReload={onReload} m={m} locale={locale} />
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
  onLoaded,
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
  // A Custom role's name and description, saved together with its permissions.
  const [details, setDetails] = useState<RoleDetails>(() => detailsOf(role))
  const [note, setNote] = useState<AutoNote | null>(null)
  const [pendingLower, setPendingLower] = useState<PendingLower | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [restorePending, setRestorePending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  // Someone else saved the role while it was open here; the user's draft stays until they save or discard it.
  const [conflict, setConflict] = useState<ConflictSource | null>(null)
  const [theirs, setTheirs] = useState<TheirVersion>('loaded')
  // The version our own last save or restore produced: that one replaces the draft.
  const [ownVersion, setOwnVersion] = useState<number | null>(null)
  const writing = useRef(false)

  const saved = fromGrants(base.permissions)
  const changes = diffGrants(saved, draft, catalog)
  const custom = base.kind === 'CUSTOM'
  const dirty = changes.length > 0 || (custom && detailsChanged(base, details))
  // While a write is in flight nothing can be edited: its answer replaces the draft.
  const busy = saving || restorePending

  // Our own save or restore, or any role while nothing is being edited, replaces the draft.
  // Someone else's newer version never does while there are unsaved changes: the user decides (story 16).
  if (role !== base) {
    setBase(role)
    const newer = role.version !== base.version
    if (!dirty || (newer && role.version === ownVersion)) {
      setDraft(fromGrants(role.permissions))
      setDetails(detailsOf(role))
      setNote(null)
    } else if (newer) {
      setConflict((current) => current ?? 'arrived')
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
  const showDetails = editable && role.kind === 'CUSTOM'
  const detailErrors = showDetails ? roleDetailsErrors(details) : {}
  const invalid = Object.keys(detailErrors).length > 0
  const caller = access && access.role.code !== 'OWNER' ? fromGrants(access.permissions) : null
  const defaults = role.kind === 'BUILT_IN' && role.defaults ? fromGrants(role.defaults) : null
  const restoreChanges = defaults ? diffGrants(saved, defaults, catalog) : []
  const canRestore = editable && defaults !== null && (role.customized || restoreChanges.length > 0)
  const name = (action: string) => actionName(catalog, action, locale) ?? action
  const notice = conflict ? conflictNotice(conflict, dirty, theirs) : null
  const savedHere = flash === 'saved' && !dirty
  const showBar = saveBarShown({ editable, dirty, saveError: saveError !== null, conflict: notice !== null, saved: savedHere })

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

  function failed(error: unknown, show: (message: string) => void, source: 'save' | 'restore') {
    const kind = roleErrorKind(error)
    if (kind === 'roleChanged') {
      // Shown in the save bar, where the user is; the draft stays and their version loads underneath.
      setConflict(source)
      void loadTheirs()
      return
    }
    if (kind === 'notFound') onReload()
    show(roleErrorMessage(error, m, catalog, locale))
  }

  /** Their version, after ours was refused; until it is here, Save would send the refused version again. */
  async function loadTheirs() {
    setTheirs('loading')
    try {
      onLoaded(await getRole(orgId, role.code))
      setTheirs('loaded')
    } catch (error) {
      if (roleErrorKind(error) === 'notFound') onReload()
      setTheirs('failed')
    }
  }

  /** The server's answer to our write: the page shows it, and the roles lists refetch (§8.5). */
  function written(next: RoleDetail) {
    setOwnVersion(next.version)
    setConflict(null)
    setTheirs('loaded')
    onLoaded(next)
    rolesChanged(orgId, (roles) => withRole(roles, summaryOf(next)))
  }

  async function save() {
    if (writing.current || invalid || notice?.versionStale) return
    writing.current = true
    setSaving(true)
    setSaveError(null)
    setFlash(null)
    try {
      written(await updateRole(orgId, role.code, editDraft(role, details, toGrants(draft)), role.version))
      setFlash('saved')
    } catch (error) {
      failed(error, setSaveError, 'save')
    } finally {
      writing.current = false
      setSaving(false)
    }
  }

  async function restore() {
    if (writing.current) return
    writing.current = true
    setRestorePending(true)
    setRestoreError(null)
    try {
      written(await restoreRole(orgId, role.code, role.version))
      setRestoring(false)
      setFlash('restored')
    } catch (error) {
      if (roleErrorKind(error) === 'roleChanged') setRestoring(false)
      failed(error, setRestoreError, 'restore')
    } finally {
      writing.current = false
      setRestorePending(false)
    }
  }

  function discard() {
    setDraft(saved)
    setDetails(detailsOf(base))
    setNote(null)
    setSaveError(null)
    // Until their version is here, the conflict (and its Try again) stays.
    if (theirs === 'loaded') setConflict(null)
  }

  function editDetails(change: Partial<RoleDetails>) {
    setDetails((current) => ({ ...current, ...change }))
    setFlash(null)
    setSaveError(null)
  }

  return (
    <>
      {showDetails ? (
        <div className="role-details">
          <h2>{t.details.title}</h2>
          <div className="role-details__fields">
            <Field
              config={{ name: 'roleName', label: t.details.name, autoComplete: 'off', maxLength: TEXT_LIMITS.roleName }}
              value={details.name}
              error={detailErrors.name ? (detailErrors.name === 'required' ? t.details.required : t.details.nameTooLong) : undefined}
              disabled={busy}
              onChange={(name) => editDetails({ name })}
            />
            <Field
              config={{
                name: 'roleDescription',
                label: t.details.description,
                type: 'textarea',
                hint: t.details.descriptionHint,
                rows: 2,
                maxLength: TEXT_LIMITS.roleDescription,
              }}
              value={details.description}
              error={detailErrors.description ? t.details.descriptionTooLong : undefined}
              disabled={busy}
              onChange={(description) => editDetails({ description })}
            />
          </div>
        </div>
      ) : null}

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
                    <ScopeControl action={action} scope={scope} caller={caller} busy={busy} onChange={(next) => choose(action, next)} m={m} />
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

      {showBar ? (
        <div className="permission-savebar" role="region" aria-label={e.unsaved}>
          {notice ? (
            <p className="permission-savebar__conflict" role="alert">
              {notice.parts.map((part) => e.conflict[part]).join(' ')}
            </p>
          ) : null}
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
          {savedHere ? (
            <p className="permission-savebar__done" role="status">
              {custom ? e.savedRole : e.saved}
            </p>
          ) : null}
          <div className="permission-savebar__row">
            <span className="permission-savebar__label">{dirty ? e.unsaved : null}</span>
            <div className="button-row">
              {conflict && theirs === 'failed' ? (
                <button type="button" className="button" onClick={() => void loadTheirs()}>
                  {e.conflict.retryButton}
                </button>
              ) : null}
              {dirty ? (
                <>
                  <button type="button" className="button" onClick={discard} disabled={busy}>
                    {e.discard}
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => void save()}
                    disabled={saving || invalid || notice?.versionStale === true}
                    aria-busy={saving}
                  >
                    {saving ? e.saving : custom ? e.saveRole : e.save}
                  </button>
                </>
              ) : (
                <button type="button" className="button" onClick={() => {
                  if (theirs === 'loaded') setConflict(null)
                  setSaveError(null)
                  setFlash(null)
                }}>
                  {e.conflict.dismiss}
                </button>
              )}
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
  busy,
  onChange,
  m,
}: {
  action: CatalogAction
  scope: Scope | null
  caller: GrantMap | null
  /** A save or restore is in flight: every option waits for its answer. */
  busy: boolean
  onChange: (scope: Scope | null) => void
  m: Messages
}) {
  const t = m.roles
  return (
    <div className="scope-control" role="radiogroup" aria-labelledby={`permission-${action.action}`} aria-disabled={busy || undefined}>
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
              disabled={optionLocked(option, scope, busy)}
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
