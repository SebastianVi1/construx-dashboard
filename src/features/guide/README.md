# Adding a guide step or section

The getting-started guide is data. A new section or step is entries in `catalog.ts`, its text in `messages.ts`, and a few lines on the page where the action happens. Selection, progress, the panel and the tours read the lists and never name an id, so leave `selection.ts`, `guideState.ts`, `GuidePanel.tsx` and `tour.ts` alone.

The lists are `as const`, so their ids are types (`GuideStepId`, `GuidePageId`, `GuideSectionId`, `GuideTourTarget`). A step naming an unknown section or page, and a misspelt id in `markGuideStep`, `<GuideHelpButton page>` or a `data-tour` attribute, fails `bun run build`. Add the catalog entries first; the page code then type-checks against them. A test-only catalog uses the wide `GuideIds` (`GuideCatalog<GuideIds>`), as `selection.test.ts` does.

**No backend change is needed.** The backend stores each member's progress keyed by the step id string and knows no step list (`construx/docs/guide.md`). Its only rules: the id matches `^[a-z][a-z0-9-]{0,63}$` and a member has at most 50 steps.

**Step by step:** a step completed for real (a `markGuideStep` that changes it to COMPLETED, after progress loaded, outside a preview) is recorded as `lastDone` in `guideState.ts`. `completionFollowUp(state, sections)` says whether the panel opens on it (`open`), forgets it (`drop`: the guide is hidden, a preview shows, or the step isn't the member's) or has nothing to do (`none`). `GuideProvider` opens the panel once no other modal is open (`isModalOpen()`), and skips it when the guided tour completed its running step with the same mark (the tour reopens the panel itself). The panel ticks the step (`stepAdvance` names it and the next open step), moves focus to the next step's "Show me" or to the progress when none is left, and clears it (`stepDoneShown`). A Skip moves focus the same way. Nothing here names a step, so a new step gets this for free.

