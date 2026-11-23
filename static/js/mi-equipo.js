// Tus Pokémon para el Duelo, guardados en este navegador (localStorage) en dos listas:
//   · 'equipo'   → hasta 6, para «Equipo contra equipo» (y el botón «Añadir a mi equipo» de la ficha);
//   · 'luchador' → uno solo, para «Uno contra uno». Añadir otro lo sustituye.
// Cada cambio se avisa con el evento «equipo-cambiado» (detail: { lista }) en document. Lo usan el
// paso 2 del Duelo (equipo.js), duelo.js, el combate y la ficha. Si el navegador no deja guardar, las
// listas duran lo que dure la visita.

import { obtenerPokemon } from './api.js';
import { gritoDe, idDesdeUrl, urlIlustracion } from './utilidades.js';

const LISTAS = {
  equipo: { clave: 'pokedex.equipo', tamano: 6 },
  luchador: { clave: 'pokedex.luchador', tamano: 1 },
};
export const TAMANO_EQUIPO = LISTAS.equipo.tamano;

// { equipo: [{ id, nombre }], luchador: [{ id, nombre }] } — id es el número del Pokémon (las formas tienen el suyo, p. ej. 10034)
const listas = Object.fromEntries(Object.keys(LISTAS).map(nombre => [nombre, leer(nombre)]));

function leer(nombre) {
  const { clave, tamano } = LISTAS[nombre];
  try {
    const guardado = JSON.parse(localStorage.getItem(clave));
    if (Array.isArray(guardado)) {
      return guardado.filter(p => Number.isInteger(p?.id) && typeof p.nombre === 'string').slice(0, tamano);
    }
  } catch { /* Sin almacenamiento o dato roto: se empieza con la lista vacía. */ }
  return [];
}

function guardar(nombre) {
  try { localStorage.setItem(LISTAS[nombre].clave, JSON.stringify(listas[nombre])); } catch { /* Navegación privada: solo dura esta visita. */ }
  document.dispatchEvent(new CustomEvent('equipo-cambiado', { detail: { lista: nombre } }));
}

/** Cuántos caben en una lista ('equipo' o 'luchador'). */
export const tamanoLista = (lista = 'equipo') => LISTAS[lista].tamano;
/** Copia de una lista: [{ id, nombre }]. */
export const miLista = (lista = 'equipo') => listas[lista].map(p => ({ ...p }));
export const miEquipo = () => miLista('equipo');
export const estaEnEquipo = (id, lista = 'equipo') => listas[lista].some(p => p.id === Number(id));
export const equipoLleno = (lista = 'equipo') => listas[lista].length >= LISTAS[lista].tamano;

/**
 * Añade un Pokémon. Devuelve 'agregado', 'repetido', 'lleno' o, en una lista de uno (el luchador),
 * 'cambiado': el nuevo sustituye al anterior.
 */
export function agregarAlEquipo({ id, nombre }, lista = 'equipo') {
  if (estaEnEquipo(id, lista)) return 'repetido';
  const nuevo = { id: Number(id), nombre };
  if (equipoLleno(lista)) {
    if (LISTAS[lista].tamano !== 1) return 'lleno';
    listas[lista] = [nuevo];
    guardar(lista);
    return 'cambiado';
  }
  listas[lista].push(nuevo);
  guardar(lista);
  return 'agregado';
}

export function quitarDelEquipo(id, lista = 'equipo') {
  listas[lista] = listas[lista].filter(p => p.id !== Number(id));
  guardar(lista);
}

/** Sustituye la lista entera (p. ej. «Completar al azar» o «Vaciar»). */
export function reemplazarEquipo(nuevos, lista = 'equipo') {
  listas[lista] = nuevos.slice(0, LISTAS[lista].tamano).map(({ id, nombre }) => ({ id: Number(id), nombre }));
  guardar(lista);
}

// --- Detalles de cada Pokémon (tipos, estadísticas, imagen) --------------------------
// Se descargan una vez por visita y se comparten entre el equipo, el simulacro y el rival.
const detalles = new Map();

/**
 * Datos que necesitan el análisis y el simulacro:
 * { id, nombre, especie, tipos, stats: { hp, attack, … }, poder (suma de estadísticas), altura (m), imagen,
 *   sprite (pixelado fijo), animados (GIF), grito (.ogg), aprende }
 * aprende: los movimientos que puede aprender, [[clave de PokéAPI, porNivel]] (porNivel: true si lo aprende
 * subiendo de nivel en algún juego, no solo con una MT o de un tutor). El combate elige 4 (combate.js).
 */
export function detallesDe(id) {
  if (!detalles.has(id)) {
    const promesa = obtenerPokemon(id).then(pokemon => {
      const stats = Object.fromEntries(pokemon.stats.map(s => [s.stat.name, s.base_stat]));
      return {
        id: pokemon.id,
        nombre: pokemon.name,
        especie: Number(idDesdeUrl(pokemon.species.url)), // las formas usan el de su especie (rareza, región)
        tipos: pokemon.types.map(t => t.type.name),
        stats,
        poder: Object.values(stats).reduce((suma, valor) => suma + valor, 0),
        altura: pokemon.height / 10, // metros: la arena escala el modelo según su tamaño real
        imagen: pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default || urlIlustracion(pokemon.id),
        sprite: pokemon.sprites.front_default || null, // sprite pixelado (96 px) para la arena
        // Sprites animados (GIF) para la arena, por orden de preferencia: Showdown y Blanco/Negro.
        animados: [pokemon.sprites.other?.showdown?.front_default, pokemon.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default].filter(Boolean),
        grito: gritoDe(pokemon), // .ogg de PokéAPI (sonido.js); Pikachu y Eevee, con su voz
        aprende: (pokemon.moves || []).map(m => [m.move.name, m.version_group_details.some(v => v.move_learn_method.name === 'level-up')]),
      };
    }).catch(error => { detalles.delete(id); throw error; }); // Si falla, el siguiente intento vuelve a pedirlo.
    detalles.set(id, promesa);
  }
  return detalles.get(id);
}
