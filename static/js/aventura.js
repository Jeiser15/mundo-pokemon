// Modo aventura: «Nueve copas, una leyenda» (#aventura). Las nueve regiones en orden; en cada una, su copa con el
// formato de una liga de campeones (la lógica está en liga.js: sorteo, grupos, eliminatorias y dificultad). Aquí
// está la interfaz, con aire de videojuego (aventura.css):
//   · el MAPA vivo del archipiélago (mapa-aventura.js) con tu entrenador en la isla de la copa en curso; encima,
//     el título, tu tarjeta de entrenador y un botón por isla (al pulsarlo, su ficha: copa, campeón y estado);
//   · el panel de la copa, una pantalla cada vez: creador de entrenador → llegada a la región → sorteo de tu equipo
//     (5 al azar + tu inicial entre 3) → sorteo de grupos (bola a bola) → la copa (la previa del próximo combate
//     y, en pestañas, tu grupo, el cuadro y tu equipo) → campeón (y el viaje por el mapa a la siguiente isla) o
//     eliminado (otra temporada con OTRO equipo al azar);
//   · el salón de la fama (tus copas, con el equipo que las ganó) y la tarjeta del Inicio.
// Cada combate lo juega simulacro.js (empezarCombate con `aventura`).
// Se guarda en este navegador ('pokedex.aventura'): región en curso, la temporada de liga.js tal cual, copas
// ganadas, cifras y ajustes. Tu entrenador va aparte ('pokedex.entrenador') porque también sale en el Duelo.

import { dibujarVistaPrevia } from './arena-pixel.js';
import { ASPECTO_ENTRENADOR, ASPECTO_INICIAL, ESCENARIOS, ESTADIO_AVENTURA, FRASES_AVENTURA, FRASES_RIVAL, GENERACIONES, NIVELES_SIMULACRO, rarezaDe, REGIONES_AVENTURA, TIPOS } from './datos.js';
import { guardarEntrenador, leerEntrenador, MAX_NOMBRE, pintarRetrato, retratoEntrenador } from './entrenador.js';
import { dibujarFondo } from './escenarios.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import {
  aspectoAlAzar, azarDe, clasificacion, completarEquipoRival, crearTemporada, dificultad, ganadorCopa, grupoDelJugador,
  GRUPOS, MAX_BONO_INTENTOS, nivelJugador, nombreCompleto, objetivoRival, participante, partidoDelJugador, planEquipoRival,
  poderReferencia, registrarCombate, RONDA_CUARTOS, RONDA_FINAL, RONDAS, rivalDe, sortearEquipo, sortearGrupos,
} from './liga.js';
import { ALTO_MAPA, ANCHO_MAPA, crearMapa, ISLAS } from './mapa-aventura.js';
import { detallesDe } from './mi-equipo.js';
import { empezarCombate } from './simulacro.js';
import { alAzar, crear, crearIcono, nombreTitulo, urlSprite } from './utilidades.js';

const CLAVE = 'pokedex.aventura';
const REGIONES = REGIONES_AVENTURA.length;
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const seccion = document.querySelector('#aventura');
const nodos = {};
let datos = leer();
let mapa = null;
let ultimo = null;          // el último combate (para el cartel del resultado)
let revelando = false;      // el sorteo de tu equipo se está abriendo Poké Ball a Poké Ball
let sorteoAnimado = false;  // el sorteo de grupos se está enseñando bola a bola
let editando = false;       // el creador de entrenador está abierto
let viajando = false;       // el entrenador camina por el mapa hacia la siguiente isla
let pestana = null;         // pestaña abierta bajo la previa: 'grupo' | 'cuadro' | 'equipo'
let islaVista = null;       // la isla cuya ficha se ve en el mapa
let version = 0;            // cada vez que se pinta el panel: lo que llegue tarde de antes se descarta
const equiposEnCurso = new Map(); // equipos de rivales que se están preparando (clave → promesa)

// --- Guardado ------------------------------------------------------------------------------------------

function vacio() {
  return {
    version: 1, region: 0, temporada: null, conquistas: [],
    estadisticas: { combates: 0, victorias: 0, derrotas: 0, legendarios: 0, temporadas: 0 },
    ajustes: { pantallaCompleta: false },
  };
}

function leer() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    if (g?.version === 1 && Number.isInteger(g.region)) {
      const base = vacio();
      const d = { ...base, ...g, estadisticas: { ...base.estadisticas, ...g.estadisticas }, ajustes: { ...base.ajustes, ...g.ajustes } };
      if (!Array.isArray(d.conquistas)) d.conquistas = [];
      if (d.temporada && (d.temporada.version !== 1 || !Array.isArray(d.temporada.participantes))) d.temporada = null;
      return d;
    }
  } catch { /* sin almacenamiento o dato roto: se empieza de cero */ }
  return vacio();
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* navegación privada: dura la visita */ }
}

// --- Utilidades de la vista ---------------------------------------------------------------------------

const romano = i => GENERACIONES[i]?.numero || String(i + 1);
const regionEnCurso = () => Math.min(REGIONES - 1, datos.temporada?.region ?? datos.region);
const yo = () => leerEntrenador();
const mayuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
const esperar = ms => new Promise(listo => setTimeout(listo, movimientoReducido.matches ? 0 : ms));
const colorTipo = tipo => TIPOS[tipo]?.color || '#8a917e';
const conquistada = i => datos.conquistas.some(c => c.region === i);
/** Nombre corto de un participante para tablas y cuadros. */
const nombreCorto = (t, clave) => (clave === 'tu' ? yo()?.nombre || 'Tú' : participante(t, clave).titulo);
const aspectoDe = (t, clave) => (clave === 'tu' ? yo()?.aspecto || ASPECTO_INICIAL : participante(t, clave).aspecto);
const clavesFrases = (t, rival) => (rival.rol === 'rival' ? 'kael' : rival.rol === 'campeon' ? (REGIONES_AVENTURA[t.region].campeon.leyendas ? 'leyendas' : 'campeon') : null);
/** Las frases del rival (Kael, campeones…) o las de cualquier entrenador. */
const frasesDe = (t, rival) => FRASES_AVENTURA[clavesFrases(t, rival)] || FRASES_RIVAL;
const NOMBRE_ESTRATEGIA = { novato: 'Novato', retador: 'Retador', maestro: 'Maestro' };
const tituloCampeon = r => `${r.campeon.genero === 'f' ? 'Campeona' : 'Campeón'} ${r.campeon.nombre}`;

/** Dónde se juega un partido: las arenas de la región en los grupos; el estadio desde los cuartos. */
function escenarioDe(t, partido) {
  if (partido.ronda >= RONDA_CUARTOS) return 'estadio';
  const { arenas } = REGIONES_AVENTURA[t.region];
  return arenas[(partido.ronda + (partido.grupo || 0)) % arenas.length];
}
const nombreArena = (t, escenario) => (escenario === 'estadio' ? REGIONES_AVENTURA[t.region].estadio : ESCENARIOS[escenario]?.nombre || ESTADIO_AVENTURA.nombre);

/** Pone los colores de la región en la vista (se funden con una transición). */
function ponerLuz() {
  const [a, b] = REGIONES_AVENTURA[regionEnCurso()].colores;
  seccion.style.setProperty('--region-a', a);
  seccion.style.setProperty('--region-b', b);
}

const boton = (texto, alPulsar, variante = 'principal', extra = {}) => crear('button', { type: 'button', clase: `av-boton ${variante}`, texto, alPulsar, ...extra });
const ventana = (clase, ...hijos) => crear('div', { clase: 'av-ventana ' + clase }, ...hijos);
const titulo = (antes, resaltado, nivel = 'h3') => crear(nivel, { clase: 'av-titulo-pixel' }, antes, crear('em', { texto: resaltado }));
const etiqueta = texto => crear('span', { clase: 'av-etiqueta', texto });

/** Escribe un texto letra a letra, como los diálogos de los juegos (el texto entero queda para los lectores). */
function escribir(elemento, texto, ms = 22) {
  elemento.setAttribute('aria-label', texto);
  if (movimientoReducido.matches) { elemento.textContent = texto; return; }
  elemento.textContent = '';
  let i = 0;
  const paso = () => {
    if (!elemento.isConnected && i > 0) return;
    elemento.textContent = texto.slice(0, ++i);
    if (i < texto.length) setTimeout(paso, texto[i - 1] === ',' || texto[i - 1] === '.' ? ms * 6 : ms);
  };
  setTimeout(paso, 250);
}

