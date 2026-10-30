import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { reloadWhenVisible, useResource, type VisibilitySource } from './use-resource'

function fakeDocument() {
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: 'hidden' as DocumentVisibilityState,
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
  }
  return {
    doc: doc as unknown as VisibilitySource & { visibilityState: string },
    show: () => {
      doc.visibilityState = 'visible'
      listeners.forEach((fn) => fn())
    },
    listeners,
  }
}

describe('reloadWhenVisible', () => {
  it('reloads once when the tab turns visible with stale data', () => {
    const { doc, show } = fakeDocument()
    const reload = vi.fn()
    reloadWhenVisible(doc, () => true, reload)

    show()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves fresh data alone', () => {
    const { doc, show } = fakeDocument()
    const reload = vi.fn()
    reloadWhenVisible(doc, () => false, reload)

    show()

    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening after cleanup', () => {
    const { doc, show, listeners } = fakeDocument()
    const reload = vi.fn()
    reloadWhenVisible(doc, () => true, reload)()

    show()

    expect(listeners.size).toBe(0)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('useResource', () => {
  it('hands back a silent revalidate next to reload', () => {
    let seen: ReturnType<typeof useResource<number>> | undefined
    const Probe = () => {
      seen = useResource(() => Promise.resolve(1), [])
      return null
    }
    renderToString(createElement(Probe))

    // First paint is loading; revalidate is what lets a reassign refetch
    // without ever returning to it (the dialog keeps its success state).
    expect(seen?.status).toBe('loading')
    expect(typeof seen?.revalidate).toBe('function')
    expect(seen?.revalidate).not.toBe(seen?.reload)
  })
})
