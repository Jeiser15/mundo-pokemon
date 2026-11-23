// Vista «Pokédex», el archivo: las 1025 especies con buscador, filtros por región y tipo y orden. Las tarjetas
// se cargan de 24 en 24 (solas al acercarse al final, o con «Ver más»). Pulsar una la lleva al ESCÁNER
// (escaner.js), que lee su registro; la ficha completa se abre desde allí.
// Los datos (número, nombre y tipos) llegan de una vez desde /api/pokedex (ver especies.js), así que
// filtrar y ordenar es instantáneo: no hace falta volver a preguntar a PokéAPI.

import { GENERACIONES, TIPOS } from './datos.js';
import { enPantalla, escanear, haSidoVisto, iniciarEscaner } from './escaner.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import { crearTarjetaPokemon } from './tarjetas.js';
import { FORMAS } from './datos-formas.js';
import { contieneNombre, crear, crearIcono, esSuNombre, normalizar } from './utilidades.js';
import { irA } from './vistas.js';

const POR_TANDA = 24; // 6 filas de 4; al acercarse al final (o con «Ver más») llegan otras 24.
const lista = document.querySelector('#lista-catalogo');
const estado = document.querySelector('#estado-catalogo');
const botonMas = document.querySelector('#mas-catalogo');
const vacio = document.querySelector('#pokedex-vacio');
const buscador = document.querySelector('#pokedex-buscar');
const selectorOrden = document.querySelector('#pokedex-orden');
const botonLimpiar = document.querySelector('#pokedex-limpiar');
const botonPokeAPI = document.querySelector('#pokedex-buscar-api');

let especies = [];     // Todas, en orden de la Pokédex (cuando llegan).
let resultado = [];    // Las que pasan los filtros, ya ordenadas.
let mostradas = 0;     // Cuántas de `resultado` hay en pantalla.
const filtros = { texto: '', gen: null, tipo: null, orden: 'numero' };

const ORDENES = {
  numero: (a, b) => a.id - b.id,
  'numero-desc': (a, b) => b.id - a.id,
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  'nombre-desc': (a, b) => b.nombre.localeCompare(a.nombre, 'es'),
};

function coincideTexto(especie, texto) {
  if (!texto) return true;
  if (/^\d+$/.test(texto)) return String(especie.id).startsWith(String(Number(texto))); // «25» → 25, 250–259
  return contieneNombre(especie.nombre, texto); // su clave o su nombre en español («Ferrodada»)
}

/** Vuelve a calcular la lista con los filtros actuales y la pinta desde el principio. */
function aplicarFiltros() {
  const texto = normalizar(filtros.texto);
  const gen = GENERACIONES.find(g => g.numero === filtros.gen);
  resultado = especies
    .filter(e => (!gen || (e.id >= gen.desde && e.id <= gen.hasta)) && (!filtros.tipo || e.tipos.includes(filtros.tipo)) && coincideTexto(e, texto))
    .sort(ORDENES[filtros.orden]);
  mostradas = 0;
  lista.replaceChildren();
  marcarFiltros();
  mostrarMas();
}

function mostrarMas() {
  const lote = resultado.slice(mostradas, mostradas + POR_TANDA);
  lista.append(...lote.map((e, orden) => crearTarjetaPokemon({
    id: e.id, nombre: e.nombre, tipos: e.tipos, orden,
    visto: haSidoVisto(e.id), enPantalla: enPantalla() === e.id,
    alPulsar: () => escanear(e.id, { mostrar: true }),
  })));
  mostradas += lote.length;
  botonMas.replaceChildren('Ver más ', crear('small', { texto: `${mostradas} de ${resultado.length}` }), ' ↓');
  botonMas.hidden = mostradas >= resultado.length;
  vacio.hidden = resultado.length > 0 || !especies.length;
  // Sin resultados por texto: puede ser una forma especial (Mega, Alola…), que no está en la lista de especies.
  const texto = filtros.texto.trim();
  botonPokeAPI.hidden = !texto;
  botonPokeAPI.textContent = `Buscar «${texto}» en PokéAPI`;
  actualizarEstado();
}

function actualizarEstado() {
  const partes = [];
  const gen = GENERACIONES.find(g => g.numero === filtros.gen);
  if (gen) partes.push(`Generación ${gen.numero} · ${gen.region}`);
  if (filtros.tipo) partes.push(`tipo ${TIPOS[filtros.tipo].nombre}`);
  if (filtros.texto.trim()) partes.push(`«${filtros.texto.trim()}»`);
  estado.textContent = `Mostrando ${mostradas} de ${resultado.length} ${resultado.length === 1 ? 'especie' : 'especies'}` + (partes.length ? ` · ${partes.join(' · ')}` : '');
  botonLimpiar.hidden = !(gen || filtros.tipo || filtros.texto.trim() || filtros.orden !== 'numero');
}

