# Adding a guide step or section

The getting-started guide is data. A new section or step is entries in `catalog.ts`, its text in `messages.ts`, and a few lines on the page where the action happens. Selection, progress, the panel and the tours read the lists and never name an id, so leave `selection.ts`, `guideState.ts`, `GuidePanel.tsx` and `tour.ts` alone.

The lists are `as const`, so their ids are types (`GuideStepId`, `GuidePageId`, `GuideSectionId`, `GuideTourTarget`). A step naming an unknown section or page, and a misspelt id in `markGuideStep`, `<GuideHelpButton page>` or a `data-tour` attribute, fails `bun run build`. Add the catalog entries first; the page code then type-checks against them. A test-only catalog uses the wide `GuideIds` (`GuideCatalog<GuideIds>`), as `selection.test.ts` does.

**No backend change is needed.** The backend stores each member's progress keyed by the step id string and knows no step list (`construx/docs/guide.md`). Its only rules: the id matches `^[a-z][a-z0-9-]{0,63}$` and a member has at most 50 steps.

## Checklist

1. **Section** (only for a new section): an entry in `guideSections`.
   - `id`: referenced by steps and by other sections' `unless`.
   - `order`: lower shows first. Taken: `owner` 10, `siteManager` 20, `finance` 30.
   - `rule.requires`: every `GuideGrant` the member must hold. `scope: 'organization'` needs a company-wide grant; `'any'` also accepts PROJECT or OWN grants.
   - `rule.unless`: section ids; a member who meets the `requires` of any of them doesn't see this section (`siteManager` uses `['owner']`).
   - `titleKey`: a key of `messages.guide.sections`.
2. **Steps**: entries in `guideSteps`. Their order in the list is their order inside a section.
   - `id`: permanent once shipped (progress is stored under it). A retired id stops counting by itself.
   - `sections`: in preference order. A step shows once, under the first visible section that lists it.
   - `requires`: grants needed to do the step. Without them the step is hidden and not counted, and a section left with no step disappears.
   - `page`: an id in `guidePages`. `chapter`: the landing guide anchor behind "Learn more" (`GuideChapter`).
   - `tourTargets`: `data-tour` values on that page, highlighted in order.
   - `textKey`: a key of `messages.guide.steps`. Optional `noSiteHint`: a key of `messages.guide.hints`, shown under the open step when the member is on no Site.
