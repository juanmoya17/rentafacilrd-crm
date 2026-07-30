import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PropertyPhoto } from '@/components/property-photo'

/**
 * The record's photo mosaic — one large shot beside a 2×2 grid of thumbs,
 * the fourth thumb carrying a `+N` when there are more than five.
 *
 * This is where browsing photos belongs, so unlike the list's `PhotoDots`
 * these thumbs are real buttons: on a record there is one gallery, and an
 * agent looking at it has already decided this is the listing they care
 * about. The large frame is what changes; the thumb row does not reorder,
 * because a grid that reshuffles under the cursor makes it impossible to go
 * back to the shot you just left.
 *
 * `+N` is not a sixth button. It selects the fifth photo like any other thumb
 * and the badge only says how many the strip is not showing — a control whose
 * label promises "23 more" and then shows you one is worse than no label.
 */

const THUMB_SLOTS = 4

export function PropertyGallery({ images }: { images: string[] }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return <PropertyPhoto src={undefined} alt="" className="aspect-[16/9] w-full sm:aspect-[21/9]" />
  }

  const thumbs = images.slice(1, 1 + THUMB_SLOTS)
  const hidden = images.length - (1 + thumbs.length)

  return (
    /* The large frame owns the height via its aspect ratio and the thumb
       column matches it with `grid-rows-2` + `h-full`. Letting the thumbs keep
       their own square aspect instead left the two columns disagreeing, and
       the leftover space opened as a gap down the middle of the thumb grid. */
    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <PropertyPhoto
        src={images[active]}
        alt={t('properties.photoOf', { index: active + 1, total: images.length })}
        eager
        className="aspect-[16/10] w-full"
      />

      {thumbs.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:h-full sm:grid-cols-2 sm:grid-rows-2">
          {thumbs.map((src, index) => {
            // +1 because thumbs start at images[1]. The last slot shows the
            // overflow badge but still selects its own photo.
            const target = index + 1
            const isLastSlot = index === thumbs.length - 1 && hidden > 0
            return (
              <li key={src} className="sm:min-h-0">
                <button
                  type="button"
                  onClick={() => setActive(target)}
                  aria-pressed={active === target}
                  aria-label={t('properties.photoOf', { index: target + 1, total: images.length })}
                  className="relative block h-full w-full overflow-hidden rounded transition-opacity duration-(--duration-fast) ease-out hover:opacity-90 active:translate-y-px"
                >
                  <PropertyPhoto
                    src={src}
                    alt=""
                    className={`aspect-[16/10] w-full sm:aspect-auto sm:h-full ${
                      active === target ? 'opacity-100' : 'opacity-80'
                    }`}
                  />
                  {isLastSlot && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 grid place-items-center bg-ink/55 font-mono text-sm font-semibold text-surface-raised"
                    >
                      +{hidden}
                    </span>
                  )}
                  {active === target && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded [box-shadow:inset_0_0_0_2px_var(--color-accent)]"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
