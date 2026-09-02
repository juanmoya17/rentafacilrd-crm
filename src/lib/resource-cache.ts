/**
 * A tiny read-through cache for useResource, keyed by request.
 *
 * Deliberately not TanStack Query: that is ~13KB and a migration of every
 * screen to buy mutations, window syncing and devtools this app does not use.
 * What it needs is "do not refetch the list I looked at four seconds ago",
 * which is this file. If optimistic mutations across screens ever land on the
 * roadmap, that is the moment to reconsider — not before.
 *
 * In memory only. Leads carry names and phone numbers, and the audit is
 * explicit that none of that goes to disk without a retention and sign-out
 * policy. A reload starts empty, which is the correct default for a CRM on a
 * phone that gets handed around.
 */
interface Entry {
  value: unknown
  at: number
}

export class ResourceCache {
  private entries = new Map<string, Entry>()

  private fresh(key: string, now: number, staleMs: number): Entry | undefined {
    const entry = this.entries.get(key)
    if (entry === undefined) return undefined
    if (now - entry.at > staleMs) {
      this.entries.delete(key)
      return undefined
    }

    return entry
  }

  /** The value, or null. Cannot distinguish a cached `null` — use `has`. */
  get<T>(key: string, now: number, staleMs: number): T | null {
    return (this.fresh(key, now, staleMs)?.value as T | undefined) ?? null
  }

  has(key: string, now: number, staleMs: number): boolean {
    return this.fresh(key, now, staleMs) !== undefined
  }

  set(key: string, value: unknown, now: number): void {
    this.entries.set(key, { value, at: now })
  }

  /**
   * By prefix, because one write invalidates a family: publishing a listing
   * has to expire `properties?page=1` and every other page and filter of it,
   * and the writer cannot know which of those the agent has visited.
   */
  invalidate(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}

/** One per tab. Cleared on sign-out — see auth-provider. */
export const resourceCache = new ResourceCache()
