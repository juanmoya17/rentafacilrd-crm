import { useMemo } from 'react'
import { X } from 'lucide-react'
import { resolveControl, type ControlState } from '@/lib/control-state'
import { useObjectUrls } from '@/lib/use-object-urls'

/**
 * File picker with thumbnails.
 *
 * Two things a bare `<input type="file">` cannot do, and both are why this
 * exists: show what was picked, and remove one item without clearing the rest.
 * The native control has no API for either — its `files` list is read-only and
 * its only "remove" is picking again from scratch.
 *
 * Multiple mode APPENDS, because per-item removal exists here. Re-picking a
 * file already in the list is a no-op rather than a duplicate: the picker has
 * no memory of what it handed over last time, and an agent adding photos in
 * two passes would otherwise upload the first batch twice.
 */
export function PhotoInput({
  id,
  label,
  accept,
  multiple,
  files,
  onChange,
  helper,
  error,
  state = 'idle',
  disabled,
  required,
  removeLabel,
}: {
  id: string
  label: string
  accept: string
  multiple?: boolean
  files: File[]
  onChange: (files: File[]) => void
  helper?: string
  error?: string
  state?: ControlState
  disabled?: boolean
  required?: boolean
  /** Accessible name for the × on a thumbnail — the glyph has none. */
  removeLabel: string
}) {
  const c = resolveControl({ id, state, disabled, helper, error })
  // Memoised so a parent re-render (a keystroke in another field) does not
  // hand the hook a new array and flicker every thumbnail.
  const previews = useObjectUrls(useMemo(() => files, [files]))

  const key = (file: File) => `${file.name}-${file.size}`

  const add = (picked: File[]) => {
    if (multiple !== true) {
      onChange(picked.slice(0, 1))
      return
    }
    const seen = new Set(files.map(key))
    onChange([...files, ...picked.filter((file) => !seen.has(key(file)))])
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      <input
        id={id}
        name={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required && files.length === 0}
        onChange={(event) => {
          add(Array.from(event.target.files ?? []))
          // Clearing the control is what lets the same file be picked again
          // after it was removed — `change` does not fire for an identical value.
          event.target.value = ''
        }}
        aria-invalid={c.invalid || undefined}
        aria-describedby={c.describedBy}
        className={`mt-1 block w-full cursor-pointer rounded-md border bg-surface-raised text-sm text-ink-2 transition-colors duration-(--duration-fast) ease-(--ease-out) file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-rule file:bg-surface-sunken file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-2 disabled:cursor-not-allowed disabled:opacity-55 ${
          c.invalid ? 'border-error' : 'border-rule-2'
        }`}
      />

      {files.length > 0 && (
        <ul className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))]">
          {files.map((file, index) => (
            <li key={key(file)} className="relative">
              <img
                src={previews[index]}
                alt={file.name}
                /* The wizard's own aspect ratio for a listing photo, so what
                   the agent previews is framed like what the card renders. */
                className="aspect-[4/3] w-full rounded-md border border-rule object-cover"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, at) => at !== index))}
                aria-label={`${removeLabel} — ${file.name}`}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/70 text-white transition-colors duration-(--duration-fast) ease-out hover:bg-ink disabled:opacity-55"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
              {/* The first gallery photo is the one the public card shows
                  after the cover, so its position is information. */}
              {multiple === true && (
                <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 font-mono text-[0.625rem] text-white">
                  {index + 1}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {(helper !== undefined || error !== undefined) && (
        <p
          id={`${id}-msg`}
          className={`mt-1 min-h-[1lh] text-xs ${c.messageIsError ? 'text-error' : 'text-muted'}`}
        >
          {c.message}
        </p>
      )}
    </div>
  )
}
