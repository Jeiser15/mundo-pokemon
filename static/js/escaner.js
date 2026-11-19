// Pokédex: el ESCÁNER. Una pantalla holográfica (con la lente azul de la Pokédex del anime) que lee el registro
// del Pokémon que pulsas en el archivo: su ilustración se materializa con un barrido de luz y aparecen su nombre,
// su categoría, sus tipos, sus medidas, su descripción (se escribe letra a letra, como si la leyera la Pokédex),
// sus estadísticas base y un botón para oír su grito.
//   ‹ ›       recorren la lista que se ve en el archivo (con sus filtros): catalogo.js da la función «vecino»;
//   Al azar   escanea una especie cualquiera;
//   Ficha     abre la ficha completa (ficha.js).
// Lleva la cuenta de los Pokémon VISTOS, como en los juegos (pokedex.vistos, en este navegador) y avisa con el
// evento «pokemon-escaneado» ({ id }) para que el archivo marque la tarjeta.
// Las respuestas que llegan tarde se descartan (versionEscaneo), como en ficha.js.

import { obtenerPokemon, obtenerRecurso } from './api.js';
import { COLOR_POR_DEFECTO, GENERACIONES, rarezaDe, TIPOS, TOTAL_ESPECIES } from './datos.js';
import { buscarPokemon } from './ficha.js';
import { grito, prepararSonido } from './sonido.js';
import { crear, nombreLegible, numeroPokedex, urlIlustracion } from './utilidades.js';

const CLAVE_VISTOS = 'pokedex.vistos';
const LETRAS_POR_PASO = 2;   // la descripción se escribe de dos en dos letras…
const PASO_MS = 24;          // …cada 24 ms
const ESTADISTICAS = { hp: 'PS', attack: 'Ataque', defense: 'Defensa', 'special-attack': 'At. esp.', 'special-defense': 'Def. esp.', speed: 'Velocidad' };
const MAXIMO_ESTADISTICA = 180; // la barra llena (casi ninguna base pasa de aquí)

const escaner = document.querySelector('#escaner');
const pantalla = document.querySelector('#escaner-pantalla');
const imagen = document.querySelector('#escaner-imagen');
const datos = document.querySelector('#escaner-datos');
const registro = document.querySelector('#escaner-registro');
const numero = document.querySelector('#escaner-numero');
const botonGrito = document.querySelector('#escaner-grito');
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');

const cache = new Map();   // id → promesa de [pokemon, especie]
const vistos = leerVistos();
let versionEscaneo = 0;
let actual = null;         // id del que está en pantalla
let urlGrito = null;
let escritura = null;
let vecino = () => null;   // (id, paso) → id del anterior/siguiente en la lista del archivo
let alAzar = () => null;   // () → id de una especie cualquiera

function leerVistos() {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS)) || []); } catch { return new Set(); }
}
function guardarVistos() {
  try { localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...vistos])); } catch { /* sin almacenamiento */ }
}

export const haSidoVisto = id => vistos.has(Number(id));
export const enPantalla = () => actual;

function pintarVistos() {
  document.querySelector('#pokedex-vistos').textContent = vistos.size;
  document.querySelector('#pokedex-vistos-barra').style.width = Math.min(100, (vistos.size / TOTAL_ESPECIES) * 100) + '%';
}

const cargar = id => {
  if (!cache.has(id)) {
    cache.set(id, Promise.all([obtenerPokemon(String(id)), obtenerRecurso('pokemon-species', id)])
      .catch(error => { cache.delete(id); throw error; }));
  }
  return cache.get(id);
};

/** Lleva un Pokémon a la pantalla. `mostrar`: en pantallas estrechas, sube hasta el escáner. */
export async function escanear(id, { mostrar = false } = {}) {
  id = Number(id);
  if (!id) return;
  const version = ++versionEscaneo;
  const vigente = () => version === versionEscaneo;
  actual = id;
  document.dispatchEvent(new CustomEvent('pokemon-escaneado', { detail: { id } }));
  if (mostrar && matchMedia('(max-width: 1100px)').matches) escaner.scrollIntoView({ behavior: movimientoReducido.matches ? 'auto' : 'smooth', block: 'start' });

  escaner.classList.add('escaneando');
  escaner.setAttribute('aria-busy', 'true');
  registro.textContent = `Escaneando… N.º ${numeroPokedex(id)}`;
  try {
    const [[pokemon, especie]] = await Promise.all([cargar(id), precargarImagen(urlIlustracion(id))]);
    if (!vigente()) return;
    pintar(id, pokemon, especie);
    vistos.add(id);
    guardarVistos();
    pintarVistos();
  } catch {
    if (!vigente()) return;
    registro.textContent = `N.º ${numeroPokedex(id)} · sin señal`;
    datos.replaceChildren(crear('p', { clase: 'escaner-error', texto: 'No se pudo leer este registro. Comprueba tu conexión e inténtalo de nuevo.' }));
  } finally {
    if (vigente()) {
      escaner.setAttribute('aria-busy', 'false');
      // Reinicia el barrido para que se vea en cada escaneo.
      escaner.classList.remove('escaneando');
      pantalla.classList.remove('materializando');
      void pantalla.offsetWidth;
      pantalla.classList.add('materializando');
    }
  }
}

/** Espera a que la ilustración esté descargada (si falla, sigue igual: se verá el registro sin imagen). */
function precargarImagen(url) {
  return new Promise(listo => {
    const previa = new Image();
    previa.onload = previa.onerror = () => listo();
    previa.src = url;
  });
}

