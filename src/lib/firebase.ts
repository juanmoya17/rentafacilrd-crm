import { initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth'

/**
 * Firebase, not Google Identity Services.
 *
 * GIS returns Google's `sub`; every account created through the website's
 * Google flow carries a FIREBASE UID in `auth_id`. GIS would match none of
 * them and would break linking on day one. Written down so it is not
 * re-proposed later.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
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

/** Opens the Google popup and returns a fresh ID token. Throws the raw Firebase error. */
export async function getGoogleIdToken(): Promise<GoogleCredential> {
  const auth = getAuth(firebaseApp())
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  return {
    idToken: await result.user.getIdToken(),
    name: result.user.displayName ?? '',
  }
}
