import { useState } from 'react'
import { Field } from '../../components/form'
import { ConfirmDialog } from '../../components/modal'
import { Notice } from '../../components/page'
import { formatMessage, useLocale, type Messages } from '../../i18n'
import { roleLabel } from '../permissions'
import { deletionCounts, replacementOptions, reportedReplacementCounts, type DeletionCounts, type ReplacementCounts } from './customRoles'
import { deleteRole, type RoleDetail } from './rolesApi'
import { useRoles } from './rolesCache'
import { invitationCountLabel, memberCountLabel, roleErrorMessage } from './roleView'
import '../../components/form/form.css'

type Props = {
  organizationId: string
  role: RoleDetail
  /** The role is gone; `replacement` is where its members and invitations went, if anywhere. */
  onDeleted: (replacement: string | null) => void
  onClose: () => void
}

/**
 * "Delete role" (roles contract §5.6, §8.3). A role anyone still references
 * (members, members who left, invitations in any status) needs a replacement
 * chosen from the roles the caller may assign. The role page's counts show
 * before the first attempt; if the server still refuses with
 * `ROLE_REPLACEMENT_REQUIRED` (someone joined meanwhile), its counts replace them.
 */
export function DeleteRoleDialog({ organizationId, role, onDeleted, onClose }: Props) {
  const { messages: m, locale } = useLocale()
  const t = m.roles.remove
  const roles = useRoles(organizationId)
  const [reported, setReported] = useState<ReplacementCounts | null>(null)
  const [replacement, setReplacement] = useState('')
  const [error, setError] = useState<string | null>(null)
  const counts = deletionCounts(role, reported)
  const options = roles.data ? replacementOptions(roles.data, role.code) : null
  const chosen = options?.find((option) => option.code === replacement) ?? null
  const lines = countLines(counts, m)

  async function confirm() {
    if (counts.needsReplacement && !chosen) return
    setError(null)
    try {
      const target = counts.needsReplacement && chosen ? chosen.code : null
      await deleteRole(organizationId, role.code, target ?? undefined)
      onDeleted(target)
    } catch (failure) {
      const next = reportedReplacementCounts(failure)
      if (next) setReported(next)
      setError(roleErrorMessage(failure, m, null, locale))
    }
  }

  return (
    <ConfirmDialog
      title={formatMessage(t.title, { role: roleLabel(role, locale) })}
      body={t.body}
      confirmLabel={t.confirm}
      pendingLabel={t.pending}
      cancelLabel={t.cancel}
      error={error}
      confirmDisabled={counts.needsReplacement && !chosen}
      onConfirm={confirm}
      onClose={onClose}
    >
      {counts.needsReplacement ? (
        <div className="role-delete">
          <p className="role-delete__intro">{t.held}</p>
          {lines.length > 0 ? (
            <ul className="role-delete__counts">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {options === null ? (
            roles.status === 'error' ? (
              <Notice tone="error" action={{ label: m.roles.retry, onClick: roles.reload }}>
                {t.rolesError}
              </Notice>
            ) : (
              <p className="role-delete__hint">{m.roles.roleSelect.lock.loading}</p>
            )
          ) : options.length === 0 ? (
            <p className="role-delete__hint">{t.noReplacement}</p>
          ) : (
            <Field
              config={{
                name: 'replacement',
                label: t.replacement,
                type: 'select',
                options: [
                  { value: '', label: t.placeholder },
                  ...options.map((option) => ({ value: option.code, label: roleLabel(option, locale) })),
                ],
              }}
              value={chosen?.code ?? ''}
              onChange={(code) => {
                setReplacement(code)
                setError(null)
              }}
            />
          )}
        </div>
      ) : (
        <p className="role-delete__intro">{t.free}</p>
      )}
    </ConfirmDialog>
  )
}

/** "3 members", "1 former member", "2 pending invitations", "1 past invitation": only the counts above zero. */
function countLines(counts: DeletionCounts, m: Messages): string[] {
  const t = m.roles.remove
  const lines: string[] = []
  if (counts.memberCount > 0) lines.push(memberCountLabel(counts.memberCount, m))
  const former = countLabel(counts.formerMemberCount, t.formerMembers)
  if (former) lines.push(former)
  const invitations = invitationCountLabel(counts.pendingInvitationCount, m)
  if (invitations) lines.push(invitations)
  const past = countLabel(counts.pastInvitationCount, t.pastInvitations)
  if (past) lines.push(past)
  return lines
}

function countLabel(count: number, labels: { one: string; many: string }): string | null {
  if (count <= 0) return null
  return count === 1 ? labels.one : formatMessage(labels.many, { count })
}
