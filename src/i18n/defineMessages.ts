export type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

// One feature's catalog slice with both languages side by side. English defines the shape;
// Spanish must have exactly the same keys, so a missing translation fails the typecheck.
export function defineMessages<T extends object>(slice: {
  en: T
  es: DeepStringify<NoInfer<T>>
}) {
  return slice
}
