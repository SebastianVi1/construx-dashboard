import type { Member } from '../members/membersApi'

/** Lowercase without accents, so "perez" finds "Pérez". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** People whose name or email holds every word of the query, in any order; all of them when it is blank. */
export function searchMembers(members: Member[], query: string): Member[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return members
  return members.filter((member) => {
    const haystack = fold(`${member.fullName ?? ''} ${member.email}`)
    return words.every((word) => haystack.includes(word))
  })
}
