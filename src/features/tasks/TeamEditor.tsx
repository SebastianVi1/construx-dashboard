import { useId } from 'react'
import { formatMessage, useLocale } from '../../i18n'
import type { SiteAccess } from '../sites/sitesApi'
import { taskRoles, type TaskRole, type TeamPlace } from './tasksApi'
import { addToTeam, changeTaskRole, removeFromTeam, sortTeam } from './teamRules'

type TeamEditorProps = {
  team: TeamPlace[]
  /** People on the site: the only valid team members. */
  people: SiteAccess[]
  error?: string
  disabled?: boolean
  onChange: (team: TeamPlace[]) => void
}

/** The task's team: who is on it and in which task role; exactly one person leads. */
export function TeamEditor({ team, people, error, disabled, onChange }: TeamEditorProps) {
  const { messages: m } = useLocale()
  const t = m.tasks
  const addId = useId()
  const errorId = `${addId}-error`
  const hintId = `${addId}-hint`
  const names = new Map(people.map((person) => [person.accessId, person.fullName || t.unnamed]))
  const available = people.filter((person) => !team.some((place) => place.accessId === person.accessId))

  return (
    <fieldset className="team-editor" id="field-team" tabIndex={-1} aria-describedby={error ? errorId : hintId}>
      <legend className="form-field__label">{t.team.title}</legend>
      {team.length > 0 ? (
        <ul className="team-editor__list">
          {sortTeam(team).map((place) => {
            const name = names.get(place.accessId) ?? t.unnamed
            return (
              <li key={place.accessId} className="team-editor__row">
                <span className="team-editor__name">{name}</span>
                <select
                  className="form-field__control team-editor__role"
                  aria-label={formatMessage(t.team.roleLabel, { name })}
                  value={place.taskRole}
                  disabled={disabled}
                  onChange={(event) => onChange(changeTaskRole(team, place.accessId, event.target.value as TaskRole))}
                >
                  {taskRoles.map((role) => (
                    <option key={role} value={role}>
                      {t.roles[role]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="task-link task-link--danger"
                  aria-label={formatMessage(t.team.removeLabel, { name })}
                  disabled={disabled}
                  onClick={() => onChange(removeFromTeam(team, place.accessId))}
                >
                  {t.team.remove}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {available.length > 0 ? (
        <div className="form-field">
          <label className="visually-hidden" htmlFor={addId}>
            {t.team.add}
          </label>
          <div className="form-field__box">
            <select
              className="form-field__control"
              id={addId}
              value=""
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value) onChange(addToTeam(team, event.target.value))
              }}
            >
              <option value="">{team.length === 0 ? t.team.addPlaceholder : t.team.add}</option>
              {available.map((person) => (
                <option key={person.accessId} value={person.accessId}>
                  {person.fullName || t.unnamed}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="form-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        <p className="form-field__hint" id={hintId}>
          {t.team.hint}
        </p>
      )}
    </fieldset>
  )
}