/** Un bocadillo de diálogo: quién habla y lo que dice (letra a letra). */
function dialogo(quien, texto, clase = '') {
  const linea = crear('p', { clase: 'av-dialogo-texto' });
  escribir(linea, `«${texto}»`);
  return crear('div', { clase: 'av-dialogo ' + clase }, crear('span', { clase: 'av-dialogo-quien', texto: quien }), linea, crear('span', { clase: 'av-dialogo-flecha', atributos: { 'aria-hidden': 'true' }, texto: '▼' }));
}

/** Miniatura de un Pokémon (sprite) con su nombre y tipos; abre su ficha. */
function fichaPokemon(d, { nivel = null, silueta = false, clase = 'av-mini' } = {}) {
  const rareza = rarezaDe(d.especie);
  return crear('button', {
    type: 'button', clase, title: silueta ? '¿Quién será?' : `${nombreTitulo(d.nombre)} · ver su ficha`,
    atributos: { ...(rareza ? { 'data-rareza': rareza } : {}), ...(silueta ? { 'data-silueta': '' } : {}) },
    estilos: { '--color-a': colorTipo(d.tipos[0]), '--color-b': colorTipo(d.tipos[1] || d.tipos[0]) },
    disabled: silueta,
    alPulsar: () => buscarPokemon(d.id),
  },
  crear('img', { src: d.sprite || d.imagen, alt: '', loading: 'lazy' }),
  ...(silueta ? [] : [crear('span', { clase: 'av-mini-nombre', texto: nombreTitulo(d.nombre) })]),
  ...(nivel && !silueta ? [crear('small', { texto: `Nv. ${nivel}` })] : []));
}

const chipTipo = tipo => crear('span', { clase: 'av-tipo', estilos: { '--color-tipo': colorTipo(tipo) } }, crearIcono(TIPOS[tipo].icono), TIPOS[tipo].nombre);

/** Una copa dibujada con CSS, del color de la región. */
const trofeo = ([a, b], clase = '') => crear('span', { clase: 'trofeo ' + clase, estilos: { '--trofeo-a': a, '--trofeo-b': b } },
  crear('span', { clase: 'trofeo-asa izquierda' }), crear('span', { clase: 'trofeo-asa derecha' }),
  crear('span', { clase: 'trofeo-copa' }), crear('span', { clase: 'trofeo-pie' }), crear('span', { clase: 'trofeo-base' }));

// --- Inicio -------------------------------------------------------------------------------------------

