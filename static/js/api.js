// Peticiones al servidor local (app.py), que a su vez consulta PokéAPI.
// Si algo falla, se lanza un Error con el mensaje que envía el servidor y su código (error.estado).

async function pedir(ruta, mensajePorDefecto) {
  const respuesta = await fetch(ruta);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const error = new Error(datos.error || mensajePorDefecto);
    error.estado = respuesta.status; // 404, 502...
    throw error;
  }
  return datos;
}

/** Datos de un Pokémon por nombre en inglés o número. */
export const obtenerPokemon = consulta =>
  pedir('/api/pokemon/' + encodeURIComponent(consulta), 'Ocurrió un error.');

/** Otros recursos: 'pokemon-species', 'evolution-chain', 'ability' o 'type'. */
export const obtenerRecurso = (recurso, id) =>
  pedir(`/api/${recurso}/${encodeURIComponent(id)}`, 'No se pudo cargar la información.');

/** Lista de Pokémon de un tipo (incluye formas alternativas). */
export const obtenerTipo = clave =>
  pedir('/api/type/' + encodeURIComponent(clave), 'No se pudo cargar la categoría.');

/** Todas las especies con sus tipos: [{ id, nombre, tipos }] (unos 50 KB; ver servidor/pokeapi.py). */
export const obtenerPokedex = () =>
  pedir('/api/pokedex', 'No se pudo cargar la Pokédex.');
