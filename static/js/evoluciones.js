// Evoluciones para el combate: en qué puede evolucionar un Pokémon durante la batalla.
//   · Si su cadena sigue (Charmander → Charmeleon), en la siguiente fase; con varias (Eevee), en todas.
//     Las formas regionales evolucionan a la forma de su misma región si existe (Vulpix de Alola → Ninetales de Alola),
//     y las evoluciones exclusivas de una región (Runerigus, Perrserker…) solo las hace esa forma (EVOLUCIONES_REGIONALES).
//   · Si ya es la última fase, en su megaevolución o forma primigenia (Charizard → Mega-Charizard X e Y).
// Datos de PokéAPI (pokemon-species y evolution-chain) a través del servidor local. simulacro.js prepara
// el árbol de cada Pokémon antes de empezar (prepararEvoluciones) porque combate.js es lógica pura y
// necesita tenerlo todo a mano.

import { obtenerRecurso } from './api.js';
import { EVOLUCIONES_REGIONALES } from './datos.js';
import { detallesDe } from './mi-equipo.js';
import { idDesdeUrl } from './utilidades.js';

const especies = new Map();
const cadenas = new Map();
const recordar = (mapa, clave, cargar) => {
  if (!mapa.has(clave)) mapa.set(clave, cargar().catch(error => { mapa.delete(clave); throw error; }));
  return mapa.get(clave);
};
const especie = id => recordar(especies, String(id), () => obtenerRecurso('pokemon-species', id));
const cadena = id => recordar(cadenas, String(id), () => obtenerRecurso('evolution-chain', id));
const esMega = nombre => /-mega(-[xyz])?$|-primal$/.test(nombre) || nombre.includes('-mega-');

/** El nodo de la cadena evolutiva que corresponde a una especie. */
function buscarNodo(nodo, nombreEspecie) {
  if (nodo.species.name === nombreEspecie) return nodo;
  for (const hijo of nodo.evolves_to) { const encontrado = buscarNodo(hijo, nombreEspecie); if (encontrado) return encontrado; }
  return null;
}

/** Ids de las formas en las que evoluciona: [{ id, mega }]. */
async function siguientes(detalles) {
  if (esMega(detalles.nombre)) return [];
  const datos = await especie(detalles.especie);
  const nodo = buscarNodo((await cadena(idDesdeUrl(datos.evolution_chain.url))).chain, datos.name);
  const sufijo = detalles.nombre.startsWith(datos.name) ? detalles.nombre.slice(datos.name.length) : ''; // '-alola'…
  // Las evoluciones exclusivas de una forma regional solo valen para esa forma; y si la forma regional
  // tiene alguna exclusiva, solo evoluciona en esa (el Meowth de Galar no evoluciona en Persian).
  const todos = nodo?.evolves_to || [];
  const exclusiva = hijo => EVOLUCIONES_REGIONALES[Number(idDesdeUrl(hijo.species.url))];
  const propias = todos.filter(hijo => sufijo && exclusiva(hijo) === sufijo);
  const hijos = propias.length ? propias : todos.filter(hijo => !exclusiva(hijo));
  if (hijos.length) {
    return Promise.all(hijos.map(async hijo => {
      const siguiente = await especie(idDesdeUrl(hijo.species.url));
      const regional = sufijo && siguiente.varieties.find(v => v.pokemon.name === siguiente.name + sufijo);
      const forma = regional || siguiente.varieties.find(v => v.is_default) || siguiente.varieties[0];
      return { id: Number(idDesdeUrl(forma.pokemon.url)), mega: false };
    }));
  }
  // Última fase: megaevolución o forma primigenia (solo desde la forma normal de la especie).
  const normal = datos.varieties.find(v => v.is_default)?.pokemon.name;
  if (normal !== detalles.nombre) return [];
  return datos.varieties.filter(v => esMega(v.pokemon.name)).map(v => ({ id: Number(idDesdeUrl(v.pokemon.url)), mega: true }));
}

/**
 * Los detalles del Pokémon con su árbol de evoluciones: { ...detalles, evoluciones: [{ ...detalles, mega,
 * evoluciones: […] }] }, hasta `profundidad` fases. Si algo falla, ese Pokémon simplemente no evoluciona.
 */
export async function prepararEvoluciones(detalles, profundidad = 3) {
  if (profundidad <= 0) return { ...detalles, evoluciones: [] };
  try {
    const formas = await siguientes(detalles);
    const evoluciones = (await Promise.allSettled(formas.map(async ({ id, mega }) => {
      const forma = await detallesDe(id);
      // Las megaevoluciones no traen movimientos en PokéAPI: usan los de su forma normal.
      const conMovimientos = forma.aprende.length ? forma : { ...forma, aprende: detalles.aprende };
      return { ...(await prepararEvoluciones(conMovimientos, mega ? 0 : profundidad - 1)), mega };
    })))
      .flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
      // Sin sprite pixelado (solo la ilustración, como Mega-Zygarde) desentonaría en la arena: no se usa.
      .filter(forma => forma.animados.length || forma.sprite);
    return { ...detalles, evoluciones };
  } catch {
    return { ...detalles, evoluciones: [] };
  }
}
