# Design — RentaFácil CRM

Locked design system. Future Hallmark runs read this file first; pages defer to
it. Amend intentionally — the file is the rule.

Because this file exists, the diversification rule is **inverted** for this
project: new screens must *share* this system, not differ from each other.

## System

- Genre · modern-minimal (B2B dashboard — no hero, no display type above 20px)
- Tone · utilitarian. Instrument panel: **softened radii** (amended
  2026-07-30 — see § Radius), hairline surface rules, hierarchy by weight,
  state changes are quiet background shifts.
- Theme · custom (vibe: "instrument panel for a brokerage floor")
- Axes · light paper / grotesk-sans display / chromatic-other (teal 195°)
- Audience · the brokerage's own agents, in the tool all day, in ES and EN
- Use case · move a lead through the pipeline; find the right unit fast

Catalog themes were not used. Coral and Cobalt would both have meant discarding
`#087c7c` / `#f5f5f4` / the sell–rent pair, which are shared with
rentafacilrd.com and the Flutter app. Cross-product identity beat theme variety.

## Tokens

**`tokens.css` at the project root is the source of truth.** `src/index.css`
imports it. Do not restate a value anywhere else — if a build needs a colour
that does not exist, add a named token to `tokens.css` and reference it.

Roles, so the right token gets picked without reading the file:

| Role | Token | Rule |
| --- | --- | --- |
| Warning / pending | `--color-warning` · `-bg` · `-edge` | hue 65; `-edge` is decorative only |
| Lead-score heat | `--color-band-hot/warm/mild/cold` | dots only, never text |
| Page paper | `--color-surface` | `#f5f5f4`, preserved from the public site |
| Raised (card, header, input) | `--color-surface-raised` | `#ffffff` |
| Hover fill / zebra | `--color-surface-sunken` | never carries a border |
| Heading text | `--color-ink` | |
| Body text | `--color-ink-2` | |
| Secondary text, labels | `--color-muted` | lightest token that may carry text |
| Surface separator | `--color-rule` | card edge, header underline — decorative |
| Control boundary | `--color-rule-2` | input edge, secondary button — 3:1 required |
| The one accent | `--color-accent` | = brand-600; keep under ~3% of any view |
| Text on an accent fill | `--color-accent-ink` | never hardcode `white` |
| Focus ring | `--color-focus` | 2px, 2px offset, never animated |

Two hard splits worth remembering: **ink tokens never draw a border, rule tokens
never carry text**, and `--color-rule-2` is much darker than a hairline because
it is the boundary that identifies a control.

## Type

- One family, `Geist Variable`, self-hosted via `@fontsource-variable/geist`.
  Display and body are the same face; hierarchy is weight (400 body / 600
  headings), never a second family.
- `Geist Mono Variable` is the outlier, and it carries exactly **two** roles:
  the wordmark, and machine values (ids, prices, dates, counts). Nothing else.
  `.font-mono` applies `tabular-nums`, so numeric columns align for free.
- Body is **14px**, not 16px — this is a dense tool and the deviation is
  deliberate. Scale is nominally 1.125, rounded to the whole-pixel grid below
  18px because sub-pixel small text blurs off-retina.
- No italic anywhere in headings or display. Emphasis is weight or accent.

## Radius

**Amended 2026-07-30, one step softer than the original spec.** Recorded rather
than quietly changed, because the tone line above used to read "tight radii".

The tokens live in `tokens.css` and deliberately **override Tailwind's
defaults**, so the whole app moved with the scale instead of needing a
find-and-replace across 45 `rounded-*` classes.

| Token | Value | Used by |
| --- | --- | --- |
| `--radius-sm` | 6px | badge, chip, tag, segmented thumb |
| `--radius-md` | 8px | button, input, select, photo, nav item |
| `--radius-lg` | 12px | card, panel, table shell, KPI tile |
| `--radius-xl` | 16px | modal, sheet, gallery frame |
| `rounded-full` | — | pills, dots, count badges. Unchanged; these are circles, not soft corners. |

One rule holds the ladder together: **a control is always tighter than the
surface holding it.** A button at the card's own radius looks swallowed by the
corner it sits in. Keep at least a 4px gap between adjacent rungs.

Density did not move with the radius — padding and `min-h-9` are unchanged, so
a screen still holds the same number of rows.

## Iconography

`lucide-react`, added 2026-07-30. Tree-shaken, so only imported glyphs ship.

