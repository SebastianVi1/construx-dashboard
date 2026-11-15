/** The selected values stored by a checkbox-group field. */
export function selectedOptionValues(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : []
  } catch {
    return []
  }
}

/** Toggle one value in the serialized checkbox-group field, preserving selection order. */
export function toggleOptionValue(value: string, optionValue: string): string {
  const selected = new Set(selectedOptionValues(value))
  if (selected.has(optionValue)) selected.delete(optionValue)
  else selected.add(optionValue)
  return JSON.stringify([...selected])
}
