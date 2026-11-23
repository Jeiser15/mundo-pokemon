// Vista «Legendarios»: el santuario de las 71 leyendas.
//   1. Leyenda destacada: altar con su ilustración y ficha breve; se recorre con ‹ ›.
//      Cada día empieza por una distinta.
//   2. Filtros por generación (I Kanto … IX Paldea).
//   3. Cartas de reliquia: se ven 10 y «Ver más» muestra 10 más. Al pulsar una se abre su ficha.

import { obtenerRecurso } from './api.js';
import { COLOR_POR_DEFECTO, GENERACIONES, LEGENDARIOS, TIPOS } from './datos.js';
import { activarInclinacion } from './efectos.js';
import { buscarPokemon } from './ficha.js';
import { crear, crearImagen, numeroPokedex, urlIlustracion } from './utilidades.js';

const PODER_TOPE = 720;            // La barra de poder se llena del todo con este valor.
const DURACION_FUNDIDO_MS = 250;   // Debe coincidir con la transición de .cambiando en legendarios.css

const seccion = document.querySelector('#legendarios');
const lista = document.querySelector('#lista-legendarios');
const generacionDe = id => GENERACIONES.find(gen => id >= gen.desde && id <= gen.hasta);
const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;
const coloresDe = tipos => ({ '--tipo-a': colorDe(tipos[0]), '--tipo-b': colorDe(tipos[1] || tipos[0]) });

// --- Piezas compartidas por la destacada y las cartas ------------------------------

function crearTipos(tipos) {
  return tipos.map(tipo => crear('span', { clase: 'leyenda-tipo', texto: TIPOS[tipo]?.nombre || tipo, estilos: { '--color-tipo': colorDe(tipo) } }));
}

function anchoPoder(poder) {
  return Math.min(100, poder / PODER_TOPE * 100) + '%';
}

// --- 1. Leyenda destacada ----------------------------------------------------------

let indiceDestacada = 0;
let versionDestacada = 0; // Descarta respuestas que llegan tarde si se pulsa ‹ › muy rápido.

function mostrarDestacada(indice) {
  const total = LEGENDARIOS.length;
  indiceDestacada = (indice + total) % total;
  const leyenda = LEGENDARIOS[indiceDestacada];
  const version = ++versionDestacada;
  const ficha = document.querySelector('#leyenda-destacada');
  const imagen = document.querySelector('#destacada-imagen');
  const descripcion = document.querySelector('#destacada-descripcion');

  // La descripción llega aparte desde PokéAPI. Cambia a la vez que el resto de la carta: antes el «Consultando…»
  // salía al instante, aún con la leyenda anterior en pantalla.
  let texto = null, pintada = false;
  const pintar = () => {
    if (version !== versionDestacada) return;
    pintada = true;
    descripcion.textContent = texto ?? 'Consultando los archivos antiguos...';
    const gen = generacionDe(leyenda.id);
    for (const [variable, color] of Object.entries(coloresDe(leyenda.tipos))) seccion.style.setProperty(variable, color);
    document.querySelector('#destacada-grupo').textContent = `${leyenda.grupo} · Gen ${gen.numero} · ${gen.region}`;
    document.querySelector('#destacada-nombre').textContent = leyenda.nombre;
    document.querySelector('#destacada-especie').textContent = leyenda.especie;
    document.querySelector('#destacada-tipos').replaceChildren(...crearTipos(leyenda.tipos));
    document.querySelector('#destacada-barra').style.width = anchoPoder(leyenda.poder);
    document.querySelector('#destacada-poder').textContent = leyenda.poder;
    document.querySelector('#destacada-contador').textContent = `${indiceDestacada + 1} / ${total}`;
    imagen.src = urlIlustracion(leyenda.id);
    imagen.alt = 'Ilustración de ' + leyenda.nombre;
    ficha.classList.remove('cambiando');
    imagen.classList.remove('cambiando');
  };

  obtenerRecurso('pokemon-species', leyenda.id)
    .then(especie => especie.flavor_text_entries.find(d => d.language.name === 'es')?.flavor_text.replace(/\s+/g, ' ') || 'Aún no hay descripción en español para esta leyenda.')
    .catch(() => 'No se pudo cargar la descripción. Comprueba tu conexión.')
    .then(llegado => {
      if (version !== versionDestacada) return;
      texto = llegado;
      if (pintada) descripcion.textContent = llegado;
    });

  // La primera vez se pinta directamente; después, con un fundido y la imagen ya descargada.
  if (!imagen.getAttribute('src')) { pintar(); return; }
  ficha.classList.add('cambiando');
  imagen.classList.add('cambiando');
  const precarga = new Image();
  precarga.onload = precarga.onerror = () => setTimeout(pintar, DURACION_FUNDIDO_MS);
  precarga.src = urlIlustracion(leyenda.id);
}

/** Igual para todos ese día; cambia a medianoche. */
function indiceDelDia() {
  const hoy = new Date();
  return Math.floor(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) / 86_400_000) % LEGENDARIOS.length;
}

// --- 2 y 3. Archivo: filtros y cartas -----------------------------------------------

