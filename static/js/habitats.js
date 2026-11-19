// Hábitats animados (css/habitats.css): la misma escena sirve para el portal de la rueda de «Categorías»
// y para el fondo de la ficha, porque todas sus medidas son proporcionales a su tamaño.

import { TIPOS } from './datos.js';
import { crear } from './utilidades.js';

const PARTICULAS = 12; // Brasas, burbujas, hojas, copos... según el tipo.

// Reparto «aleatorio» pero fijo: las partículas no se amontonan y no cambian al recargar.
const fraccion = n => n - Math.floor(n);
function crearParticulas(semilla) {
  return Array.from({ length: PARTICULAS }, (_, i) => crear('i', {
    clase: 'particula',
    estilos: {
      '--x': (fraccion(i * 0.618 + semilla * 0.13) * 100).toFixed(1),  // posición horizontal (0–100)
      '--y': (fraccion(i * 0.381 + semilla * 0.29) * 100).toFixed(1),  // posición vertical (0–100)
      '--t': fraccion(i * 0.7548 + semilla * 0.17).toFixed(3),         // desfase de la animación (0–1)
      '--s': (0.6 + fraccion(i * 0.5698 + semilla * 0.07) * 0.8).toFixed(2), // tamaño (0,6–1,4)
      '--v': (0.75 + fraccion(i * 0.4142) * 0.5).toFixed(2),           // ritmo (0,75–1,25)
    },
  }));
}

/**
 * Crea una escena animada.
 * @param {object} p
 * @param {string} p.tipo              Clave del tipo ('fire'…). Si no existe, se usa 'normal'.
 * @param {string|null} [p.rareza]     'legendario' o 'singular': en vez del hábitat del tipo, un santuario.
 * @param {number} [p.semilla]         Cambia el reparto de las partículas entre escenas.
 * @param {string} [p.clase]           Clases extra para el contenedor.
 * @param {Node[]} [p.fondo]           Elementos entre el fondo y las partículas (p. ej. el número de la ficha).
 * @param {Node[]} [p.primerPlano]     Elementos encima de todo (Pokémon, símbolo, pie de foto…).
 */
export function crearHabitat({ tipo, rareza = null, semilla = 0, clase = '', fondo = [], primerPlano = [] }) {
  const clave = TIPOS[tipo] ? tipo : 'normal';
  return crear('span', {
    clase: ('habitat ' + clase).trim(),
    atributos: rareza ? { 'data-rareza': rareza } : { 'data-tipo': clave },
    estilos: { '--color-tipo': TIPOS[clave].color },
  },
    crear('span', { clase: 'escena-fondo', atributos: { 'aria-hidden': 'true' } }),
    ...fondo,
    ...crearParticulas(semilla),
    crear('span', { clase: 'escena-suelo', atributos: { 'aria-hidden': 'true' } }),
    ...primerPlano,
  );
}
