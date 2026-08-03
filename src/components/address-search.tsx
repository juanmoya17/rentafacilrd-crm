import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { mapsConfigured, searchPlaces, type Place, type Suggestion } from '@/lib/google-maps'

/**
 * Address type-ahead against Google Places. Picking a suggestion fills the
 * address, city, province and country and drops the map pin in one go — the
 * interaction that turns five fields plus a map click into one.
 *
 * A real combobox (role=combobox + role=listbox + aria-activedescendant), not
 * a div with a click handler: arrow keys, Enter and Escape are how this gets
 * used once an agent has typed the same street twice.
 *
 * Details are fetched on PICK, never per keystroke — the suggestion list is
 * cheap, `fetchFields` is the billed call.
 *
 * Without a key the input still works; it just stops suggesting. That is a
 * supported deploy, not a broken one.
 */

/** Long enough not to fire a request per keystroke, short enough to feel live. */
const DEBOUNCE_MS = 350

export function AddressSearch({
  id,
  label,
  value,
  onChange,
  onSelect,
  helper,
  error,
  invalid,
  disabled,
  placeholder,
  emptyLabel,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Fired only on an actual pick, never on typing. */
  onSelect: (place: Place) => void
  helper?: string
  error?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  /** Shown when a finished search returned nothing. */
  emptyLabel: string
}) {
  const listId = useId()
  const [results, setResults] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [searching, setSearching] = useState(false)
  // Set on pick so the effect below does not re-search the text we just wrote
  // into the field, which would reopen the list under the cursor.
  const skipRef = useRef(false)

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false
      return
    }
    if (!mapsConfigured() || value.trim().length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    let live = true
    const timer = setTimeout(() => {
      setSearching(true)
      searchPlaces(value)
        .then((places) => {
          // A superseded keystroke must not overwrite a newer list.
          if (!live) return
          setResults(places)
          setOpen(true)
          setActive(-1)
        })
        .finally(() => {
          if (live) setSearching(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [value])

  const pick = (suggestion: Suggestion) => {
    skipRef.current = true
    // The prediction text lands immediately; the formatted address replaces it
    // when the details come back. Waiting for the round trip would leave the
    // field showing what the agent typed for a beat after they clicked.
    onChange(suggestion.label)
    setOpen(false)
    setResults([])

    void suggestion.resolve().then((place) => {
      if (place === null) return
      skipRef.current = true
      onChange(place.label)
      onSelect(place)
    })
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">
        {label}
      </label>

      <div className="relative mt-1">
        <input
          id={id}
          name={id}
          type="text"
          role="combobox"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            // Deferred: a click on an option fires blur first, and closing the
            // list synchronously would unmount the option before its click.
            setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(event) => {
            if (!open || results.length === 0) return
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((current) => (current + 1) % results.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((current) => (current <= 0 ? results.length - 1 : current - 1))
            } else if (event.key === 'Enter' && active >= 0) {
              event.preventDefault()
              const chosen = results[active]
              if (chosen !== undefined) pick(chosen)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-msg`}
          className={`min-h-9 w-full rounded-md border bg-surface-raised px-3 py-1.5 pr-9 text-sm text-ink transition-colors duration-(--duration-fast) ease-(--ease-out) placeholder:text-muted hover:bg-surface-sunken focus:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-55 ${
            invalid === true ? 'border-error' : 'border-rule-2'
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-muted">
          {searching ? (
            <Loader2
              aria-hidden="true"
              className="size-4 [animation:rf-spin_700ms_linear_infinite]"
            />
          ) : (
            <MapPin aria-hidden="true" className="size-4" />
          )}
        </span>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-rule bg-surface-raised py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li>
            ) : (
              results.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // onMouseDown, not onClick: mousedown lands before the input's
                  // blur, so the pick survives the list closing.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pick(suggestion)
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    index === active ? 'bg-surface-sunken text-ink' : 'text-ink-2'
                  }`}
                >
                  {suggestion.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <p
        id={`${id}-msg`}
        className={`mt-1 min-h-[1lh] text-xs ${invalid === true ? 'text-error' : 'text-muted'}`}
      >
        {invalid === true ? error : helper}
      </p>
    </div>
  )
}
