/** Clave del estado vacío de "Anuncios por incorporar", o null si hay algo que mostrar. */
export function claimEmptyKey(count: number): 'claim.empty' | null {
  return count === 0 ? 'claim.empty' : null
}
