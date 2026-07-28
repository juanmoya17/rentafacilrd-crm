/**
 * Spanish is the source of truth: every other locale is typed against these
 * keys, so a missing translation is a compile error, not a runtime fallback.
 */
export const es = {
  'app.name': 'RentaFácil CRM',

  'nav.main': 'Principal',
  'nav.home': 'Inicio',

  'auth.signIn': 'Entrar',
  'auth.signingIn': 'Entrando…',
  'auth.subtitle': 'Entra con tu cuenta de agente.',
  'auth.email': 'Correo',
  'auth.password': 'Contraseña',
  'auth.signOut': 'Cerrar sesión',
  'auth.signingOut': 'Saliendo…',
  'auth.checking': 'Verificando sesión…',
  'auth.failed': 'No pudimos iniciar sesión.',
  'auth.signOutFailed': 'No pudimos avisar al servidor.',

  'error.backendTitle': 'No pudimos contactar el servidor',
  'error.retry': 'Reintentar',
  'error.unreachable': 'No pudimos contactar el servidor.',
  'error.sessionExpired': 'Tu sesión expiró.',
  'error.generic': 'Ocurrió un error inesperado.',

  'language.label': 'Idioma',
  'language.es': 'Español',
  'language.en': 'English',

  'dashboard.greeting': 'Hola, {name}',
  'dashboard.sessionNote': 'Sesión activa por cookie contra el backend Laravel.',
  'dashboard.email': 'Correo',
  'dashboard.agentId': 'ID de agente',
} as const

export type TranslationKey = keyof typeof es
