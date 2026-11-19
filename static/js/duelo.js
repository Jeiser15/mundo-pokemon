// Vista «Duelo Pokémon» (#duelo): la portada (maqueta de la arena y tu récord) y tres pasos, uno a la vez.
//   Maqueta: el escenario elegido, inclinado en 3D, con tus Pokémon (GIF animados) de pie sobre él en
//   formación y un rival misterioso enfrente. Cambia al elegir escenario, dificultad o Pokémon.
//   1. Configura la batalla: modo (MODOS_BATALLA), dificultad (NIVELES_SIMULACRO) y escenario (ESCENARIOS),
//      cada escenario con su vista previa real en pixel art (arena-pixel.js → dibujarVistaPrevia).
//   2. Elige tus Pokémon (hasta 6) o, en «Uno contra uno», a tu luchador (uno): equipo.js, con la lista del modo.
//   3. ¡A combatir!: resumen, interruptor de pantalla completa e «Iniciar combate» (simulacro.js abre la ventana).
// La última configuración se recuerda en este navegador.

import { ESCENARIOS, MODOS_BATALLA, NIVELES_SIMULACRO } from './datos.js';
import { dibujarVistaPrevia } from './arena-pixel.js';
import { usarLista } from './equipo.js';
import { miLista, tamanoLista } from './mi-equipo.js';
import { empezarCombate, leerRecord } from './simulacro.js';
import { crear, nombreTitulo, urlAnimado, urlSprite } from './utilidades.js';

const CLAVE = 'pokedex.duelo';
const NUMERALES = ['I', 'II', 'III'];
/** Dónde se colocan tus Pokémon en la maqueta (% del campo): el primero delante y el resto detrás, en cuña. */
const FORMACION = [[33, 64], [25, 46], [25, 84], [16, 34], [16, 60], [16, 86]];
const seccion = document.querySelector('#duelo');
const configuracion = document.querySelector('#duelo-configuracion');
const resumen = document.querySelector('#duelo-resumen');
const botonesPaso = [...document.querySelectorAll('#duelo-pasos button')];
const botonAEquipo = document.querySelector('#duelo-a-equipo');
const botonACombate = document.querySelector('#duelo-a-combate');
const maqueta = {
  campo: document.querySelector('#duelo-cartel-fondo'),
  escena: document.querySelector('#duelo-cartel-escena'),
  rotulo: document.querySelector('#duelo-cartel-rotulo'),
};
const cifras = {
  combates: document.querySelector('#duelo-cifra-combates'),
  victorias: document.querySelector('#duelo-cifra-victorias'),
  derrotas: document.querySelector('#duelo-cifra-derrotas'),
  porcentaje: document.querySelector('#duelo-cifra-porcentaje'),
};
const textos = {
  paso2: document.querySelector('#duelo-nombre-paso-2'),
  titulo: document.querySelector('#duelo-equipo-titulo'),
  ayuda: document.querySelector('#duelo-equipo-texto'),
};

const ajustes = leerAjustes();
let paso = 1;

/** Vista previa del campo de un escenario (lienzo de 480×270 que el CSS agranda sin suavizar). */
function vistaPrevia(escenario) {
  const lienzo = dibujarVistaPrevia(escenario);
  lienzo.className = 'vista-escenario';
  lienzo.setAttribute('aria-hidden', 'true');
  return lienzo;
}

/** Sprite animado (GIF de Showdown); si no existe, el sprite fijo; si tampoco, se oculta. */
function spriteAnimado({ id, nombre }, clase) {
  const imagen = crear('img', { clase, src: urlAnimado(id), alt: nombreTitulo(nombre), loading: 'lazy' });
  imagen.onerror = () => { imagen.onerror = () => { imagen.hidden = true; }; imagen.src = urlSprite(id); };
  return imagen;
}

function leerAjustes() {
  const porDefecto = { modo: 'equipo', nivel: 'retador', escenario: 'bosque', pantallaCompleta: false };
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE)) || {};
    return {
      modo: MODOS_BATALLA[guardado.modo] ? guardado.modo : porDefecto.modo,
      nivel: NIVELES_SIMULACRO[guardado.nivel] ? guardado.nivel : porDefecto.nivel,
      escenario: ESCENARIOS[guardado.escenario] ? guardado.escenario : porDefecto.escenario,
      pantallaCompleta: guardado.pantallaCompleta === true,
    };
  } catch { return porDefecto; }
}