- **Size** `size-4` (16px) inline with text, `size-5` (20px) for a standalone
  chrome control. `strokeWidth` 1.75 at rest; the nav's active item goes to
  2.25 — weight carries hierarchy here exactly as it does in the type.
- **Always `aria-hidden`.** The label beside it is the accessible name. When
  the label is hidden at a breakpoint (the header's sign-out) or absent
  entirely (the view switcher), the control carries an explicit `aria-label`
  **and** a `title`.
- **Icon-only is earned, not default.** Only where the glyph is genuinely
  self-evident *and* the control is used often enough to be learned — view
  mode, density, close. Never for domain values: a row of icons standing in
  for "Draft / Published / Paused / Expired" is a quiz, not a filter.
- **One glyph per meaning, app-wide.** A distinct silhouette per nav item is
  the condition under which nav icons earn their space; two items sharing a
  glyph is a bug, not a shortcut.
- **`Map` must be imported aliased** (`Map as MapIcon`) — the bare name shadows
  the global constructor and breaks any `new Map()` in the same module.

## Logo

`public/logo.svg` — the house/key mark, teal `#04AC9C`. It sits beside the mono
wordmark in the header.

**The mark's teal is not a UI token and must not become one.** `#04AC9C` is
2.4:1 on white; it is artwork and legal as a mark, but it cannot carry text or
act as a control boundary. Every UI surface stays on `--color-accent`
(`#087c7c`, 5.0:1), which is also what keeps the CRM in step with
rentafacilrd.com and the Flutter app. The two teals sitting side by side in the
header is intentional, not drift.

The `<img>` is `alt=""`: the wordmark next to it already names the product, and
a screen reader announcing "RentaFácil CRM logo, RentaFácil CRM" says it twice.

## CTA voice

- Primary · `--color-accent` fill, `--color-accent-ink` text, `rounded-md` (6px),
  `px-3 py-1.5`, `min-h-9`
- Secondary · `--color-rule-2` 1px border on raised surface, same radius, same height
- Ghost · no border, `--color-surface-sunken` on hover
- Every control is `min-h-9` (36px). Input height equals button height — a form
  with 36px buttons and 31px inputs reads untuned. 36 rather than the 44px touch
  ideal is a deliberate density call; it still clears the 24px WCAG 2.5.8 floor.

## Component contract — eight states, not two

Every interactive primitive in `src/components/ui.tsx` ships all eight:
default · hover · `:focus-visible` · `:active` · disabled · loading · error ·
success. Hover, focus and active are the browser's (`hover:` in Tailwind v4 is
already `@media (hover: hover)`, so touch devices never get stuck states);
disabled is the native attribute; the remaining four come from one `state` prop
typed `'idle' | 'loading' | 'error' | 'success'` — one prop, so "loading and
error at once" cannot be expressed.

Precedence and ARIA wiring live in `src/lib/control-state.ts`
(`resolveControl`), tested in `control-state.test.ts`. Two rules it enforces:
a disabled control is never announced invalid, and an error message *replaces*
helper text rather than stacking under it.

Geometry rules that keep controls from feeling loose:

- `border-width` is 1px in **every** state. Colour moves; width never does.
- The message slot reserves one line — but only on fields that can actually
  produce a message, so a bare login form pays nothing.
- The right-edge glyph slot is always reserved, so an appearing spinner or ⚠
  never reflows the input's text.

## Macrostructure families

App pages only — there are no marketing or content pages in this project. Pages
inside a family share its shape and vary only in which columns or fields they
declare. A new screen picks a family; it does not invent a sixth.

| Family | Shape | Screens |
| --- | --- | --- |
| **Console** | Stat row → action queue | dashboard |
| **Register** | Filter bar → sticky-head table (≥lg) / card stack (<lg) | leads · properties · inventory · notifications · tasks · projects |
| **Record** | Title spine + labelled sections | lead-detail · property-detail · project-detail |
| **Board** | Horizontal columns, drag between | pipeline |
| **Preferences** | Labelled field groups | settings |

### The toolbar — three regions, not one row

`FilterBar` takes `children` (search), `filters` (narrowing) and `actions`
(presentation). The split is by **job**, not by size:

```
┌──────────────────────────────────────────────────────┐
│ [search        ] 9 results         [sort] [view] [☑] │  find + present
├──────────────────────────────────────────────────────┤
│ [All][Draft][Published]… [⚙ Advanced filters (2)]    │  narrow
└──────────────────────────────────────────────────────┘
```