export function iniciarAventura() {
  Object.assign(nodos, {
    lienzo: seccion.querySelector('#aventura-mapa'),
    marco: seccion.querySelector('.av-mapa-desliza'),
    islas: seccion.querySelector('#aventura-islas'),
    tarjeta: seccion.querySelector('#aventura-tarjeta'),
    info: seccion.querySelector('#aventura-info'),
    panel: seccion.querySelector('#aventura-panel'),
    vitrina: seccion.querySelector('#aventura-vitrina'),
  });
  mapa = crearMapa(nodos.lienzo);
  // El mapa solo se anima si se ve: la vista está abierta, la pestaña también y el mapa está en pantalla.
  let enPantalla = true;
  const repasar = () => mapa.pausar(seccion.hidden || document.hidden || !enPantalla);
  new IntersectionObserver(([e]) => { enPantalla = e.isIntersecting; repasar(); }).observe(nodos.lienzo);
  new MutationObserver(() => { repasar(); if (!seccion.hidden) centrarMapa(); }).observe(seccion, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', repasar);
  repasar();
  document.addEventListener('entrenador-cambiado', () => { pintarMapa(); pintarTarjeta(); pintarInicio(); });
  pintarTodo();
}

function pintarTodo() {
  ponerLuz();
  pintarMapa();
  pintarTarjeta();
  pintarPanel();
  pintarVitrina();
  pintarInicio();
}

const irAlPanel = () => nodos.panel.scrollIntoView({ behavior: movimientoReducido.matches ? 'instant' : 'smooth', block: 'start' });

// --- El mapa y lo que va encima --------------------------------------------------------------------------

function pintarMapa() {
  const actual = regionEnCurso();
  mapa.pintar({
    actual,
    conquistas: datos.conquistas.map(c => c.region),
    aspecto: yo()?.aspecto || null,
    seleccion: islaVista,
  });
  nodos.islas.replaceChildren(...REGIONES_AVENTURA.map((r, i) => {
    const estado = conquistada(i) ? 'ganada' : i === actual ? 'actual' : 'bloqueada';
    const isla = ISLAS[i];
    return crear('li', { estilos: { '--x': `${(isla.x / ANCHO_MAPA) * 100}%`, '--y': `${((isla.y + isla.ry + 4) / ALTO_MAPA) * 100}%` } },
      crear('button', {
        type: 'button', clase: 'av-isla', atributos: { 'data-estado': estado, 'aria-pressed': String(islaVista === i), ...(estado === 'actual' ? { 'aria-current': 'step' } : {}) },
        estilos: { '--color-a': r.colores[0] },
        title: `${r.region} · ${r.copa}`,
        alPulsar: () => { islaVista = islaVista === i ? null : i; pintarMapa(); },
      }, crear('span', { clase: 'av-isla-sello', texto: estado === 'ganada' ? '★' : estado === 'bloqueada' ? '🔒' : '▶' }), r.region));
  }));
  pintarInfo();
}

/** Lleva el mapa (en el móvil se desliza) hasta tu isla. */
function centrarMapa() {
  const marco = nodos.marco;
  if (!marco || marco.scrollWidth <= marco.clientWidth) return;
  const x = (ISLAS[regionEnCurso()].x / ANCHO_MAPA) * marco.scrollWidth;
  marco.scrollLeft = Math.max(0, x - marco.clientWidth / 2);
}

/** La ficha de la isla señalada en el mapa (o, si no hay ninguna, la de la región en curso). */
function pintarInfo() {
  const i = islaVista ?? regionEnCurso();
  const r = REGIONES_AVENTURA[i];
  const copa = datos.conquistas.find(c => c.region === i);
  const actual = i === regionEnCurso() && !copa;
  const t = datos.temporada?.region === i ? datos.temporada : null;
  const estado = copa ? `★ Copa ganada${copa.intento > 1 ? ` al ${copa.intento}.º intento` : ''}`
    : actual ? (t ? `Estás aquí · ${textoFase(t)}` : 'Estás aquí') : `Bloqueada · gana la ${REGIONES_AVENTURA[i - 1]?.copa || 'copa anterior'}`;
  nodos.info.replaceChildren(
    crear('div', { clase: 'av-info-sello', estilos: { '--color-a': r.colores[0], '--color-b': r.colores[1] }, texto: romano(i) }),
    crear('div', { clase: 'av-info-texto' },
      crear('strong', { texto: `${r.region} · ${r.copa}` }),
      crear('span', { texto: `${tituloCampeon(r)}, ${r.campeon.apodo} · desde Nv. ${r.nivel}` }),
      crear('em', { atributos: { 'data-estado': copa ? 'ganada' : actual ? 'actual' : 'bloqueada' }, texto: estado })),
    ...(actual && yo() ? [boton(t && !['equipo'].includes(t.fase) ? 'Ver la copa ▾' : 'Empezar ▾', () => irAlPanel(), 'secundario pequeno')] : []));
}

function textoFase(t) {
  if (t.fase === 'equipo') return t.sorteo ? 'eligiendo inicial' : 'recién llegado';
  if (t.fase === 'sorteo') return 'sorteo de grupos';
  if (t.fase === 'campeon') return '¡campeón!';
  if (t.fase === 'eliminado') return 'eliminado';
  return RONDAS[t.ronda].nombre.toLowerCase();
}

/** Tu tarjeta de entrenador (arriba a la derecha del mapa). */
function pintarTarjeta() {
  const entrenador = yo();
  const { combates, victorias } = datos.estadisticas;
  if (!entrenador) {
    nodos.tarjeta.replaceChildren(
      crear('p', { texto: 'Crea a tu entrenador para empezar el viaje en Kanto.' }),
      boton('Crear mi entrenador ▸', () => { editando = true; pintarPanel(); irAlPanel(); }));
    return;
  }
  nodos.tarjeta.replaceChildren(
    retratoEntrenador(entrenador.aspecto, { escala: 2, clase: 'av-tarjeta-retrato' }),
    crear('div', { clase: 'av-tarjeta-datos' },
      crear('strong', { texto: entrenador.nombre }),
      crear('span', { clase: 'av-estrellas', atributos: { 'aria-label': `${datos.conquistas.length} de ${REGIONES} copas` } },
        ...REGIONES_AVENTURA.map((r, i) => crear('i', { clase: conquistada(i) ? 'ganada' : '', estilos: { '--color': r.colores[0] }, title: r.copa }))),
      crear('small', { texto: combates ? `${victorias} victorias en ${combates} combates` : 'Aún sin combates' })),
    crear('button', { type: 'button', clase: 'av-tarjeta-editar', title: 'Cambiar tu entrenador', atributos: { 'aria-label': 'Cambiar tu entrenador' }, texto: '✎', alPulsar: () => { editando = true; pintarPanel(); irAlPanel(); } }));
}

// --- El panel ---------------------------------------------------------------------------------------------

function pintarPanel() {
  const v = ++version;
  ponerLuz();
  const entrenador = yo();
  if (!entrenador || editando) { nodos.panel.replaceChildren(creador(entrenador)); return; }
  if (!datos.temporada && datos.conquistas.length >= REGIONES) { nodos.panel.replaceChildren(pantallaLeyenda()); return; }
  if (!datos.temporada) {
    datos.temporada = crearTemporada(Math.min(datos.region, REGIONES - 1));
    datos.estadisticas.temporadas++;
    guardar();
    pintarMapa();
  }
  const t = datos.temporada;
  if (t.fase === 'equipo') return t.sorteo ? pantallaEquipo(t, v) : pantallaLlegada(t);
  if (t.fase === 'sorteo' || sorteoAnimado) return pantallaSorteo(t, v);
  if (t.fase === 'campeon') return pantallaCampeon(t, v);
  if (t.fase === 'eliminado') return pantallaEliminado(t, v);
  return pantallaCopa(t, v);
}

/** La tira de fases de la copa (Equipo · Sorteo · J1 · J2 · J3 · Cuartos · Semis · Final). */
function fases(t) {
  const pasos = ['Equipo', 'Sorteo', ...RONDAS.map(ronda => ronda.corto)];
  const indice = t.fase === 'equipo' ? 0 : t.fase === 'sorteo' || sorteoAnimado ? 1 : t.fase === 'campeon' ? pasos.length
    : t.fase === 'eliminado' ? 2 + (t.eliminadoEn ?? 0) : 2 + t.ronda;
  return crear('ol', { clase: 'av-fases', atributos: { 'aria-label': 'Fases de la copa' } }, ...pasos.map((paso, i) => crear('li', {
    atributos: { 'data-estado': t.fase === 'eliminado' && i === indice ? 'eliminado' : i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente', ...(i === indice ? { 'aria-current': 'step' } : {}) },
    texto: paso,
  })));
}

/** Cabecera de cada pantalla de la copa: región, copa y la tira de fases. */
function cabecera(t) {
  const r = REGIONES_AVENTURA[t.region];
  return crear('div', { clase: 'av-cabecera' }, // un <div>: base.css le pone a <header> el estilo de la cabecera de la web
    crear('div', {},
      etiqueta(`Región ${romano(t.region)} · ${r.region}${t.intento > 1 ? ` · intento ${t.intento}` : ''}`),
      crear('h3', { clase: 'av-copa-nombre', texto: r.copa })),
    fases(t));
}

// --- Llegada a la región ------------------------------------------------------------------------------

function pantallaLlegada(t) {
  const r = REGIONES_AVENTURA[t.region];
  const nivel = nivelJugador(t);
  const primera = dificultad(t.region, 0); const final = dificultad(t.region, RONDA_FINAL);
  const aviso = crear('p', { clase: 'av-aviso', atributos: { role: 'status' } });
  const sortear = boton('Sortear mi equipo ▸', async () => {
    sortear.disabled = true;
    sortear.textContent = 'Preparando las Poké Balls…';
    try {
      const especies = await cargarEspecies();
      t.sorteo = sortearEquipo(t.region, especies);
      datos.estadisticas.legendarios += [...t.sorteo.sorteados, ...t.sorteo.opciones].filter(id => rarezaDe(id)).length;
      revelando = true;
      guardar();
      pintarPanel();
      pintarMapa();
    } catch (error) {
      sortear.disabled = false;
      sortear.textContent = 'Reintentar el sorteo';
      aviso.textContent = 'No se pudo cargar la Pokédex: ' + (error.message || 'error desconocido');
    }
  });
  const as = r.campeon.as;
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-llegada' },
    crear('div', { clase: 'av-llegada-cartel' },
      crear('div', { clase: 'av-llegada-texto' },
        etiqueta(`Región ${romano(t.region)} de ${REGIONES}${t.intento > 1 ? ` · intento ${t.intento}` : ''}`),
        crear('h3', { clase: 'av-llegada-region', texto: r.region }),
        crear('p', { clase: 'av-llegada-copa', texto: r.copa }),
        dialogo('Locutor', r.lema),
        crear('ul', { clase: 'av-chips' },
          crear('li', {}, crear('b', { texto: `Nv. ${nivel}` }), ' tu equipo', ...(t.intento > 1 ? [crear('small', { texto: ` (+${Math.min(MAX_BONO_INTENTOS, t.intento - 1)})` })] : [])),
          crear('li', {}, crear('b', { texto: `Nv. ${primera.nivel}–${final.nivel}` }), ' los rivales'),
          crear('li', {}, crear('b', { texto: '16' }), ' entrenadores'),
          crear('li', { atributos: { 'data-aviso': String(!primera.ayudas) } }, crear('b', { texto: primera.ayudas ? 'Con' : 'Sin' }), ' ayudas de tipos'))),
      crear('figure', { clase: 'av-llegada-campeon' },
        crear('span', { clase: 'av-foco', atributos: { 'aria-hidden': 'true' } }),
        retratoEntrenador(r.campeon.aspecto, { escala: 5, volteado: true, clase: 'av-sprite' }),
        ...(as ? [crear('img', { clase: 'av-llegada-as', src: urlSprite(as), alt: '' })] : []),
        crear('figcaption', {},
          crear('strong', { texto: tituloCampeon(r) }),
          crear('span', { texto: r.campeon.leyendas ? `${r.campeon.apodo} · combate con seis leyendas` : `${r.campeon.apodo} · te espera en la final` })))),
    crear('div', { clase: 'av-reglas' },
      crear('p', {}, crear('b', { texto: 'Tu equipo: ' }), '5 Pokémon de la región al azar y 1 inicial que eliges entre 3. Cada uno tiene un 1 % de ser legendario. Queda sellado toda la copa; si te eliminan, el próximo intento sorteas otro.'),
      crear('p', {}, crear('b', { texto: 'El formato: ' }), '4 grupos de 4, cuartos, semifinal y final a partido único. Subes un nivel con cada victoria.')),
    crear('div', { clase: 'av-acciones' }, aviso, sortear)));
}

// --- Sorteo de tu equipo -------------------------------------------------------------------------------

