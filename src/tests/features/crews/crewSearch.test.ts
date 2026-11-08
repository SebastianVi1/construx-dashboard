import { describe, expect, it } from 'bun:test'
import { searchMembers } from '../../../features/crews/crewSearch'
import type { Member } from '../../../features/members/membersApi'

function member(membershipId: string, fullName: string | null, email: string): Member {
  return { membershipId, fullName, email } as Member
}

const people = [
  member('m1', 'José Pérez', 'jose@obra.mx'),
  member('m2', 'Ana López', 'ana.lopez@obra.mx'),
  member('m3', null, 'carlos@obra.mx'),
  member('m4', 'Ana María Ruiz', 'amr@obra.mx'),
]

const ids = (list: Member[]) => list.map((item) => item.membershipId)

describe('searchMembers', () => {
  it('returns everyone, in order, for an empty or blank query', () => {
    expect(ids(searchMembers(people, ''))).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(ids(searchMembers(people, '   '))).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('ignores case and accents', () => {
    expect(ids(searchMembers(people, 'JOSE'))).toEqual(['m1'])
    expect(ids(searchMembers(people, 'perez'))).toEqual(['m1'])
    expect(ids(searchMembers(people, 'lópez'))).toEqual(['m2'])
  })

  it('matches the email, including people without a name', () => {
    expect(ids(searchMembers(people, 'carlos@'))).toEqual(['m3'])
  })

  it('needs every word, in any order', () => {
    expect(ids(searchMembers(people, 'ana'))).toEqual(['m2', 'm4'])
    expect(ids(searchMembers(people, 'ruiz ana'))).toEqual(['m4'])
    expect(ids(searchMembers(people, 'ana pérez'))).toEqual([])
  })
})
