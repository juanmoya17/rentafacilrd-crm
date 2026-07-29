# Design — RentaFácil CRM

Locked design system. Future Hallmark runs read this file first; pages defer to
it. Amend intentionally — the file is the rule.

Because this file exists, the diversification rule is **inverted** for this
project: new screens must *share* this system, not differ from each other.

## System

- Genre · modern-minimal (B2B dashboard — no hero, no display type above 20px)
- Tone · utilitarian. Instrument panel: tight radii, hairline surface rules,
  hierarchy by weight, state changes are quiet background shifts.
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

## Motion stance

Motion-cut. No animation library, and none should be added for UI state. Two
primitives only: a `--duration-fast` (120ms) colour transition on hover/active,
and the `rf-spin` loading spinner. `--ease-out` is the only easing; never the
browser default `ease`, never overshoot.

Reduced-motion collapses both. The spinner's label carries the meaning, so the
rotation is dropped rather than slowed.

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

## Open edges

Known-incomplete, in priority order. None is a blocker; all are route work.

1. **Warning surfaces still ride Tailwind `amber`** (`bg-amber-50` /
   `text-amber-800`, 6 sites each). They clear 4.5:1, so this is a coherence
   issue, not an accessibility one. Most visible on the dashboard, where four
   amber "Needs action" cards out-shout the teal accent. Either add
   `--color-warning` / `--color-warning-bg` at hue ~74, or reduce those cards to
   a hairline with an amber marker.
2. **`slate-*` migration bridge.** 19 files still use `slate` class names,
   re-pointed at the ink/rule ramp in `tokens.css`. Rename to `text-ink-2` /
   `border-rule` / `text-muted` per site, then delete the bridge block.
3. **`ScoreDot` band colours** (`red-500`, `orange-400`, `amber-300`) are still
   raw Tailwind. They are dots, not text, so contrast does not bind — but they
   are the last un-tokenised palette in the primitives.
4. **17 route files were not touched.** They inherit the fonts and the re-tint
   automatically; they do not yet use `Field`, and several hand-roll inputs the
   way `login.tsx` used to.

## Exports

`tokens.css` is the source of truth and is already a valid Tailwind v4 `@theme`
block. For DTCG `tokens.json`, shadcn/ui CSS variables, or a Flutter
`ThemeData`, ask *"extend design.md with <format> exports"*.