async function pantallaEquipo(t, v) {
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla' }, cabecera(t), crear('p', { clase: 'av-cargando', texto: 'Abriendo las Poké Balls…' })));
  let detalles;
  try {
    detalles = await Promise.all([...t.sorteo.sorteados, ...t.sorteo.opciones].map(id => detallesDe(id)));
  } catch (error) {
    if (v !== version) return;
    nodos.panel.querySelector('.av-cargando').textContent = 'No se pudieron cargar tus Pokémon: ' + (error.message || 'error desconocido');
    nodos.panel.querySelector('.av-pantalla').append(boton('Reintentar', () => pintarPanel()));
    return;
  }
  if (v !== version) return;
  const animar = revelando && !movimientoReducido.matches;
  revelando = false;
  const sorteados = detalles.slice(0, 5);
  const opciones = detalles.slice(5);
  let elegida = null;
  const sellar = boton('Sellar mi equipo 🔒', () => {
    if (elegida == null) return;
    t.equipo = [...t.sorteo.sorteados, elegida];
    t.fase = 'sorteo';
    guardar();
    pintarPanel();
    pintarMapa();
  }, 'principal', { disabled: true });
  const botonesInicial = opciones.map((d, i) => {
    const b = crear('button', {
      type: 'button', clase: 'av-carta opcion', atributos: { 'aria-pressed': 'false', ...(rarezaDe(d.especie) ? { 'data-rareza': rarezaDe(d.especie) } : {}) },
      estilos: { '--i': 5 + i, '--color-a': colorTipo(d.tipos[0]), '--color-b': colorTipo(d.tipos[1] || d.tipos[0]) },
      alPulsar: () => {
        elegida = d.id;
        botonesInicial.forEach(otro => otro.setAttribute('aria-pressed', String(otro === b)));
        sellar.disabled = false;
        sellar.textContent = `Sellar con ${nombreTitulo(d.nombre)} 🔒`;
      },
    }, ...contenidoCarta(d));
    return b;
  });
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-equipo' + (animar ? ' animado' : '') },
    cabecera(t),
    crear('div', { clase: 'av-bloque' },
      titulo('Tu equipo, ', 'al azar'),
      crear('p', { texto: 'Cinco Pokémon de la región salen de sus Poké Balls.' })),
    crear('div', { clase: 'av-cartas' }, ...sorteados.map((d, i) => crear('div', {
      clase: 'av-carta', atributos: rarezaDe(d.especie) ? { 'data-rareza': rarezaDe(d.especie) } : {},
      estilos: { '--i': i, '--color-a': colorTipo(d.tipos[0]), '--color-b': colorTipo(d.tipos[1] || d.tipos[0]) },
    }, ...contenidoCarta(d)))),
    crear('div', { clase: 'av-bloque' },
      titulo('Elige a tu ', 'inicial'),
      crear('p', { texto: 'Solo uno de estos tres se une a ti. Piensa en los tipos que te faltan.' })),
    crear('div', { clase: 'av-cartas opciones' }, ...botonesInicial),
    crear('div', { clase: 'av-acciones' }, crear('p', { clase: 'av-aviso', texto: 'Sellado hasta el final de la copa.' }), sellar)));
}

function contenidoCarta(d) {
  const rareza = rarezaDe(d.especie);
  return [
    crear('span', { clase: 'av-carta-ball', atributos: { 'aria-hidden': 'true' } }),
    crear('img', { clase: 'av-carta-arte', src: d.imagen, alt: '' }),
    ...(rareza ? [crear('span', { clase: 'av-carta-sello', texto: rareza === 'legendario' ? '¡Legendario!' : '¡Singular!' })] : []),
    crear('strong', { texto: nombreTitulo(d.nombre) }),
    crear('span', { clase: 'av-carta-tipos' }, ...d.tipos.map(chipTipo)),
    crear('small', { texto: `Poder ${d.poder}` }),
  ];
}

// --- Sorteo de grupos ----------------------------------------------------------------------------------

function pantallaSorteo(t, v) {
  const porBombo = b => t.participantes.filter(p => p.bombo === b);
  const ficha = p => crear('span', { clase: 'av-sorteo-ficha' + (p.clave === 'tu' ? ' es-tuyo' : '') + (p.rol === 'campeon' ? ' es-campeon' : '') + (p.rol === 'rival' ? ' es-rival' : '') },
    retratoEntrenador(aspectoDe(t, p.clave), { escala: 1, clase: 'av-sorteo-retrato' }),
    crear('span', { texto: nombreCorto(t, p.clave) }),
    ...(p.tipo ? [crear('i', { estilos: { '--color-tipo': colorTipo(p.tipo) }, title: TIPOS[p.tipo].nombre })] : []));
  if (!t.grupos) { // antes del sorteo: los cuatro bombos
    const empezar = boton('¡Que empiece el sorteo! ▸', () => {
      sortearGrupos(t);
      sorteoAnimado = true;
      guardar();
      pintarPanel();
      pintarMapa();
    });
    nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-sorteo' },
      cabecera(t),
      crear('div', { clase: 'av-bloque' },
        titulo('Cuatro bombos, ', 'cuatro grupos'),
        dialogo('Organización', `Un entrenador de cada bombo en cada grupo. Tú sales del bombo 4. Kael caerá en tu grupo, y ${REGIONES_AVENTURA[t.region].campeon.genero === 'f' ? 'la' : 'el'} ${tituloCampeon(REGIONES_AVENTURA[t.region])}, en la otra mitad del cuadro.`)),
      crear('div', { clase: 'av-bombos' }, ...[1, 2, 3, 4].map(b => crear('div', { clase: 'av-bombo' },
        crear('span', { clase: 'av-bombo-nombre', texto: `Bombo ${b}` }),
        ...porBombo(b).map(ficha)))),
      crear('div', { clase: 'av-acciones' }, crear('span'), empezar)));
    return;
  }
  // El sorteo bola a bola (o ya hecho, si se vuelve a pintar).
  const cajas = GRUPOS.map((letra, g) => crear('div', { clase: 'av-grupo-caja' + (t.grupos[g].includes('tu') ? ' es-tuyo' : '') },
    crear('span', { clase: 'av-bombo-nombre', texto: `Grupo ${letra}` }),
    crear('div', { clase: 'av-grupo-huecos' })));
  const seguir = boton('Ir a la fase de grupos ▸', () => { sorteoAnimado = false; pintarPanel(); pintarMapa(); }, 'principal', { disabled: true });
  let terminado = !sorteoAnimado || movimientoReducido.matches;
  const saltar = boton('Ver el resultado', () => { terminado = true; }, 'secundario');
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-sorteo' },
    cabecera(t),
    crear('div', { clase: 'av-bloque' }, titulo('Así quedan ', 'los grupos')),
    crear('div', { clase: 'av-grupos' }, ...cajas),
    crear('div', { clase: 'av-acciones' }, saltar, seguir)));
  (async () => {
    for (const { clave, grupo } of t.ordenSorteo) {
      const p = participante(t, clave);
      const nueva = ficha(p);
      if (!terminado) nueva.classList.add('sale');
      cajas[grupo].querySelector('.av-grupo-huecos').append(nueva);
      if (!terminado) await esperar(clave === 'tu' || p.rol ? 520 : 240);
      if (v !== version) return;
    }
    sorteoAnimado = false;
    saltar.hidden = true;
    seguir.disabled = false;
    seguir.focus({ preventScroll: true });
  })();
}

// --- La copa: la previa del combate y, debajo, tu grupo, el cuadro y tu equipo ------------------------------------

function pantallaCopa(t, v) {
  const partido = partidoDelJugador(t);
  const enGrupos = t.ronda < RONDA_CUARTOS;
  if (!pestana || (pestana === 'grupo' && !enGrupos)) pestana = enGrupos ? 'grupo' : 'cuadro';
  const contenido = crear('div', { clase: 'av-pestana-contenido', atributos: { role: 'tabpanel' } });
  const pestanas = [['grupo', enGrupos ? `Grupo ${GRUPOS[grupoDelJugador(t)]}` : 'Grupos'], ['cuadro', 'Cuadro'], ['equipo', 'Tu equipo']];
  const botones = pestanas.map(([clave, texto]) => crear('button', {
    type: 'button', clase: 'av-pestana', texto, atributos: { role: 'tab', 'aria-selected': String(pestana === clave) },
    alPulsar: () => { pestana = clave; botones.forEach((b, k) => b.setAttribute('aria-selected', String(pestanas[k][0] === clave))); llenar(); },
  }));
  const llenar = () => {
    const g = grupoDelJugador(t);
    if (pestana === 'grupo') {
      contenido.replaceChildren(
        crear('div', { clase: 'av-grupo-vista' }, tablaGrupo(t, g), resultadosGrupo(t, g)),
        crear('details', { clase: 'av-otros' },
          crear('summary', { texto: enGrupos ? 'Los otros grupos' : 'Cómo acabaron los grupos' }),
          crear('div', { clase: 'av-otros-tablas' }, ...GRUPOS.map((_, i) => i).filter(i => !enGrupos || i !== g).map(i => tablaGrupo(t, i)))));
    } else if (pestana === 'cuadro') contenido.replaceChildren(cuadro(t));
    else contenido.replaceChildren(equipoSellado(t, v));
  };
  llenar();
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-copa' + (t.ronda === RONDA_FINAL ? ' es-final' : '') },
    cabecera(t),
    ...(ultimo ? [cartelResultado(ultimo)] : []),
    partido ? cartaPartido(t, partido, v) : crear('p', { clase: 'av-aviso', texto: 'Esperando al resto de partidos…' }),
    crear('div', { clase: 'av-pestanas', atributos: { role: 'tablist', 'aria-label': 'La copa' } }, ...botones),
    contenido));
}