function guardarAjustes() {
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* sin almacenamiento */ }
}

/** La lista de Pokémon del modo elegido: 'equipo' (hasta 6) o 'luchador' (uno). */
const lista = () => MODOS_BATALLA[ajustes.modo].lista;
const esDuelo = () => lista() === 'luchador';
const misPokemon = () => miLista(lista());

export function iniciarDuelo() {
  botonesPaso.forEach(boton => boton.addEventListener('click', () => irAPaso(Number(boton.dataset.paso))));
  seccion.querySelectorAll('[data-ir]').forEach(boton => boton.addEventListener('click', () => irAPaso(Number(boton.dataset.ir))));
  document.addEventListener('equipo-cambiado', () => { pintarPasos(); pintarMaqueta(); if (paso === 1) pintarConfiguracion(); if (paso === 3) pintarResumen(); });
  document.addEventListener('batalla-terminada', () => { pintarCifras(); pintarConfiguracion(); if (paso === 3) pintarResumen(); });
  aplicarModo();
  pintarCifras();
  irAPaso(1, false);
}

/** Lo que cambia con el modo: la lista con la que trabaja el paso 2 y sus textos. */
function aplicarModo() {
  usarLista(lista());
  textos.paso2.textContent = esDuelo() ? 'Elige a tu luchador' : 'Elige tus Pokémon';
  textos.titulo.textContent = esDuelo() ? 'Elige a tu luchador' : 'Elige tus Pokémon';
  textos.ayuda.textContent = esDuelo()
    ? 'Uno solo: se enfrentará a un rival a su altura. Búscalo o deja que el azar elija por ti.'
    : `Hasta ${tamanoLista('equipo')}. Durante el combate podrás cambiarlos entre ellos.`;
  botonAEquipo.textContent = esDuelo() ? 'Siguiente: elige a tu luchador →' : 'Siguiente: elige tus Pokémon →';
  pintarConfiguracion();
  pintarPasos();
  pintarMaqueta();
}

const hayPokemon = () => misPokemon().length > 0;

