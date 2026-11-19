// Cálculo de efectividad: cuánto daño hace o recibe cada tipo.

import { TABLA_TIPOS } from './datos.js';

/** Multiplicador de un ataque de tipo `ataque` contra un Pokémon de tipo `defensa` (2, 1, 0.5 o 0). */
export const multiplicador = (ataque, defensa) => TABLA_TIPOS[ataque]?.[defensa] ?? 1;

/** Tipos contra los que `tipo` hace el doble de daño. */
export const fuerteContra = tipo => Object.keys(TABLA_TIPOS).filter(defensa => multiplicador(tipo, defensa) === 2);

/** Tipos que hacen el doble de daño a un Pokémon de tipo `tipo`. */
export const debilAnte = tipo => Object.keys(TABLA_TIPOS).filter(ataque => multiplicador(ataque, tipo) === 2);

const FACTORES = [['double_damage_from', 2], ['half_damage_from', 0.5], ['no_damage_from', 0]];

/**
 * Combina las relaciones de daño de los tipos del Pokémon (las da PokéAPI en /type/<tipo>).
 * Devuelve { fire: 2, water: 0.5, ... } con un multiplicador para cada tipo de `tiposDeAtaque`.
 * Con dos tipos los factores se multiplican: ×2 y ×2 dan ×4; ×2 y ×0,5 se anulan.
 */
export function calcularMultiplicadores(relacionesDeDano, tiposDeAtaque) {
  const multiplicadores = Object.fromEntries(tiposDeAtaque.map(tipo => [tipo, 1]));
  for (const relaciones of relacionesDeDano) {
    for (const [grupo, factor] of FACTORES) {
      for (const { name } of relaciones[grupo]) {
        if (name in multiplicadores) multiplicadores[name] *= factor;
      }
    }
  }
  return multiplicadores;
}