function cartelResultado(r) {
  return crear('div', { clase: 'av-resultado', atributos: { 'data-resultado': r.victoria ? 'victoria' : 'derrota', role: 'status' } },
    crear('strong', { texto: r.victoria ? '¡Victoria!' : 'Derrota' }),
    crear('span', { clase: 'av-marcador', texto: r.marcador }),
    crear('span', { texto: `${r.ronda} contra ${r.rival}` }),
    ...(r.victoria ? [crear('em', { texto: `Tu equipo sube a Nv. ${r.nivel}` })] : []),
    ...(r.mvp ? [crear('small', {}, crear('img', { src: urlSprite(r.mvp.id), alt: '' }), `El mejor: ${nombreTitulo(r.mvp.nombre)} (${r.mvp.kos} K.O.)`)] : []));
}

/** La previa: los dos entrenadores sobre la arena del partido, lo que dice el rival y las siluetas de su equipo. */
function cartaPartido(t, partido, v) {
  const r = REGIONES_AVENTURA[t.region];
  const rival = rivalDe(t, partido);
  const dif = dificultad(t.region, t.ronda);
  const nivel = nivelJugador(t);
  const final = t.ronda === RONDA_FINAL;
  const escenario = escenarioDe(t, partido);
  const entrenador = yo();
  const siluetas = crear('div', { clase: 'av-siluetas', atributos: { 'aria-label': 'El equipo rival (en silueta)' } },
    ...Array.from({ length: 6 }, () => crear('span', { clase: 'av-hueco' })));
  const completa = crear('input', { type: 'checkbox', checked: datos.ajustes.pantallaCompleta });
  completa.addEventListener('change', () => { datos.ajustes.pantallaCompleta = completa.checked; guardar(); });
  const jugar = boton('Preparando al rival…', null, 'principal grande', { disabled: true });
  const diferencia = dif.nivel - nivel;
  const prepararlo = () => prepararRival(t, partido).then(async ids => {
    const suyos = await Promise.all(ids.map(id => detallesDe(id)));
    if (v !== version) return;
    siluetas.replaceChildren(...suyos.map(d => fichaPokemon(d, { silueta: true, clase: 'av-silueta' })));
    jugar.disabled = false;
    jugar.textContent = final ? '¡A por la copa!' : '¡Al combate!';
    jugar.onclick = () => lanzarCombate(t, partido, ids, completa.checked);
  }).catch(error => {
    if (v !== version) return;
    jugar.disabled = false;
    jugar.textContent = 'Reintentar';
    jugar.title = error.message || '';
    jugar.onclick = () => { jugar.disabled = true; jugar.textContent = 'Preparando al rival…'; prepararlo(); };
  });
  prepararlo();
  const fondo = fondoDe(escenario, t.region);
  const lado = (aspecto, nombre, detalle, suyo) => crear('div', { clase: 'av-previa-lado' + (suyo ? ' suyo' : '') },
    crear('span', { clase: 'av-plataforma', atributos: { 'aria-hidden': 'true' } }),
    retratoEntrenador(aspecto, { escala: 4, volteado: suyo, clase: 'av-sprite' }),
    crear('strong', { texto: nombre }),
    detalle);
  return crear('article', { clase: 'av-previa' + (final ? ' es-final' : '') + (escenario === 'estadio' ? ' en-estadio' : ''), atributos: { 'aria-label': `Tu próximo combate: ${RONDAS[t.ronda].nombre}` } },
    fondo,
    crear('div', { clase: 'av-previa-ronda' },
      crear('span', { texto: RONDAS[t.ronda].nombre + (partido.grupo != null ? ` · Grupo ${GRUPOS[partido.grupo]}` : '') }),
      crear('span', { texto: nombreArena(t, escenario) })),
    ...(final ? [crear('div', { clase: 'av-previa-copa', atributos: { 'aria-hidden': 'true' } }, trofeo(r.colores))] : []),
    crear('div', { clase: 'av-previa-duelo' },
      lado(entrenador.aspecto, entrenador.nombre, crear('small', { texto: `Nv. ${nivel}` }), false),
      crear('span', { clase: 'av-vs', texto: 'VS' }),
      lado(rival.aspecto, nombreCompleto(rival).replace(/^(el|la) /, ''), crear('small', {},
        `Nv. ${dif.nivel}`, ...(rival.tipo ? [' · ', chipTipo(rival.tipo)] : []), ...(rival.rol === 'rival' ? [' · tu rival'] : [])), true)),
    dialogo(rival.titulo, alAzar(frasesDe(t, rival).inicio), 'rival'),
    crear('div', { clase: 'av-previa-pie' },
      siluetas,
      crear('ul', { clase: 'av-chips' },
        crear('li', {}, crear('b', { texto: NOMBRE_ESTRATEGIA[dif.estrategia] }), ' ', '★'.repeat(NIVELES_SIMULACRO[dif.estrategia].estrellas)),
        crear('li', { atributos: { 'data-aviso': String(diferencia > 0) } }, diferencia > 0 ? `Te saca ${diferencia} ${diferencia === 1 ? 'nivel' : 'niveles'}` : diferencia < 0 ? `Le sacas ${-diferencia} ${diferencia === -1 ? 'nivel' : 'niveles'}` : 'Mismo nivel'),
        crear('li', {}, dif.ayudas ? 'Con ayudas de tipos' : 'Sin ayudas de tipos'),
        ...(dif.leyendas ? [crear('li', { atributos: { 'data-aviso': 'true' } }, dif.leyendas === 1 ? 'Lleva una leyenda' : `${dif.leyendas} leyendas`)] : [])),
      crear('div', { clase: 'av-previa-acciones' },
        crear('label', { clase: 'av-interruptor' }, completa, crear('span', { texto: 'Pantalla completa' })),
        jugar)));
}

const fondos = new Map();
/** La arena del partido en pixel art, de fondo de la previa (el estadio, con los colores de la región). */
function fondoDe(escenario, region) {
  const clave = escenario === 'estadio' ? 'estadio-' + region : escenario;
  if (!fondos.has(clave)) fondos.set(clave, escenario === 'estadio' ? dibujarFondo('estadio', { colores: REGIONES_AVENTURA[region].colores }) : dibujarVistaPrevia(escenario));
  const lienzo = document.createElement('canvas');
  lienzo.width = 480; lienzo.height = 270;
  lienzo.getContext('2d').drawImage(fondos.get(clave), 0, 0);
  lienzo.className = 'av-previa-fondo';
  lienzo.setAttribute('aria-hidden', 'true');
  return lienzo;
}

/** El equipo del rival de esta ronda: se decide una vez (liga.js) y se guarda en la temporada. */
async function prepararRival(t, partido) {
  const rival = rivalDe(t, partido);
  const ronda = t.ronda;
  if (rival.equipo && rival.rondaEquipo === ronda) return rival.equipo;
  const clave = `${t.semilla}-${t.intento}-${rival.clave}-${ronda}`;
  if (!equiposEnCurso.has(clave)) {
    equiposEnCurso.set(clave, (async () => {
      const especies = await cargarEspecies();
      const azar = azarDe(t.semilla + ronda * 31 + rival.bombo * 7 + t.intento * 101);
      const plan = planEquipoRival(t, rival, ronda, especies, azar);
      const [tuyos, candidatos] = await Promise.all([
        Promise.all(t.equipo.map(id => detallesDe(id))),
        Promise.allSettled(plan.candidatos.map(id => detallesDe(id))).then(lista => lista.flatMap(x => (x.status === 'fulfilled' ? [x.value] : []))),
      ]);
      const dif = dificultad(t.region, ronda);
      return completarEquipoRival(plan.fijos, candidatos,
        { objetivo: objetivoRival(t, ronda, poderReferencia(tuyos)), tipo: rival.tipo, contra: tuyos, peso: dif.contra }, azar);
    })().catch(error => { equiposEnCurso.delete(clave); throw error; }));
  }
  const ids = await equiposEnCurso.get(clave);
  if (datos.temporada === t) {
    rival.equipo = ids;
    rival.rondaEquipo = ronda;
    guardar();
  }
  return ids;
}