3. **Page** (only if the step's page is new): an entry in `guidePages`. A route inside a Site uses `:siteId` and then `needsSite: true` (and only then). A query such as `?tab=details` is allowed.
4. **Text** in `messages.ts`, under both `en` and `es` (`defineMessages` fails the build on a missing Spanish key):
   - `sections.<titleKey>`: the heading.
   - `steps.<textKey>`: `{ title, body }`.
   - `targets['<target>']`: optional `{ title, body }` for one tour popover; without it the step's own text shows.
   - `hints.<key>`: only for a new `noSiteHint`.
5. **Tour targets**: `data-tour="<target>"` on the real element. Values match `^[a-z][a-z0-9-]*$`. The tour uses the first *visible* match and waits up to 4 s for it, so a target inside a dialog or a later tab still works.
6. **"?" button**: `<GuideHelpButton page="<pageId>" />` in the page header (`import { GuideHelpButton } from '../guide'`). It renders nothing when the member has no step on that page. If the targets sit behind a tab, pass `onReplay` to switch to it (see `SiteDetailPage.tsx`).
7. **Completion**: call `markGuideStep('<stepId>', organizationId)` right after the API call resolves, on the success path only: never in a `catch`, and only for the action the step names (a create, not an edit). Always pass `organizationId`. Put the call in a small save or load helper with the API function injectable, so a test can drive it (patterns: `sites/siteBudgetSave.ts`, `finance/saveExpense.ts`, `sites/siteLoad.ts`).
8. **Tests** in `src/tests/features/guide/` (the Tester's files: request them in the ticket when you aren't granted them):
   - `selection.test.ts`, "built-in catalog": `catalogProblems(guideCatalog)` must stay `[]`. It checks ids, unknown sections, pages and `unless`, `:siteId` against `needsSite`, target syntax and the 50-step cap.
   - `selection.test.ts`, `selectGuide` blocks: update the exact shapes of every seeded role whose sections change (`seededRoles` mirrors the backend's `seeded-roles.properties`), and add a `describe` for the new section: who gets it, who doesn't, its `titleKey`. `guideState.test.ts` and `guidePaths.test.ts` also select for `seededRoles.OWNER`; rerun them.
   - A Site page loads its Site through `sites/siteLoad.ts` `loadSite`, never `getSite` (`siteLoad.test.ts` checks every page).
   - The completion helper: a test next to the feature's tests (`src/tests/features/<feature>/`) that subscribes with `subscribeGuideSteps` and checks a success marks once and a failure marks nothing (`sites/siteBudgetSave.test.ts`).
9. `bun run lint && bun run build && bun test`.

## Worked example: a Prices section

**This waits until the backend price Catalog is back.** It was removed (`a0e87ae`, migration `V39`), `/prices` is a disabled placeholder, and spec #83 leaves price steps out until then.

Section, after Finance:

```ts
{ id: 'prices', order: 40, rule: { requires: [{ action: 'MANAGE_PRICES', scope: 'organization' }] }, titleKey: 'prices' },
```

Seeded roles with `MANAGE_PRICES:ORGANIZATION` are Owner, Administrator and Finance, so all three gain it.

Step:

```ts
{
  id: 'add-catalog-item',
  sections: ['prices'],
  requires: [{ action: 'MANAGE_PRICES', scope: 'organization' }],
  page: 'prices',
  chapter: 'finance',
  tourTargets: ['catalog-item-add'],
  textKey: 'addCatalogItem',
},
```

The landing guide has no prices chapter (its chapters are in `construx-landing-page/src/data/guide.ts`), so `finance` it is. For a dedicated chapter, add it on the landing page first, then to `GuideChapter`.

Page: `{ id: 'prices', route: '/prices', needsSite: false }`.

Text:

```ts
// en
sections: { ..., prices: 'Prices' },
steps: { ..., addCatalogItem: { title: 'Add your first catalog item', body: 'Add a material, labor category or piece of equipment with its unit and cost.' } },
targets: { ..., 'catalog-item-add': { title: 'Add an item here', body: 'Fill in its name, unit and cost, then save.' } },
// es
sections: { ..., prices: 'Precios' },
steps: { ..., addCatalogItem: { title: 'Agrega tu primer insumo al catálogo', body: 'Agrega un material, una categoría de mano de obra o una máquina con su unidad y costo.' } },
targets: { ..., 'catalog-item-add': { title: 'Agrega un insumo aquí', body: 'Escribe su nombre, unidad y costo, y guarda.' } },
```

Page markup in `prices/PricesPage.tsx`: `<GuideHelpButton page="prices" />` in the `page-header`, and `data-tour="catalog-item-add"` on the button that opens `ResourceFormDialog` for a new item.

Completion: `ResourceFormDialog` calls `createResource` on two create branches and `updateResource` on edit. Move the create into a helper, for example `prices/catalogItemSave.ts`:

```ts
export async function createCatalogItem(organizationId: string, body: ResourceCreateBody, create = createResource) {
  const created = await create(organizationId, body)
  markGuideStep('add-catalog-item', organizationId)
  return created
}
```

Both create branches call it; the edit branch keeps `updateResource` and marks nothing.

Tests:
- `selection.test.ts`: the Owner becomes `owner, finance, prices`, the Administrator `owner, prices`, Finance `finance, prices`. A new `describe('selectGuide: "Prices"')`: `MANAGE_PRICES` company-wide gets it; Member and Superintendent (only `VIEW_PRICES`) don't; `titleKey` is `prices`.
- `src/tests/features/prices/catalogItemSave.test.ts`: a create marks `add-catalog-item` for its Company; a failed create marks nothing and rethrows.
