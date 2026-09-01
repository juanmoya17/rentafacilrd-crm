/**
 * Shrink a photo before it is uploaded.
 *
 * Not a nicety. `post_property` refuses anything over 3MB and a photo off a
 * current phone is 4-8MB, so today the agent picks the picture they want and
 * the form rejects it — on a screen where the fix ("open an editor and resize
 * it") is not available. Compression is what makes those photos uploadable at
 * all; the smaller upload on a mobile connection is the second benefit.
 *
 * JPEG out, always. The server's allow-list is jpeg/png/jpg — WebP would be
 * smaller and is refused, so encoding to it would trade one rejection for
 * another.
 *
 * No dependency: createImageBitmap + canvas are native everywhere this app
 * runs (Chrome Android, Safari 17+). An image library for this would be
 * ~50KB to do what the browser already does.
 */

/** The server's ceiling, minus room for the multipart envelope. */
const MAX_BYTES = 2_800 * 1024

/** Long edge. A listing photo is never displayed larger than this. */
const MAX_EDGE = 1920

const QUALITY = 0.82

/** Only what the server would accept, and only when it is actually too big. */
const COMPRESSIBLE = ['image/jpeg', 'image/jpg', 'image/png']

export function needsCompression(file: File): boolean {
  return COMPRESSIBLE.includes(file.type) && file.size > MAX_BYTES
}

/** Fit inside a square of `max`, keeping the aspect ratio, in whole pixels. */
export function fittedSize(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }

  const scale = max / longest

  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Returns the original on any failure — a decode error, a tainted canvas, a
 * browser without `toBlob`. A photo that uploads slowly beats a photo the
 * agent cannot pick at all, and this runs while they are looking at the form.
 *
 * ponytail: decodes on the main thread. With twenty photos that is a
 * noticeable pause; move to a Worker (createImageBitmap and OffscreenCanvas
 * both work there) if anyone reports it.
 */
export async function compressImage(file: File): Promise<File> {
  if (!needsCompression(file)) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = fittedSize(bitmap.width, bitmap.height, MAX_EDGE)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (context === null) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    })
    // A re-encode that came out bigger is a re-encode worth throwing away.
    if (blob === null || blob.size >= file.size) return file

    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch {
    return file
  }
}

/** The server reads the extension as well as the MIME type. */
function jpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.jpg`
}
