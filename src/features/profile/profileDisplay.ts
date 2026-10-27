/** Name shown for the signed-in person: their full name, or their email until they set one. */
export function displayName(fullName: string | null, email: string): string {
  return fullName?.trim() || email
}

/** One or two letters for the avatar: first and last name, or the email's first letter. */
export function initials(fullName: string | null, email: string): string {
  const words = fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.length === 1 ? [words[0]] : [email]
  return letters.map((word) => word.charAt(0).toUpperCase()).join('')
}
