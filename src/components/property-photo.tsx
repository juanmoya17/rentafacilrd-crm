import { useI18n } from '@/lib/i18n/context'

/**
 * Listing photography — the cover shot, and the dot row that says how many
 * more there are.
 *
 * Shared by the card grid, the map view's list column and the record's
 * gallery, so the empty state is decided once. `images: []` is a normal
 * listing state, not an error: a draft that has not been photographed yet is
 * most of what a new agent's inventory looks like. It gets a labelled block
 * rather than a broken `<img>` or a collapsed box, so the card keeps its
 * shape and the row height does not jump between listings.
 */

export function PropertyPhoto({
  src,
  alt,
  className = '',
  /** Cover shots above the fold are the LCP element — never lazy-load those. */
  eager = false,
}: {
  src: string | undefined
  alt: string
  className?: string
  eager?: boolean
}) {
  const { t } = useI18n()

  if (src === undefined) {
    return (
      <div
        className={`grid place-items-center rounded bg-surface-sunken ${className}`}
        role="img"
        aria-label={t('properties.noPhotos')}
      >
        <span className="text-xs text-muted">{t('properties.noPhotos')}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      /* object-cover so a portrait shot fills the frame instead of pillarboxing
         — every card in a row has to be the same height or the grid rags. */
      className={`rounded bg-surface-sunken object-cover ${className}`}
    />
  )
}

/**
 * Photo-count dots, indicators only.
 *
 * Deliberately not a carousel: clicking through five shots of a listing is
 * something you do once you have opened it, and a row of twelve cards each
 * with its own interactive control is twelve more focus stops between the
 * agent and the record they are actually going to. The count is the
 * information; the record's gallery is where you browse. `aria-hidden`
 * because the figure's own label already carries the number.
 */
export function PhotoDots({ count, active = 0 }: { count: number; active?: number }) {
  if (count < 2) return null

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1"
    >
      {Array.from({ length: Math.min(count, 6) }, (_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${
            index === active ? 'bg-surface-raised' : 'bg-surface-raised/50'
          }`}
        />
      ))}
    </span>
  )
}
