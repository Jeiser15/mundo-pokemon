// Inicio («Mundo Pokémon»): lo que no es el héroe ni el Duelo en vivo.
//   - Caminos: los 18 tipos (abren la Pokédex filtrada), el estante animado de la Pokédex y la silueta
//     de «¿Quién es ese Pokémon?» con tu mejor racha.
//   - Pokémon del día: el mismo para todos ese día; su tipo tiñe la luz del fondo (ponerLuz, mundo.js).
//   - Regiones: las nueve, como etapas de un viaje; cada una abre la Pokédex con sus Pokémon.

import { obtenerPokemon, obtenerRecurso } from './api.js';
import { mostrarGeneracion, mostrarTipo } from './catalogo.js';
import { COLOR_POR_DEFECTO, GENERACIONES, LEGENDARIOS, NOMBRES_ESTADISTICAS, TIPOS, TOTAL_ESPECIES } from './datos.js';
import { buscarPokemon } from './ficha.js';
import { ponerLuz } from './mundo.js';
import { alAzar, crear, crearIcono, crearImagen, nombreLegible, numeroPokedex, urlAnimado, urlIlustracion, urlSprite } from './utilidades.js';

const LIMA = '#8fbf5e'; // la luz propia del Inicio
// Estante de la Pokédex (sprites animados) y siluetas de «¿Quién es?»: Pokémon que casi todo el mundo reconoce.
const ESTANTE = [1, 4, 7, 25, 133, 175];
const SILUETAS = [25, 6, 150, 133, 94, 143, 448, 658, 39, 54, 7, 1, 4, 52, 131, 249, 384, 778, 887, 700];

export function iniciarGuia() {
  crearAccesosTipos();
  crearEstante();
  pintarQuien();
  crearRegiones();
  cargarPokemonDelDia();
}

// --- Caminos -------------------------------------------------------------------

function crearAccesosTipos() {
  document.querySelector('#guia-tipos').append(...Object.entries(TIPOS).map(([clave, tipo]) => crear('button', {
    type: 'button', clase: 'camino-tipo', title: `Ver los Pokémon de tipo ${tipo.nombre}`,
    estilos: { '--color-tipo': tipo.color }, alPulsar: () => mostrarTipo(clave),
  }, crear('span', {}, crearIcono(tipo.icono)), tipo.nombre)));
}

/** Sprites animados (GIF de Showdown) de pie en el estante; si alguno falla, su sprite fijo. */
function crearEstante() {
  document.querySelector('#pokedex-estante').append(...ESTANTE.map(id => {
    const imagen = crear('img', { src: urlAnimado(id), alt: '', loading: 'lazy' });
    imagen.addEventListener('error', () => { imagen.src = urlSprite(id); }, { once: true });
    return imagen;
  }));
}

/** Una silueta al azar; al pasar por encima se revela (como en el juego). */
function pintarQuien() {
  document.querySelector('#novedades-silueta').src = urlIlustracion(alAzar(SILUETAS));
  let racha = 0;
  let adivinados = 0;
  try {
    racha = Number(localStorage.getItem('pokedex.quien.mejor-racha')) || 0;
    adivinados = (JSON.parse(localStorage.getItem('pokedex.quien.adivinados')) || []).length || 0;
  } catch { /* sin almacenamiento o dato roto */ }
  const partes = [adivinados && `${adivinados} en tu colección`, racha && `mejor racha: ${racha}`].filter(Boolean);
  if (partes.length) document.querySelector('#novedades-racha').textContent = partes.join(' · ').replace(/^./, letra => letra.toUpperCase());
}

// --- Pokémon del día ----------------------------------------------------------

/** Mismo Pokémon para todo el día; cambia a medianoche. 7919 es primo con 1025, así que
 *  en 1025 días seguidos salen todas las especies sin repetir y sin ir en orden. */
function idDelDia(fecha = new Date()) {
  const dias = Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000);
  return (dias * 7919) % TOTAL_ESPECIES + 1;
}

async function cargarPokemonDelDia() {
  const tile = document.querySelector('#pokemon-del-dia');
  const id = idDelDia();
  try {
    const [pokemon, especie] = await Promise.all([obtenerPokemon(String(id)), obtenerRecurso('pokemon-species', id)]);
    pintarPokemonDelDia(tile, pokemon, especie);
  } catch {
    tile.classList.remove('cargando');
    tile.setAttribute('aria-busy', 'false');
    tile.replaceChildren(crear('div', { clase: 'del-dia-info' },
      crear('span', { clase: 'mundo-sello', texto: '✦ Pokémon del día' }),
      crear('p', { clase: 'del-dia-error', texto: 'No se pudo cargar el Pokémon del día. Comprueba tu conexión.' }),
      crear('button', { type: 'button', clase: 'del-dia-boton', texto: 'Reintentar', alPulsar: () => { mostrarEsqueleto(tile); cargarPokemonDelDia(); } }),
    ));
  }
}