The one-row version wrapped differently at 1280 than at 1440 — the right-hand
cluster jumped lines as the window resized, which is the one thing a toolbar
must never do. Status chips get their own row because they are the widest
element on every screen that has them and the only one whose count grows with
the domain.

The advanced-filters disclosure rides in `filters` rather than on a row of its
own: closed it is a chip beside the status chips; open, the panel is wider than
the remaining track so flex-wrap gives it a line — the moment it has earned
one. Its badge shows the count of active advanced filters while shut, because
a price floor set yesterday otherwise silently explains a short result list
today.

The Register shell is `components/register.tsx`. Its column definition drives
both layouts, so the table and the card stack cannot drift apart. Below `lg` the
table becomes cards — these screens used to be a 56rem table in a horizontal
scroller, which at 375px was a 3-inch window onto it.

**Properties offers three user-chosen views** — Table / Fichas / Mapa, in the
toolbar's right cluster. Exactly one may be mounted at a time. Register already
keeps both of *its own* layouts in the DOM and relies on `display: none` to
stop the hidden copy claiming `view-transition-name: record-title`; a second
visible view would give two elements the same name and silently kill the record
morph. The card grid and the map's list column are property-shaped rather than
column projections, so they live in `routes/properties.tsx`; the anti-drift
guarantee comes from `StatusBadges`, `LeadCount`, `PriceCell` and
`InlineAction`, which every view renders through.

### Photography and the map

`CrmProperty` carries `images: string[]` (always an array, `[]` for an
unphotographed draft), `description`, and `lat`/`lng` (both or neither).
`PropertyPhoto` owns the no-photo block so the empty state is decided once and
cards keep their height. `PropertyGallery` — one large frame plus up to four
thumbs, the last carrying `+N` — is the record's browsing surface; the list's
`PhotoDots` are indicators only, because twelve per-card carousels would put
twelve focus stops between an agent and the record they are opening.

The map is Leaflet on OpenStreetMap tiles. Three things constrain edits to it:

- **Tiles are third-party requests** from the agent's browser to
  `tile.openstreetmap.org`. Swap `TILE_URL` in `property-map.tsx` for a
  self-hosted endpoint if that ever has to stop; nothing else changes.
- **Pins are `divIcon`s, never Leaflet's default marker**, so the
  `marker-icon.png` 404 that bundlers produce cannot happen. Their styling
  lives in `index.css` (Leaflet builds them outside anything Tailwind scans)
  and `--color-pin-shadow` is the single elevation token in the system — the
  documented exception to "hairlines, not elevation", because a pin sits on
  photographic tiles rather than on our paper.
- **Selection syncs both ways and there is no popup bubble.** A bubble would
  cover the neighbouring pins, which are the reason to be looking at a map.
- `scrollWheelZoom` is off. The page scrolls; ⌘/Ctrl + wheel and the buttons
  still zoom.

Un-geocoded listings are never dropped — they sit under a labelled divider in
the list column, because an agent who filtered to eight rows and counts six
pins needs to know where the other two went.

**Record — one shape, two body layouts.** Every record is `RecordHeader`
(back link · optional `media` · title · `meta` line · badges · actions) followed
by `RecordSectionHead`-labelled sections. What varies is whether the sections
stack full-width or split into a 2/3 + 1/3 rail, and the rule is the body:

- **Stack** when the sections are peers — `property-detail` (gallery, About,
  Details, Publicación, Leads).
- **Rail** when one section is a long chronological body that would bury its
  neighbours — `lead-detail`, whose timeline grows without bound while the
  tasks beside it must stay reachable.
- **Tabs** when the sections are alternative views of the same thing rather
  than parts of it — `project-detail` (models / units).

`FactGrid` is the labelled-fact block in all three; `FactList` is the narrow
label-value rail, and its only remaining consumer is `settings.tsx` under the
Preferences family.

Two slots on `RecordHeader` exist to stop facts being dressed as status:
`meta` is the glanceable line under the title (a property's specs, a project's
price range), `badges` is for actual state chips. A price range in `badges`
reads as a status pill beside a real one — that was the bug that motivated the
slot.

## Motion stance

**Amended 2026-07-30, at the user's explicit request, from the original
motion-cut stance.** Recorded rather than quietly changed, because the previous
version of this file said the opposite.

Five primitives app-wide. No screen uses more than three.

| Primitive | What it communicates | Where |
| --- | --- | --- |
| **view-transition** | Spatial continuity across a route change; the row you clicked morphs into the record heading | app shell + every list → detail link |
| **reveal** | This list just arrived | Register rows, card grids |
| **press** | The control received the input | every button/input (`active:translate-y-px`) |
| **settle / rollback** | The server accepted — or refused, and the UI just moved back | tasks, pipeline, via the failure toast |
| **lift** | This card is a target | project cards, nav indicator |

