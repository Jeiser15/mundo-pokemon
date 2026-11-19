// Duelo Pokémon — el combate. La configuración (modo, dificultad, escenario) y la elección de Pokémon
// están en duelo.js, que llama a empezarCombate(). El combate se abre en una ventana emergente
// (<dialog id="batalla-ventana">) con una arena en pixel art vista desde arriba (arena-pixel.js). Las
// reglas y la estrategia del rival están en combate.js; aquí se monta la ventana (marcadores, lienzo,
// mando y registro) y se encadenan los sucesos de cada turno.
//
// Cada combate es distinto: un entrenador rival con nombre y oficio (según los tipos de su equipo) que
// habla en los momentos clave, un clima sorteado según el escenario, estados alterados, energía de
// evolución (con la barra llena, «¡Evolucionar!» lo transforma en plena batalla; megaevolución si ya es
// su última fase), Pokémon que salen de su Poké Ball con su grito, efectos de sonido por tipo y música
// original que se acelera en los momentos tensos (sonido.js; se puede silenciar desde la barra).
//
// Pantalla completa: se pide sobre #simulacro (el contenido), no sobre el <dialog>: Chrome no deja poner
// un <dialog> en pantalla completa («Dialog elements are invalid»). Con la clase .en-pantalla-completa el
// CSS deja solo la arena, con los marcadores y los movimientos encima. Si el navegador no tiene la API
// (iPhone), la clase sola hace que la ventana ocupe toda la pantalla del navegador.
//
// Modos (MODOS_BATALLA en datos.js): 'equipo' (tu equipo contra otro igual de grande, con cambios) y
// 'duelo' (tu luchador contra un rival a su altura; empieza solo, sin elegir quién sale).
// Fases: 'cargando' → 'intro' → 'preparacion' (eliges quién sale) → 'accion' (eliges qué hacer)
//        → 'animando' (se resuelve el turno) → 'cambio' o 'relevo' (eliges a otro) → … → 'final'.

import { CLIMAS, COLOR_POR_DEFECTO, ENTRENADORES, ESCENARIOS, ESTADOS, FRASES_RIVAL, MODOS_BATALLA, NIVELES_SIMULACRO, rarezaDe, TIPOS } from './datos.js';
import {
  accionObligada, activo, ataquesDe, crearCombate, decidirRival, disponibles, elegirEquipoRival, elegirInicialRival,
  elegirRelevo, ENERGIA_LLENA, enPie, esPropio, evolucionar, ganador, mejorEvolucion, multiplicadorContra, otroLado,
  preseleccionarCandidatos, puedeEvolucionar, resolverTurno,
} from './combate.js';
import { ALTO, ANCHO, crearArenaPixel } from './arena-pixel.js';
import { cargarEspecies } from './especies.js';
import { prepararEvoluciones } from './evoluciones.js';
import { detallesDe, miLista } from './mi-equipo.js';
import * as sonido from './sonido.js';
import { alAzar, crear, crearIcono, nombreTitulo } from './utilidades.js';

const ventana = document.querySelector('#batalla-ventana');
const arena = document.querySelector('#simulacro'); // contenido de la ventana
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const CLAVE_RECORD = 'pokedex.simulacro';
const MAX_REGISTRO = 60;

let nivelCombate = 'retador'; // configuración del combate en curso (la elige duelo.js)
let modoCombate = 'equipo';
let escenarioCombate = 'bosque';
let quierePantallaCompleta = false;
let climaCombate = null;    // clave de CLIMAS o null (despejado): se sortea en cada combate
let entrenador = null;      // { nombre, titulo, articulo }: el rival (se mantiene en la revancha)
let version = 0;            // Cada combate nuevo (o abandonado) cambia el número: lo que llegue tarde se descarta.
let fase = 'inactivo';
let estado = null;          // combate.js → crearCombate()
let equipoJugador = [];
let equipoRival = [];       // se guardan para la revancha (ya con su árbol de evoluciones)
let danioRecibido = {};     // tipo de ataque → daño que te hizo el rival (para el consejo final)
let nodos = {};             // piezas de la ventana que se actualizan (y la arena pixelada)

const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;
const nombre = luchador => nombreTitulo(luchador.nombre);
const quien = (lado, luchador) => (lado === 'jugador' ? `Tu ${nombre(luchador)}` : `${nombre(luchador)} (rival)`);
const SIMBOLO = { 4: '×4', 2: '×2', 1: '×1', 0.5: '×½', 0.25: '×¼', 0: '×0' };
const simbolo = mult => SIMBOLO[mult] ?? '×' + mult;
const efecto = mult => (mult === 0 ? 'nulo' : mult >= 2 ? 'fuerte' : mult < 1 ? 'debil' : 'neutro');
const esperar = ms => new Promise(listo => setTimeout(listo, movimientoReducido.matches ? Math.min(ms, 120) : ms));
const mayuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);
/** Opciones del combate según el modo: en el duelo todos tienen más vida (MODOS_BATALLA.duelo.vida). */
const opcionesCombate = () => ({ vida: MODOS_BATALLA[modoCombate].vida || 1, clima: climaCombate });
/** Lo que necesita la arena para dibujar a un luchador. */
const modelo = luchador => (luchador
  ? { clave: luchador.id, animados: luchador.animados, sprite: luchador.sprite, imagen: luchador.imagen, altura: luchador.altura, rareza: rarezaDe(luchador.especie) }
  : null);
