/**
 * Popup or redirect, for the Google sign-in button.
 *
 * Firebase recommends redirect on mobile and it is not a preference: the popup
 * has to open inside the click that asked for it, and Safari iOS blocks one
 * that does not, with no error the page can show. The agent taps, nothing
 * happens, and there is nothing to tell them why.
 *
 * Redirect costs a full reload of the app, which is why desktop keeps the
 * popup rather than everyone moving to the safer flow.
 */

/** Tailwind's `md`. Below it the layout is already the phone layout. */
const REDIRECT_BELOW = 768

/**
 * Decided on WIDTH alone, not on pointer type. The case that breaks is the
 * narrow window; a 1440px touchscreen laptop opens popups perfectly well and
 * would only lose the app reload for nothing.
 */
export function prefersRedirect(width: number): boolean {
  return width < REDIRECT_BELOW
}
