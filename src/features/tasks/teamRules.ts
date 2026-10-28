import { taskRoles, type Task, type TaskRole, type TeamPlace } from './tasksApi'

const seniority = (role: TaskRole) => taskRoles.indexOf(role)

/** Most senior first; people with the same role keep their order. */
export function sortTeam<T extends { taskRole: TaskRole }>(team: T[]): T[] {
  return team.toSorted((a, b) => seniority(a.taskRole) - seniority(b.taskRole))
}

/** The first person added leads the task; anyone after joins as crew. */
export function addToTeam(team: TeamPlace[], accessId: string): TeamPlace[] {
  if (team.some((place) => place.accessId === accessId)) return team
  return [...team, { accessId, taskRole: team.length === 0 ? 'LEAD' : 'CREW' }]
}

/** Making someone the Lead moves the previous Lead to foreman, so the team keeps exactly one. */
export function changeTaskRole(team: TeamPlace[], accessId: string, taskRole: TaskRole): TeamPlace[] {
  return team.map((place) => {
    if (place.accessId === accessId) return { ...place, taskRole }
    if (taskRole === 'LEAD' && place.taskRole === 'LEAD') return { ...place, taskRole: 'FOREMAN' }
    return place
  })
}

/** Removing the Lead hands the lead to the most senior person left. */
export function removeFromTeam(team: TeamPlace[], accessId: string): TeamPlace[] {
  const left = team.filter((place) => place.accessId !== accessId)
  if (left.length === 0 || left.some((place) => place.taskRole === 'LEAD')) return left
  const heir = sortTeam(left)[0].accessId
  return left.map((place) => (place.accessId === heir ? { ...place, taskRole: 'LEAD' } : place))
}

/** Why the server would reject this team: nobody in it, or not exactly one Lead. */
export function teamIssue(team: TeamPlace[]): 'empty' | 'lead' | null {
  if (team.length === 0) return 'empty'
  return team.filter((place) => place.taskRole === 'LEAD').length === 1 ? null : 'lead'
}

/** Same people in the same roles, in any order. */
export function sameTeam(a: TeamPlace[], b: TeamPlace[]): boolean {
  const key = (team: TeamPlace[]) =>
    team
      .map((place) => `${place.accessId}:${place.taskRole}`)
      .toSorted()
      .join('|')
  return key(a) === key(b)
}

type WithTeam = Pick<Task, 'assignees'>

export function myTaskRole(task: WithTeam, membershipId: string | null): TaskRole | null {
  if (!membershipId) return null
  return task.assignees.find((assignee) => assignee.membershipId === membershipId)?.taskRole ?? null
}

export function isOnTeam(task: WithTeam, membershipId: string | null): boolean {
  return myTaskRole(task, membershipId) !== null
}

/** The current Lead may record expenses on the task and see its spending. */
export function isLead(task: WithTeam, membershipId: string | null): boolean {
  return myTaskRole(task, membershipId) === 'LEAD'
}
