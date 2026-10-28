import { describe, expect, it } from 'bun:test'
import {
  addToTeam,
  changeTaskRole,
  isLead,
  isOnTeam,
  myTaskRole,
  removeFromTeam,
  sameTeam,
  sortTeam,
  teamIssue,
} from './teamRules'
import type { Task, TeamPlace } from './tasksApi'

const task: Pick<Task, 'assignees'> = {
  assignees: [
    { accessId: 'a-1', membershipId: 'm-1', fullName: 'Ana', taskRole: 'LEAD' },
    { accessId: 'a-2', membershipId: 'm-2', fullName: 'Bob', taskRole: 'CREW' },
  ],
}

describe('team rules', () => {
  it('the first person added leads; the next ones join as crew; nobody twice', () => {
    const one = addToTeam([], 'a-1')
    expect(one).toEqual([{ accessId: 'a-1', taskRole: 'LEAD' }])
    const two = addToTeam(one, 'a-2')
    expect(two).toEqual([
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-2', taskRole: 'CREW' },
    ])
    expect(addToTeam(two, 'a-2')).toBe(two)
  })

  it('making someone the Lead moves the previous Lead to foreman, so there is always one', () => {
    const team: TeamPlace[] = [
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-2', taskRole: 'CREW' },
    ]
    expect(changeTaskRole(team, 'a-2', 'LEAD')).toEqual([
      { accessId: 'a-1', taskRole: 'FOREMAN' },
      { accessId: 'a-2', taskRole: 'LEAD' },
    ])
    expect(changeTaskRole(team, 'a-2', 'FOREMAN')).toEqual([
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-2', taskRole: 'FOREMAN' },
    ])
  })

  it('removing the Lead hands the lead to the most senior person left', () => {
    const team: TeamPlace[] = [
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-2', taskRole: 'CREW' },
      { accessId: 'a-3', taskRole: 'FOREMAN' },
    ]
    expect(removeFromTeam(team, 'a-1')).toEqual([
      { accessId: 'a-2', taskRole: 'CREW' },
      { accessId: 'a-3', taskRole: 'LEAD' },
    ])
    expect(removeFromTeam(team, 'a-2')).toEqual([
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-3', taskRole: 'FOREMAN' },
    ])
    expect(removeFromTeam([{ accessId: 'a-1', taskRole: 'LEAD' }], 'a-1')).toEqual([])
  })

  it('a team needs someone and exactly one Lead, like the server', () => {
    expect(teamIssue([])).toBe('empty')
    expect(teamIssue([{ accessId: 'a-1', taskRole: 'CREW' }])).toBe('lead')
    expect(
      teamIssue([
        { accessId: 'a-1', taskRole: 'LEAD' },
        { accessId: 'a-2', taskRole: 'LEAD' },
      ]),
    ).toBe('lead')
    expect(teamIssue([{ accessId: 'a-1', taskRole: 'LEAD' }])).toBeNull()
  })

  it('compares teams by people and roles, in any order', () => {
    const team: TeamPlace[] = [
      { accessId: 'a-1', taskRole: 'LEAD' },
      { accessId: 'a-2', taskRole: 'CREW' },
    ]
    expect(sameTeam(team, team.toReversed())).toBe(true)
    expect(sameTeam(team, [{ accessId: 'a-1', taskRole: 'LEAD' }])).toBe(false)
    expect(sameTeam(team, changeTaskRole(team, 'a-2', 'FOREMAN'))).toBe(false)
  })

  it('sorts a team most senior first, keeping the order inside a role', () => {
    expect(
      sortTeam([
        { accessId: 'c', taskRole: 'CREW' },
        { accessId: 'l', taskRole: 'LEAD' },
        { accessId: 'f', taskRole: 'FOREMAN' },
        { accessId: 'c2', taskRole: 'CREW' },
      ]).map((place) => place.accessId),
    ).toEqual(['l', 'f', 'c', 'c2'])
  })

  it('finds the caller in a task team by membership id', () => {
    expect(isOnTeam(task, 'm-2')).toBe(true)
    expect(isOnTeam(task, 'm-9')).toBe(false)
    expect(isOnTeam(task, null)).toBe(false)
    expect(isLead(task, 'm-1')).toBe(true)
    expect(isLead(task, 'm-2')).toBe(false)
    expect(myTaskRole(task, 'm-2')).toBe('CREW')
    expect(myTaskRole(task, null)).toBeNull()
  })
})
