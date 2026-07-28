import type { TranslationKey } from './es'

// Typed against the Spanish keys: dropping or misspelling one fails the build.
export const en: Record<TranslationKey, string> = {
  'app.name': 'RentaFácil CRM',

  'nav.main': 'Main',
  'nav.home': 'Home',

  'auth.signIn': 'Sign in',
  'auth.signingIn': 'Signing in…',
  'auth.subtitle': 'Sign in with your agent account.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signOut': 'Sign out',
  'auth.signingOut': 'Signing out…',
  'auth.checking': 'Checking session…',
  'auth.failed': 'We could not sign you in.',
  'auth.signOutFailed': 'We could not reach the server.',

  'error.backendTitle': 'We could not reach the server',
  'error.retry': 'Retry',
  'error.unreachable': 'We could not reach the server.',
  'error.sessionExpired': 'Your session expired.',
  'error.generic': 'Something went wrong.',

  'language.label': 'Language',
  'language.es': 'Español',
  'language.en': 'English',

  'dashboard.greeting': 'Hi, {name}',
  'dashboard.sessionNote': 'Session active via cookie against the Laravel backend.',
  'dashboard.email': 'Email',
  'dashboard.agentId': 'Agent ID',
}
