// Lista compacta de las 1025 especies (número, nombre y tipos), compartida por varias vistas.
// Se descarga una sola vez de /api/pokedex; si falla, el siguiente intento vuelve a pedirla.

import { obtenerPokedex } from './api.js';

let promesa = null;
let porId = new Map();

/** Devuelve (una vez descargada) la lista [{ id, nombre, tipos }] en orden de la Pokédex. */
export function cargarEspecies() {
  promesa ??= obtenerPokedex()
    .then(lista => { porId = new Map(lista.map(especie => [especie.id, especie])); return lista; })
    .catch(error => { promesa = null; throw error; });
  return promesa;
}

/** Claves de tipo de una especie (['grass', 'poison']) o [] si aún no se conoce. */
export const tiposDe = id => porId.get(Number(id))?.tipos || [];
