import type { ComponentType, ReactNode } from 'react'
import { motion } from 'motion/react'
import { useRowReveal } from '@/lib/motion'

/**
 * The Register family — the shared shell behind every dense list screen.
 *
 * Two things it exists to fix, both of which were being hand-rolled per screen:
 *
 *  1. **Mobile.** These screens were `<table class="min-w-[52rem]">` inside a
 *     horizontal scroller. At 375px that is a 3-inch-wide window onto a
 *     56rem table. Below `lg` the same columns now render as stacked cards,
 *     driven off one column definition so the two layouts cannot drift.
 *  2. **A sticky header.** Only possible because the page (not a wrapper) is
 *     the scroll container — an `overflow-x-auto` ancestor would silently
 *     break `position: sticky`, which is why the table no longer sits in one.
 *
 * Both layouts are always in the DOM; the breakpoint hides one with
 * `display: none`. That is deliberate — a JS breakpoint check would flash the
 * wrong layout on first paint — but it has one non-obvious consequence:
 * **every row's primary cell exists twice.** It is only safe for that cell to
 * carry `view-transition-name: record-title` because the hidden copy is
 * `display: none` and so does not participate in a transition. If either layout
 * is ever made visible at the same time as the other, two elements will claim
 * the same name and the morph will silently stop working — a duplicated
 * view-transition-name aborts the whole transition with no error.
 */

export interface Column<Row> {
  key: string
  header: string
  /** Right-aligns and sets tabular mono — use for anything a reader compares. */
  numeric?: boolean
  /**
   * Placement in the sub-`lg` card layout:
   *   primary — the card's heading line. Whatever link it renders is stretched
   *             to cover the whole card (see `.rf-cardlink`), so this column
   *             owns the row's navigation.
   *   meta    — the small line under the heading
   *   field   — a labelled row in the card body
   *   hide    — desktop only (row-selection checkboxes, repeated affordances)
   */
  card?: 'primary' | 'meta' | 'field' | 'hide'
  render: (row: Row) => ReactNode
}

/** Header cell. Uppercase micro-label, hairline under, sticky under the app bar. */
function HeadCell({ column }: { column: Column<unknown> }) {
  return (
    /* top-0 because <main> is the scroll container — there is no header offset
       to subtract, so nothing to keep in sync when the header height changes. */
    <th
      scope="col"
      className={`sticky top-0 z-10 bg-surface-raised px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted ${
        column.numeric === true ? 'text-right' : 'text-left'
      }`}
    >
      {column.header}
    </th>
  )
}

