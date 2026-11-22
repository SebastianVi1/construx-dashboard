import { describe, expect, it } from 'bun:test'
import { guideCatalog } from '../../../features/guide/catalog'
import { factHolds, tourCatalogProblems, tourSpotlightTexts, tourStepForMark, tourSteps, type TourCatalog, type TourIds } from '../../../features/guide/tourCatalog'
import { guideMessages } from '../../../features/guide/messages'
import { tourStops } from '../../../features/guide/tour'

const entry = { id: 'tour-example', page: 'sites', requires: [], tourTargets: ['site-create'], textKey: 'site' } as const
const problems = (steps: TourCatalog<TourIds>) => tourCatalogProblems(steps, guideCatalog)

describe('tour catalog', () => {
  it('keeps the built-in tour compatible with the checklist catalog', () => {
    expect(problems(tourSteps)).toEqual([])
  })

  it('reports invalid ids, missing prefix, duplicates and checklist clashes', () => {
    expect(problems([{ ...entry, id: 'Bad_Id' }]).join(' ')).toContain('Bad_Id')
    expect(problems([{ ...entry, id: 'example' }]).join(' ')).toContain('example')
    expect(problems([entry, entry]).join(' ')).toContain('tour-example')
    expect(problems([{ ...entry, id: 'create-site' }]).join(' ')).toContain('create-site')
  })

  it('reports unknown pages and checklist steps', () => {
    expect(problems([{ ...entry, page: 'unknown' }]).join(' ')).toContain('unknown')
    expect(problems([{ ...entry, checklistStep: 'missing' }]).join(' ')).toContain('missing')
  })

  it('reports invalid normal and replay targets', () => {
    expect(problems([{ ...entry, tourTargets: ['Bad_Target'] }]).join(' ')).toContain('Bad_Target')
    expect(problems([{ ...entry, replayTargets: ['Bad_Replay'] }]).join(' ')).toContain('Bad_Replay')
  })

  it('reports two tour steps sharing a checklist mark', () => {
    const shared = { ...entry, checklistStep: 'create-site' }
    expect(problems([shared, { ...shared, id: 'tour-other' }]).join(' ')).toContain('create-site')
  })

  it('rejects more than fifty checklist and tour ids together', () => {
    const count = 51 - guideCatalog.steps.length
    expect(problems(Array.from({ length: count }, (_, index) => ({ ...entry, id: `tour-${index}` }))).join(' ')).toContain('50')
  })

  it('defines the Site step and maps only its checklist mark', () => {
    expect(tourSteps).toHaveLength(1)
    expect(tourSteps[0]).toMatchObject({ id: 'tour-site', page: 'sites', requires: ['hasCompany'], doneWhen: 'hasSite', prefill: 'site', checklistStep: 'create-site' })
    expect(tourStepForMark('create-site', tourSteps)?.id).toBe('tour-site')
    expect(tourStepForMark('site-details', tourSteps)).toBeNull()
  })

  it('checks both Company and Site facts', () => {
    expect(factHolds('hasCompany', { hasCompany: true, siteId: null })).toBe(true)
    expect(factHolds('hasCompany', { hasCompany: false, siteId: 's1' })).toBe(false)
    expect(factHolds('hasSite', { hasCompany: true, siteId: null })).toBe(false)
    expect(factHolds('hasSite', { hasCompany: true, siteId: 's1' })).toBe(true)
  })

  for (const locale of ['en', 'es'] as const) {
    it(`uses ${locale} step and target copy while running, and replay copy without checklist target copy`, () => {
      const messages = guideMessages[locale]
      const running = tourSpotlightTexts(messages, false)
      expect(running.steps.site).toEqual(messages.tourSteps.site)
      expect(running.targets['site-create']).toEqual(messages.targets['site-create'])
      expect(running.targets['site-create-save']).toEqual(messages.targets['site-create-save'])

      const replay = tourSpotlightTexts(messages, true)
      expect(replay.steps.site).toEqual({ title: messages.tourSteps.site.title, body: messages.tourSteps.site.replay })
      expect(replay.targets).toEqual({})
      const replayStops = tourStops(
        tourSteps.map((step) => ({ ...step, tourTargets: step.replayTargets ?? step.tourTargets })),
        replay,
      )
      expect(replayStops).toEqual([{
        target: 'site-create', title: messages.tourSteps.site.title, body: messages.tourSteps.site.replay,
      }])
      expect(JSON.stringify(replayStops)).not.toContain(messages.targets['site-create'].body)
    })
  }

  it('has replay copy for every catalog step in both locales', () => {
    for (const step of tourSteps) {
      for (const locale of ['en', 'es'] as const) {
        expect(guideMessages[locale].tourSteps[step.textKey].replay.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
