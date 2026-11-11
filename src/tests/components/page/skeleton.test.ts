import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SkeletonBlock, SkeletonRegion, SkeletonTable } from '../../../components/page/Skeleton'
import { CrewsSectionSkeleton } from '../../../features/crews/CrewSkeleton'
import { PhasesPageSkeleton } from '../../../features/goals/PhaseSkeletons'
import { LocaleContext } from '../../../i18n/locale-context'
import { messages } from '../../../i18n/messages'

function render(child: ReturnType<typeof createElement>, locale: 'en' | 'es' = 'en') {
  return renderToStaticMarkup(createElement(LocaleContext.Provider, {
    value: { locale, messages: messages[locale], setLocale: () => {} },
  }, child))
}

describe('container loading placeholders', () => {
  test('reserves real table rows and columns inside the scrolling surface', () => {
    const html = render(createElement(SkeletonTable, { columns: 5, rows: 3 }))
    expect(html).toContain('table-scroll')
    expect(html).toContain('data-table')
    expect(html.match(/<td>/g)).toHaveLength(15)
    expect(html.match(/<th>/g)).toHaveLength(5)
    expect(html).toContain('aria-busy="true"')
  })

  test('announces loading in the active locale and hides decorative content', () => {
    const html = render(createElement(SkeletonRegion, {
      className: 'sites-grid', children: createElement(SkeletonBlock, { height: 248 }),
    }), 'es')
    expect(html).toContain('sites-grid')
    expect(html).toContain('aria-label="Cargando…"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('height:248px')
    expect(html).not.toContain('<button')
  })

  test('the crews placeholder keeps the section header it stands in for', () => {
    const html = render(createElement(CrewsSectionSkeleton))
    expect(html).toContain('page-section__header')
    expect(html).toContain('crews-list')
  })

  test('the phases page placeholder keeps its header and view tabs', () => {
    const html = render(createElement(PhasesPageSkeleton))
    expect(html).toContain('page-header')
    expect(html).toContain('filter-tabs')
    expect(html).toContain('gantt__sheet--skeleton')
  })
})