function pintar(id, pokemon, especie) {
  const enEspanol = lista => [...lista].reverse().find(x => x.language.name === 'es'); // la más reciente
  const nombre = enEspanol(especie.names)?.name || nombreLegible(pokemon.name);
  const categoria = enEspanol(especie.genera)?.genus || 'Pokémon';
  const descripcion = enEspanol(especie.flavor_text_entries)?.flavor_text.replace(/\s+/g, ' ') || 'Aún no hay descripción en español para esta especie.';
  const tipos = pokemon.types.map(t => t.type.name);
  const gen = GENERACIONES.find(g => id >= g.desde && id <= g.hasta);
  const rareza = rarezaDe(id);
  const medida = (valor, unidad) => `${(valor / 10).toLocaleString('es', { maximumFractionDigits: 1 })} ${unidad}`;
  const total = pokemon.stats.reduce((suma, s) => suma + s.base_stat, 0);

  escaner.style.setProperty('--tipo-a', TIPOS[tipos[0]]?.color || COLOR_POR_DEFECTO);
  escaner.style.setProperty('--tipo-b', TIPOS[tipos[1] || tipos[0]]?.color || COLOR_POR_DEFECTO);
  registro.textContent = `N.º ${numeroPokedex(id)}${gen ? ` · Gen ${gen.numero} · ${gen.region}` : ''}`;
  numero.textContent = numeroPokedex(id);
  imagen.src = urlIlustracion(id);
  imagen.alt = 'Ilustración de ' + nombre;
  urlGrito = pokemon.cries?.latest || pokemon.cries?.legacy || null;
  botonGrito.disabled = !urlGrito;

  const parrafo = crear('span', { atributos: { 'aria-hidden': 'true' } });
  datos.replaceChildren(
    crear('div', { clase: 'escaner-titulo' },
      crear('h3', { texto: nombre }),
      ...(rareza ? [crear('span', { clase: 'escaner-rareza escaner-' + rareza, texto: rareza === 'legendario' ? '✦ Legendario' : '✧ Singular' })] : [])),
    crear('p', { clase: 'escaner-especie', texto: categoria }),
    crear('div', { clase: 'escaner-fila' },
      crear('span', { clase: 'escaner-tipos' }, ...tipos.map(tipo => crear('span', {
        texto: TIPOS[tipo]?.nombre || tipo, estilos: { '--color-tipo': TIPOS[tipo]?.color || COLOR_POR_DEFECTO } }))),
      crear('span', { clase: 'escaner-medidas' }, crear('span', { texto: medida(pokemon.height, 'm') }), crear('span', { texto: medida(pokemon.weight, 'kg') }))),
    crear('p', { clase: 'escaner-descripcion' }, parrafo, crear('span', { clase: 'solo-lectores', texto: descripcion })),
    crear('ul', { clase: 'escaner-stats', atributos: { 'aria-label': `Estadísticas base (total ${total})` } },
      ...pokemon.stats.map(s => crear('li', {},
        crear('span', { texto: ESTADISTICAS[s.stat.name] || s.stat.name }),
        crear('b', { texto: s.base_stat }),
        crear('i', { atributos: { 'aria-hidden': 'true' } }, crear('em', { estilos: { '--valor': Math.min(1, s.base_stat / MAXIMO_ESTADISTICA).toFixed(3) } }))))),
  );
  escribir(parrafo, descripcion);
}

/** La descripción, letra a letra (con movimiento reducido, de golpe). */
function escribir(elemento, texto) {
  clearInterval(escritura);
  elemento.parentElement.classList.remove('escribiendo');
  if (movimientoReducido.matches) { elemento.textContent = texto; return; }
  let letras = 0;
  elemento.textContent = '';
  elemento.parentElement.classList.add('escribiendo');
  escritura = setInterval(() => {
    letras += LETRAS_POR_PASO;
    elemento.textContent = texto.slice(0, letras);
    if (letras >= texto.length) { clearInterval(escritura); elemento.parentElement.classList.remove('escribiendo'); }
  }, PASO_MS);
}

/**
 * @param {object} p
 * @param {(id: number, paso: number) => number|null} p.vecino  El anterior (-1) o el siguiente (1) en la lista del archivo.
 * @param {() => number|null} p.azar                             Una especie cualquiera.
 */
export function iniciarEscaner({ vecino: elVecino, azar }) {
  vecino = elVecino;
  alAzar = azar;
  pintarVistos();
  const pasar = paso => { const otro = vecino(actual, paso); if (otro) escanear(otro); };
  document.querySelector('#escaner-anterior').addEventListener('click', () => pasar(-1));
  document.querySelector('#escaner-siguiente').addEventListener('click', () => pasar(1));
  document.querySelector('#escaner-azar').addEventListener('click', () => { const id = alAzar(); if (id) escanear(id); });
  document.querySelector('#escaner-ficha').addEventListener('click', () => { if (actual) buscarPokemon(String(actual)); });
  botonGrito.addEventListener('click', () => {
    prepararSonido(); // los navegadores solo dejan sonar tras un clic: este lo es
    grito(urlGrito, { volumen: 0.6 });
    botonGrito.classList.remove('sonando');
    void botonGrito.offsetWidth;
    botonGrito.classList.add('sonando');
  });
  // Flechas del teclado mientras el foco está en el escáner.
  escaner.addEventListener('keydown', evento => {
    const paso = { ArrowLeft: -1, ArrowRight: 1 }[evento.key];
    if (paso && !evento.target.closest('input, select')) { evento.preventDefault(); pasar(paso); }
  });
}