// --- Filtros -----------------------------------------------------------------------

function marcarFiltros() {
  document.querySelectorAll('#pokedex-regiones .pokedex-chip').forEach(chip => chip.setAttribute('aria-pressed', String((chip.dataset.valor || null) === filtros.gen)));
  document.querySelectorAll('#pokedex-tipos .pokedex-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.valor === filtros.tipo)));
}

function crearFiltros() {
  // Regiones: una a la vez; «Todas» las quita.
  document.querySelector('#pokedex-regiones').append(
    crear('button', { type: 'button', clase: 'pokedex-chip', alPulsar: () => { filtros.gen = null; aplicarFiltros(); } }, crear('b', { texto: '✦' }), 'Todas'),
    ...GENERACIONES.map(gen => crear('button', {
      type: 'button', clase: 'pokedex-chip', title: `Generación ${gen.numero}: #${gen.desde}–${gen.hasta}`,
      atributos: { 'data-valor': gen.numero },
      alPulsar: () => { filtros.gen = gen.numero; aplicarFiltros(); },
    }, crear('b', { texto: gen.numero }), gen.region)),
  );
  // Tipos: uno a la vez; pulsar el activo lo quita.
  document.querySelector('#pokedex-tipos').append(...Object.entries(TIPOS).map(([clave, tipo]) => crear('button', {
    type: 'button', clase: 'pokedex-chip pokedex-chip-tipo',
    atributos: { 'data-valor': clave }, estilos: { '--color-tipo': tipo.color },
    alPulsar: () => { filtros.tipo = filtros.tipo === clave ? null : clave; aplicarFiltros(); },
  }, crear('span', {}, crearIcono(tipo.icono)), tipo.nombre)));

  let espera;
  buscador.addEventListener('input', () => {
    clearTimeout(espera); // Espera a que se deje de escribir un momento.
    espera = setTimeout(() => { filtros.texto = buscador.value; aplicarFiltros(); }, 150);
  });
  // Enter: si solo queda un Pokémon, lo escanea.
  buscador.addEventListener('keydown', evento => {
    if (evento.key !== 'Enter') return;
    clearTimeout(espera);
    filtros.texto = buscador.value;
    aplicarFiltros();
    if (resultado.length === 1) escanear(resultado[0].id, { mostrar: true });
  });
  botonPokeAPI.addEventListener('click', () => buscarPokemon(claveDe(filtros.texto)));
  selectorOrden.addEventListener('change', () => { filtros.orden = selectorOrden.value; aplicarFiltros(); });
  const limpiar = () => {
    Object.assign(filtros, { texto: '', gen: null, tipo: null, orden: 'numero' });
    buscador.value = '';
    selectorOrden.value = 'numero';
    aplicarFiltros();
  };
  botonLimpiar.addEventListener('click', limpiar);
  document.querySelector('#pokedex-vacio-limpiar').addEventListener('click', limpiar);
}

async function cargarDatos() {
  estado.textContent = 'Cargando la Pokédex desde PokéAPI...';
  botonMas.hidden = true;
  try {
    especies = await cargarEspecies();
    document.querySelectorAll('[data-total-especies]').forEach(cifra => { cifra.textContent = especies.length; });
    aplicarFiltros();
    // El escáner empieza con uno al azar (o con el primero de la lista, si se llegó con un filtro).
    if (!enPantalla()) escanear(hayFiltros() ? resultado[0]?.id : especieAlAzar());
  } catch (error) {
    // Un 404 aquí significa que app.py se arrancó antes de que existiera /api/pokedex.
    estado.textContent = error.estado === 404
      ? 'El servidor está ejecutando una versión anterior. Reinícialo: en la terminal pulsa Ctrl+C y escribe python app.py.'
      : error.message || 'No se pudo cargar la Pokédex.';
    botonMas.textContent = 'Reintentar';
    botonMas.hidden = false;
  }
}

const hayFiltros = () => Boolean(filtros.gen || filtros.tipo || filtros.texto.trim());
const especieAlAzar = () => especies[Math.floor(Math.random() * especies.length)]?.id ?? null;

/** El anterior (-1) o el siguiente (1) de `id` en la lista del archivo, dando la vuelta al llegar al final. */
function vecino(id, paso) {
  if (!resultado.length) return null;
  const indice = resultado.findIndex(e => e.id === id);
  if (indice < 0) return resultado[0].id;
  return resultado[(indice + paso + resultado.length) % resultado.length].id;
}

/** Al entrar con un filtro desde otra vista: si lo del escáner no está en la lista, escanea el primero. */
function escanearPrimeroSiHaceFalta() {
  if (resultado.length && !resultado.some(e => e.id === enPantalla())) escanear(resultado[0].id);
}

/** Abre la Pokédex con solo los Pokémon de una generación (objeto de GENERACIONES). La usa la portada. */
export function mostrarGeneracion(gen) {
  Object.assign(filtros, { texto: '', gen: gen.numero, tipo: null });
  buscador.value = '';
  if (especies.length) { aplicarFiltros(); escanearPrimeroSiHaceFalta(); } else marcarFiltros(); // Si aún no han llegado, se aplicará al llegar.
  irA('catalogo');
}

/** Abre la Pokédex con solo los Pokémon de un tipo ('fire'…). La usan Categorías y la portada. */
export function mostrarTipo(clave) {
  Object.assign(filtros, { texto: '', gen: null, tipo: clave });
  buscador.value = '';
  if (especies.length) { aplicarFiltros(); escanearPrimeroSiHaceFalta(); } else marcarFiltros();
  irA('catalogo');
}

/** La forma cuya clave o nombre en español es exactamente el texto (ya normalizado), o undefined. */
const formaDe = normal => Object.keys(FORMAS).find(clave => esSuNombre(clave, normal));

/** Lo que se pide a PokéAPI para lo escrito: la clave de la forma si es una («Mega-Charizard X» → 'charizard-mega-x');
 *  si no, el texto en minúsculas con guiones en vez de espacios (como las claves de PokéAPI). */
const claveDe = texto => formaDe(normalizar(texto)) || texto.trim().toLowerCase().replace(/\s+/g, '-');

/**
 * Buscador de la portada. Si el texto es un número o el nombre exacto de una especie (en inglés o en español) o de
 * una forma («charizard-mega-x»), abre su ficha; si no («char»), abre la Pokédex con los que coinciden.
 */
export async function buscarDesdePortada(texto) {
  const consulta = texto.trim();
  if (!consulta) return;
  let lista;
  try { lista = await cargarEspecies(); } catch { buscarPokemon(consulta); return; } // Sin lista, se pregunta a PokéAPI.
  const normal = normalizar(consulta);
  const exacta = /^\d+$/.test(normal)
    ? lista.find(e => e.id === Number(normal))
    : lista.find(e => esSuNombre(e.nombre, normal));
  if (exacta) { buscarPokemon(String(exacta.id)); return; }
  // Una forma («charizard-mega-x», «Mega-Charizard X»): no está en la lista de especies, pero sí en FORMAS.
  const forma = formaDe(normal);
  if (forma) { buscarPokemon(forma); return; }
  if (!especies.length) especies = lista;
  Object.assign(filtros, { texto: consulta, gen: null, tipo: null });
  buscador.value = consulta;
  aplicarFiltros();
  escanearPrimeroSiHaceFalta();
  irA('catalogo');
}

/** Carga la siguiente tanda sola cuando «Ver más» se acerca a la pantalla (el botón sigue ahí para el teclado). */
function cargarAlBajar() {
  const observador = new IntersectionObserver(([entrada]) => {
    if (!entrada.isIntersecting || botonMas.hidden || !especies.length) return;
    mostrarMas();
    // Si el botón sigue cerca (pantallas altas), se vuelve a observar para recibir un aviso nuevo.
    observador.unobserve(botonMas);
    requestAnimationFrame(() => observador.observe(botonMas));
  }, { rootMargin: '0px 0px 500px 0px' });
  observador.observe(botonMas);
}

/** Marca la tarjeta que está en el escáner y las ya vistas. */
function marcarEscaneada({ detail: { id } }) {
  lista.querySelectorAll('.pokemon-card').forEach(tarjeta => {
    const esta = Number(tarjeta.dataset.id) === id;
    tarjeta.setAttribute('aria-pressed', String(esta));
    if (esta) tarjeta.classList.add('visto');
  });
}

export function iniciarCatalogo() {
  crearFiltros();
  iniciarEscaner({ vecino, azar: especieAlAzar });
  document.addEventListener('pokemon-escaneado', marcarEscaneada);
  botonMas.addEventListener('click', () => (especies.length ? mostrarMas() : cargarDatos()));
  cargarAlBajar();
  cargarDatos();
}