export function Register<Row>({
  columns,
  rows,
  rowKey,
  footer,
  label,
  density = 'comfortable',
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string | number
  footer?: ReactNode
  label: string
  /** Desktop row height only — the card layout is always comfortable. */
  density?: 'compact' | 'comfortable'
}) {
  const reveal = useRowReveal()
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5'
  const cardColumns = columns.filter((column) => column.card !== 'hide')
  const primary = cardColumns.find((column) => column.card === 'primary')
  const meta = cardColumns.filter((column) => column.card === 'meta')
  const fields = cardColumns.filter(
    (column) => column.card === 'field' || column.card === undefined,
  )

  return (
    <>
      {/* ---------------------------------------------------- lg and up: table */}
      {/* Deliberately NOT overflow-hidden: an overflow container becomes the
          sticky ancestor, which silently pins the table head to the card
          instead of the viewport. Rows carry no background, so nothing needs
          clipping to the rounded corners anyway. */}
      <div className="hidden rounded-lg border border-rule bg-surface-raised lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-rule">
              {columns.map((column) => (
                <HeadCell key={column.key} column={column as Column<unknown>} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <motion.tr
                key={rowKey(row)}
                {...reveal(index)}
                /* The accent bar is an inset box-shadow rather than a border so
                 * it cannot change the row's height on hover. */
                className="group border-b border-rule/60 transition-[background-color,box-shadow] duration-(--duration-base) ease-out last:border-0 hover:bg-surface-sunken hover:[box-shadow:inset_2px_0_0_0_var(--color-accent)]"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 align-top ${rowPadding} ${
                      column.numeric === true
                        ? 'text-right font-mono text-ink-2'
                        : 'text-ink-2'
                    }`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t border-rule bg-surface-sunken">{footer}</tfoot>}
        </table>
      </div>

      {/* ------------------------------------------------- below lg: card stack

          The card is NOT wrapped in a link. Wrapping it would nest the primary
          column's own <a> inside an outer <a>, which is invalid HTML and which
          React warns about at runtime. Instead `.rf-cardlink` stretches the
          primary column's existing link across the card, so the whole card is
          the tap target with exactly one anchor in it. */}
      <ul className="space-y-2 lg:hidden">
        {rows.map((row, index) => (
          <motion.li
            key={rowKey(row)}
            {...reveal(index)}
            className="relative rounded-lg border border-rule bg-surface-raised p-3 transition-colors duration-(--duration-base) ease-out hover:border-rule-2"
          >
            <div className="min-w-0">
              {primary && (
                <div className="rf-cardlink text-sm font-medium text-ink">
                  {primary.render(row)}
                </div>
              )}
              {meta.map((column) => (
                <div key={column.key} className="mt-0.5 text-xs text-muted">
                  {column.render(row)}
                </div>
              ))}
            </div>

            {fields.length > 0 && (
              /* `relative` so anything interactive in a field (an inline action
                 button, a second link) paints above the stretched link rather
                 than under it. */
              <dl className="relative mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {fields.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs uppercase tracking-wider text-muted">
                      {column.header}
                    </dt>
                    <dd
                      className={`mt-0.5 text-sm text-ink-2 ${
                        column.numeric === true ? 'font-mono' : ''
                      }`}
                    >
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </motion.li>
        ))}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ filters */

export interface SegmentOption<T extends string> {
  value: T | null
  label: string
  /** Lucide component. Required on every option when the group is `iconOnly`. */
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>
}

/**
 * Filter group with a sliding indicator.
 *
 * The indicator is one shared element that animates between segments rather
 * than a background colour appearing on the new segment and vanishing from the
 * old. That is the whole reason this is not just styled buttons: the movement
 * is what tells the eye *which* filter it came from.
 *
 * `group` must be unique per instance on the page — two groups sharing it would
 * animate the indicator between them across the screen.
 */
export function Segmented<T extends string>({
  group,
  label,
  options,
  value,
  onChange,
  iconOnly = false,
}: {
  group: string
  label: string
  options: SegmentOption<T>[]
  value: T | null
  onChange: (next: T | null) => void
  /**
   * Render the glyph alone and move the label to `aria-label` + `title`.
   *
   * Only defensible when the glyph is genuinely self-evident *and* the control
   * is used often enough to be learned — a view switcher, a density toggle.
   * Never for domain values: a row of icons standing in for "Draft / Published
   * / Paused / Expired" is a quiz, not a filter.
   */
  iconOnly?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-0.5 rounded-md border border-rule bg-surface-raised p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value ?? '__all'}
            type="button"
            aria-pressed={selected}
            /* The label survives as the accessible name and as the tooltip
               when the glyph is alone — an icon-only control that announces
               as "button" is the usual way this pattern fails. */
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            /* whitespace-nowrap: a filter chip that wraps to two lines is one
             * of the mobile gates — clickable text stays on one line.
             * min-h-8 + active: the press state is part of the eight, and a
             * chip without one feels dead next to buttons that have it.
             * Icon-only gets a square footprint so the row reads as a set of
             * equal switches rather than ragged chips. */
            className={`relative min-h-8 whitespace-nowrap rounded-sm text-sm font-medium transition-colors duration-(--duration-fast) ease-out active:translate-y-px ${
              iconOnly ? 'grid size-8 place-items-center' : 'px-2.5 py-1'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`segmented-${group}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-sm bg-accent"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span
              className={`relative flex items-center gap-1.5 ${
                selected ? 'text-accent-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
              {!iconOnly && option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Search field with a live result count.
 *
 * The count is announced `polite` and only after the caller's debounce has
 * settled, so a screen reader hears "18 results" once instead of on every
 * keystroke.
 */
export function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  resultLabel,
  pending,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder: string
  resultLabel?: string
  /** True while the debounce is still running — dims the count rather than hiding it. */
  pending?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-9 w-full rounded-md border border-rule-2 bg-surface-raised px-3 py-1.5 text-sm text-ink transition-colors duration-(--duration-base) ease-out placeholder:text-muted hover:bg-surface-sunken focus:bg-surface-raised sm:w-64"
      />
      {resultLabel !== undefined && (
        <output
          htmlFor={id}
          aria-live="polite"
          className={`hidden shrink-0 font-mono text-xs text-muted transition-opacity duration-(--duration-base) ease-out sm:block ${
            pending === true ? 'opacity-40' : 'opacity-100'
          }`}
        >
          {resultLabel}
        </output>
      )}
    </div>
  )
}

/**
 * Toolbar above a Register — three regions, not one wrapping row.
 *
 * The single-row version put search, eight status chips and the view controls
 * in one `flex-wrap`, so which line the right-hand cluster landed on depended
 * on the viewport: at 1440 it sat beside the search, at 1280 it dropped to its
 * own line leaving a long gap. The toolbar reshuffled as the window resized,
 * which is exactly what a toolbar must not do.
 *
 * Now the rows are fixed:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │ [search        ] 9 results        [sort] [view] [☑] │  ← finding + presenting
 *   ├─────────────────────────────────────────────────────┤
 *   │ [All][Draft][Published][Paused][Expired][Sold] …    │  ← narrowing
 *   └─────────────────────────────────────────────────────┘
 *
 * The split is by *job*, not by size: row one is how you find and how you look
 * at it, row two is what you exclude. Status chips get their own row because
 * they are the widest element on every screen that has them and the only one
 * whose count grows with the domain.
 *
 * `filters` and `actions` are optional — a screen with neither (tasks) renders
 * a single row and pays nothing for the structure.
 */
export function FilterBar({
  children,
  filters,
  actions,
}: {
  /** Primary control — the search field. Always row one, always first. */
  children?: ReactNode
  /** Narrowing controls: status chips, toggles, active-filter pills. Row two. */
  filters?: ReactNode
  /** Presentation controls: sort, view mode, density, select-all. Row one, right. */
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 space-y-2">
      {(children || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {actions && (
            /* ml-auto on the cluster, not on its first child: with the search
               field flex-growing on mobile the cluster wraps to its own line,
               and an ml-auto on a lone chip there pushes it to a lonely right
               edge instead of keeping the group left-aligned under the search. */
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>
          )}
        </div>
      )}
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </div>
  )
}