/** «¡Al combate!»: se llama dentro del clic (así el navegador deja la pantalla completa y el sonido). */
function lanzarCombate(t, partido, ids, pantallaCompleta) {
  const r = REGIONES_AVENTURA[t.region];
  const rival = rivalDe(t, partido);
  const dif = dificultad(t.region, t.ronda);
  const escenario = escenarioDe(t, partido);
  const ronda = RONDAS[t.ronda].nombre + (partido.grupo != null ? ` · Grupo ${GRUPOS[partido.grupo]}` : '');
  empezarCombate({
    modo: 'equipo', nivel: dif.estrategia, escenario, pantallaCompleta,
    aventura: {
      copa: r.copa, ronda, final: t.ronda === RONDA_FINAL, enEstadio: escenario === 'estadio', estadio: r.estadio,
      colores: r.colores, ayudas: dif.ayudas,
      jugador: { ids: t.equipo, nivel: nivelJugador(t) },
      rival: { ids, nivel: dif.nivel, nombre: rival.nombre, titulo: rival.titulo, articulo: rival.articulo, aspecto: rival.aspecto, frases: clavesFrases(t, rival) },
      alTerminar: resultado => alTerminarCombate(t, rival, ronda, resultado),
    },
  });
}

/** El combate terminó: la liga apunta el resultado, se simulan los demás y se pinta lo nuevo. */
function alTerminarCombate(t, rival, ronda, resultado) {
  if (datos.temporada !== t || !partidoDelJugador(t)) return;
  registrarCombate(t, resultado);
  const e = datos.estadisticas;
  e.combates++;
  if (resultado.victoria) e.victorias++; else e.derrotas++;
  ultimo = {
    victoria: resultado.victoria, rival: nombreCompleto(rival), ronda, nivel: nivelJugador(t),
    marcador: `${resultado.kosHechos}–${resultado.kosRecibidos}`, mvp: resultado.mvp,
  };
  const gano = t.fase === 'campeon' && !conquistada(t.region);
  if (gano) {
    datos.conquistas.push({ region: t.region, equipo: [...t.equipo], fecha: Date.now(), intento: t.intento, rival: nombreCompleto(rival), marcador: ultimo.marcador });
    datos.region = Math.max(datos.region, t.region + 1);
  }
  guardar();
  pintarTodo();
  if (gano) mapa.celebrar();
}

/** Tabla de un grupo: posición, entrenador, combates, victorias, derrotas, K.O. y puntos. */
function tablaGrupo(t, g) {
  const filas = clasificacion(t, g);
  const terminado = t.ronda >= RONDA_CUARTOS;
  return crear('table', { clase: 'av-tabla' },
    crear('caption', {}, `Grupo ${GRUPOS[g]} `, crear('small', { texto: terminado ? '· clasificación final' : `· tras la jornada ${Math.min(3, t.ronda)}` })),
    crear('thead', {}, crear('tr', {}, ...['', 'Entrenador', 'PJ', 'G', 'P', 'K.O.', 'Pts'].map((texto, i) => crear('th', { texto, atributos: { scope: 'col', ...(i === 5 ? { title: 'Pokémon que dejó K.O. menos los que perdió' } : {}) } })))),
    crear('tbody', {}, ...filas.map((f, i) => {
      const diferencia = f.kf - f.kc;
      return crear('tr', { clase: (f.clave === 'tu' ? 'es-tuyo ' : '') + (i < 2 ? 'pasa' : ''), atributos: participante(t, f.clave).rol === 'campeon' ? { 'data-rol': 'campeon' } : {} },
        crear('td', { clase: 'pos', texto: String(i + 1) }),
        crear('th', { atributos: { scope: 'row' } }, crear('span', { clase: 'av-quien' }, retratoEntrenador(aspectoDe(t, f.clave), { escala: 1, clase: 'av-retrato-mini' }), nombreCorto(t, f.clave))),
        crear('td', { texto: String(f.pj) }), crear('td', { texto: String(f.g) }), crear('td', { texto: String(f.p) }),
        crear('td', { texto: diferencia > 0 ? `+${diferencia}` : String(diferencia) }),
        crear('td', { clase: 'pts', texto: String(f.pts) }));
    })));
}

/** Los resultados de un grupo, jornada a jornada. */
function resultadosGrupo(t, g) {
  const jugados = t.partidos.filter(p => p.grupo === g && p.resultado);
  if (!jugados.length) return crear('p', { clase: 'av-nota', texto: 'Pasan a cuartos los dos primeros de cada grupo. 3 puntos por victoria; los K.O. son los goles.' });
  return crear('ol', { clase: 'av-resultados' }, ...jugados.map(p => crear('li', { clase: [p.local, p.visitante].includes('tu') ? 'es-tuyo' : '' },
    crear('small', { texto: RONDAS[p.ronda].corto }),
    crear('span', { clase: p.resultado.ganador === p.local ? 'gana' : '', texto: nombreCorto(t, p.local) }),
    crear('b', { texto: `${p.resultado.local}–${p.resultado.visitante}` }),
    crear('span', { clase: p.resultado.ganador === p.visitante ? 'gana' : '', texto: nombreCorto(t, p.visitante) }))));
}

/** El cuadro de eliminatorias: cuartos, semifinal y final, con tu camino resaltado. */
function cuadro(t) {
  const columnas = [[RONDA_CUARTOS, 4], [RONDA_CUARTOS + 1, 2], [RONDA_FINAL, 1]].map(([ronda, cuantos]) => {
    const partidos = Array.from({ length: cuantos }, (_, llave) => t.partidos.find(p => p.ronda === ronda && p.llave === llave) || null);
    return crear('div', { clase: 'av-cuadro-ronda', atributos: { 'data-ronda': ronda } },
      crear('span', { clase: 'av-cuadro-titulo', texto: RONDAS[ronda].corto }),
      ...partidos.map(p => crear('div', { clase: 'av-cuadro-partido' + (p && [p.local, p.visitante].includes('tu') ? ' es-tuyo' : '') },
        ...(p ? [p.local, p.visitante] : [null, null]).map((clave, lado) => crear('div', {
          clase: 'av-cuadro-fila' + (p?.resultado?.ganador === clave && clave ? ' gana' : '') + (p?.resultado && p.resultado.ganador !== clave ? ' cae' : '') + (clave === 'tu' ? ' es-tuyo' : ''),
        },
        ...(clave ? [retratoEntrenador(aspectoDe(t, clave), { escala: 1, clase: 'av-retrato-mini' })] : []),
        crear('span', { texto: clave ? nombreCorto(t, clave) : 'Por decidir' }),
        crear('b', { texto: p?.resultado ? String(lado ? p.resultado.visitante : p.resultado.local) : '' }))))));
  });
  return crear('div', { clase: 'av-cuadro' }, ...columnas,
    crear('div', { clase: 'av-cuadro-copa', atributos: { 'aria-hidden': 'true' } }, trofeo(REGIONES_AVENTURA[t.region].colores)));
}

/** Tu equipo sellado, con su nivel actual. */
function equipoSellado(t, v) {
  const fila = crear('div', { clase: 'av-equipo-fila' }, ...t.equipo.map(() => crear('span', { clase: 'av-mini vacio' })));
  Promise.all(t.equipo.map(id => detallesDe(id))).then(detalles => {
    if (v !== version) return;
    fila.replaceChildren(...detalles.map(d => fichaPokemon(d, { nivel: nivelJugador(t) })));
  }).catch(() => {});
  return crear('div', { clase: 'av-equipo-sellado' },
    crear('p', { clase: 'av-nota', texto: `🔒 Sellado hasta el final de la copa · Nv. ${nivelJugador(t)} · ${t.victorias} ${t.victorias === 1 ? 'victoria' : 'victorias'} y ${t.derrotas} ${t.derrotas === 1 ? 'derrota' : 'derrotas'} esta temporada` }),
    fila);
}

// --- Campeón, eliminado y leyenda ---------------------------------------------------------------------------

