import { createContext, useContext } from 'react'
import type { RemoteData } from '../../components/data/useRemoteData'
import type { PlanLibrary } from './planLibraryApi'

export const PlanLibraryContext = createContext<RemoteData<PlanLibrary> | null>(null)
export function usePlanLibrary() {
  const value = useContext(PlanLibraryContext)
  if (!value) throw new Error('Plans library provider is missing')
  return value
}