/** Una frase del rival para ese momento, con el nombre de su Pokémon. */
const frase = (momento, luchador) => alAzar(FRASES_RIVAL[momento]).replaceAll('{p}', luchador ? nombre(luchador) : '');
/** «A, B y C». */
const enumerar = lista => (lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}` : lista[0] || '');
/** Etapas en el marcador y en el registro. */
const ETAPAS = {
  attack: { corto: 'ATQ', nombre: 'el Ataque' }, defense: { corto: 'DEF', nombre: 'la Defensa' },
  'special-attack': { corto: 'AT.ESP', nombre: 'el Ataque Especial' }, 'special-defense': { corto: 'DF.ESP', nombre: 'la Defensa Especial' },
  speed: { corto: 'VEL', nombre: 'la Velocidad' },
};
/** Lo que hace cada movimiento de carga en su primer turno. */
const PREPARA = {
  aire: 'se eleva muy alto', tierra: 'excava un hoyo y se esconde bajo tierra', agua: 'se sumerge bajo el agua',
  sombra: 'desaparece de repente', sol: 'absorbe luz solar', brillo: 'acumula energía',
};

export function iniciarSimulacro() {
  // Cerrar la ventana (✕, Esc) a mitad de combate es abandonarlo.
  ventana.addEventListener('close', () => { if (fase !== 'inactivo') abandonar(); });
  // Si sales de la pantalla completa con Esc, la ventana vuelve a su forma normal.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) arena.classList.remove('en-pantalla-completa');
    pintarBotonPantalla();
  });
}

// --- Récord (victorias y derrotas por modo y nivel, en este navegador) ------------------------

/** Récord por modo y nivel: { equipo: { retador: { v, d } … }, duelo: { … } }. Lo muestra duelo.js. */
export function leerRecord() {
  let record = {};
  try { record = JSON.parse(localStorage.getItem(CLAVE_RECORD)) || {}; } catch { /* sin almacenamiento */ }
  if (!record.equipo && !record.duelo) record = { equipo: record }; // formato anterior: solo había equipo
  record.equipo ??= {};
  record.duelo ??= {};
  return record;
}

function guardarRecord(modoClave, nivelClave, victoria) {
  const record = leerRecord();
  record[modoClave][nivelClave] ??= { v: 0, d: 0 };
  record[modoClave][nivelClave][victoria ? 'v' : 'd']++;
  try { localStorage.setItem(CLAVE_RECORD, JSON.stringify(record)); } catch { /* sin almacenamiento */ }
}

// --- Ventana emergente ---------------------------------------------------------------------------

/**
 * Empieza un combate con la configuración de duelo.js. Se llama desde un clic: así el navegador
 * permite poner la pantalla completa y que suene el combate.
 * @param {{ modo: string, nivel: string, escenario: string, pantallaCompleta: boolean }} ajustes
 */
export function empezarCombate({ modo, nivel, escenario, pantallaCompleta }) {
  modoCombate = modo;
  nivelCombate = nivel;
  escenarioCombate = escenario;
  quierePantallaCompleta = pantallaCompleta;
  return empezar(false);
}

function abrirVentana() {
  if (!ventana.open) {
    ventana.showModal();
    document.body.classList.add('batalla-abierta'); // congela la página de fondo
  }
  if (quierePantallaCompleta) ponerPantallaCompleta(true);
}

const enPantallaCompleta = () => arena.classList.contains('en-pantalla-completa');

/** Entra o sale de la pantalla completa (hay que llamarla desde un clic: si no, el navegador la niega). */
function ponerPantallaCompleta(activar) {
  arena.classList.toggle('en-pantalla-completa', activar);
  if (activar && !document.fullscreenElement) arena.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  if (!activar && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  pintarBotonPantalla();
}

function pintarBotonPantalla() {
  if (!nodos.botonPantalla) return;
  const completa = enPantallaCompleta();
  nodos.botonPantalla.textContent = completa ? '⤡ Salir' : '⛶ Pantalla completa';
  nodos.botonPantalla.title = completa ? 'Salir de la pantalla completa (Esc)' : 'Ver solo la arena, a pantalla completa';
  nodos.botonPantalla.setAttribute('aria-pressed', String(completa));
}

/** Botones de sonido de la barra: efectos y gritos (🔊) y música (♪). */
function pintarBotonesSonido() {
  if (!nodos.botonEfectos) return;
  const efectos = sonido.efectosActivos();
  const musica = sonido.musicaActiva();
  nodos.botonEfectos.textContent = efectos ? '🔊' : '🔇';
  nodos.botonEfectos.setAttribute('aria-pressed', String(efectos));
  nodos.botonEfectos.title = efectos ? 'Silenciar efectos y gritos' : 'Activar efectos y gritos';
  nodos.botonMusica.setAttribute('aria-pressed', String(musica));
  nodos.botonMusica.title = musica ? 'Silenciar la música' : 'Activar la música';
}

function abandonar() {
  version++; // corta cualquier animación en curso
  fase = 'inactivo';
  estado = null;
  sonido.detenerMusica();
  nodos.arena?.detener();
  clearTimeout(nodos.temporizadorBocadillo);
  nodos = {};
  arena.replaceChildren();
  ponerPantallaCompleta(false);
  if (ventana.open) ventana.close();
  document.body.classList.remove('batalla-abierta');
}

// --- Preparar un combate ----------------------------------------------------------------------

/** Un clima al azar según los pesos del escenario (o null: despejado). */
function sortearClima() {
  const pesos = Object.entries(ESCENARIOS[escenarioCombate].climas || { despejado: 1 });
  let resto = Math.random() * pesos.reduce((suma, [, peso]) => suma + peso, 0);
  for (const [clave, peso] of pesos) { resto -= peso; if (resto <= 0) return CLIMAS[clave] ? clave : null; }
  return null;
}

/** El entrenador rival: nombre al azar y oficio según el tipo que más se repite en su equipo. */
function crearEntrenador(equipo, nivel) {
  const cuenta = {};
  for (const p of equipo) for (const tipo of p.tipos) cuenta[tipo] = (cuenta[tipo] || 0) + 1;
  const tipo = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]?.[0] || 'normal';
  const [nombrePropio, genero] = alAzar(ENTRENADORES.nombres);
  const g = genero === 'f' ? 1 : 0;
  const oficio = (ENTRENADORES.oficios[tipo] || ENTRENADORES.oficios.normal)[g];
  const rango = ENTRENADORES.rango[nivel][g];
  return { nombre: nombrePropio, titulo: `${rango} ${oficio} ${nombrePropio}`.trim(), articulo: g ? 'la' : 'el' };
}

async function empezar(revancha) {
  const vigente = ++version;
  sonido.prepararSonido(); // dentro del clic: así el navegador deja sonar
  sonido.detenerMusica();
  fase = 'cargando';
  nodos.arena?.detener();
  abrirVentana();
  const aviso = crear('p', { clase: 'arena-aviso', texto: revancha ? 'Preparando la revancha…' : 'Buscando un rival a tu altura…' });
  arena.replaceChildren(
    crear('div', { clase: 'arena-barra' },
      crear('span', { clase: 'arena-titulo' }, crear('b', { texto: 'Arena de batalla' })),
      crear('button', { type: 'button', clase: 'arena-salir', texto: '✕ Cerrar', alPulsar: abandonar })),
    aviso);
  try {
    if (!revancha) {
      const duelo = modoCombate === 'duelo';
      const tuyos = miLista(MODOS_BATALLA[modoCombate].lista);
      if (!tuyos.length) throw new Error(duelo ? 'aún no has elegido a tu luchador.' : 'tu equipo está vacío.');
      const detalles = await Promise.all(tuyos.map(p => detallesDe(p.id)));
      const especies = await cargarEspecies();
      const preseleccion = preseleccionarCandidatos(especies, detalles, nivelCombate, { duelo });
      const candidatos = (await Promise.allSettled(preseleccion.map(e => detallesDe(e.id))))
        .flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
      if (vigente !== version) return;
      const rivales = elegirEquipoRival(candidatos, detalles, nivelCombate, detalles.length, { duelo });
      if (rivales.length < detalles.length) throw new Error('no se encontraron suficientes rivales.');
      aviso.textContent = 'Preparando las evoluciones…';
      [equipoJugador, equipoRival] = await Promise.all([detalles, rivales].map(lista => Promise.all(lista.map(d => prepararEvoluciones(d)))));
      entrenador = crearEntrenador(equipoRival, nivelCombate);
    }
    if (vigente !== version) return;
    climaCombate = sortearClima();
    estado = crearCombate(equipoJugador, equipoRival, nivelCombate, opcionesCombate());
    danioRecibido = {};
    montarArena();
    pintarBotonPantalla();
    pintarBotonesSonido();
    nodos.arena.precargar([...equipoJugador, ...equipoRival].map(modelo)); // los GIF se decodifican mientras tanto
    sonido.precargarGritos([...equipoJugador, ...equipoRival].map(d => d.grito));
    fase = 'intro';
    pintarMarcador('jugador');
    pintarMarcador('rival');
    pintarFichas();
    pintarMando('El rival se acerca…');
    await presentar(vigente);
    if (vigente !== version) return;
    fase = 'preparacion';
    if (modoCombate === 'duelo') { // uno contra uno: los dos saltan al campo sin más
      elegirLuchador(0);
      return;
    }
    pintarMando();
    anotar('Mira su equipo en el marcador y elige quién sale primero.', 'sistema');
  } catch (error) {
    if (vigente !== version) return;
    fase = 'error';
    arena.querySelector('.arena-aviso')?.replaceWith(crear('p', { clase: 'arena-aviso error', texto: 'No se pudo preparar la batalla: ' + (error.message || 'error desconocido') }));
  }
}

/** Presentación: transición, el rival te desafía, empieza la música y se anuncia el clima. */
async function presentar(vigente) {
  await nodos.arena.transicion();
  if (vigente !== version) return;
  sonido.empezarMusica();
  const desafio = `¡${mayuscula(entrenador.articulo)} ${entrenador.titulo} te desafía!`;
  anotar(desafio, 'sistema');
  hablar('rival', `${desafio} ${frase('inicio')}`, 3200);
  await esperar(1400);
  if (climaCombate) {
    const clima = CLIMAS[climaCombate];
    anunciar(clima.anuncio, 'inicio');
    anotar(`${clima.icono} ${clima.anuncio} ${textoClima(clima)}`, 'sistema');
    await esperar(1500);
  }
}

/** «Potencia Fuego ×1,3 · debilita Agua ×0,7». */
function textoClima(clima) {
  const partes = Object.entries(clima.potencia).map(([tipo, f]) => `${f > 1 ? 'potencia' : 'debilita'} ${TIPOS[tipo].nombre} ×${String(f).replace('.', ',')}`);
  return mayuscula(partes.join(' · ')) + '.';
}

// --- Ventana de batalla: barra, marcadores, lienzo pixelado, mando y registro ----------------------

function montarArena() {
  const datosNivel = NIVELES_SIMULACRO[nivelCombate];
  const lienzo = crear('canvas', { clase: 'arena-lienzo', width: ANCHO, height: ALTO, atributos: { role: 'img', 'aria-label': 'Arena de batalla vista desde arriba' } });
  const clima = CLIMAS[climaCombate];
  nodos = {
    turno: crear('span', { clase: 'arena-turno', texto: 'Preparación' }),
    jugador: crearLado('jugador'),
    rival: crearLado('rival'),
    mando: crear('div', { clase: 'arena-mando', atributos: { 'aria-live': 'polite' } }),
    registro: crear('ol', { clase: 'arena-registro', atributos: { role: 'log', 'aria-label': 'Registro del combate' } }),
    bocadillo: crear('p', { clase: 'arena-bocadillo', atributos: { 'aria-live': 'polite' } }),
    arena: crearArenaPixel(lienzo, { escenario: escenarioCombate, clima: climaCombate, sonar: sonido.efecto }),
    botonPantalla: crear('button', { type: 'button', clase: 'arena-completa', alPulsar: () => ponerPantallaCompleta(!enPantallaCompleta()) }),
    botonEfectos: crear('button', { type: 'button', clase: 'arena-sonido', atributos: { 'aria-label': 'Efectos y gritos' }, alPulsar: () => { sonido.alternar('efectos'); pintarBotonesSonido(); } }),
    botonMusica: crear('button', { type: 'button', clase: 'arena-sonido', texto: '♪', atributos: { 'aria-label': 'Música' }, alPulsar: () => { sonido.alternar('musica'); pintarBotonesSonido(); } }),
  };
  arena.dataset.nivel = nivelCombate;
  arena.dataset.modo = modoCombate;
  arena.dataset.escenario = escenarioCombate;
  delete arena.dataset.resultado;
  arena.replaceChildren(
    crear('div', { clase: 'arena-barra' },
      crear('span', { clase: 'arena-titulo' },
        crear('b', { texto: modoCombate === 'duelo' ? 'Uno contra uno' : 'Equipo contra equipo' }),
        ` · nivel ${datosNivel.nombre} `,
        crear('span', { clase: 'nivel-estrellas', texto: '✦'.repeat(datosNivel.estrellas) })),
      ...(clima ? [crear('span', { clase: 'arena-clima', title: textoClima(clima), atributos: { 'data-clima': climaCombate } }, crear('b', { texto: clima.icono }), crear('span', { texto: clima.nombre }))] : []),
      nodos.turno,
      nodos.botonMusica,
      nodos.botonEfectos,
      nodos.botonPantalla,
      crear('button', { type: 'button', clase: 'arena-salir', texto: '✕ Abandonar', alPulsar: abandonar })),
    crear('div', { clase: 'arena-cuerpo' },
      crear('div', { clase: 'arena-principal' },
        crear('div', { clase: 'arena-marcadores' },
          nodos.jugador.hud,
          crear('span', { clase: 'arena-vs', texto: 'VS', atributos: { 'aria-hidden': 'true' } }),
          nodos.rival.hud),
        crear('div', { clase: 'arena-lienzo-marco' }, lienzo, nodos.bocadillo)),
      crear('div', { clase: 'arena-lateral' },
        nodos.mando,
        crear('div', { clase: 'arena-registro-marco' }, crear('h4', { texto: 'Registro del combate' }), nodos.registro))),
  );
}

/** Marcador de un bando: entrenador, equipo, nombre, estado, tipos, vida y energía de evolución. */
function crearLado(lado) {
  const partes = {
    nombre: crear('strong', { clase: 'hud-nombre' }),
    estado: crear('span', { clase: 'hud-estado', hidden: true }),
    etapas: crear('span', { clase: 'hud-etapas' }),
    tipos: crear('span', { clase: 'hud-tipos' }),
    pvTexto: crear('small', { clase: 'hud-pv-texto' }),
    fichas: crear('div', { clase: 'hud-fichas' }),
    energia: crear('span', { clase: 'hud-energia', title: 'Energía de evolución' }, crear('b', { texto: 'EVO' }), crear('i', {}, crear('i'))),
  };
  partes.hud = crear('div', { clase: 'hud', atributos: { 'data-lado': lado } },
    crear('div', { clase: 'hud-cabecera' },
      crear('span', { clase: 'hud-etiqueta', texto: lado === 'jugador' ? 'Tú' : entrenador?.titulo || 'Rival' }),
      partes.fichas),
    crear('div', { clase: 'hud-identidad' }, crear('span', { clase: 'hud-nombre-linea' }, partes.nombre, partes.estado, partes.etapas), partes.tipos),
    crear('span', { clase: 'hud-pv', atributos: { 'aria-hidden': 'true' } }, crear('i', { clase: 'hud-pv-rastro' }), crear('i', { clase: 'hud-pv-actual' })),
    crear('span', { clase: 'hud-pie' }, partes.pvTexto, partes.energia));
  return partes;
}

/** Marcador del que está en el campo. */
function pintarMarcador(lado) {
  const partes = nodos[lado];
  const luchador = activo(estado, lado);
  partes.nombre.classList.toggle('vacio', !luchador);
  partes.nombre.textContent = luchador ? nombre(luchador) : lado === 'jugador' ? '¿Quién sale?' : 'Esperando…';
  partes.hud.classList.toggle('es-mega', Boolean(luchador?.mega));
  partes.tipos.replaceChildren(...(luchador ? luchador.tipos : []).map(tipo =>
    crear('span', { clase: 'hud-tipo', estilos: { '--color-tipo': colorDe(tipo) } }, crearIcono(TIPOS[tipo]?.icono || ''), TIPOS[tipo]?.nombre || tipo)));
  pintarEstado(lado);
  actualizarPV(lado);
  actualizarEnergia(lado);
}

function pintarEstado(lado) {
  const chip = nodos[lado].estado;
  const luchador = activo(estado, lado);
  // Etapas que no están a 0: «ATQ +1», «DEF −1»…
  nodos[lado].etapas.replaceChildren(...Object.entries(luchador?.etapas || {}).filter(([, n]) => n).map(([clave, n]) =>
    crear('span', {
      clase: 'hud-etapa', atributos: { 'data-signo': n > 0 ? 'sube' : 'baja' },
      title: `${mayuscula(ETAPAS[clave].nombre)}: ${n > 0 ? '+' : '−'}${Math.abs(n)}`, texto: `${ETAPAS[clave].corto} ${n > 0 ? '+' : '−'}${Math.abs(n)}`,
    })));
  const tipo = luchador?.estado?.tipo;
  chip.hidden = !tipo;
  if (!tipo) return;
  chip.textContent = ESTADOS[tipo].corto;
  chip.title = ESTADOS[tipo].nombre;
  chip.style.setProperty('--color-estado', ESTADOS[tipo].color);
}

/** Marcador + modelo en la arena. `entra`: sale de su Poké Ball (y suena su grito). Se cumple al terminar. */
async function mostrarLuchador(lado, entra = false) {
  const luchador = activo(estado, lado);
  pintarMarcador(lado);
  if (entra) {
    hablar(lado, lado === 'jugador' ? `¡Adelante, ${nombre(luchador)}!` : frase(enPie(estado, 'rival') === 1 && estado.rival.equipo.length > 1 ? 'ultimo' : 'sale', luchador), 1800);
    setTimeout(() => sonido.grito(luchador.grito), movimientoReducido.matches ? 0 : 850); // cuando se abre la Poké Ball
  }
  await nodos.arena.poner(lado, modelo(luchador), { entrada: entra });
  nodos.arena.estado(lado, luchador?.estado?.tipo || null);
  nodos.arena.listo(lado, puedeEvolucionar(luchador));
}

function actualizarPV(lado) {
  const partes = nodos[lado];
  const luchador = activo(estado, lado);
  const fraccion = luchador ? luchador.pv / luchador.pvMax : 0;
  partes.hud.style.setProperty('--pv', fraccion.toFixed(3));
  partes.hud.dataset.salud = !luchador ? 'vacia' : fraccion > 0.5 ? 'alta' : fraccion > 0.2 ? 'media' : 'baja';
  partes.pvTexto.textContent = !luchador ? '' : lado === 'jugador'
    ? `${luchador.pv} / ${luchador.pvMax} PV`
    : `${Math.ceil(fraccion * 100)} % de vida`;
}

/** Barra de energía de evolución (oculta si ese Pokémon ya no puede evolucionar). */
function actualizarEnergia(lado) {
  const partes = nodos[lado];
  const luchador = activo(estado, lado);
  const puede = Boolean(luchador?.evoluciones?.length);
  partes.energia.hidden = !puede;
  if (!puede) return;
  partes.energia.style.setProperty('--energia', (luchador.energia / ENERGIA_LLENA).toFixed(3));
  partes.energia.classList.toggle('llena', luchador.energia >= ENERGIA_LLENA);
  partes.energia.title = luchador.energia >= ENERGIA_LLENA ? '¡Puede evolucionar!' : `Energía de evolución: ${Math.round(luchador.energia)} %`;
}

/** Miniaturas de cada equipo en su marcador: quién está en el campo, cuánta vida le queda y quién cayó. */
function pintarFichas() {
  for (const lado of ['jugador', 'rival']) {
    nodos[lado].fichas.replaceChildren(...estado[lado].equipo.map((luchador, i) => {
      const fraccion = luchador.pv / luchador.pvMax;
      const situacion = luchador.pv === 0 ? 'K.O.' : `${Math.ceil(fraccion * 100)} % de vida`;
      return crear('span', {
        clase: 'ficha-mini' + (luchador.pv === 0 ? ' fuera' : '') + (i === estado[lado].activo ? ' en-campo' : ''),
        atributos: { role: 'img', 'aria-label': `${nombre(luchador)}: ${situacion}`, title: `${nombre(luchador)} · ${situacion}` },
        estilos: { '--pv': fraccion.toFixed(3), '--color-tipo': colorDe(luchador.tipos[0]) },
      }, crear('img', { src: luchador.sprite || luchador.imagen, alt: '' }), crear('i'));
    }));
  }
}

const anunciar = (texto, tono) => nodos.arena.anunciar(texto, tono);

/** Bocadillo de diálogo sobre la arena (tu lado a la izquierda, el del rival a la derecha). */
function hablar(lado, texto, ms = 2400) {
  const bocadillo = nodos.bocadillo;
  if (!bocadillo) return;
  clearTimeout(nodos.temporizadorBocadillo);
  bocadillo.dataset.lado = lado;
  bocadillo.replaceChildren(...(lado === 'rival' ? [crear('b', { texto: entrenador.titulo })] : []), crear('span', { texto }));
  bocadillo.classList.remove('visible');
  void bocadillo.offsetWidth; // reinicia la animación de entrada
  bocadillo.classList.add('visible');
  nodos.temporizadorBocadillo = setTimeout(() => bocadillo.classList.remove('visible'), ms);
}

/** La música va más deprisa si a alguien le queda su último Pokémon o tu Pokémon tiene poca vida. */
function actualizarTension() {
  const yo = activo(estado, 'jugador');
  const tenso = enPie(estado, 'jugador') === 1 || enPie(estado, 'rival') === 1 || (yo && yo.pv > 0 && yo.pv / yo.pvMax < 0.25);
  sonido.tensionMusica(tenso);
}

// --- Mando: lo que puede hacer el jugador ----------------------------------------------------

function pintarMando(espera = 'Resolviendo el turno') {
  const mando = nodos.mando;
  mando.dataset.fase = fase;
  if (fase === 'preparacion' || fase === 'relevo' || fase === 'cambio') {
    const titulo = {
      preparacion: '¿Quién sale primero?',
      relevo: 'Tu Pokémon quedó K.O. ¿Quién sale ahora?',
      cambio: '¿A quién quieres sacar? (el que entre recibirá el golpe rival)',
    }[fase];
    const opciones = estado.jugador.equipo.flatMap((luchador, i) => (luchador.pv > 0 && i !== estado.jugador.activo ? [[luchador, i]] : []));
    mando.replaceChildren(
      crear('p', { clase: 'mando-titulo', texto: titulo }),
      crear('div', { clase: 'mando-equipo' }, ...opciones.map(([luchador, i]) => crearOpcionLuchador(luchador, i))),
      ...(fase === 'cambio' ? [crear('button', { type: 'button', clase: 'mando-volver', texto: '← Volver', alPulsar: () => { fase = 'accion'; pintarMando(); } })] : []),
    );
    return;
  }
  if (fase === 'accion') {
    const yo = activo(estado, 'jugador');
    const el = activo(estado, 'rival');
    const ayudas = NIVELES_SIMULACRO[estado.nivel].ayudas;
    const libres = disponibles(estado, 'jugador').length;
    const obligada = accionObligada(yo);
    if (obligada) { // tras Hiperrayo (recarga) o con un movimiento de carga a medias: no hay nada que elegir
      const recarga = obligada.tipo === 'recargar';
      mando.replaceChildren(
        crear('p', { clase: 'mando-titulo', texto: recarga ? `${nombre(yo)} tiene que recargar energía` : `${nombre(yo)} va a soltar ${obligada.ataque.nombre}` }),
        crear('button', { type: 'button', clase: 'accion accion-continuar', alPulsar: () => jugarTurno(obligada) },
          crear('strong', { texto: 'Continuar ▸' }),
          crear('small', { texto: recarga ? 'Pierde este turno por el esfuerzo del movimiento anterior.' : 'Lo cargó el turno pasado: este turno ataca.' })));
      return;
    }
    mando.replaceChildren(
      crear('p', { clase: 'mando-titulo', texto: `¿Qué movimiento usará ${nombre(yo)}?` }),
      ...(puedeEvolucionar(yo) ? [crearBotonEvolucion(yo, el)] : []),
      crear('div', { clase: 'mando-movimientos' }, ...ataquesDe(yo).map(ataque => crearBotonAtaque(yo, ataque, el, ayudas))),
      crear('div', { clase: 'mando-acciones' },
        crear('button', {
          type: 'button', clase: 'accion accion-concentrar', disabled: yo.cargado,
          alPulsar: () => jugarTurno({ tipo: 'concentrar' }),
        }, crear('strong', { texto: 'Concentrarse' }), crear('small', { texto: yo.cargado ? 'Ya está concentrado' : 'Mitad de daño · próximo ×1,7' })),
        ...(modoCombate === 'duelo' ? [] : [crear('button', { // en el uno contra uno no hay a quién cambiar
          type: 'button', clase: 'accion accion-cambiar', disabled: !libres,
          alPulsar: () => { fase = 'cambio'; pintarMando(); },
        }, crear('strong', { texto: 'Cambiar' }), crear('small', { texto: libres ? `${libres} en el banquillo` : 'No queda nadie' }))]),
      ),
      ...(ayudas ? [] : [crear('p', { clase: 'mando-pista', texto: 'Nivel Maestro: sin ayudas. ¿Recuerdas qué tipos le hacen ×2?' })]),
    );
    return;
  }
  mando.replaceChildren(crear('p', { clase: 'mando-titulo mando-espera', texto: espera }));
}

/** «¡Evolucionar! Charmeleon → Charizard»: no gasta el turno; después eliges movimiento con la forma nueva. */
function crearBotonEvolucion(yo, rival) {
  const indice = mejorEvolucion(yo, rival);
  const forma = yo.evoluciones[indice];
  const mega = Boolean(forma.mega);
  return crear('button', {
    type: 'button', clase: 'accion accion-evolucionar' + (mega ? ' es-mega' : ''),
    alPulsar: () => evolucionarJugador(indice),
  },
    crear('span', { clase: 'evolucion-destello', atributos: { 'aria-hidden': 'true' } }),
    crear('strong', { texto: mega ? '✦ ¡Megaevolucionar!' : '✦ ¡Evolucionar!' }),
    crear('small', { texto: `${nombre(yo)} → ${nombreTitulo(forma.nombre)} · no gasta el turno` }));
}

function crearOpcionLuchador(luchador, indice) {
  const fraccion = luchador.pv / luchador.pvMax;
  const rival = activo(estado, 'rival');
  const pista = rival && NIVELES_SIMULACRO[estado.nivel].ayudas ? ' · ' + resumenContra(luchador, rival) : '';
  return crear('button', {
    type: 'button', clase: 'opcion-luchador',
    estilos: { '--pv': fraccion.toFixed(3), '--color-tipo': colorDe(luchador.tipos[0]) },
    alPulsar: () => elegirLuchador(indice),
  },
    crear('img', { src: luchador.sprite || luchador.imagen, alt: '' }),
    crear('strong', { texto: nombre(luchador) + (luchador.estado ? ` · ${ESTADOS[luchador.estado.tipo].corto}` : '') }),
    crear('span', { clase: 'opcion-tipos' }, ...luchador.tipos.map(tipo =>
      crear('i', { title: TIPOS[tipo]?.nombre, estilos: { '--color-tipo': colorDe(tipo) } }, crearIcono(TIPOS[tipo]?.icono || '')))),
    crear('span', { clase: 'opcion-pv', atributos: { 'aria-hidden': 'true' } }, crear('i')),
    crear('small', { texto: `${luchador.pv} / ${luchador.pvMax} PV${pista}` }));
}

/** «Pega ×2, recibe ×½»: ayuda a elegir (no se muestra en Maestro). */
function resumenContra(luchador, rival) {
  const pega = Math.max(...luchador.tipos.map(t => multiplicadorContra(t, rival.tipos)));
  const recibe = Math.max(...rival.tipos.map(t => multiplicadorContra(t, luchador.tipos)));
  return `pega ${simbolo(pega)}, recibe ${simbolo(recibe)}`;
}

/** Rasgos de un movimiento para el botón: [marca corta, explicación]. */
function rasgosDe(ataque) {
  const rasgos = [];
  if (ataque.prioridad > 0) rasgos.push(['Rápido', 'Actúa antes que los demás movimientos']);
  if (ataque.prioridad < 0) rasgos.push(['Lento', 'Actúa después que los demás movimientos']);
  if (ataque.recarga) rasgos.push(['Recarga', 'Después pierde un turno recargando']);
  if (ataque.carga) rasgos.push(['2 turnos', `El primer turno ${PREPARA[ataque.carga]}; el segundo ataca`]);
  if (ataque.drena) rasgos.push(['Drena', `Recupera el ${ataque.drena} % del daño que hace`]);
  if (ataque.retroceso) rasgos.push(['Retroceso', `Se hace el ${ataque.retroceso} % del daño que causa`]);
  if (ataque.costeVida) rasgos.push(['Arriesgado', `Pierde el ${ataque.costeVida} % de su vida máxima`]);
  if (ataque.golpes) {
    const [minimo, maximo] = ataque.golpes;
    rasgos.push([`${minimo}${maximo > minimo ? '–' + maximo : ''} golpes`, 'Golpea varias veces (la potencia ya lo cuenta)']);
  }
  if (ataque.estado) rasgos.push([ESTADOS[ataque.estado].corto, `${ataque.probEstado} % de dejarlo ${ESTADOS[ataque.estado].nombre.toLowerCase()}`]);
  if (ataque.amedrentar) rasgos.push(['Amedrenta', `${ataque.amedrentar} % de que el rival no se mueva si golpea antes`]);
  if (ataque.cambios) {
    const propio = ataque.aQuien === 'propio';
    const lista = Object.entries(ataque.cambios).map(([clave, n]) => `${ETAPAS[clave].nombre} ${n > 0 ? 'sube' : 'baja'}${Math.abs(n) > 1 ? ' mucho' : ''}`);
    rasgos.push([propio ? (Object.values(ataque.cambios).some(n => n < 0) ? 'Agota' : 'Potencia') : 'Debilita',
      `${ataque.probCambio < 100 ? ataque.probCambio + ' % de que ' : ''}${propio ? 'a él' : 'al rival'}: ${enumerar(lista)}`]);
  }
  return rasgos;
}

/**
 * Botón de un movimiento, como en los juegos: del color de su tipo, con su nombre, clase, potencia,
 * precisión, eficacia y hasta dos rasgos (rápido, recarga…; la explicación completa, al pasar el ratón).
 */
function crearBotonAtaque(yo, ataque, rival, ayudas) {
  const tipo = TIPOS[ataque.tipo];
  const mult = multiplicadorContra(ataque.tipo, rival.tipos);
  const clase = ataque.categoria === 'fisico' ? 'Físico' : 'Especial';
  const climaFactor = CLIMAS[climaCombate]?.potencia?.[ataque.tipo] || 1;
  const eficacia = ayudas ? `${simbolo(mult)} ${mult >= 2 ? 'eficaz' : mult === 0 ? 'no afecta' : mult < 1 ? 'poco eficaz' : 'normal'}` : '¿eficaz?';
  const rasgos = rasgosDe(ataque);
  const explicacion = [
    `${tipo.nombre} · ${clase} · potencia ${ataque.poder} · precisión ${ataque.precision == null ? '(no falla)' : ataque.precision + ' %'}`,
    esPropio(yo, ataque) ? 'De su tipo: pega ×1,5 más fuerte' : 'No es de su tipo: pega algo menos',
    ...(climaFactor !== 1 ? [`${CLIMAS[climaCombate].nombre}: ×${String(climaFactor).replace('.', ',')}`] : []),
    ...rasgos.map(([, texto]) => texto),
  ].join('\n');
  return crear('button', {
    type: 'button',
    clase: 'accion accion-ataque',
    atributos: { 'data-categoria': ataque.categoria, ...(ayudas ? { 'data-efecto': efecto(mult) } : {}), ...(climaFactor !== 1 ? { 'data-clima': climaFactor > 1 ? 'potencia' : 'debilita' } : {}) },
    estilos: { '--color-tipo': tipo.color },
    title: explicacion,
    alPulsar: () => jugarTurno({ tipo: 'atacar', ataque }),
  },
    crear('span', { clase: 'accion-icono' }, crearIcono(tipo.icono)),
    crear('strong', { texto: ataque.nombre }),
    crear('small', { clase: 'accion-detalle' },
      crear('span', { texto: `${clase} · ${ataque.poder} · ${ataque.precision == null ? '—' : ataque.precision + ' %'}${climaFactor !== 1 ? ' ' + CLIMAS[climaCombate].icono + (climaFactor > 1 ? '↑' : '↓') : ''}` }),
      crear('em', { clase: 'accion-eficacia', texto: eficacia })),
    ...(rasgos.length ? [crear('span', { clase: 'accion-rasgos' }, ...rasgos.slice(0, 2).map(([marca]) => crear('b', { texto: marca })))] : []));
}

// --- Turnos -------------------------------------------------------------------------------------

/** Botones de la preparación, del relevo tras un K.O. y del cambio voluntario. */
async function elegirLuchador(indice) {
  if (fase === 'cambio') return jugarTurno({ tipo: 'cambiar', indice });
  const vigente = version;
  if (fase === 'preparacion') {
    estado.jugador.activo = indice;
    estado.rival.activo = elegirInicialRival(estado);
    fase = 'animando';
    pintarMando('Los Pokémon salen al campo');
    pintarFichas();
    nodos.turno.textContent = 'Turno 1';
    anotar(`¡Empieza la batalla! Sales con ${nombre(activo(estado, 'jugador'))}; ${entrenador.articulo} ${entrenador.titulo}, con ${nombre(activo(estado, 'rival'))}.`, 'sistema');
    await mostrarLuchador('rival', true);
    if (vigente !== version) return;
    await esperar(250);
    await mostrarLuchador('jugador', true);
    if (vigente !== version) return;
    anunciar('¡A luchar!', 'inicio');
    actualizarTension();
    await esperar(800);
  } else if (fase === 'relevo') {
    estado.jugador.activo = indice;
    fase = 'animando';
    pintarMando();
    pintarFichas();
    anotar(`Sale tu ${nombre(activo(estado, 'jugador'))}.`, 'jugador');
    await mostrarLuchador('jugador', true);
    if (vigente !== version) return;
    if (activo(estado, 'rival').pv === 0) await relevoRival();
  } else return;
  if (vigente !== version) return;
  fase = 'accion';
  pintarMando();
}

/** «¡Evolucionar!»: se transforma ya (no gasta el turno) y vuelves a elegir con su forma nueva. */
async function evolucionarJugador(indice) {
  if (fase !== 'accion') return;
  const vigente = version;
  const suceso = evolucionar(estado, 'jugador', indice);
  if (!suceso) return;
  fase = 'animando';
  pintarMando('¡Está evolucionando!');
  await reproducir(suceso);
  if (vigente !== version) return;
  fase = 'accion';
  pintarMando();
}

async function jugarTurno(accionJugador) {
  if (fase !== 'accion' && fase !== 'cambio') return;
  const vigente = version;
  fase = 'animando';
  pintarMando();
  anotar(`Turno ${estado.turno}`, 'separador');
  const accionRival = decidirRival(estado);
  const sucesos = resolverTurno(estado, accionJugador, accionRival);
  for (const suceso of sucesos) {
    await reproducir(suceso);
    if (vigente !== version) return;
  }
  nodos.turno.textContent = `Turno ${estado.turno}`;
  pintarFichas();
  actualizarTension();

  const fin = ganador(estado);
  if (fin) return terminar(fin);
  if (activo(estado, 'jugador').pv === 0) { // eliges tú primero; el rival saca después
    fase = 'relevo';
    pintarMando();
    return;
  }
  if (activo(estado, 'rival').pv === 0) await relevoRival();
  if (vigente !== version) return;
  fase = 'accion';
  pintarMando();
}

async function relevoRival() {
  estado.rival.activo = elegirRelevo(estado, 'rival');
  anotar(`${mayuscula(entrenador.articulo)} ${entrenador.titulo} saca a ${nombre(activo(estado, 'rival'))}.`, 'rival');
  pintarFichas();
  await mostrarLuchador('rival', true);
  await esperar(250);
}

/** Anima un suceso del turno (ver resolverTurno en combate.js). */
async function reproducir(suceso) {
  const { lado, luchador } = suceso;
  switch (suceso.tipo) {
    case 'cambio':
      anotar(lado === 'jugador'
        ? `Retiras a ${nombre(suceso.sale)} y sale ${nombre(suceso.entra)}.`
        : `${mayuscula(entrenador.articulo)} ${entrenador.titulo} retira a ${nombre(suceso.sale)} y saca a ${nombre(suceso.entra)}.`, lado);
      if (lado === 'jugador') hablar('jugador', `¡Vuelve, ${nombre(suceso.sale)}!`, 1200);
      await nodos.arena.retirar(lado);
      pintarFichas();
      await mostrarLuchador(lado, true);
      return esperar(300);

    case 'concentra':
      anotar(`${quien(lado, luchador)} se concentra: este turno recibe la mitad de daño y su próximo golpe hará ×1,7.`, lado);
      sonido.efecto('concentrar');
      nodos.arena.concentrar(lado);
      actualizarEnergia(lado);
      return esperar(850);

    case 'prepara': { // primer turno de un movimiento de carga (Rayo Solar, Vuelo, Excavar…)
      const { ataque } = suceso;
      nodos.arena.rotulo(lado, ataque.nombre, colorDe(ataque.tipo));
      sonido.efecto(ataque.tipo);
      anotar(`${quien(lado, luchador)} usa ${ataque.nombre}: ${PREPARA[ataque.carga] || 'se prepara'}.`, lado);
      await nodos.arena.preparar(lado, ataque.carga, ataque.tipo);
      return esperar(450);
    }

    case 'ataque': {
      nodos.arena.cargado(lado, false);
      nodos.arena.rotulo(lado, suceso.ataque.nombre, colorDe(suceso.ataque.tipo));
      sonido.efecto(suceso.ataque.tipo);
      await nodos.arena.atacar(lado, suceso.ataque);
      if (suceso.falla) {
        const texto = suceso.falla === 'oculto' ? '¡No lo alcanza!' : '¡Falló!';
        sonido.efecto('falla');
        nodos.arena.esquivar(otroLado(lado), texto);
        anunciar(texto, 'nulo');
        anotar(textoAtaque(suceso), lado, 'debil');
        return esperar(750);
      }
      const { mult } = suceso;
      sonido.efecto(mult === 0 ? 'nulo' : mult >= 2 ? 'golpeFuerte' : 'golpe');
      if (mult >= 2) sonido.efecto('eficaz'); else if (mult > 0 && mult < 1) sonido.efecto('pocoEficaz');
      if (suceso.certero) sonido.efecto('critico');
      nodos.arena.golpear(otroLado(lado), suceso);
      actualizarPV(otroLado(lado));
      actualizarEnergia('jugador');
      actualizarEnergia('rival');
      if (mult >= 2) anunciar(`¡Ventaja ${simbolo(mult)}!`, 'fuerte');
      else if (mult === 0) anunciar('Sin efecto', 'nulo');
      else if (suceso.certero) anunciar('¡Certero!', 'fuerte');
      if (lado === 'rival') {
        const clave = suceso.ataque.tipo;
        danioRecibido[clave] = (danioRecibido[clave] || 0) + suceso.danio;
        if (mult >= 2 && suceso.defensor.pv > 0 && Math.random() < 0.4) hablar('rival', frase('ventaja', suceso.atacante));
      }
      anotar(textoAtaque(suceso), lado, efecto(mult));
      return esperar(850);
    }

    case 'drena':
      sonido.efecto('curar');
      nodos.arena.curar(lado, suceso.cura);
      actualizarPV(lado);
      anotar(`${quien(lado, luchador)} absorbe energía y recupera ${suceso.cura} PV.`, lado);
      return esperar(550);

    case 'retroceso':
      sonido.efecto('golpe');
      nodos.arena.danioEstado(lado, 'retroceso', suceso.danio, '#ffd0c0');
      actualizarPV(lado);
      anotar(suceso.motivo === 'coste'
        ? `${quien(lado, luchador)} pierde ${suceso.danio} PV por el esfuerzo.`
        : `${quien(lado, luchador)} también se hace daño: ${suceso.danio} PV de retroceso.`, lado);
      return esperar(550);

    case 'etapas': {
      const sube = Object.values(suceso.cambios).some(n => n > 0);
      sonido.efecto(sube ? 'subeEtapa' : 'bajaEtapa');
      nodos.arena.etapas(lado, sube);
      pintarEstado(lado);
      // «Baja el Ataque y la Defensa de tu Lucario.» (o, si unas suben y otras bajan, cada una por separado)
      const valores = Object.values(suceso.cambios);
      const de = lado === 'jugador' ? `tu ${nombre(luchador)}` : `${nombre(luchador)} (rival)`;
      const nombres = Object.keys(suceso.cambios).map(clave => ETAPAS[clave].nombre);
      anotar(valores.every(n => n > 0) || valores.every(n => n < 0)
        ? `${sube ? 'Sube' : 'Baja'}${valores.some(n => Math.abs(n) > 1) ? ' mucho' : ''} ${enumerar(nombres)} de ${de}.`
        : `${mayuscula(enumerar(Object.entries(suceso.cambios).map(([clave, n]) => `${ETAPAS[clave].nombre} ${n > 0 ? 'sube' : 'baja'}`)))} (${de}).`, lado, 'estado');
      return esperar(650);
    }

    case 'ko': {
      anunciar('K.O.', 'ko');
      anotar(`${quien(lado, luchador)} queda K.O.`, lado, 'ko');
      sonido.grito(luchador.grito, { tono: 0.72 });
      sonido.efecto('ko');
      pintarFichas();
      nodos.arena.listo(lado, false);
      if (lado === 'rival' && enPie(estado, 'rival') > 0) hablar('rival', frase('pierde', luchador));
      await nodos.arena.ko(lado);
      return esperar(300);
    }

    case 'evoluciona': {
      const antes = nombreTitulo(suceso.de);
      const despues = nombre(luchador);
      if (lado === 'rival') hablar('rival', frase('evoluciona', { nombre: suceso.de }), 2600);
      else hablar('jugador', `¡${antes}, es tu momento!`, 2000);
      anunciar(suceso.mega ? '¡Megaevolución!' : `¡${antes} evoluciona!`, 'inicio');
      anotar(lado === 'jugador' ? `¿Qué? ¡Tu ${antes} está evolucionando!` : `¿Qué? ¡${antes} (rival) está evolucionando!`, lado, 'evolucion');
      nodos.arena.listo(lado, false);
      nodos.arena.precargar([modelo(luchador)]);
      await nodos.arena.evolucionar(lado, modelo(luchador), { mega: suceso.mega });
      sonido.grito(luchador.grito);
      pintarMarcador(lado);
      pintarFichas();
      nodos.arena.estado(lado, luchador.estado?.tipo || null);
      anunciar(`¡${despues}!`, 'victoria');
      anotar(suceso.mega
        ? `¡${antes} megaevolucionó en ${despues}! Más fuerte y con un 15 % de vida recuperada.`
        : `¡${antes} evolucionó en ${despues}! Más fuerte y con un 15 % de vida recuperada.`, lado, 'evolucion');
      if (suceso.aprende?.length) anotar(`${lado === 'jugador' ? 'Tu ' + despues : despues + ' (rival)'} ahora conoce ${enumerar(suceso.aprende)}.`, lado, 'evolucion');
      return esperar(700);
    }

    case 'energiaLlena': {
      sonido.efecto('energiaLlena');
      actualizarEnergia(lado);
      nodos.arena.listo(lado, true);
      const formas = luchador.evoluciones.map(forma => modelo(forma));
      nodos.arena.precargar(formas); // la evolución ya irá rápida
      sonido.precargarGritos(luchador.evoluciones.map(forma => forma.grito));
      anotar(`¡${quien(lado, luchador)} rebosa energía! Ya puede evolucionar.`, lado, 'evolucion');
      if (lado === 'jugador') anunciar('¡Puede evolucionar!', 'inicio');
      return esperar(lado === 'jugador' ? 700 : 300);
    }

    case 'estado': {
      const datos = ESTADOS[suceso.estado];
      sonido.efecto(suceso.estado);
      nodos.arena.estado(lado, suceso.estado);
      pintarEstado(lado);
      anunciar(`¡${datos.nombre}!`, 'fuerte');
      anotar(`${quien(lado, luchador)} está ${datos.nombre.toLowerCase()}. ${DESCRIPCION_ESTADO[suceso.estado]}`, lado, 'estado');
      return esperar(750);
    }

    case 'noActua':
      sonido.efecto(suceso.estado);
      anotar(`${quien(lado, luchador)} ${NO_ACTUA[suceso.estado]}`, lado, 'estado');
      await nodos.arena.noActua(lado, suceso.estado);
      return esperar(300);

    case 'despierta':
    case 'descongela':
      sonido.efecto(suceso.tipo === 'despierta' ? 'despierta' : 'ice');
      nodos.arena.estado(lado, null);
      pintarEstado(lado);
      anotar(`${quien(lado, luchador)} ${suceso.tipo === 'despierta' ? 'se despierta.' : 'se descongela.'}`, lado);
      return esperar(500);

    case 'danioEstado': {
      sonido.efecto(suceso.estado);
      nodos.arena.danioEstado(lado, suceso.estado, suceso.danio, ESTADOS[suceso.estado].color);
      actualizarPV(lado);
      anotar(`${quien(lado, luchador)} ${suceso.estado === 'quemado' ? 'sufre por la quemadura' : 'sufre por el veneno'}: ${suceso.danio} de daño.`, lado);
      return esperar(700);
    }
    default:
      return undefined;
  }
}

const DESCRIPCION_ESTADO = {
  quemado: 'Perderá vida cada turno y sus golpes físicos harán menos daño.',
  envenenado: 'Perderá vida cada turno.',
  paralizado: 'Irá más lento y a veces no podrá moverse.',
  congelado: 'No podrá moverse hasta descongelarse (el fuego lo derrite).',
  dormido: 'No podrá moverse durante unos turnos.',
};
const NO_ACTUA = {
  dormido: 'está profundamente dormido.',
  congelado: 'está congelado y no puede moverse.',
  paralizado: 'está paralizado: ¡no puede moverse!',
  recarga: 'tiene que recargar energía y no puede moverse.',
  amedrentado: 'se amedrenta y no puede moverse.',
};

function textoAtaque({ lado, atacante, defensor, ataque, danio, mult, certero, protegido, clima, falla }) {
  const nombreAtaque = ataque.nombre;
  if (falla === 'oculto') return `${quien(lado, atacante)} usa ${nombreAtaque}… pero ${nombre(defensor)} está fuera de su alcance.`;
  if (falla) return `${quien(lado, atacante)} usa ${nombreAtaque}… ¡pero falla!`;
  if (mult === 0) return `${quien(lado, atacante)} usa ${nombreAtaque}… pero a ${nombre(defensor)} no le afecta (×0).`;
  let texto = `${quien(lado, atacante)} usa ${nombreAtaque}: ${danio} de daño a ${nombre(defensor)}.`;
  if (mult >= 2) texto += ` ¡Ventaja de tipo ${simbolo(mult)}!`;
  else if (mult < 1) texto += ` Poco eficaz (${simbolo(mult)}).`;
  if (clima > 1) texto += ` ${CLIMAS[climaCombate].icono} El clima lo potencia.`;
  else if (clima < 1) texto += ` ${CLIMAS[climaCombate].icono} El clima lo debilita.`;
  if (certero) texto += ' ¡Golpe certero!';
  if (protegido) texto += ' (Estaba concentrado: recibe la mitad).';
  return texto;
}

function anotar(texto, lado, extra = '') {
  if (!nodos.registro) return;
  nodos.registro.prepend(crear('li', { clase: `registro-${lado} ${extra}`.trim(), texto }));
  while (nodos.registro.children.length > MAX_REGISTRO) nodos.registro.lastElementChild.remove();
}

// --- Final -----------------------------------------------------------------------------------------

function terminar(ganadorLado) {
  fase = 'final';
  const victoria = ganadorLado === 'jugador';
  guardarRecord(modoCombate, estado.nivel, victoria);
  const turnos = estado.turno - 1;
  const quedan = enPie(estado, ganadorLado);
  const total = estado[ganadorLado].equipo.length;
  const mvp = [...estado.jugador.equipo].sort((a, b) => b.danioHecho - a.danioHecho)[0];
  const evoluciones = estado.jugador.equipo.reduce((suma, l) => suma + l.evoluciono, 0);
  sonido.fanfarria(victoria);
  nodos.arena.celebrar(ganadorLado);
  anunciar(victoria ? '¡Victoria!' : 'Derrota', victoria ? 'victoria' : 'ko');
  hablar('rival', frase(victoria ? 'pierdeCombate' : 'gana'), 4000);
  anotar(victoria ? '¡Victoria! Has ganado la batalla.' : 'Derrota: el rival ha ganado la batalla.', 'sistema');
  nodos.turno.textContent = victoria ? 'Victoria' : 'Derrota';
  arena.dataset.resultado = victoria ? 'victoria' : 'derrota';
  nodos.mando.dataset.fase = 'final';
  const resumen = [
    `${turnos} turnos`,
    modoCombate === 'duelo' ? 'uno contra uno' : `${victoria ? 'te quedaron' : 'al rival le quedaron'} ${quedan} de ${total} en pie`,
    ...(evoluciones ? [`${evoluciones} ${evoluciones === 1 ? 'evolución' : 'evoluciones'}`] : []),
    ...(climaCombate ? [`${CLIMAS[climaCombate].icono} ${CLIMAS[climaCombate].nombre.toLowerCase()}`] : []),
    `nivel ${NIVELES_SIMULACRO[estado.nivel].nombre}`,
  ].join(' · ');
  nodos.mando.replaceChildren(crear('div', { clase: 'arena-final', atributos: { 'data-resultado': victoria ? 'victoria' : 'derrota' } },
    crear('span', { clase: 'final-sello', texto: victoria ? '✦ Victoria ✦' : 'Derrota' }),
    crear('h3', { texto: victoria ? `¡Venciste a ${entrenador.articulo} ${entrenador.titulo}!` : `${mayuscula(entrenador.articulo)} ${entrenador.titulo} se impuso esta vez` }),
    crear('p', { texto: resumen }),
    crear('div', { clase: 'final-mvp' },
      crear('img', { src: mvp.sprite || mvp.imagen, alt: '' }),
      crear('span', {},
        crear('small', { texto: modoCombate === 'duelo' ? 'Tu luchador' : 'El mejor de tu equipo' }),
        crear('strong', { texto: nombre(mvp) }),
        crear('span', { texto: `${mvp.danioHecho} de daño · ${mvp.kos} K.O.` }))),
    ...(victoria ? [] : [crear('p', { clase: 'final-consejo', texto: consejoFinal() })]),
    crear('div', { clase: 'final-botones' },
      crear('button', { type: 'button', clase: 'final-principal', texto: 'Revancha', alPulsar: () => empezar(true) }),
      crear('button', { type: 'button', texto: 'Nuevo rival', alPulsar: () => empezar(false) }),
      crear('button', { type: 'button', texto: 'Cerrar', alPulsar: abandonar })),
  ));
  document.dispatchEvent(new CustomEvent('batalla-terminada')); // duelo.js actualiza el récord
}

/** Tras una derrota: con qué te hizo más daño el rival. */
function consejoFinal() {
  const [clave] = Object.entries(danioRecibido).sort((a, b) => b[1] - a[1])[0] || [];
  if (!clave) return 'Prueba a concentrarte cuando el rival no pueda hacerte mucho daño.';
  const resisten = Object.keys(TIPOS).filter(t => multiplicadorContra(clave, [t]) < 1).map(t => TIPOS[t].nombre);
  return `El rival te hizo más daño con ataques de tipo ${TIPOS[clave].nombre}. Lo resisten: ${resisten.join(', ') || 'ningún tipo'}. ${modoCombate === 'duelo' ? 'Prueba con un luchador de uno de esos tipos.' : 'Saca a uno de esos antes de recibirlo.'}`;
}
