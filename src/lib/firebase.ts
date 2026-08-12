import { initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth'

/**
 * Firebase, not Google Identity Services.
 *
 * GIS returns Google's `sub`; every account created through the website's
 * Google flow carries a FIREBASE UID in `auth_id`. GIS would match none of
 * them and would break linking on day one. Written down so it is not
 * re-proposed later.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

/**
 * Gate for the button, not just the popup: a configuration failure otherwise
 * looks identical to the agent closing the window. `social_login` (the
 * admin's kill switch) and this are separate questions; the button needs
 * both to be true.
 *
 * Both fields, not just the key. These are inlined by Vite at BUILD time, so
 * a deploy that sets some of them and not others is a green build with a
 * button that cannot work — which is exactly what shipped on 2026-08-12:
 * only `VITE_FIREBASE_API_KEY` was set in Railway, the button rendered, and
 * `signInWithPopup` threw `auth/auth-domain-config-required`. `projectId`
 * and `appId` are deliberately not required here: the popup does not use
 * them, and demanding them would hide a button that works.
 */
export function isFirebaseConfigured(): boolean {
  return config.apiKey !== '' && config.authDomain !== ''
}

let app: FirebaseApp | null = null

function firebaseApp(): FirebaseApp {
  app ??= initializeApp(config)
  return app
}

export interface GoogleCredential {
  idToken: string
  name: string
}

/**
 * Opens the Google popup and returns a fresh ID token. Throws the raw
 * Firebase error.
 *
 * Firebase's own session is signed out immediately after: it has no further
 * job once the ID token is in hand, and `getAuth()` defaults to IndexedDB
 * persistence, so leaving it signed in would hold a long-lived Google
 * refresh token on the origin — readable by any script — long after the CRM
 * session (a Laravel cookie) ends. `signOut` runs even when `getIdToken`
 * itself throws, so a failed exchange never leaves that session behind.
 */
export async function getGoogleIdToken(): Promise<GoogleCredential> {
  const auth = getAuth(firebaseApp())
  const provider = new GoogleAuthProvider()
  // Otherwise a browser with one signed-in Google account re-authenticates
  // that account with no popup — including the previous agent's, on a
  // shared machine, after a logout that only ever cleared the Laravel cookie.
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  try {
    return {
      idToken: await result.user.getIdToken(),
      name: result.user.displayName ?? '',
    }
  } finally {
    await signOut(auth)
  }
}