function crearCarta(leyenda, orden) {
  const gen = generacionDe(leyenda.id);
  return crear('button', {
    type: 'button',
    clase: 'leyenda',
    atributos: { 'data-gen': gen.numero, 'aria-label': `${leyenda.nombre}, ${leyenda.grupo}. Generación ${gen.numero}, ${gen.region}. Poder ${leyenda.poder}. Ver ficha.` },
    estilos: { ...coloresDe(leyenda.tipos), '--orden': orden },
    alPulsar: () => buscarPokemon(String(leyenda.id)),
  },
    crear('span', { clase: 'leyenda-marco' },
      crear('span', { clase: 'leyenda-cabecera' },
        crear('span', { clase: 'leyenda-gen', texto: gen.numero, title: `Generación ${gen.numero} · ${gen.region}` }),
        crear('span', { clase: 'leyenda-numero', texto: 'N.º ' + numeroPokedex(leyenda.id) })),
      crear('span', { clase: 'leyenda-arte' }, crear('span', { clase: 'leyenda-aura' }), crearImagen(urlIlustracion(leyenda.id))),
      crear('span', { clase: 'leyenda-datos' },
        crear('small', { clase: 'leyenda-grupo', texto: leyenda.grupo }),
        crear('strong', { clase: 'leyenda-nombre', texto: leyenda.nombre }),
        crear('span', { clase: 'leyenda-especie', texto: leyenda.especie }),
        crear('span', { clase: 'leyenda-tipos' }, ...crearTipos(leyenda.tipos)),
        crear('span', { clase: 'leyenda-poder' },
          crear('small', { texto: 'Poder' }),
          crear('i', {}, crear('b', { estilos: { width: anchoPoder(leyenda.poder) } })),
          crear('strong', { texto: leyenda.poder })),
      ),
    ),
    crear('span', { clase: 'leyenda-brillo', atributos: { 'aria-hidden': 'true' } }),
  );
}

const POR_TANDA = 10;      // Cartas que se ven al principio y cada vez que se pulsa «Ver más».
let filtro = 'todas';      // 'todas' o el número romano de una generación.
let mostradas = POR_TANDA;

/** Crea las 71 cartas una sola vez; actualizarArchivo() decide cuáles se ven. */
function crearArchivo() {
  LEGENDARIOS.forEach((leyenda, orden) => lista.append(crearCarta(leyenda, orden)));
}

/** Muestra las primeras `mostradas` cartas del filtro elegido y ajusta el botón «Ver más». */
function actualizarArchivo() {
  const delFiltro = [...lista.children].filter(carta => filtro === 'todas' || carta.dataset.gen === filtro);
  for (const carta of lista.children) carta.hidden = true;
  delFiltro.slice(0, mostradas).forEach(carta => { carta.hidden = false; });
  const boton = document.querySelector('#leyendas-ver-mas');
  boton.hidden = mostradas >= delFiltro.length;
  boton.querySelector('small').textContent = `${Math.min(mostradas, delFiltro.length)} de ${delFiltro.length}`;
}

function crearFiltros() {
  const contenedor = document.querySelector('#leyendas-filtros');
  const opciones = [{ valor: 'todas', numero: '✦', nombre: 'Todas', cuenta: LEGENDARIOS.length },
    ...GENERACIONES.map(gen => ({ valor: gen.numero, numero: gen.numero, nombre: gen.region, cuenta: LEGENDARIOS.filter(l => generacionDe(l.id) === gen).length }))];
  const botones = opciones.map(opcion => crear('button', {
    type: 'button',
    clase: 'leyendas-filtro',
    atributos: { 'aria-pressed': String(opcion.valor === 'todas') },
    alPulsar: evento => {
      botones.forEach(boton => boton.setAttribute('aria-pressed', String(boton === evento.currentTarget)));
      filtro = opcion.valor;
      mostradas = POR_TANDA; // Cada filtro empieza otra vez por las 10 primeras.
      actualizarArchivo();
    },
  }, crear('b', { texto: opcion.numero }), opcion.nombre, crear('small', { texto: opcion.cuenta })));
  contenedor.append(...botones);
}

function pintarCifras() {
  document.querySelector('#cifra-leyendas').textContent = LEGENDARIOS.length;
  document.querySelector('#cifra-grupos').textContent = new Set(LEGENDARIOS.map(l => l.grupo)).size;
  document.querySelector('#cifra-poder').textContent = Math.max(...LEGENDARIOS.map(l => l.poder));
}

export function iniciarLegendarios() {
  document.querySelector('#destacada-anterior').addEventListener('click', () => mostrarDestacada(indiceDestacada - 1));
  document.querySelector('#destacada-siguiente').addEventListener('click', () => mostrarDestacada(indiceDestacada + 1));
  document.querySelector('#destacada-ver').addEventListener('click', () => buscarPokemon(String(LEGENDARIOS[indiceDestacada].id)));
  mostrarDestacada(indiceDelDia());
  pintarCifras();
  crearFiltros();
  crearArchivo();
  actualizarArchivo();
  document.querySelector('#leyendas-ver-mas').addEventListener('click', () => { mostradas += POR_TANDA; actualizarArchivo(); });
  activarInclinacion(lista, '.leyenda', { giro: 10, paralaje: 8 });
}