function pantallaCampeon(t, v) {
  const r = REGIONES_AVENTURA[t.region];
  const entrenador = yo();
  const ultima = t.region >= REGIONES - 1;
  const siguiente = REGIONES_AVENTURA[t.region + 1];
  const fila = crear('div', { clase: 'av-equipo-fila' });
  Promise.all(t.equipo.map(id => detallesDe(id))).then(d => { if (v === version) fila.replaceChildren(...d.map(x => fichaPokemon(x))); }).catch(() => {});
  const viajar = boton(ultima ? 'Ver el Salón de la Fama ▾' : `Viajar a ${siguiente.region} ▸`, async () => {
    if (viajando) return;
    datos.temporada = null;
    ultimo = null;
    guardar();
    if (ultima) { pintarTodo(); nodos.vitrina.scrollIntoView({ behavior: 'smooth' }); return; }
    viajando = true;
    viajar.disabled = true;
    nodos.lienzo.scrollIntoView({ behavior: movimientoReducido.matches ? 'instant' : 'smooth', block: 'center' });
    await esperar(500);
    const marco = nodos.marco;
    if (marco && marco.scrollWidth > marco.clientWidth) marco.scrollTo({ left: Math.max(0, (ISLAS[t.region + 1].x / ANCHO_MAPA) * marco.scrollWidth - marco.clientWidth / 2), behavior: 'smooth' });
    await mapa.viajar(t.region, t.region + 1);
    viajando = false;
    pintarTodo();
    await esperar(300);
    irAlPanel();
  });
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-campeon', estilos: { '--trofeo-a': r.colores[0], '--trofeo-b': r.colores[1] } },
    crear('div', { clase: 'av-confeti', atributos: { 'aria-hidden': 'true' } }, ...Array.from({ length: 32 }, (_, i) => crear('i', {
      estilos: { '--i': i, '--x': `${Math.random() * 98}%`, '--retraso': `${-Math.random() * 4}s`, '--dura': `${2.8 + Math.random() * 2.4}s` },
    }))),
    crear('div', { clase: 'av-campeon-escena' },
      crear('span', { clase: 'av-foco', atributos: { 'aria-hidden': 'true' } }),
      trofeo(r.colores, 'grande'),
      retratoEntrenador(entrenador.aspecto, { escala: 6, pose: 'celebra', clase: 'av-sprite' })),
    etiqueta(`Región ${romano(t.region)} · ${r.region}`),
    crear('h3', { clase: 'av-campeon-titulo' }, ultima ? '¡Eres leyenda!' : '¡Campeón!'),
    crear('p', { clase: 'av-campeon-copa', texto: ultima ? 'Las nueve copas son tuyas' : r.copa }),
    dialogo('Locutor', ultima
      ? `¡${entrenador.nombre} ha vencido a Geeta y a sus seis leyendas! Su nombre queda grabado para siempre en el Salón de la Fama.`
      : `¡${entrenador.nombre} gana la ${r.copa}! ${t.victorias} victorias y ${t.derrotas} ${t.derrotas === 1 ? 'derrota' : 'derrotas'}${t.intento > 1 ? `, al ${t.intento}.º intento` : ''}. ${siguiente.region} le espera… y allí todo es más difícil.`),
    fila,
    crear('div', { clase: 'av-acciones' }, crear('span'), viajar)));
}

function pantallaEliminado(t) {
  const r = REGIONES_AVENTURA[t.region];
  const ronda = RONDAS[t.eliminadoEn ?? 0];
  const verdugo = t.partidos.find(p => p.ronda === t.eliminadoEn && [p.local, p.visitante].includes('tu'));
  const quien = verdugo && verdugo.resultado.ganador !== 'tu' ? participante(t, verdugo.resultado.ganador) : null;
  const campeon = ganadorCopa(t);
  const bono = Math.min(MAX_BONO_INTENTOS, t.intento);
  nodos.panel.replaceChildren(crear('div', { clase: 'av-pantalla av-eliminado' },
    cabecera(t),
    crear('div', { clase: 'av-eliminado-cuerpo' },
      crear('div', { clase: 'av-eliminado-escena' },
        retratoEntrenador(yo().aspecto, { escala: 5, pose: 'triste', clase: 'av-sprite' }),
        ...(quien ? [retratoEntrenador(quien.aspecto, { escala: 5, volteado: true, pose: 'celebra', clase: 'av-sprite' })] : [])),
      crear('div', {},
        etiqueta(ronda.fase === 'grupos' ? 'Fuera en la fase de grupos' : `Fuera en ${ronda.nombre.toLowerCase()}`),
        titulo('Fin del camino… ', 'por ahora'),
        crear('p', { texto: [
          quien && ronda.fase !== 'grupos' ? `${mayuscula(nombreCompleto(quien))} te dejó fuera.` : 'No te alcanzó para ser de los dos primeros del grupo.',
          campeon ? `La ${r.copa} la ganó ${campeon === 'tu' ? 'tu equipo' : nombreCompleto(participante(t, campeon))}.` : '',
        ].filter(Boolean).join(' ') }),
        crear('p', { clase: 'av-nota', texto: `Tu equipo se despide. En la próxima temporada sortearás otro al azar${t.intento <= MAX_BONO_INTENTOS ? `, y la experiencia de tus intentos le da +${bono} ${bono === 1 ? 'nivel' : 'niveles'}` : ` (con los +${MAX_BONO_INTENTOS} niveles de experiencia)`}.` }))),
    cuadro(t),
    crear('div', { clase: 'av-acciones' },
      crear('span'),
      boton('Nueva temporada con otro equipo ▸', () => {
        datos.temporada = crearTemporada(t.region, { intento: t.intento + 1 });
        datos.estadisticas.temporadas++;
        ultimo = null;
        pestana = null;
        guardar();
        pintarTodo();
        irAlPanel();
      }))));
}

function pantallaLeyenda() {
  const entrenador = yo();
  return crear('div', { clase: 'av-pantalla av-campeon leyenda' },
    crear('div', { clase: 'av-campeon-escena' }, crear('span', { clase: 'av-foco', atributos: { 'aria-hidden': 'true' } }), retratoEntrenador(entrenador.aspecto, { escala: 6, pose: 'celebra', clase: 'av-sprite' })),
    etiqueta('Nueve de nueve'),
    crear('h3', { clase: 'av-campeon-titulo' }, `${entrenador.nombre}, leyenda`),
    crear('p', { texto: 'Ganaste las nueve copas, de la Meseta Añil al Área Cero. Tus equipos campeones están en el Salón de la Fama.' }),
    crear('div', { clase: 'av-acciones' }, crear('span'),
      boton('Empezar otra aventura', () => {
        if (!confirm('¿Empezar de cero? Se borrarán tus copas y tus cifras de la aventura (tu entrenador se queda).')) return;
        datos = vacio();
        ultimo = null;
        guardar();
        pintarTodo();
      }, 'secundario')));
}

// --- Salón de la fama --------------------------------------------------------------------------------------

function pintarVitrina() {
  nodos.vitrina.replaceChildren(...REGIONES_AVENTURA.map((r, i) => {
    const copa = datos.conquistas.find(c => c.region === i);
    const hueco = crear('article', { clase: 'av-vitrina-copa' + (copa ? ' ganada' : ''), estilos: { '--trofeo-a': r.colores[0], '--trofeo-b': r.colores[1] } },
      trofeo(copa ? r.colores : ['#3a4466', '#2a3350']),
      crear('strong', { texto: r.copa }),
      crear('small', { texto: copa ? `${r.region} · ${new Date(copa.fecha).toLocaleDateString('es')}${copa.intento > 1 ? ` · intento ${copa.intento}` : ''}` : `${r.region} · por ganar` }));
    if (copa) {
      const fila = crear('div', { clase: 'av-vitrina-equipo' });
      hueco.append(fila);
      Promise.all(copa.equipo.map(id => detallesDe(id))).then(d => fila.replaceChildren(...d.map(x => crear('img', { src: x.sprite || x.imagen, alt: nombreTitulo(x.nombre), title: nombreTitulo(x.nombre), loading: 'lazy' })))).catch(() => {});
    }
    return hueco;
  }));
}

// --- Creador de entrenador --------------------------------------------------------------------------------

