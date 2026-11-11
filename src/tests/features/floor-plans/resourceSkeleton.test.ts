import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LocaleContext } from '../../../i18n/locale-context'
import { messages } from '../../../i18n/messages'
import { FloorPlanGallerySkeleton, FloorPlanWorkspaceSkeleton } from '../../../features/floor-plans/FloorPlanSkeletons'
import { DocumentFoldersSkeleton, DocumentEntriesSkeleton } from '../../../features/documents/DocumentSkeletons'

function render(component: () => ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(LocaleContext.Provider, {
    value: { locale: 'en', setLocale: () => {}, messages: messages.en },
  }, createElement(component)))
}

describe('resource loading containers', () => {
  test('floor plan loading reserves the actual gallery cards and thumbnails', () => {
    const html = render(FloorPlanGallerySkeleton)
    expect(html).toContain('class="floor-plan-list"')
    expect(html.match(/class="floor-plan-card"/g)).toHaveLength(3)
    expect(html.match(/class="floor-plan-card__thumb"/g)).toHaveLength(3)
    expect(html).not.toContain('<button')
  })

  test('workspace loading reserves the toolbar, canvas, and inspector', () => {
    const html = render(FloorPlanWorkspaceSkeleton)
    for (const className of ['floor-plan-workspace', 'floor-plan-toolbar', 'floor-plan-canvas', 'zone-panel']) {
      expect(html).toContain(className)
    }
    expect(html).toContain('aria-busy="true"')
  })

  test('folder and file placeholders reuse their distinct loaded layouts', () => {
    const folders = render(DocumentFoldersSkeleton)
    const entries = render(DocumentEntriesSkeleton)
    expect(folders).toContain('document-folders-grid')
    expect(folders.match(/class="document-folder-card"/g)).toHaveLength(4)
    expect(entries).toContain('document-entries-list')
    expect(entries.match(/class="document-entry"/g)).toHaveLength(4)
  })
})
