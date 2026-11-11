import { useEffect, useRef, useState } from 'react'
import { PinPhotoTooLargeError, uploadPinPhoto } from './pinPhoto'

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
 * Photos picked for a pin that does not exist yet. Each starts uploading when picked, so saving the pin
 * only has to name the keys; a failed one stays in the list to be retried or removed.
 */
export function usePhotoUploads(organizationId: string, siteId: string, floorPlanId: string) {
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
    uploadPinPhoto(organizationId, siteId, floorPlanId, file).then(
      (key) => patch(id, { state: 'done', key }),
      (error: unknown) => patch(id, { state: error instanceof PinPhotoTooLargeError ? 'tooLarge' : 'failed' }),
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
    /** True when every picked photo is in storage. */
    allDone: items.every((item) => item.state === 'done'),
    keys: items.flatMap((item) => (item.key ? [item.key] : [])),
  }
}
