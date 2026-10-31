import { useEffect, useState } from 'react'
import type { Messages } from '../../i18n'
import type { ExcelLibrary } from './excelModel'
import type { ExcelStore } from './excelStore'
import { parseExpanded, toggleExpanded } from './excelTreeRows'
import { excelErrorMessage } from './useExcelStore'

const CHANGED = 'construx:excel-library-changed'
const CHANNEL = 'construx-excel-library'

/** Tells every view of the library, in this tab and in others, to read it again. */
export function notifyLibraryChanged(organizationId: string) {
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: organizationId }))
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(organizationId)
    channel.close()
  } catch {
    // Other tabs catch up on their next load.
  }
}

function onLibraryChanged(organizationId: string, listener: () => void): () => void {
  const local = (event: Event) => {
    if ((event as CustomEvent<string>).detail === organizationId) listener()
  }
  window.addEventListener(CHANGED, local)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<string>) => {
      if (event.data === organizationId) listener()
    }
  } catch {
    channel = null
  }
  return () => {
    window.removeEventListener(CHANGED, local)
    channel?.close()
  }
}

/** The company's folders and workbooks, read again whenever any view changes them. */
export function useExcelLibrary(store: ExcelStore | null, organizationId: string, t: Messages['excel']) {
  const [library, setLibrary] = useState<ExcelLibrary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!store) return
    let active = true
    const load = () => {
      store
        .tree(organizationId)
        .then((tree) => {
          if (active) setLibrary(tree)
        })
        .catch((caught: unknown) => {
          if (active) setError(excelErrorMessage(caught, t))
        })
    }
    load()
    const stop = onLibraryChanged(organizationId, load)
    return () => {
      active = false
      stop()
    }
  }, [store, organizationId, t])

  /** Reads the library again here and tells the other views to do the same. */
  async function refresh() {
    if (!store) return
    setLibrary(await store.tree(organizationId))
    notifyLibraryChanged(organizationId)
  }

  return { library, error, refresh }
}

/**
 * The folders a tree shows open, kept per company and per view (`page` or `nav`). Storage is a
 * convenience: when it is unavailable the tree simply starts closed.
 */
export function useExpandedFolders(organizationId: string, view: 'page' | 'nav') {
  const key = `construx.excel.expanded.${view}.${organizationId}`
  const [state, setState] = useState(() => ({ key, expanded: read(key) }))
  // A company switch keeps this component mounted, so re-read for the new key.
  const expanded = state.key === key ? state.expanded : read(key)

  function toggle(folderId: string) {
    const next = toggleExpanded(expanded, folderId)
    setState({ key, expanded: next })
    try {
      localStorage.setItem(key, JSON.stringify([...next]))
    } catch {
      // Not remembered this time.
    }
  }

  return { expanded, toggle }
}

function read(key: string): Set<string> {
  try {
    return parseExpanded(localStorage.getItem(key))
  } catch {
    return new Set()
  }
}