Rules that hold regardless:

- `transform` and `opacity` only. Never `width`, `height`, `top`, or `margin`.
- Three easings, all tokens; `--ease-out` entering, `--ease-in` leaving,
  `--ease-in-out` for toggles. The browser default `ease` is never used, and
  nothing overshoots.
- Three durations: 120 / 200 / 320ms. Exits run ~70% of their entrance.
- **Reveals fire once** (`viewport={{ once: true }}`). A row that re-animates
  every time it scrolls back into view makes a long table feel like it is still
  loading.
- Stagger is capped at 12 steps (~264ms) so a 50-row table finishes settling.
- **No success toasts.** If the user can see the row moved, saying so is noise.
  Toasts exist for the case where the UI already showed a change and the server
  then refused — that rollback is otherwise invisible. Error toasts do not
  auto-dismiss and carry the retry.
- `prefers-reduced-motion: reduce` kills every one of the five, including the
  view transitions — `*` does not match `::view-transition-*` pseudo-elements,
  so those are cut explicitly in `index.css`.

### Anti-patterns knowingly accepted here

The maximal motion set was requested after these costs were named, so they are
recorded rather than treated as bugs. A future audit should read this section
before flagging them:

- **Scroll-triggered row reveals** (Hallmark tell #12). Mitigated to one-shot
  via `once: true`, but a dense table still animates on first scroll-through.
- **Hover lift on cards** (tell #2). Limited to project cards and the nav
  indicator; deliberately absent from table rows, which use a background shift
  and an accent spine instead.
- **A motion library in a 3-dependency project.** `motion` adds ~44kB gzipped
  to the bundle. It earns it on the layout animations (a checked task travelling
  to Completed, the segmented indicator, toast stacking) which CSS cannot do
  without measuring; it would not have earned it for fades alone.

If the tool ever starts to feel slow to the agents using it, the first three
things to cut are the row reveals, the card lift, and the stagger — in that
order. Nothing else in this list carries information.

## Contrast ledger

Every pair the app renders, measured (WCAG 2.1), not estimated. Recompute this
table if any colour token changes.

| Pair | Ratio | Floor |
| --- | --- | --- |
| ink on paper / raised | 16.3 / 17.7 | 4.5 |
| ink-2 on paper / raised | 9.4 / 10.3 | 4.5 |
| muted on paper / raised / sunken | 4.6 / 5.0 / 4.6 | 4.5 |
| rule-2 vs paper / raised (control boundary) | 3.1 / 3.3 | 3.0 |
| accent-ink on accent fill | 5.0 | 4.5 |
| accent-ink on accent hover (brand-700) | 7.1 | 4.5 |
| focus ring vs paper / raised | 4.6 / 5.0 | 3.0 |
| brand-700 on brand-50 (active nav) | 6.7 | 4.5 |
| error on raised / error-bg | 5.4 / 4.7 | 4.5 |
| success on raised / success-bg | 5.0 / 4.7 | 4.5 |
| sell-ink on sell-bg | 4.6 | 4.5 |
| rent-ink on rent-bg | 4.5 | 4.5 |
| warning on raised / warning-bg | 5.1 / 4.6 | 4.5 |
| band-hot / band-cold vs raised (dots) | 4.7 / 3.3 | — |

Four of these were failures in the CRM before this system landed, and the fixes
are why some tokens look unintuitive:

- Nav section labels sat at `slate-400` on white — **2.6:1**. `slate-400` is now
  collapsed onto `--color-muted`; it is not a lighter step any more, because no
  lighter step can legally carry text.
- Input and secondary-button borders sat at `slate-300` — **1.5:1** as a control
  boundary, against a 3:1 requirement. Hence the much darker `--color-rule-2`.
- `text-sell` on `bg-sell-bg` — **3.2:1**. Background preserved (it is the part
  the buyer recognises), label darkened to `--color-sell-ink`.
- `text-rent` on `bg-rent-bg` — **2.3:1**. Same fix, `--color-rent-ink`.

## Layout invariants — do not remove these

Three `min-width: 0` declarations and one grid template are load-bearing. Each
was added after a real, visible break; none is defensive.

- **`grid-cols-[minmax(0,1fr)]` on the app shell** (`crm-layout.tsx`). A grid
  item's automatic minimum size in the inline axis is `min-content`, so the
  Kanban's `min-w-max` propagated up and stretched the shell to 1644px on a
  1280px viewport, pushing the header's sign-out button to x=1852. `overflow-x:
  clip` then hid the scrollbar, so the page looked fine while the header was
  unusable. **This is the trap to know about: `clip` suppresses the symptom, not
  the cause.** Check header width against viewport width, not for a scrollbar.
- **`min-w-0` on the shell's flex row and on the `<main>` padding wrapper.**
  Same failure, two more places it can enter.
- **No `overflow-*` on the Register's table wrapper.** An overflow container
  becomes the sticky ancestor, which pins the table head to the card instead of
  the viewport.
- **Padding on the wrapper inside `<main>`, never on `<main>` itself.** Sticky
  offsets resolve against the scrollport's content box, so padding on the
  scroll container parks a `sticky top-0` head that far down and lets rows
  scroll through the gap above it.
- **No hardcoded sticky offsets anywhere.** `<main>` is the scroll container, so
  every in-page sticky is `top-0`. The old `top-[49px]` constants were measured
  against a header that later became 57px tall, and everything sat 8px high with
  content showing through. `grep -rn "top-\[" src/` should return nothing.
- **The remount key is on the wrapper *inside* `<main>`, never on `<main>`.** A
  keyed scroll container is rebuilt on every navigation, so there is no element
  left to restore a scroll offset into — `scrollTop` on a fresh node is always
  0. Moving that key is what made scroll restoration possible.
- **Only one Register layout may be visible at a time.** Both the table and the
  card stack are always in the DOM, so every row's primary cell exists twice.
  It is only safe for that cell to carry `view-transition-name: record-title`
  because the hidden copy is `display: none`. Render both at once and two
  elements claim the same name, which aborts the transition silently — no error,
  the morph just stops happening.

## Open edges

Known-incomplete, in priority order. None is a blocker.

1. **`useResource` refetches on every mount**, so a view transition into a
   record and straight back re-requests the list. Scroll restoration now waits
   for that refetch (which is what its retry loop is for), so the cost shows up
   as a brief pause before the list lands at the right offset rather than as a
   wrong offset. A short-lived cache would remove the pause.
2. **Bundle is one 685kB chunk** (208kB gzipped). Vite is warning about it, and
   Leaflet made it louder — it is only needed by one of three views on one
   screen and is currently in the entry chunk. The split, in order of payoff:
   `React.lazy` the route components, then dynamic-`import()` `property-map.tsx`
   so the map is fetched when an agent picks the Mapa view rather than on
   first paint.
3. **`ScoreDot` bands are colour + number, with no third channel.** The number
   carries the value so nothing is lost, but a shape or letter per band would
   make the heat readable without relying on the figure.
4. **Register renders both layouts**, so a 50-row table is 100 row nodes. The
   alternative — a JS breakpoint — flashes the wrong layout on first paint, so
   this is the right trade, but it is a real cost at high row counts.

### Closed by the 2026-07-30 redesign

- Warning surfaces now use `--color-warning` / `--color-warning-bg` (hue 65),
  and the dashboard's four filled amber cards are one hairline queue with a
  single amber spine per row — the accent is the loudest colour again.
- The `slate-*` migration bridge is **deleted**. No file in `src/` references a
  raw Tailwind colour; if a `slate-*` class reappears it will render as
  Tailwind's blue-grey against a teal brand, which is the intended tell.
- `ScoreDot` band colours are tokenised as `--color-band-hot/warm/mild/cold`.
- All 13 routes plus the two auth-shell screens (`require-auth`,
  `verification-pending`) are on the family shells and the token system.
- `pipeline.tsx` and `lead-detail.tsx` now report a refused optimistic update
  through the failure toast with a retry, instead of an inline paragraph.
- **Scroll restoration** for the `<main>` scroll container
  (`lib/use-scroll-restoration.ts`). POP restores, PUSH/REPLACE goes to the top.
  The hard part was not saving the offset but restoring into content that has
  not loaded yet — assigning `scrollTop` to a still-short container clamps to
  its maximum, so the restore retries on a `ResizeObserver` until the offset
  sticks or a 1.2s deadline passes. `lib/scroll-store.ts` holds that decision as
  a pure function with tests.

## Exports

`tokens.css` is the source of truth and is already a valid Tailwind v4 `@theme`
block. For DTCG `tokens.json`, shadcn/ui CSS variables, or a Flutter
`ThemeData`, ask *"extend design.md with <format> exports"*.