function creador(guardado) {
  const estado = { nombre: guardado?.nombre || '', aspecto: { ...(guardado?.aspecto || ASPECTO_INICIAL) } };
  const ESCALA = 7;
  const vista = retratoEntrenador(estado.aspecto, { escala: ESCALA, clase: 'av-creador-sprite' });
  let pose = 'quieto';
  let ocupado = false;
  // Respira mientras el creador está en pantalla.
  let paso = 0;
  const reloj = setInterval(() => {
    if (!vista.isConnected) { clearInterval(reloj); return; }
    if (ocupado) return;
    paso++;
    pintarRetrato(vista, estado.aspecto, { escala: ESCALA, pose, dy: pose === 'quieto' && !movimientoReducido.matches ? paso % 2 : 0 });
  }, 650);
  const repintar = () => {
    pintarRetrato(vista, estado.aspecto, { escala: ESCALA, pose });
    grupos.forEach(g => g.actualizar());
  };
  const probar = async () => {
    if (ocupado) return;
    ocupado = true;
    for (const [p, ms, k] of [['paso', 160, 0], ['paso', 160, 1], ['paso', 160, 0], ['paso', 160, 1], ['lanza1', 360], ['lanza2', 520], ['ordena', 520], ['celebra', 800], ['quieto', 0]]) {
      pose = p;
      pintarRetrato(vista, estado.aspecto, { escala: ESCALA, pose, paso: k || 0 });
      if (ms) await esperar(ms);
    }
    ocupado = false;
  };
  const { gorras, chaquetas, pantalones, peinados, colores, pieles, pelos } = ASPECTO_ENTRENADOR;
  /** Opciones con dibujo: cada botón enseña a tu entrenador con esa pieza. */
  const piezas = (clave, opciones) => {
    const botones = Object.entries(opciones).map(([valor, nombre]) => {
      const mini = retratoEntrenador({ ...estado.aspecto, [clave]: valor }, { escala: 2, clase: 'av-opcion-sprite' });
      const b = crear('button', { type: 'button', clase: 'av-opcion', atributos: { 'data-valor': valor }, alPulsar: () => { estado.aspecto[clave] = valor; repintar(); } },
        mini, crear('span', { texto: nombre }));
      b.mini = mini;
      return b;
    });
    const caja = crear('div', { clase: 'av-opciones' }, ...botones);
    caja.actualizar = () => botones.forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.valor === estado.aspecto[clave]));
      pintarRetrato(b.mini, { ...estado.aspecto, [clave]: b.dataset.valor }, { escala: 2 });
    });
    return caja;
  };
  const muestras = (titulo, clave, lista) => {
    const botones = lista.map(([valor, nombre]) => crear('button', {
      type: 'button', clase: 'av-color', title: nombre, atributos: { 'aria-label': `${titulo}: ${nombre}`, 'data-valor': valor },
      estilos: { '--muestra': valor }, alPulsar: () => { estado.aspecto[clave] = valor; repintar(); },
    }));
    const caja = crear('fieldset', { clase: 'av-colores' }, crear('legend', { texto: titulo }), crear('div', {}, ...botones));
    caja.actualizar = () => botones.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === estado.aspecto[clave])));
    return caja;
  };
  const paginas = {
    gorra: piezas('gorra', gorras),
    chaqueta: piezas('chaqueta', chaquetas),
    pantalon: piezas('pantalon', pantalones),
    peinado: piezas('peinado', peinados),
    colores: crear('div', { clase: 'av-paleta' },
      muestras('Gorra y zapatillas', 'colorGorra', colores.map(([n, c]) => [c, n])),
      muestras('Chaqueta', 'colorChaqueta', colores.map(([n, c]) => [c, n])),
      muestras('Pantalón', 'colorPantalon', colores.map(([n, c]) => [c, n])),
      muestras('Pelo', 'pelo', pelos.map(([n, c]) => [c, n])),
      muestras('Piel', 'piel', pieles.map((c, i) => [c, `Tono ${i + 1}`]))),
  };
  paginas.colores.actualizar = () => [...paginas.colores.children].forEach(c => c.actualizar());
  const grupos = Object.values(paginas);
  let abierta = 'gorra';
  const hoja = crear('div', { clase: 'av-creador-hoja', atributos: { role: 'tabpanel' } }, paginas.gorra);
  const NOMBRES = { gorra: 'Gorra', chaqueta: 'Chaqueta', pantalon: 'Pantalón', peinado: 'Peinado', colores: 'Colores' };
  const lenguetas = Object.keys(paginas).map(clave => crear('button', {
    type: 'button', clase: 'av-pestana', texto: NOMBRES[clave], atributos: { role: 'tab', 'aria-selected': String(clave === abierta) },
    alPulsar: () => { abierta = clave; hoja.replaceChildren(paginas[clave]); lenguetas.forEach(l => l.setAttribute('aria-selected', String(l.textContent === NOMBRES[clave]))); },
  }));
  const nombre = crear('input', { type: 'text', value: estado.nombre, maxLength: MAX_NOMBRE, placeholder: 'Tu nombre', autocomplete: 'off', atributos: { 'aria-label': 'Nombre de tu entrenador' } });
  const listo = boton('¡Listo! ▸', () => {
    estado.nombre = nombre.value.trim();
    if (!estado.nombre) { nombre.focus(); return; }
    guardarEntrenador(estado);
    editando = false;
    pintarTodo();
    irAlPanel();
  }, 'principal', { disabled: !estado.nombre.trim() });
  nombre.addEventListener('input', () => { listo.disabled = !nombre.value.trim(); });
  nombre.addEventListener('keydown', e => { if (e.key === 'Enter' && nombre.value.trim()) listo.click(); });
  repintar();
  return crear('div', { clase: 'av-pantalla av-creador' },
    crear('div', { clase: 'av-creador-escenario' },
      crear('span', { clase: 'av-foco', atributos: { 'aria-hidden': 'true' } }),
      crear('span', { clase: 'av-plataforma grande', atributos: { 'aria-hidden': 'true' } }),
      vista,
      crear('div', { clase: 'av-creador-botones' },
        boton('▶ Probar', probar, 'secundario pequeno'),
        boton('🎲 Al azar', () => { estado.aspecto = aspectoAlAzar(Math.random, Math.random() < 0.5 ? 'f' : 'm'); repintar(); }, 'secundario pequeno'))),
    crear('div', { clase: 'av-creador-formulario' },
      etiqueta(guardado ? 'Tu entrenador' : 'Antes de empezar'),
      titulo(guardado ? 'Cambia tu ' : 'Crea a tu ', 'entrenador'),
      crear('p', { texto: 'Saldrá a un lado de la arena para lanzar tus Poké Balls, en la aventura y en el Duelo.' }),
      crear('label', { clase: 'av-nombre' }, crear('span', { texto: 'Nombre' }), nombre),
      crear('div', { clase: 'av-pestanas', atributos: { role: 'tablist', 'aria-label': 'Partes de tu entrenador' } }, ...lenguetas),
      hoja,
      crear('div', { clase: 'av-acciones' },
        guardado ? boton('Cancelar', () => { editando = false; pintarPanel(); }, 'secundario') : crear('span'),
        listo)));
}

// --- Tarjeta del Inicio ------------------------------------------------------------------------------------

function pintarInicio() {
  const tarjeta = document.querySelector('#inicio-aventura');
  if (!tarjeta) return;
  const entrenador = yo();
  const n = datos.conquistas.length;
  const r = REGIONES_AVENTURA[regionEnCurso()];
  tarjeta.querySelector('#inicio-aventura-dato').textContent = !entrenador ? 'Crea tu entrenador y empieza en Kanto'
    : n >= REGIONES ? '¡Nueve copas! Eres leyenda'
      : `${n} de ${REGIONES} copas · ahora en ${r.region}`;
  tarjeta.querySelector('#inicio-aventura-estrellas').replaceChildren(...REGIONES_AVENTURA.map((reg, i) => crear('i', {
    clase: conquistada(i) ? 'ganada' : i === regionEnCurso() ? 'actual' : '', estilos: { '--color': reg.colores[0] }, title: reg.copa,
  })));
  tarjeta.querySelector('#inicio-aventura-entrenador').replaceChildren(
    retratoEntrenador(entrenador?.aspecto || ASPECTO_INICIAL, { escala: 5, pose: entrenador ? 'lanza2' : 'quieto', clase: 'inicio-aventura-retrato' }));
}