/** Marcadores animados mientras llegan los datos (el HTML ya trae uno igual). */
function mostrarEsqueleto(tile) {
  tile.classList.add('cargando');
  tile.setAttribute('aria-busy', 'true');
  tile.replaceChildren(
    crear('div', { clase: 'del-dia-arte esqueleto' }),
    crear('div', { clase: 'del-dia-info' }, ...['corta', 'titulo', '', '', 'media'].map(tamano => crear('span', { clase: ('linea-esqueleto ' + tamano).trim() }))),
  );
}

function pintarPokemonDelDia(tile, pokemon, especie) {
  const enEspanol = lista => lista.find(x => x.language.name === 'es');
  const nombre = enEspanol(especie.names)?.name || nombreLegible(pokemon.name);
  // Las especies 899–1025 no tienen la categoría en español: la de las leyendas está traducida; si no, no se pone.
  const categoria = enEspanol(especie.genera)?.genus || LEGENDARIOS.find(l => l.id === pokemon.id)?.especie;
  const descripcion = enEspanol(especie.flavor_text_entries)?.flavor_text.replace(/\s+/g, ' ') || 'Aún no hay descripción en español para esta especie.';
  const tipos = pokemon.types.map(t => t.type.name);
  const hoy = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long' });
  const color = TIPOS[tipos[0]]?.color || COLOR_POR_DEFECTO;
  const total = pokemon.stats.reduce((suma, s) => suma + s.base_stat, 0);

  tile.classList.remove('cargando');
  tile.setAttribute('aria-busy', 'false');
  tile.style.setProperty('--tipo-dia', color);
  ponerLuz(document.querySelector('#del-dia-bloque'), color, TIPOS[tipos[1]]?.color || LIMA);
  tile.replaceChildren(
    crear('div', { clase: 'del-dia-arte' },
      crear('span', { clase: 'del-dia-halo', atributos: { 'aria-hidden': 'true' } }),
      crear('span', { clase: 'del-dia-numero', texto: numeroPokedex(pokemon.id), atributos: { 'aria-hidden': 'true' } }),
      crearImagen(urlIlustracion(pokemon.id), { loading: 'eager', alt: 'Ilustración de ' + nombre })),
    crear('div', { clase: 'del-dia-info' },
      crear('span', { clase: 'mundo-sello', texto: `✦ Pokémon del día · ${hoy}` }),
      crear('h2', { texto: nombre }),
      crear('span', { clase: 'del-dia-especie', texto: `N.º ${numeroPokedex(pokemon.id)}${categoria ? ' · ' + categoria : ''}` }),
      crear('div', { clase: 'del-dia-tipos' }, ...tipos.map(tipo => crear('span', {
        texto: TIPOS[tipo]?.nombre || tipo, estilos: { '--color-etiqueta': TIPOS[tipo]?.color || COLOR_POR_DEFECTO } }))),
      crear('p', { clase: 'del-dia-descripcion', texto: descripcion }),
      crear('ul', { clase: 'del-dia-stats', atributos: { 'aria-label': `Estadísticas base (total ${total})` } }, ...pokemon.stats.map(s => crear('li', {},
        crear('span', { texto: NOMBRES_ESTADISTICAS[s.stat.name] || s.stat.name }),
        crear('strong', { texto: s.base_stat }),
        crear('i', { atributos: { 'aria-hidden': 'true' } }, crear('b', { estilos: { width: Math.min(100, s.base_stat / 180 * 100) + '%' } })),
      ))),
      crear('div', { clase: 'del-dia-acciones' },
        crear('button', { type: 'button', clase: 'del-dia-boton', alPulsar: () => buscarPokemon(String(pokemon.id)) },
          'Ver ficha completa ', crear('span', { texto: '↗', atributos: { 'aria-hidden': 'true' } })),
        crear('small', { texto: `Suma de estadísticas: ${total} · mañana, otro distinto` })),
    ),
  );
}

// --- Regiones ------------------------------------------------------------------

function crearRegiones() {
  document.querySelector('#guia-regiones').append(...GENERACIONES.map(gen => crear('button', {
    type: 'button',
    clase: 'region',
    atributos: { 'aria-label': `Generación ${gen.numero}, región de ${gen.region}: ver sus Pokémon en la Pokédex` },
    alPulsar: () => mostrarGeneracion(gen),
  },
    crear('span', { clase: 'region-marca', atributos: { 'aria-hidden': 'true' } }),
    crear('small', { clase: 'region-generacion', texto: 'Gen ' + gen.numero }),
    crear('strong', { texto: gen.region }),
    crear('small', { clase: 'region-rango', texto: `N.º ${numeroPokedex(gen.desde)} – ${numeroPokedex(gen.hasta)}` }),
    crear('span', { clase: 'region-iniciales', atributos: { 'aria-hidden': 'true' } }, ...gen.iniciales.map(id => crear('img', { src: urlSprite(id), alt: '', loading: 'lazy' }))),
  )));
}
