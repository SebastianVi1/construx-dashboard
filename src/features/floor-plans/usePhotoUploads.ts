import { useEffect, useRef, useState } from 'react'
import { PhotoTooLargeError } from './pinPhoto'

export type PhotoUpload = {
  id: number
  file: File
  /** Object URL of the picked file, for the thumbnail. */
  previewUrl: string
  state: 'uploading' | 'done' | 'failed' | 'tooLarge'
  /** Storage key once uploaded. */
  key?: string
}

/**
 * Photos picked for something not saved yet (a pin, a progress note). Each starts uploading when picked
 * through `upload`, which resolves with the storage key, so saving only has to name the keys; a failed one
 * stays in the list to be retried or removed. `upload` rejects with `PhotoTooLargeError` for a file
 * over the limit.
 */
export function usePhotoUploads(upload: (file: File) => Promise<string>) {
  const [items, setItems] = useState<PhotoUpload[]>([])
  const nextId = useRef(1)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    const created = urls.current
    return () => {
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [])

  function patch(id: number, change: Partial<PhotoUpload>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }

  function start(id: number, file: File) {
    upload(file).then(
      (key) => patch(id, { state: 'done', key }),
      (error: unknown) => patch(id, { state: error instanceof PhotoTooLargeError ? 'tooLarge' : 'failed' }),
    )
  }

  return {
    items,
    add(files: File[]) {
      const added = files.map((file) => {
        const previewUrl = URL.createObjectURL(file)
        urls.current.add(previewUrl)
        return { id: nextId.current++, file, previewUrl, state: 'uploading' as const }
      })
      setItems((current) => [...current, ...added])
      for (const item of added) start(item.id, item.file)
    },
    retry(id: number) {
      const item = items.find((i) => i.id === id)
      if (!item) return
      patch(id, { state: 'uploading' })
      start(id, item.file)
    },
    remove(id: number) {
      setItems((current) => current.filter((item) => item.id !== id))
    },
    /** Empties the list once what it held was saved. */
    clear() {
      setItems([])
    },
    /** True when every picked photo is in storage. */
    allDone: items.every((item) => item.state === 'done'),
    keys: items.flatMap((item) => (item.key ? [item.key] : [])),
  }
}
