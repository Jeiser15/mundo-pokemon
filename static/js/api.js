// Peticiones de datos. Funciona de dos maneras:
//   · CON el servidor local (python app.py): se le pregunta a él, que guarda una caché y una copia en SQLite;
//   · SIN servidor (la app de Android, que lleva la web dentro del APK): se pregunta directamente a PokéAPI,
//     que permite peticiones desde cualquier web (CORS).
// Se averigua una sola vez al empezar (usaServidor). Si algo falla, se lanza un Error con un mensaje en español
// y su código (error.estado: 400, 404, 502…), igual en las dos maneras.

import { TIPOS } from './datos.js';
import { idDesdeUrl } from './utilidades.js';

const POKEAPI = 'https://pokeapi.co/api/v2/';
const CLAVE_POKEDEX = 'pokedex.especies';        // la lista compacta, guardada en este navegador (modo directo)
const VIGENCIA_POKEDEX_MS = 7 * 24 * 3600 * 1000; // una semana: así el celular no repite 19 descargas grandes
const MENSAJES = {
  invalido: 'Escribe un nombre o número válido.',
  noEncontrado: 'No encontramos ese Pokémon.',
  sinRespuesta: 'PokéAPI no pudo responder. Inténtalo de nuevo.',
  sinConexion: 'No se pudo conectar con PokéAPI. Comprueba tu conexión a internet.',
};

let modo = null;

/** true si hay servidor local; false si hay que ir directo a PokéAPI. Se pregunta una vez. */
export function usaServidor() {
  modo ??= (async () => {
    // Dentro de la app de Android (o abierta como archivo suelto) no hay servidor: ni se pregunta.
    if (location.hostname === 'appassets.androidplatform.net' || location.protocol === 'file:') return false;
    try {
      const respuesta = await fetch('/api/snapshot', { signal: AbortSignal.timeout(3000) });
      return respuesta.ok;
    } catch {
      return false;
    }
  })();
  return modo;
}

const conEstado = (mensaje, estado) => Object.assign(new Error(mensaje), { estado });

async function pedirAlServidor(ruta, mensajePorDefecto) {
  // Un reintento: el servidor solo encola 5 conexiones y, con muchas peticiones seguidas (abrir fichas muy
  // deprisa), puede rechazar alguna. Si vuelve a fallar, un mensaje en español (no el «Failed to fetch» del navegador).
  let respuesta;
  for (let intento = 0; !respuesta; intento++) {
    try {
      respuesta = await fetch(ruta);
    } catch {
      if (intento >= 1) throw conEstado('No se pudo conectar con el servidor local. Comprueba que sigue abierto.', 502);
      await new Promise(listo => setTimeout(listo, 300));
    }
  }
  const datos = await respuesta.json();
  if (!respuesta.ok) throw conEstado(datos.error || mensajePorDefecto, respuesta.status); // 404, 502...
  return datos;
}

async function pedirAPokeAPI(ruta) {
  let respuesta;
  try { respuesta = await fetch(POKEAPI + ruta); } catch { throw conEstado(MENSAJES.sinConexion, 502); }
  if (respuesta.status === 404) throw conEstado(MENSAJES.noEncontrado, 404);
  if (!respuesta.ok) throw conEstado(MENSAJES.sinRespuesta, 502);
  return respuesta.json();
}

/** Un recurso de PokéAPI (pokemon, pokemon-species, evolution-chain, ability o type) por nombre o número. */
async function recurso(tipoRecurso, nombre, mensajePorDefecto) {
  if (await usaServidor()) return pedirAlServidor(`/api/${tipoRecurso}/${encodeURIComponent(nombre)}`, mensajePorDefecto);
  const limpio = String(nombre).trim().toLowerCase();
  // Igual que el servidor: solo letras, números y guiones (evita pedir rutas raras a PokéAPI).
  if (!/^[a-z0-9-]{1,100}$/.test(limpio)) throw conEstado(MENSAJES.invalido, 400);
  return pedirAPokeAPI(`${tipoRecurso}/${limpio}`);
}

/** Datos de un Pokémon por nombre en inglés o número. */
export const obtenerPokemon = consulta => recurso('pokemon', consulta, 'Ocurrió un error.');

/** Otros recursos: 'pokemon-species', 'evolution-chain', 'ability' o 'type'. */
export const obtenerRecurso = (tipoRecurso, id) => recurso(tipoRecurso, id, 'No se pudo cargar la información.');

/** Lista de Pokémon de un tipo (incluye formas alternativas). */
export const obtenerTipo = clave => recurso('type', clave, 'No se pudo cargar la categoría.');

/** Todas las especies con sus tipos: [{ id, nombre, tipos }] (unos 50 KB; ver servidor/pokeapi.py). */
export async function obtenerPokedex() {
  if (await usaServidor()) return pedirAlServidor('/api/pokedex', 'No se pudo cargar la Pokédex.');
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_POKEDEX));
    if (Array.isArray(guardada?.lista) && guardada.lista.length && Date.now() - guardada.fecha < VIGENCIA_POKEDEX_MS) return guardada.lista;
  } catch { /* sin almacenamiento o dato roto: se vuelve a armar */ }
  const lista = await armarPokedex();
  try { localStorage.setItem(CLAVE_POKEDEX, JSON.stringify({ fecha: Date.now(), lista })); } catch { /* sin almacenamiento */ }
  return lista;
}

/**
 * Lo mismo que obtener_pokedex() del servidor: PokéAPI no tiene una consulta que dé esto de una vez, así que
 * se arma con la lista de especies y los 18 tipos (19 consultas). Cada especie toma los tipos de su forma
 * normal, que tiene su mismo número.
 */
async function armarPokedex() {
  const claves = Object.keys(TIPOS);
  let especies, porTipo;
  try {
    [especies, ...porTipo] = await Promise.all([pedirAPokeAPI('pokemon-species?limit=2000'), ...claves.map(t => pedirAPokeAPI('type/' + t))]);
  } catch (error) {
    throw conEstado('No se pudo cargar la Pokédex. Comprueba tu conexión e inténtalo de nuevo.', error.estado || 502);
  }
  const tiposPorId = new Map(); // número → { hueco: tipo }
  claves.forEach((tipo, i) => {
    for (const { slot, pokemon } of porTipo[i].pokemon) {
      const id = Number(idDesdeUrl(pokemon.url));
      if (!tiposPorId.has(id)) tiposPorId.set(id, {});
      tiposPorId.get(id)[slot] = tipo;
    }
  });
  return especies.results
    .map(especie => {
      const id = Number(idDesdeUrl(especie.url));
      const huecos = tiposPorId.get(id) || {};
      return { id, nombre: especie.name, tipos: Object.keys(huecos).sort().map(hueco => huecos[hueco]) };
    })
    .sort((a, b) => a.id - b.id);
}