function irAPaso(numero, desplazar = true) {
  paso = numero === 3 && !hayPokemon() ? 2 : numero; // sin Pokémon no se puede combatir
  for (const n of [1, 2, 3]) document.querySelector('#duelo-paso-' + n).hidden = n !== paso;
  pintarPasos();
  if (paso === 3) pintarResumen();
  if (desplazar) document.querySelector('#duelo-paso-' + paso).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

function pintarPasos() {
  for (const boton of botonesPaso) {
    const n = Number(boton.dataset.paso);
    boton.parentElement.dataset.estado = n === paso ? 'actual' : n < paso ? 'hecho' : 'pendiente';
    if (n === paso) boton.setAttribute('aria-current', 'step'); else boton.removeAttribute('aria-current');
    boton.disabled = n === 3 && !hayPokemon();
  }
  const cuantos = misPokemon().length;
  botonACombate.disabled = !cuantos;
  botonACombate.textContent = !cuantos ? (esDuelo() ? 'Elige a tu luchador' : 'Añade al menos un Pokémon')
    : esDuelo() ? 'Siguiente: ¡a combatir! →' : `Siguiente: ¡a combatir! (${cuantos}/${tamanoLista('equipo')}) →`;
}

// --- Portada: maqueta de la arena y récord ----------------------------------------------------------

/** Una figura de pie sobre el campo de la maqueta, con su sombra. */
function figura(contenido, x, y, { clase = '', alto, i = 0 }) {
  const lugar = { '--x': x + '%', '--y': y + '%' };
  return [ // --alto y --sombra, en px de una maqueta de 640 px: el CSS los escala con su ancho
    crear('span', { clase: 'escaparate-sombra', estilos: { ...lugar, '--sombra': Math.round(alto * 0.8) } }),
    crear('span', { clase: 'escaparate-figura ' + clase, estilos: { ...lugar, '--alto': alto, '--i': i } }, contenido),
  ];
}

function pintarMaqueta() {
  maqueta.campo.replaceChildren(vistaPrevia(ajustes.escenario));
  const tuyos = misPokemon();
  const alto = tuyos.length === 1 ? 112 : tuyos.length <= 3 ? 78 : 60;
  maqueta.escena.replaceChildren(
    // Primero los de atrás: así los de delante se dibujan encima.
    ...tuyos.map((p, i) => [p, i]).reverse().flatMap(([p, i]) => {
      const [x, y] = tuyos.length === 1 ? [31, 66] : FORMACION[i];
      return figura(spriteAnimado(p, ''), x, y, { clase: 'tuyo', alto, i });
    }),
    ...figura(crear('span', { clase: 'escaparate-vs', texto: 'vs' }), 50, 58, { alto: 0 }),
    ...figura(crear('span', { clase: 'escaparate-misterio', texto: '?' }), 69, 66, { alto: tuyos.length === 1 ? 92 : 74 }),
  );
  maqueta.rotulo.replaceChildren(
    ESCENARIOS[ajustes.escenario].nombre, ' · ',
    crear('b', { texto: `${NIVELES_SIMULACRO[ajustes.nivel].nombre} ${'✦'.repeat(NIVELES_SIMULACRO[ajustes.nivel].estrellas)}` }), ' · ',
    tuyos.length ? (esDuelo() ? nombreTitulo(tuyos[0].nombre) : `tu equipo de ${tuyos.length}`) : 'sin Pokémon todavía');
}

/** Tu récord en todos los modos y dificultades. */
function pintarCifras() {
  let v = 0; let d = 0;
  for (const porNivel of Object.values(leerRecord())) for (const r of Object.values(porNivel)) { v += r.v || 0; d += r.d || 0; }
  cifras.combates.textContent = v + d;
  cifras.victorias.textContent = v;
  cifras.derrotas.textContent = d;
  cifras.porcentaje.textContent = v + d ? Math.round((v / (v + d)) * 100) : '—';
}

// --- Paso 1: configuración ------------------------------------------------------------------------

/** Grupo de opciones como botones que se pueden pulsar (solo uno activo). */
function grupo(numero, titulo, descripcion, clave, opciones, crearContenido) {
  return crear('section', { clase: 'duelo-grupo' },
    crear('div', { clase: 'duelo-grupo-cabecera' },
      crear('span', { clase: 'grupo-numero', texto: NUMERALES[numero - 1], atributos: { 'aria-hidden': 'true' } }),
      crear('h4', { texto: titulo }),
      crear('p', { texto: descripcion })),
    crear('div', { clase: `duelo-opciones duelo-opciones-${clave}`, atributos: { role: 'group', 'aria-label': titulo } },
      ...Object.entries(opciones).map(([valor, datos]) => crear('button', {
        type: 'button',
        clase: 'duelo-opcion',
        atributos: { 'aria-pressed': String(ajustes[clave] === valor), 'data-valor': valor },
        alPulsar: () => elegir(clave, valor),
      }, ...crearContenido(valor, datos)))));
}

/** Deja elegido un escenario (lo usa la portada: «elige una arena» lleva al Duelo con ella puesta). */
export function elegirEscenario(clave) {
  if (ESCENARIOS[clave]) elegir('escenario', clave);
}

function elegir(clave, valor) {
  if (ajustes[clave] === valor) return;
  ajustes[clave] = valor;
  guardarAjustes();
  if (clave === 'modo') aplicarModo();
  else { pintarConfiguracion(); pintarMaqueta(); }
}

function pintarConfiguracion() {
  const record = leerRecord()[ajustes.modo];
  const tamano = miLista('equipo').length || tamanoLista('equipo');
  configuracion.replaceChildren(
    grupo(1, 'Modo de combate', 'Cómo se enfrentan los dos bandos.', 'modo', MODOS_BATALLA, (valor, datos) => {
      const n = valor === 'duelo' ? 1 : tamano;
      return [
        crear('span', { clase: 'opcion-marcador', texto: `${n} × ${n}`, atributos: { 'aria-hidden': 'true' } }),
        crear('strong', { texto: datos.nombre }),
        crear('small', { texto: datos.descripcion }),
      ];
    }),
    grupo(2, 'Dificultad', 'Lo fuerte y lo listo que es el rival.', 'nivel', NIVELES_SIMULACRO, (valor, datos) => [
      crear('span', { clase: 'opcion-estrellas', texto: '✦'.repeat(datos.estrellas), atributos: { 'aria-hidden': 'true' } }),
      crear('strong', { texto: datos.nombre }),
      crear('small', { texto: datos.descripcion }),
      crear('em', { texto: `${record[valor]?.v ?? 0} victorias · ${record[valor]?.d ?? 0} derrotas` }),
    ]),
    grupo(3, 'Escenario', 'Dónde se celebra el combate.', 'escenario', ESCENARIOS, (valor, datos) => [
      crear('span', { clase: 'opcion-vista' }, vistaPrevia(valor)),
      crear('strong', { texto: datos.nombre }),
      crear('small', { texto: datos.descripcion }),
    ]),
  );
}

// --- Paso 3: resumen e inicio ---------------------------------------------------------------------

function pintarResumen() {
  const tuyos = misPokemon();
  const nivel = NIVELES_SIMULACRO[ajustes.nivel];
  const modo = MODOS_BATALLA[ajustes.modo];
  const escenario = ESCENARIOS[ajustes.escenario];
  const record = leerRecord()[ajustes.modo][ajustes.nivel] || { v: 0, d: 0 };
  const interruptor = crear('input', { type: 'checkbox', checked: ajustes.pantallaCompleta, atributos: { role: 'switch' } });
  interruptor.addEventListener('change', () => { ajustes.pantallaCompleta = interruptor.checked; guardarAjustes(); });
  const dato = (titulo, valor, cambiar) => crear('div', { clase: 'resumen-dato' },
    crear('dt', { texto: titulo }),
    crear('dd', {}, valor, crear('button', { type: 'button', clase: 'resumen-cambiar', texto: 'Cambiar', alPulsar: cambiar })));
  resumen.replaceChildren(
    crear('div', { clase: 'resumen-escenario' },
      vistaPrevia(ajustes.escenario),
      crear('span', { clase: 'resumen-escenario-nombre', texto: escenario.nombre })),
    crear('div', { clase: 'resumen-panel' },
      crear('span', { clase: 'duelo-kicker', texto: '✦ Paso III · Todo listo' }),
      crear('h3', { texto: '¿Empezamos el combate?' }),
      crear('dl', { clase: 'resumen-datos' },
        dato('Modo', modo.nombre, () => irAPaso(1)),
        dato('Dificultad', `${nivel.nombre} ${'✦'.repeat(nivel.estrellas)}`, () => irAPaso(1)),
        dato('Escenario', escenario.nombre, () => irAPaso(1)),
        dato(esDuelo() ? 'Luchador' : 'Tu equipo', crear('span', { clase: 'resumen-equipo' }, ...tuyos.map(p => spriteAnimado(p, 'resumen-sprite'))), () => irAPaso(2))),
      crear('p', { clase: 'resumen-record', texto: `Tu récord en ${modo.nombre.toLowerCase()}, nivel ${nivel.nombre}: ${record.v} victorias y ${record.d} derrotas.` }),
      crear('label', { clase: 'interruptor' },
        interruptor,
        crear('span', { clase: 'interruptor-pista', atributos: { 'aria-hidden': 'true' } }),
        crear('span', {}, crear('strong', { texto: 'Jugar en pantalla completa' }), crear('small', { texto: 'Solo la arena y tus movimientos. Esc para salir.' }))),
      crear('button', {
        type: 'button', clase: 'duelo-iniciar',
        alPulsar: () => empezarCombate({ ...ajustes }),
      }, crear('span', { texto: '⚔', atributos: { 'aria-hidden': 'true' } }), 'Iniciar combate'),
      crear('button', { type: 'button', clase: 'duelo-atras', texto: esDuelo() ? '← Cambiar de luchador' : '← Volver a mis Pokémon', alPulsar: () => irAPaso(2) })),
  );
}
