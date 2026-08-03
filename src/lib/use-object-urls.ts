import { useEffect, useState } from 'react'

/**
 * Blob URLs for a set of files, revoked when they change or on unmount.
 *
 * Object URLs are a manual allocation: without the revoke the blob stays in
 * memory for the life of the document, and a gallery re-picked a few times
 * over a long wizard session leaks every version of it. Building them inline
 * during render leaks one per render, which is worse.
 *
 * `files` must be a stable reference — a fresh array literal on every render
 * revokes and recreates every URL each time, which flickers the images.
 *
 * In its own file rather than beside PhotoInput: a component file that also
 * exports a hook loses fast refresh (react-refresh/only-export-components),
 * the same split as toast-context / toast.
 */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file))
    setUrls(created)

    return () => {
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [files])

  return urls
}
