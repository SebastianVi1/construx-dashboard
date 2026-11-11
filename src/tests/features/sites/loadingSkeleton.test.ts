import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LocaleContext } from '../../../i18n/locale-context'
import { messages } from '../../../i18n/messages'
import { SitesGridSkeleton, BudgetOverviewSkeleton, SiteTeamSkeleton } from '../../../features/sites/SiteSkeletons'

function render(component: typeof SitesGridSkeleton) {
  return renderToStaticMarkup(createElement(LocaleContext.Provider, {
    value: { locale: 'en', messages: messages.en, setLocale: () => {} },
  }, createElement(component)))
}

test('site loading keeps the responsive card containers instead of a line list', () => {
  const html = render(SitesGridSkeleton)
  expect(html).toContain('sites-grid')
  // The placeholder fills the screen like a site list full of cards would.
  expect(html.match(/class="site-card"/g)).toHaveLength(6)
  expect(html).toContain('skeleton-screen')
  expect(html).toContain('site-card__footer')
  expect(html).not.toContain('href=')
})

test('budget and team loading reuse their own responsive containers', () => {
  expect(render(BudgetOverviewSkeleton)).toContain('budget-overview')
  expect(render(BudgetOverviewSkeleton)).toContain('budget-figures')
  expect(render(SiteTeamSkeleton)).toContain('site-team__roster')
  expect(render(SiteTeamSkeleton).match(/class="site-team__person"/g)).toHaveLength(6)
})