**Preview your change:** under `bun run dev`, the account menu has two dev items (`devTools` in `config/env.ts`, absent from production builds). "Preview checklist" opens the panel as a brand-new member sees it and runs the first step's "Show me"; skips there are not saved, and closing the panel ends the preview. "Start tour" restarts the guided tour in the current Company at "Create your first site": it forgets this browser's tour memory there (saved server progress stays) and, unlike the preview, creates a real Site and saves real progress.

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
7. **Completion**: call `markGuideStep('<stepId>', organizationId)` (`import { markGuideStep } from '../guide'`) right after the API call resolves, on the success path only: never in a `catch`, and only for the action the step names (a create, not an edit). `organizationId` is required: the guide ignores a mark for another Company. Put the call in a small save or load helper with the API function injectable, so a test can drive it; components call the helper, never `markGuideStep` (patterns: `sites/siteSave.ts`, `sites/siteBudgetSave.ts`, `finance/saveExpense.ts`, `tasks/taskSave.ts`, `sites/siteLoad.ts`).
8. **Tests** in `src/tests/features/guide/` (the Tester's files: request them in the ticket when you aren't granted them):
   - `selection.test.ts`, "built-in catalog": `catalogProblems(guideCatalog)` must stay `[]`. It checks ids, unknown sections, pages and `unless`, `:siteId` against `needsSite`, target syntax and the 50-step cap.
   - `selection.test.ts`, `selectGuide` blocks: update the exact shapes of every seeded role whose sections change (`seededRoles` mirrors the default grants in the backend's `built-in-roles.yml`), and add a `describe` for the new section: who gets it, who doesn't, its `titleKey`. `guideState.test.ts` and `guidePaths.test.ts` also select for `seededRoles.OWNER`; rerun them.
   - A Site page loads its Site through `sites/siteLoad.ts` `loadSite`, never `getSite` (`siteLoad.test.ts` checks every page).
   - The completion helper: a test next to the feature's tests (`src/tests/features/<feature>/`) that records marks with `recordGuideMarks()` (`src/tests/support/guideMarks.ts`) and checks a success marks once, a failure marks nothing, and an edit or a no-op marks nothing where the helper has one (`sites/siteSave.test.ts`).
9. `bun run lint && bun run build && bun test`.

## Adding a tour step

The guided tour is a second, ordered list next to the checklist: `tourCatalog.ts` (`tourSteps`). Tour steps are never counted in "2/5"; they are gated by facts, saved on the server under their own `tour-…` id through the same `guideSaves`, and shown as rows of the timeline at the top of the panel (`GuideTourTimeline.tsx`). The reducer (`tourState.ts`) and the timeline read the list and never name a step. `useGuidedTour.ts` names none either, but it holds the one place that maps a created id to a fact, one case per prefill key (today `'site'` → `siteId` in `onMark`); a step whose mark creates something new adds its case there. Leave `catalog.ts`, `selection.ts`, `guideState.ts` and `guideCommands.ts` alone.

The flow is timeline first. Every way into a step (start, "Continue tour", a timeline row, the dev "Start tour", a save that finished the previous step) only stages it: the panel opens on the timeline with the step's text and "Start this step". Nothing navigates, pre-fills or spotlights until that button (`run`), which closes the panel first, so only one modal is ever open. A save of the running step ticks it and reopens the panel on the next step (or "Tour complete"); closing the tour's form unsaved reopens it on the same step with "Not saved yet". Staged vs running is `useGuidedTour`'s `running` flag, not reducer state, and a mark completes a step only while it runs. The tour is offered only to members who see the 'owner' section and can create Sites (`MANAGE_PROJECT`).

1. **Catalog entry** in `tourSteps`, in walk-through order (append; never reorder or rename shipped ids):
   - `id`: `tour-` plus a name; matches `GUIDE_STEP_ID` and never changes once shipped (progress is stored under it).
   - `page`: an id in `guidePages` (reused, not duplicated). A page with `:siteId` opens the tour's own Site (`facts.siteId`).
   - `requires`: the facts that must hold to start or jump to the step. The timeline disables a step whose facts don't hold and lists what is missing.
   - `doneWhen` (optional): a fact that counts the step as done even when its progress save never reached the server (for example `tour-site` uses `hasSite`), so a reload never asks for the same thing twice.
   - `tourTargets`: `data-tour` values spotlighted while the step is current. `replayTargets` (optional): the targets a replay of a done step shows; a replay opens and creates nothing.
   - `prefill` (optional): the key of a form the step opens with example values.
   - `checklistStep` (optional): the checklist step whose existing `markGuideStep` completes this tour step. Without it, the step is completed by a mark carrying its own id.
   - `textKey`: a key of `messages.guide.tourSteps` (`{ title, body, replay }`: `replay` replaces `body` when a done step is replayed).
2. **Facts** (only for a new prerequisite): add it to `TourFact`, its value to `TourFacts`, its case to `factHolds`, and where it comes from to `tourFactsFrom` (`tourMemory.ts`) plus the `missing` line in `messages.guide.tourTimeline`. An id the tour created goes into `TourMemory` (one `localStorage` key per Company) from the `onMark` switch in `useGuidedTour.ts`.
3. **Pre-fill** (only for a new form): add the key to `TourPrefillKey`; write a pure builder in the page's feature whose example copy lives in that feature's `messages.ts` (as `sites/siteTourValues.ts`, which reads `sites.tourExample` for the locale and takes `localToday()`); on the page, `useTourForm('<key>')`: when `requested`, open the form with the builder's values and call `opened()`; pass `failed` to the form so a failed save shows "Not saved yet"; call `closed()` when the form closes without a save; close a tour-opened form without reporting when `running` turns false (`sites/useCreateSiteDialog.ts` is the pattern). Tag the form's submit with `submitTour` (`components/form`) when the step spotlights it. The guide never imports the page's feature.
4. **Text** in `messages.ts`, `en` and `es`: `tourSteps.<textKey>` (`{ title, body, replay }`) and, for a target with its own popover while the step runs, `targets['<target>']`. A replay never shows `targets` copy, only `replay`.
5. **Completion**: nothing new when `checklistStep` is set: the page already marks that checklist step after its API call, and a mark while this step is running (after "Start this step", not replaying) completes it. A mark that creates something passes the new id as `markGuideStep`'s third argument (`createdId`), and `useGuidedTour`'s `onMark` maps it to a fact.
6. **Tests** (the Tester's files): `tourCatalog.test.ts` keeps `tourCatalogProblems(tourSteps, guideCatalog)` at `[]`. It checks the id format and prefix, duplicates, clashes with checklist ids, unknown pages and checklist steps, target syntax, two steps sharing a `checklistStep`, and checklist plus tour ids under the 50-step cap. A new builder gets its own test (EN/ES, a fixed `today`).
7. `bun run lint && bun run build && bun test`, then try it with the dev "Start tour".

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
