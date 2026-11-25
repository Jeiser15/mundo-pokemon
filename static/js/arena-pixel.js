// Arena de batalla en pixel art con la cámara desde arriba (la usa simulacro.js en su ventana emergente).
//
// El mundo mide 480×270 unidades (1 unidad = 1 píxel del fondo). El escenario (escenarios.js: bosque,
// volcán, playa, cueva de cristal, cumbre nevada o ruinas) se dibuja una vez con semilla fija y se agranda
// sin suavizar (píxeles gordos); su ambiente animado (lava, olas, luciérnagas, nieve…) va en cada fotograma.
// El <canvas> se dibuja a la resolución REAL de la pantalla (con la densidad de píxeles del dispositivo) y
// una «cámara» pasa del mundo a la pantalla:
//   · cada sprite se dibuja con un número ENTERO de píxeles de pantalla por píxel del sprite (nítido y
//     parejo) si eso no cambia su tamaño más de un 6 %; su posición avanza píxel a píxel de pantalla;
//   · su tamaño sale de su altura real (altoObjetivo), medida en su fotograma típico;
//   · los Pokémon usan sus sprites ANIMADOS (GIF de PokéAPI, decodificados con ImageDecoder); si no hay,
//     el sprite fijo.
// Un bucle con requestAnimationFrame redibuja todo: campo, sombras, Pokémon, efectos (partículas con
// brillo, haces, rayos, ondas…), números de daño y letreros (fuente-pixel.js). Los efectos se dibujan en
// dos capas a baja resolución (bajo y sobre los Pokémon) que se amplían sin suavizar: pixel art como ellos.
//
// Las acciones (entrar, atacar, recibir, caer…) devuelven promesas que simulacro.js espera en orden.
// Movimientos: cada Pokémon lleva 4 movimientos reales (combate.js) y animacionDe() elige cómo se ve cada
// uno, con el anime como referencia: por su nombre (ANIMACIONES: Placaje Eléctrico es una esfera eléctrica
// que embiste, Triturar unas fauces enormes, Tijera X una X brillante, Vuelo cae del cielo…) y, si no está,
// por su tipo y clase (POR_TIPO). Son familias con opciones (embestida, puñetazos, fauces, garras, filo,
// coletazo, haz, esfera, ola, desde el cielo, proyectiles…), dibujadas con formas de pixel art con borde y,
// como en los juegos, el fondo cambia mientras duran (fondo(): tormenta, noche, rosa psíquico que ondula…).
// atacar() se cumple en el instante del impacto. rotulo() muestra el nombre del movimiento. Los de dos
// turnos se preparan con preparar() (se esconde bajo tierra, vuela, acumula luz…).
// Además: los Pokémon salen de una Poké Ball y vuelven a ella con un rayo rojo; evolucionan con la silueta
// de luz que alterna entre las dos formas (arcoíris si es megaevolución); el clima del combate (lluvia,
// granizo, arena, niebla o sol) se dibuja encima del campo; los estados alterados se ven sobre el Pokémon;
// el combate empieza con una transición de franjas y la victoria acaba con confeti. La arena no suena por
// sí misma: avisa con `sonar(nombre)` (sonido.js) en los momentos justos.
// Entrenadores (opcional, `entrenadores: { jugador, rival }` con su aspecto; entrenador.js): entran caminando por
// los lados al empezar, lanzan la Poké Ball desde la mano, señalan al rival al dar una orden, recogen a su Pokémon
// con el rayo rojo, bajan la cabeza cuando cae uno de los suyos y celebran al ganar.

import { PALETAS_ATAQUE } from './datos.js';
import { coloresDe, hojaDeAtaque, LADO_SPRITE } from './sprites-ataques.js';
import { ALTO, ANCHO, CASA, crearAmbiente, dibujarFondo, SUELO } from './escenarios.js';
import { lienzoEntrenador, manoDe as manoEntrenador, medidasDe as medidasEntrenador, prepararEntrenador } from './entrenador.js';
import { anchoTexto, dibujarTexto } from './fuente-pixel.js';

export { ALTO, ANCHO }; // tamaño del mundo (el lienzo real se ajusta a la pantalla)
const DIRECCION = { jugador: 1, rival: -1 };
const FUEGO = ['#fffbe0', '#ffe27a', '#ff9a2e', '#e2461c', '#8a2a14', '#3a2a24'];
const LLAMA_AZUL = ['#ffffff', '#d6ecff', '#8cc4ff', '#4a7ce0', '#25397a', '#1a2040'];
const ARCOIRIS = ['#ff5a5a', '#ffb84a', '#ffe94a', '#6aff8a', '#5ac8ff', '#a86aff'];
const COLOR_TONO = { fuerte: '#ffd36a', ko: '#ff8f70', inicio: '#cbe89c', victoria: '#ffe08a', nulo: '#e0e7e2', normal: '#ffffff' };
const TINTES = { fire: '#ff7a2e', electric: '#ffe14a', ice: '#a6eeff', poison: '#b469d6', psychic: '#ff7ab0', ghost: '#5b3a8f', dark: '#2a2238', water: '#5fb2ff', grass: '#7fd06a', dragon: '#7f8cff', fairy: '#ffb3dc' };
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const reducido = () => movimientoReducido.matches;
const ahora = () => performance.now();
const pausa = ms => new Promise(listo => setTimeout(listo, reducido() ? Math.min(ms, 60) : ms));
const entre = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

const RGB = new Map();
const rgb = hex => {
  if (!RGB.has(hex)) RGB.set(hex, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  return RGB.get(hex);
};
/** Color a lo largo de una lista (0 = el primero, 1 = el último): las partículas cambian de color al envejecer. */
function mezclar(colores, t) {
  if (colores.length === 1) return colores[0];
  const pos = Math.min(0.999, Math.max(0, t)) * (colores.length - 1);
  const i = Math.floor(pos);
  const [a, b] = [rgb(colores[i]), rgb(colores[i + 1])];
  const f = pos - i;
  return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
}

const vistasPrevias = new Map();
/** El fondo de un escenario, para mostrarlo como vista previa (480×270; agrándalo con image-rendering: pixelated). */
export function dibujarVistaPrevia(escenario) {
  if (!vistasPrevias.has(escenario)) vistasPrevias.set(escenario, dibujarFondo(escenario));
  const copia = document.createElement('canvas');
  copia.width = ANCHO;
  copia.height = ALTO;
  copia.getContext('2d').drawImage(vistasPrevias.get(escenario), 0, 0);
  return copia;
}

// --- Modelos: sprites animados (GIF) o fijos -----------------------------------------------------------

const modelos = new Map();

/** Carga el modelo de un Pokémon (con caché): primero sus GIF animados; si no, el sprite fijo; si no, la ilustración. */
function cargarModelo(datos) {
  const clave = [...(datos.animados || []), datos.sprite, datos.imagen].filter(Boolean).join('|');
  if (!modelos.has(clave)) {
    modelos.set(clave, crearModelo(datos).then(modelo => { if (!modelo) modelos.delete(clave); return modelo; }));
  }
  return modelos.get(clave);
}

/** Lo mismo sin caché; el modelo dice de qué archivo salió (`origen`). También lo usan las pruebas. */
export async function crearModelo(datos) {
  for (const url of datos.animados || []) { const m = await decodificarGif(url); if (m) return { ...m, origen: url }; }
  for (const url of [datos.sprite, datos.imagen].filter(Boolean)) { const m = await cargarEstatico(url); if (m) return { ...m, origen: url }; }
  return null;
}

async function decodificarGif(url) {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    // El archivo entero (no un flujo): si no, al leer cuántos fotogramas tiene aún no han llegado todos y
    // el Pokémon repetiría solo los primeros, a toda velocidad.
    const datos = await respuesta.arrayBuffer();
    const cuadros = 'ImageDecoder' in window ? await leerConImageDecoder(datos) : leerGif(datos);
    return cuadros.length ? await completarModelo(cuadros, cuadros.length > 1) : null;
  } catch {
    return null;
  }
}

const MAX_CUADROS = 400; // los GIF más largos (Regieleki, Xurkitree) tienen ~300

/** Fotogramas ya compuestos con el decodificador del navegador (Chrome y Edge). */
async function leerConImageDecoder(datos) {
  const decodificador = new ImageDecoder({ data: datos, type: 'image/gif' });
  await decodificador.tracks.ready;
  await decodificador.completed;
  const total = Math.min(MAX_CUADROS, decodificador.tracks.selectedTrack.frameCount);
  const cuadros = [];
  for (let i = 0; i < total; i++) {
    const { image } = await decodificador.decode({ frameIndex: i });
    cuadros.push({ fuente: await createImageBitmap(image), msArchivo: (image.duration || 0) / 1000 });
    image.close();
  }
  decodificador.close();
  return cuadros;
}

/**
 * Lector de GIF propio, para los navegadores sin ImageDecoder (Firefox, Safari): descomprime cada
 * fotograma (LZW), lo pinta sobre el anterior respetando la transparencia y la «disposición» (borrar o
 * restaurar después de mostrarlo) y devuelve los fotogramas compuestos como lienzos, con su duración.
 * También lo usan las pruebas (se compara con ImageDecoder píxel a píxel).
 */
export function leerGif(buffer) {
  const b = new Uint8Array(buffer);
  if (b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) throw new Error('No es un GIF');
  let p = 6;
  const u16 = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v; };
  const ancho = u16(); const alto = u16();
  const banderas = b[p]; p += 3;
  let paletaGlobal = null;
  if (banderas & 0x80) { const n = 3 * (1 << ((banderas & 7) + 1)); paletaGlobal = b.subarray(p, p + n); p += n; }
  const pantalla = new ImageData(ancho, alto); // lo que se ve, fotograma a fotograma
  const px = pantalla.data;
  const cuadros = [];
  let retraso = 0; let transparente = -1; let disposicion = 0;
  while (p < b.length && cuadros.length < MAX_CUADROS) {
    const bloque = b[p++];
    if (bloque === 0x3b) break; // fin del archivo
    if (bloque === 0x21) { // extensión: solo interesa la de control (duración, transparencia, disposición)
      const etiqueta = b[p++];
      if (etiqueta === 0xf9) {
        p++; const f = b[p++];
        disposicion = (f >> 2) & 7; retraso = u16() * 10; const indice = b[p++]; transparente = f & 1 ? indice : -1; p++;
      } else { while (b[p]) p += b[p] + 1; p++; }
      continue;
    }
    if (bloque !== 0x2c) break; // algo raro: se queda con lo leído
    const x = u16(); const y = u16(); const w = u16(); const h = u16(); const f = b[p++];
    let paleta = paletaGlobal;
    if (f & 0x80) { const n = 3 * (1 << ((f & 7) + 1)); paleta = b.subarray(p, p + n); p += n; }
    const minimo = b[p++];
    let total = 0;
    for (let q = p; b[q]; q += b[q] + 1) total += b[q];
    const comprimido = new Uint8Array(total);
    for (let o = 0; b[p]; p += b[p] + 1) { comprimido.set(b.subarray(p + 1, p + 1 + b[p]), o); o += b[p]; }
    p++;
    const indices = descomprimirLZW(minimo, comprimido, w * h);
    const antes = disposicion === 3 ? new Uint8ClampedArray(px) : null;
    const filas = f & 0x40 ? filasEntrelazadas(h) : null;
    for (let i = 0; i < h; i++) {
      const py = y + (filas ? filas[i] : i);
      if (py >= alto) continue;
      for (let j = 0; j < w; j++) {
        const c = indices[i * w + j];
        if (c === transparente || x + j >= ancho || !paleta || c * 3 >= paleta.length) continue;
        const k = (py * ancho + x + j) * 4;
        px[k] = paleta[c * 3]; px[k + 1] = paleta[c * 3 + 1]; px[k + 2] = paleta[c * 3 + 2]; px[k + 3] = 255;
      }
    }
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    lienzo.getContext('2d').putImageData(pantalla, 0, 0);
    cuadros.push({ fuente: lienzo, msArchivo: retraso });
    if (disposicion === 2) { // se borra su rectángulo
      for (let i = y; i < Math.min(alto, y + h); i++) px.fill(0, (i * ancho + x) * 4, (i * ancho + Math.min(ancho, x + w)) * 4);
    } else if (antes) px.set(antes); // se vuelve a lo que había antes
    retraso = 0; transparente = -1; disposicion = 0;
  }
  return cuadros;
}

/** Orden de las filas de un GIF entrelazado: primero cada 8.ª, luego las intermedias. */
function filasEntrelazadas(h) {
  const filas = [];
  for (const [inicio, paso] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let f = inicio; f < h; f += paso) filas.push(f);
  return filas;
}

/** Descompresión LZW de un fotograma GIF: devuelve el índice de color de cada píxel. */
function descomprimirLZW(minimo, datos, cuantos) {
  const salida = new Uint8Array(cuantos);
  const limpiar = 1 << minimo; const fin = limpiar + 1;
  const prefijo = new Int16Array(4096); const sufijo = new Uint8Array(4096); const pila = new Uint8Array(4097);
  for (let i = 0; i < limpiar; i++) sufijo[i] = i;
  let tam = minimo + 1; let mascara = (1 << tam) - 1; let siguiente = fin + 1;
  let anterior = -1; let primero = 0; let bits = 0; let acumulado = 0; let o = 0; let i = 0;
  while (o < cuantos) {
    while (bits < tam) { if (i >= datos.length) return salida; acumulado |= datos[i++] << bits; bits += 8; }
    const codigo = acumulado & mascara; acumulado >>>= tam; bits -= tam;
    if (codigo === limpiar) { tam = minimo + 1; mascara = (1 << tam) - 1; siguiente = fin + 1; anterior = -1; continue; }
    if (codigo === fin) break;
    if (anterior === -1) { salida[o++] = sufijo[codigo]; anterior = codigo; primero = codigo; continue; }
    let actual = codigo; let sp = 0;
    if (codigo >= siguiente) { pila[sp++] = primero; actual = anterior; } // el caso «KwKwK»
    while (actual >= limpiar) { pila[sp++] = sufijo[actual]; actual = prefijo[actual]; }
    pila[sp++] = actual;
    primero = actual;
    while (sp && o < cuantos) salida[o++] = pila[--sp];
    if (siguiente < 4096) {
      prefijo[siguiente] = anterior; sufijo[siguiente] = primero; siguiente++;
      if (siguiente > mascara && tam < 12) { tam++; mascara = (1 << tam) - 1; }
    }
    anterior = codigo;
  }
  return salida;
}

function cargarEstatico(url) {
  return new Promise(listo => {
    const imagen = new Image();
    imagen.crossOrigin = 'anonymous'; // raw.githubusercontent.com lo permite: así se pueden leer sus píxeles
    imagen.onload = () => {
      const copia = document.createElement('canvas');
      copia.width = imagen.naturalWidth;
      copia.height = imagen.naturalHeight;
      copia.getContext('2d').drawImage(imagen, 0, 0);
      completarModelo([{ fuente: copia, msArchivo: 0 }], false).then(listo, () => listo(null));
    };
    imagen.onerror = () => listo(null);
    imagen.src = url;
  });
}

/**
 * Caja que cubre el dibujo en TODOS los fotogramas (sin los bordes transparentes). Cada fotograma se
 * recorta a esa caja (ocupa mucha menos memoria) y lleva su duración: la del archivo, como en Showdown.
 * Las de 10 ms o menos valen 100 ms, como hacen los navegadores con los GIF.
 * `altoTipico`: la altura del dibujo en un fotograma normal (la mediana). Con ella se calcula su tamaño:
 * con la caja de todos, a los que agitan las alas hacia arriba (Charizard) les tocaba encogerse.
 */
async function completarModelo(cuadros, animado) {
  const { width: ancho, height: alto } = cuadros[0].fuente;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  let x0 = ancho; let y0 = alto; let x1 = -1; let y1 = -1;
  const altos = []; // alto del dibujo en cada fotograma
  try {
    for (const cuadro of cuadros) {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.drawImage(cuadro.fuente, 0, 0);
      const datos = ctx.getImageData(0, 0, ancho, alto).data;
      let arriba = alto; let abajo = -1;
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
        if (datos[(y * ancho + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (y < arriba) arriba = y; abajo = y;
        }
      }
      if (abajo >= 0) altos.push(abajo - arriba + 1);
    }
  } catch { /* sin permiso para leer píxeles: se usa la imagen entera */ }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = ancho - 1; y1 = alto - 1; }
  const w = x1 - x0 + 1; const h = y1 - y0 + 1;
  altos.sort((a, b) => a - b);
  const altoTipico = altos.length ? altos[Math.floor(altos.length / 2)] : h;
  const recortes = await Promise.all(cuadros.map(c => createImageBitmap(c.fuente, x0, y0, w, h)));
  cuadros.forEach((c, i) => {
    c.fuente.close?.();
    c.fuente = recortes[i];
    c.ms = !animado ? 1e9 : c.msArchivo > 10 ? c.msArchivo : 100;
  });
  return { cuadros, animado, total: cuadros.reduce((suma, c) => suma + c.ms, 0), caja: { x: 0, y: 0, w, h }, altoTipico };
}

/**
 * Alto en el mundo según la altura real: 44 unidades por metro elevado a 0,75 (un poco menos que
 * proporcional, para que los pequeños se vean y los gigantes quepan). Pikachu (0,4 m) 22, Lucario (1,2 m)
 * 50, Charizard (1,7 m) 65, Garchomp (1,9 m) 71 y, como mucho, 140 (Onix, Rayquaza…). Mínimo 16.
 */
const altoObjetivo = altura => Math.min(140, Math.max(16, 44 * Math.pow(Math.max(0.1, altura || 1), 0.75)));
/** Ancho máximo en el mundo: los muy alargados (Kyogre, Wailord, Dondozo) se encogen para no pisar al rival. */
const ANCHO_MAXIMO = 185;
/**
 * Dónde se coloca cada bando según lo ancho que sea: en su casilla o, si no cabe, más hacia fuera, de
 * modo que entre los dos quede siempre un hueco en el centro.
 */
const posicionDe = (lado, ancho) => (lado === 'jugador'
  ? Math.min(CASA.jugador, ANCHO / 2 - 26 - ancho / 2)
  : Math.max(CASA.rival, ANCHO / 2 + 26 + ancho / 2));

// --- La arena -------------------------------------------------------------------------------------------

/**
 * Prepara la arena en un <canvas> y arranca su bucle de dibujo.
 * @param {HTMLCanvasElement} lienzo
 * @param {{ escenario?: string }} opciones  escenario: clave de ESCENARIOS (datos.js; los dibuja escenarios.js)
 */
export function crearArenaPixel(lienzo, { escenario = 'bosque', clima = null, sonar = () => {}, entrenadores: aspectos = null, colores = null } = {}) {
  // Dos capas de efectos a baja resolución (2 píxeles por unidad del mundo, como los de los sprites) que se
  // amplían sin suavizar: así los ataques, partículas y climas se ven en pixel art, igual que los Pokémon.
  const RESOLUCION_EFECTOS = 2;
  const capaSuelo = document.createElement('canvas');
  const capaAire = document.createElement('canvas');
  for (const capa of [capaSuelo, capaAire]) { capa.width = ANCHO * RESOLUCION_EFECTOS; capa.height = ALTO * RESOLUCION_EFECTOS; }
  const contextos = { real: lienzo.getContext('2d'), suelo: capaSuelo.getContext('2d'), aire: capaAire.getContext('2d') };
  let ctx = contextos.real;
  const campo = dibujarFondo(escenario, { colores });
  const ambiente = crearAmbiente(escenario, { colores });
  const bufer = document.createElement('canvas'); // para teñir un sprite (destello blanco, color del ataque)
  const bctx = bufer.getContext('2d');

  // El lienzo mide lo mismo que en pantalla (por la densidad de píxeles): así nada se ve borroso.
  const ajustarTamano = () => {
    const caja = lienzo.getBoundingClientRect();
    const densidad = Math.min(2, window.devicePixelRatio || 1);
    const ancho = Math.max(320, Math.round((caja.width || 800) * densidad));
    if (lienzo.width !== ancho) { lienzo.width = ancho; lienzo.height = Math.round((ancho * ALTO) / ANCHO); }
  };
  const observador = new ResizeObserver(ajustarTamano);
  observador.observe(lienzo);
  ajustarTamano();

  const nuevoLuchador = lado => ({
    lado, x: CASA[lado], ox: 0, oy: 0, sx: 1, sy: 1, alfa: 1, blanco: 0, tinte: { color: '#ffffff', alfa: 0 },
    mira: lado === 'jugador' ? -1 : 1, // los sprites miran a la izquierda: el tuyo se voltea para mirar al rival
    visible: false, quieto: true, parpadeo: false, cargado: false, rareza: null, modelo: null, escala: 1, clave: null,
    estado: null, listo: false, // estado alterado ('quemado'…) y si ya puede evolucionar
    oculto: null, preparado: null, // escondido por un movimiento de carga ('aire'…) o acumulando energía ({ modo, color })
    reloj: Math.random() * 1000, fase: lado === 'jugador' ? 0 : 1.7,
  });
  const luchadores = { jugador: nuevoLuchador('jugador'), rival: nuevoLuchador('rival') };
  // Entrenadores: a cada lado, un poco por detrás de los Pokémon (más arriba en la vista 3/4).
  const ESCALA_ENTRENADOR = 1; // unidades del mundo por píxel de su sprite (× la unidad de medidasDe)
  const PIES_ENTRENADOR_Y = SUELO - 7;
  const CASA_ENTRENADOR = { jugador: 24, rival: ANCHO - 24 };
  const entrenadores = Object.fromEntries(['jugador', 'rival'].map(lado => [lado, aspectos?.[lado]
    ? { lado, aspecto: aspectos[lado], x: CASA_ENTRENADOR[lado], pose: 'quieto', paso: 0, visible: false, hastaPose: 0, celebrando: false }
    : null]));
  for (const E of Object.values(entrenadores)) if (E) prepararEntrenador(E.aspecto); // los de los juegos: que vayan llegando
  const camara = { x: ANCHO / 2, y: ALTO / 2, zoom: 1 };
  const tweens = [];
  const particulas = [];
  const efimeros = [];
  const textos = [];
  let anuncio = null;
  let rotulo = null; // nombre del movimiento bajo el atacante
  let tapado = true; // negro hasta que empieza la transición de entrada
  let temblor = { fuerza: 0, hasta: 0, ms: 1 };
  let activo = true;
  let detenida = false; // detener() es para siempre; pausar() se puede deshacer
  let anterior = ahora();

  // --- Cámara: del mundo a la pantalla ----------------------------------------------------------
  let S = 1; let W = 1; let H = 1; let sacudidaX = 0; let sacudidaY = 0;
  let Sreal = 1; let sacudida = { x: 0, y: 0 }; // escala y temblor del lienzo real
  const X = x => (x - camara.x) * S + W / 2 + sacudidaX;
  const Y = y => (y - camara.y) * S + H / 2 + sacudidaY;
  /** Dibuja en el lienzo real ('real') o en una capa de efectos ('suelo', 'aire'): ajusta pincel, escala y temblor. */
  function usar(nombre) {
    ctx = contextos[nombre];
    W = nombre === 'real' ? lienzo.width : ANCHO * RESOLUCION_EFECTOS;
    H = nombre === 'real' ? lienzo.height : ALTO * RESOLUCION_EFECTOS;
    S = (W / ANCHO) * camara.zoom;
    sacudidaX = Math.round((sacudida.x * W) / lienzo.width);
    sacudidaY = Math.round((sacudida.y * W) / lienzo.width);
    ctx.imageSmoothingEnabled = false;
  }
  /** Pega una capa de efectos sobre el lienzo real, ampliada sin suavizar (píxeles gordos). */
  function componer(capa) {
    usar('real');
    ctx.drawImage(capa, 0, 0, W, H);
  }
  // Píxeles de pantalla por píxel del sprite: un número entero (píxeles parejos) si así cambia su tamaño menos
  // de un 6 %; si no, el valor exacto (redondear agrandaba o encogía a algunos hasta un 25 % y los tamaños no
  // cuadraban). En pantallas pequeñas el sprite tiene que verse más pequeño que el original: se reduce suavizado.
  const pixelesPorUnidad = L => {
    const bruto = Sreal * L.escala;
    if (bruto < 0.75) return bruto;
    const entero = Math.max(1, Math.round(bruto));
    return Math.abs(entero - bruto) / bruto <= 0.06 ? entero : bruto;
  };

  // --- Medidas y puntos de referencia de cada luchador (en unidades del mundo) -----------------
  const anchoDe = L => (L.modelo ? (L.modelo.caja.w * pixelesPorUnidad(L)) / Sreal : 40);
  const altoDe = L => (L.modelo ? (L.modelo.caja.h * pixelesPorUnidad(L)) / Sreal : 40);
  const centro = L => ({ x: L.x + L.ox, y: SUELO + L.oy - altoDe(L) * 0.5 });
  const boca = L => ({ x: L.x + L.ox + DIRECCION[L.lado] * anchoDe(L) * 0.3, y: SUELO + L.oy - altoDe(L) * 0.64 });
  const cabeza = L => ({ x: L.x + L.ox, y: SUELO + L.oy - altoDe(L) - 6 });
  const pie = L => ({ x: L.x + L.ox, y: SUELO });

  // --- Motor de animación ----------------------------------------------------------------------
  const CURVAS = { lineal: t => t, suave: t => t * t * (3 - 2 * t), acelera: t => t * t, frena: t => 1 - (1 - t) * (1 - t), rebote: t => 1 - Math.pow(1 - t, 3) * Math.cos(t * 6) };
  function animar(objeto, destino, ms, curva = 'suave') {
    if (reducido()) { Object.assign(objeto, destino); return Promise.resolve(); }
    return new Promise(listo => {
      const desde = Object.fromEntries(Object.keys(destino).map(k => [k, objeto[k]]));
      tweens.push({ objeto, desde, destino, inicio: ahora(), ms, curva: CURVAS[curva], listo });
    });
  }
  /** Algo que se dibuja durante `ms` en una capa ('suelo', 'aire' o 'pantalla'); se cumple al terminar. */
  function efimero(ms, dibujar, { retraso = 0, capa = 'aire' } = {}) {
    return new Promise(listo => efimeros.push({ inicio: ahora() + retraso, ms, dibujar, capa, listo }));
  }
  /** Llama a `cadaCuadro(p)` en cada fotograma durante `ms` (para soltar partículas). */
  const emitir = (ms, cadaCuadro, opciones) => efimero(ms, p => cadaCuadro(p), opciones);
  const particula = p => {
    if (reducido()) return;
    particulas.push({ vx: 0, vy: 0, g: 0, arrastre: 0, tam: 2, tamFin: null, vida: 400, forma: 'cuadro', giro: 0, vgiro: 0, alfa: 1, capa: 'aire', ...p, nacio: ahora() });
  };
  const temblar = (fuerza, ms) => { if (!reducido() && fuerza >= temblor.fuerza * ((temblor.hasta - ahora()) / temblor.ms)) temblor = { fuerza, hasta: ahora() + ms, ms }; };
  const destellar = (color, ms, alfa = 0.6) => efimero(ms, p => { ctx.globalAlpha = alfa * (1 - p); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }, { capa: 'pantalla' });
  const textoFlotante = (texto, x, y, opciones = {}) => textos.push({ texto, x, y, inicio: ahora(), ms: 1200, tamano: 1.6, color: '#fff', ...opciones });

  // --- Pinceles (todo se pasa a píxeles de pantalla) -----------------------------------------
  const texturas = new Map();
  function texturaBrillo(color) {
    if (!texturas.has(color)) {
      const t = document.createElement('canvas');
      t.width = t.height = 64;
      const c = t.getContext('2d');
      const [r, g, b] = rgb(color.startsWith('#') ? color : '#ffffff');
      const degradado = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      degradado.addColorStop(0, `rgba(${r},${g},${b},1)`);
      degradado.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
      degradado.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = degradado;
      c.fillRect(0, 0, 64, 64);
      texturas.set(color, t);
    }
    return texturas.get(color);
  }
  /** Halo de luz (se suma a lo que hay debajo). */
  function brillo(x, y, radio, color, alfa = 1) {
    if (radio <= 0 || alfa <= 0) return;
    const r = radio * S;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alfa);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(texturaBrillo(color), X(x) - r, Y(y) - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  /** Cuadradito de `tam` unidades (un píxel gordo). */
  function cuadro(x, y, tam, color) {
    const t = Math.max(1, Math.round(tam * S));
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(X(x) - t / 2), Math.round(Y(y) - t / 2), t, t);
  }
  /** Línea o polilínea con grosor en unidades; con `halo`, se dibuja antes una versión ancha y suave. */
  function trazo(puntos, grosor, color, { alfa = 1, halo = null, aditivo = false } = {}) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const camino = () => { ctx.beginPath(); puntos.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); };
    if (halo) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alfa * 0.35;
      ctx.strokeStyle = halo;
      ctx.lineWidth = Math.max(2, grosor * 3 * S);
      camino(); ctx.stroke();
    }
    ctx.globalCompositeOperation = aditivo ? 'lighter' : 'source-over';
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, grosor * S);
    camino(); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  function disco(x, y, r, color, alfa = 1) {
    ctx.globalAlpha = alfa;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(X(x), Y(y), Math.max(0.5, r * S), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function aro(x, y, r, grosor, color, alfa = 1, achatado = 1) {
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, grosor * S);
    ctx.beginPath(); ctx.ellipse(X(x), Y(y), Math.max(0.5, r * S), Math.max(0.5, r * S * achatado), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /** Zigzag de rayo entre dos puntos (desplazamiento del punto medio, recursivo). */
  function zigzag(a, b, desviacion, profundidad = 4) {
    if (profundidad === 0) return [a, b];
    const medio = [(a[0] + b[0]) / 2 + entre(-desviacion, desviacion), (a[1] + b[1]) / 2 + entre(-desviacion, desviacion)];
    return [...zigzag(a, medio, desviacion / 2, profundidad - 1), ...zigzag(medio, b, desviacion / 2, profundidad - 1).slice(1)];
  }

  // --- Efectos de pantalla y de golpe ----------------------------------------------------------
  /** Estrella de impacto con chispas: el «¡pum!» de cada golpe. */
  function impacto(x, y, paleta, fuerza = 1) {
    const [c1, c2] = paleta;
    efimero(220, p => {
      const r = (8 + 14 * fuerza) * Math.min(1, p * 3);
      const puntas = 10;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      for (let i = 0; i <= puntas * 2; i++) {
        const radio = (i % 2 ? r * 0.45 : r) * S;
        const a = (i / (puntas * 2)) * Math.PI * 2 + p;
        const px = X(x) + Math.cos(a) * radio; const py = Y(y) + Math.sin(a) * radio;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = Math.max(1, 2 * S); ctx.strokeStyle = c1; ctx.stroke();
      ctx.globalAlpha = 1;
      brillo(x, y, 26 * fuerza * (1 - p), c2, 0.8);
    });
    for (let i = 0; i < Math.round(10 * fuerza); i++) {
      const a = Math.random() * Math.PI * 2; const v = entre(80, 170) * fuerza;
      particula({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, arrastre: 3, vida: entre(220, 380), colores: ['#ffffff', c2, c1], tam: 2, forma: 'chispa' });
    }
  }
  /** «Marco de impacto» como en el anime: un instante de líneas radiales y contraste alto. */
  function marcoImpacto(x, y) {
    efimero(130, p => {
      ctx.globalAlpha = 0.45 * (1 - p);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.8 * (1 - p);
      ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2 + entre(-0.05, 0.05);
        const r0 = entre(40, 70) * S;
        ctx.lineWidth = Math.max(1, entre(1, 4) * S * 0.5);
        ctx.beginPath(); ctx.moveTo(X(x) + Math.cos(a) * r0, Y(y) + Math.sin(a) * r0); ctx.lineTo(X(x) + Math.cos(a) * W, Y(y) + Math.sin(a) * W); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, { capa: 'pantalla' });
  }
  /** Golpe de cámara: se acerca un poco al objetivo y vuelve. */
  function golpeCamara(x, fuerza = 1) {
    if (reducido()) return;
    animar(camara, { zoom: 1 + 0.06 * fuerza, x: ANCHO / 2 + (x - ANCHO / 2) * 0.12 }, 90, 'frena')
      .then(() => animar(camara, { zoom: 1, x: ANCHO / 2 }, 380));
  }
  /** Líneas de velocidad que cruzan la pantalla (embestidas). */
  function lineasVelocidad(dir, ms) {
    const lineas = Array.from({ length: 14 }, () => ({ y: entre(0.1, 0.9), largo: entre(0.15, 0.35), fase: Math.random() }));
    efimero(ms, p => {
      ctx.strokeStyle = '#ffffff';
      for (const l of lineas) {
        const avance = ((p * 2.2 + l.fase) % 1) * (W + l.largo * W);
        const x = dir > 0 ? W - avance : avance - l.largo * W;
        ctx.globalAlpha = 0.35 * Math.sin(p * Math.PI);
        ctx.lineWidth = Math.max(1, S * 0.8);
        ctx.beginPath(); ctx.moveTo(x, l.y * H); ctx.lineTo(x + l.largo * W, l.y * H); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, { capa: 'pantalla' });
  }
  function polvo(x, y, cuantas = 8, color = '#c9b08a') {
    for (let i = 0; i < cuantas; i++) {
      particula({ x: x + entre(-14, 14), y: y - entre(0, 3), vx: entre(-50, 50), vy: entre(-35, -8), g: 40, arrastre: 2, vida: entre(380, 700), colores: [color, '#8a7356'], tam: 3, tamFin: 7, forma: 'humo', alfa: 0.55 });
    }
  }
  /** Inclinación de preparación hacia atrás (anticipación) y salida hacia delante. */
  async function anticipar(L, ms = 160) {
    L.quieto = false;
    await animar(L, { ox: -DIRECCION[L.lado] * 5, sy: 0.94, sx: 1.04 }, ms, 'frena');
  }
  function soltar(L) {
    animar(L, { ox: DIRECCION[L.lado] * 7, sy: 1.04, sx: 0.97 }, 130, 'frena')
      .then(() => animar(L, { ox: 0, oy: 0, sx: 1, sy: 1 }, 340)).then(() => { L.quieto = true; });
  }
  /** Carga de energía alrededor de un punto: partículas que se juntan y un halo que crece. */
  function cargar(lugar, colores, ms, radio = 34) {
    emitir(ms, () => {
      const a = Math.random() * Math.PI * 2; const r = entre(radio * 0.6, radio);
      particula({ x: lugar.x + Math.cos(a) * r, y: lugar.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, vida: 300, colores, tam: 2, brillo: 4, forma: 'chispa' });
    });
    return efimero(ms, p => brillo(lugar.x, lugar.y, 6 + 14 * p, colores[1] || colores[0], 0.4 + 0.5 * p));
  }

  function destelloEstrella(x, y, r, p) {
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, p));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rr = (i % 2 ? r * 0.2 : r) * S; i ? ctx.lineTo(X(x) + Math.cos(a) * rr, Y(y) + Math.sin(a) * rr) : ctx.moveTo(X(x) + Math.cos(a) * rr, Y(y) + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    brillo(x, y, r * 2, '#ffffff', 0.5 * Math.sin(Math.PI * Math.min(1, p)));
  }

  // --- Piezas de los ataques: chispas del aura de cada elemento, estallidos, cristales y tajos ---------
  /** Una partícula del aura de un estilo (o de su estallido al golpear, con más `fuerza`). */
  function chispaDeAura(x, y, estilo, paleta, fuerza = 1) {
    switch (estilo) {
      case 'fuego':
      case 'llama-azul':
        particula({ x, y, vx: entre(-14, 14) * fuerza, vy: -entre(40, 90) * fuerza, vida: entre(260, 440), colores: estilo === 'fuego' ? FUEGO : LLAMA_AZUL, tam: 2.5, tamFin: 6, brillo: 5, forma: 'humo', alfa: 0.85 });
        break;
      case 'rayo': {
        if (Math.random() < 0.4) { const z = zigzag([x, y], [x + entre(-14, 14), y + entre(-14, 14)], 5, 2); efimero(70, () => trazo(z, 1.1, '#ffffff', { halo: paleta[0] })); }
        particula({ x, y, vx: entre(-70, 70) * fuerza, vy: entre(-70, 70) * fuerza, arrastre: 4, vida: 220, colores: ['#ffffff', paleta[0]], tam: 1.5, forma: 'chispa' });
        break;
      }
      case 'agua':
        particula({ x, y, vx: entre(-40, 40) * fuerza, vy: -entre(30, 90) * fuerza, g: 360, vida: 420, colores: ['#ffffff', paleta[1], paleta[0]], tam: 2, forma: 'gota' });
        break;
      case 'sombra':
      case 'veneno':
        particula({ x, y, vx: entre(-16, 16) * fuerza, vy: -entre(20, 50) * fuerza, vida: 520, colores: [paleta[1], paleta[0], paleta[2]], tam: 2.5, tamFin: 6, forma: estilo === 'veneno' && Math.random() < 0.5 ? 'burbuja' : 'humo', alfa: 0.7 });
        break;
      case 'hojas':
        particula({ x, y, vx: entre(-50, 50) * fuerza, vy: entre(-50, 30) * fuerza, arrastre: 2, vida: 520, colores: [paleta[1], paleta[0], paleta[2]], tam: 2, forma: 'roca', vgiro: entre(-10, 10) });
        break;
      default: // brillos: psíquico, acero, hielo, hada, dragón, bicho
        particula({ x, y, vx: entre(-30, 30) * fuerza, vy: entre(-40, 10) * fuerza, arrastre: 2, vida: 440, colores: ['#ffffff', paleta[1], paleta[0]], tam: 2, forma: 'estrella', brillo: 3 });
    }
  }

  /** Estallido del elemento al golpear, con alguna seña propia (rayos, cristales, salpicadura, ondas…). */
  function estallido(x, y, estilo, paleta) {
    for (let i = 0; i < 16; i++) chispaDeAura(x + entre(-6, 6), y + entre(-6, 6), estilo, paleta, 2.2);
    if (estilo === 'fuego' || estilo === 'llama-azul') destellar(estilo === 'fuego' ? '#ff9a40' : '#9cc8ff', 200, 0.25);
    if (estilo === 'rayo') {
      destellar('#fff8c8', 140, 0.4);
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const z = zigzag([x, y], [x + Math.cos(a) * 34, y + Math.sin(a) * 26], 8, 3);
        efimero(180, p => trazo(z, 1.4, '#ffffff', { halo: paleta[0], alfa: 1 - p }));
      }
    }
    if (estilo === 'agua') efimero(480, p => aro(x, SUELO, 10 + p * 30, 2, paleta[1], 1 - p, 0.35), { capa: 'suelo' });
    if (estilo === 'hielo') {
      const puntas = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * Math.PI * 2 + entre(-0.3, 0.3), largo: entre(12, 22) }));
      efimero(650, p => cristales(x, y, puntas, Math.min(1, p * 5), p > 0.6 ? 1 - (p - 0.6) / 0.4 : 0.95, paleta));
    }
    if (estilo === 'psi') for (let i = 0; i < 3; i++) efimero(420, p => aro(x, y, 6 + p * 30, 2, paleta[0], 0.9 * (1 - p), 1.2), { retraso: i * 80 });
    if (estilo === 'metal') for (let i = 0; i < 3; i++) efimero(300, p => destelloEstrella(x + entre(-16, 16), y + entre(-18, 18), 3 + p * 8, p), { retraso: i * 60 });
  }

  /** Cristales de hielo que salen de un punto (`crece` de 0 a 1). */
  function cristales(x, y, puntas, crece, alfa, paleta) {
    for (const c of puntas) {
      const fx = x + Math.cos(c.a) * c.largo * crece; const fy = y + Math.sin(c.a) * c.largo * crece * 0.8;
      const nx = Math.cos(c.a + Math.PI / 2) * 3; const ny = Math.sin(c.a + Math.PI / 2) * 3;
      ctx.globalAlpha = alfa;
      ctx.fillStyle = '#d8f8ff';
      ctx.beginPath(); ctx.moveTo(X(x + nx), Y(y + ny)); ctx.lineTo(X(fx), Y(fy)); ctx.lineTo(X(x - nx), Y(y - ny)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = paleta[0]; ctx.lineWidth = Math.max(1, S * 0.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    brillo(x, y, 28, '#c8f4ff', 0.4 * alfa);
  }

  /** Arco de un tajo (media luna) que mira hacia el rival: halo de color y filo blanco. */
  function arcoTajo(x, y, r, desde, hasta, dir, color, alfa, grosor = 4) {
    const [a, b, anti] = dir > 0 ? [desde, hasta, false] : [Math.PI - desde, Math.PI - hasta, true];
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * alfa; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, grosor * 2.6 * S);
    ctx.beginPath(); ctx.arc(X(x), Y(y), r * S, a, b, anti); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alfa; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, grosor * S);
    ctx.beginPath(); ctx.arc(X(x), Y(y), r * S, a, b, anti); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- Pinceles de pixel art: formas con borde oscuro, como los efectos de los juegos -------------------
  /** Esfera (energía, lodo, sombra…): borde oscuro, cuerpo, luz y un brillo blanco. colores: [claro, medio, oscuro, borde]. */
  function bola(x, y, r, colores, alfa = 1) {
    const [claro, medio, oscuro, borde = '#120a06'] = colores;
    const px = X(x); const py = Y(y); const R = Math.max(1, r * S);
    ctx.globalAlpha = alfa;
    ctx.fillStyle = borde; ctx.beginPath(); ctx.arc(px, py, R + Math.max(1, S * 0.7), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = oscuro; ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = medio; ctx.beginPath(); ctx.arc(px - R * 0.14, py - R * 0.14, R * 0.76, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = claro; ctx.beginPath(); ctx.arc(px - R * 0.32, py - R * 0.32, R * 0.36, 0, Math.PI * 2); ctx.fill();
    const b = Math.max(1, Math.round(R * 0.2));
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(px - R * 0.5), Math.round(py - R * 0.56), b, b);
    ctx.globalAlpha = 1;
  }

  const LLAMA_FUEGO = ['#5a140a', '#d8401a', '#ff8a26', '#ffd45a', '#fff6d0'];
  const LLAMA_AURA = ['#0a1c4a', '#1f5fd0', '#4f9dff', '#a8d4ff', '#ffffff'];
  /** Llama en forma de gota: la parte redonda mira hacia `angulo` y la cola queda detrás (capas del borde al centro). */
  function llama(x, y, tam, angulo, alfa = 1, colores = LLAMA_FUEGO) {
    const T = Math.max(1, tam * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(angulo + Math.PI);
    ctx.globalAlpha = alfa;
    [1.18, 1, 0.74, 0.48, 0.22].forEach((f, i) => {
      const r = T * f;
      ctx.fillStyle = colores[i];
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.quadraticCurveTo(r * 1.3, -r * 0.55, r * 2.3, 0);
      ctx.quadraticCurveTo(r * 1.3, r * 0.55, 0, r);
      ctx.fill();
    });
    ctx.restore();
  }

  /** Hoja con borde oscuro y nervio claro. */
  function hoja(x, y, tam, giro, color) {
    const T = Math.max(1, tam * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(giro);
    const forma = r => { ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.quadraticCurveTo(0, -r * 1.15, r * 1.6, 0); ctx.quadraticCurveTo(0, r * 1.15, -r * 1.6, 0); };
    ctx.fillStyle = '#10300f'; forma(T * 1.3); ctx.fill();
    ctx.fillStyle = color; forma(T); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, S * 0.5);
    ctx.beginPath(); ctx.moveTo(-T * 1.2, 0); ctx.lineTo(T * 1.2, 0); ctx.stroke();
    ctx.restore();
  }

  /** Rayo grueso: borde oscuro, cuerpo amarillo y núcleo blanco. */
  function rayoGrueso(puntos, ancho = 3, alfa = 1, colores = ['#3a2600', '#ffd83a', '#ffffff']) {
    trazo(puntos, ancho * 1.9, colores[0], { alfa });
    trazo(puntos, ancho, colores[1], { alfa });
    trazo(puntos, ancho * 0.4, colores[2], { alfa });
  }

  /** Destello de cuatro puntas (cruz de píxeles). */
  function chispa4(x, y, r, color = '#ffffff', alfa = 1) {
    const px = Math.round(X(x)); const py = Math.round(Y(y));
    const R = Math.max(1, Math.round(r * S)); const g = Math.max(1, Math.round(R / 3));
    ctx.globalAlpha = alfa;
    ctx.fillStyle = color;
    ctx.fillRect(px - R, py - Math.floor(g / 2), R * 2 + 1, g);
    ctx.fillRect(px - Math.floor(g / 2), py - R, g, R * 2 + 1);
    ctx.globalAlpha = 1;
  }

  /** Media luna cortante (Tajo Aéreo): la parte curva mira hacia `giro`. */
  function medialuna(x, y, r, giro, alfa = 1) {
    const R = Math.max(2, r * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(giro);
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    ctx.arc(0, 0, R, -1.25, 1.25);
    ctx.arc(-R * 0.45, 0, R * 0.95, 1.05, -1.05, true);
    ctx.closePath();
    ctx.fillStyle = '#bfe2ff'; ctx.fill();
    ctx.lineWidth = Math.max(1, S * 0.7); ctx.strokeStyle = '#1d3a66'; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, S * 0.55);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.86, -0.85, 0.85); ctx.stroke();
    ctx.restore();
  }

  /** Gema facetada con borde (Joya de Luz). */
  function gemaPixel(x, y, r, color, giro = 0) {
    const R = Math.max(2, r * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(giro);
    const forma = k => { ctx.beginPath(); ctx.moveTo(0, -R * k); ctx.lineTo(R * 0.75 * k, -R * 0.25 * k); ctx.lineTo(0, R * k); ctx.lineTo(-R * 0.75 * k, -R * 0.25 * k); ctx.closePath(); };
    ctx.fillStyle = '#120a06'; forma(1.3); ctx.fill();
    ctx.fillStyle = color; forma(1); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.moveTo(0, -R * 0.25); ctx.lineTo(R * 0.75, -R * 0.25); ctx.lineTo(0, R); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-R * 0.75, -R * 0.25); ctx.lineTo(0, -R * 0.25); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** Cabeza de dragón de energía (Pulso Dragón), mirando hacia `dir`; `abierta` (0–1) abre la mandíbula. */
  const CABEZA_DRAGON = [[-11, -5], [-3, -8], [5, -7], [12, -4], [19, -1], [13, 0], [4, 1], [-4, 3], [-11, 3]];
  function cabezaDragon(x, y, largo, dir, abierta = 0, alfa = 1) {
    const f = (largo / 30) * S;
    const borde = 1.3 / (largo / 30);
    const quijada = [[-4, 3], [4, 1], [13 - abierta * 2, 2 + abierta * 6], [5, 6 + abierta * 3], [-6, 6]];
    const cuerno = [[-3, -7], [-15, -14], [-8, -5]];
    const poligono = puntos => { ctx.beginPath(); puntos.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.scale(dir * f, f);
    ctx.globalAlpha = alfa;
    ctx.lineJoin = 'round';
    for (const forma of [cuerno, quijada, CABEZA_DRAGON]) { poligono(forma); ctx.lineWidth = borde * 2; ctx.strokeStyle = '#141850'; ctx.stroke(); ctx.fillStyle = '#6e7cf0'; ctx.fill(); }
    ctx.fillStyle = '#cdd3ff';
    poligono([[-3, -7], [5, -6], [11, -3], [3, -4]]); ctx.fill();
    ctx.fillStyle = '#fff36a'; ctx.fillRect(3, -5, 3, 2);
    ctx.fillStyle = '#ffffff';
    for (const dx of [6, 10]) { poligono([[dx, 1], [dx + 1.5, 1], [dx + 0.7, 3]]); ctx.fill(); }
    ctx.restore();
  }

  /** Luna grande y rosada (Fuerza Lunar). */
  function lunaGrande(x, y, r, alfa) {
    brillo(x, y, r * 3.2, '#ff9ad6', 0.6 * alfa);
    bola(x, y, r, ['#ffffff', '#fff0f8', '#f5b8da', '#6a2a50'], alfa);
    disco(x + r * 0.3, y + r * 0.15, r * 0.22, '#f0a8cf', alfa);
    disco(x - r * 0.25, y + r * 0.4, r * 0.14, '#f0a8cf', alfa);
    disco(x + r * 0.05, y - r * 0.35, r * 0.1, '#f0a8cf', alfa);
  }

  /** Triángulo relleno en coordenadas del mundo. */
  function triangulo(x1, y1, x2, y2, x3, y3) {
    ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.lineTo(X(x3), Y(y3)); ctx.closePath(); ctx.fill();
  }

  // --- Fondo del movimiento: como en los juegos, el campo se tiñe mientras dura (debajo de los Pokémon) ---
  const FONDOS = {
    fuego: [255, 110, 30, 0.2], agua: [30, 110, 220, 0.24], tormenta: [8, 8, 22, 0.62], psiquico: [215, 70, 160, 0.34],
    oscuro: [4, 2, 10, 0.7], sombra: [35, 10, 60, 0.52], hielo: [170, 230, 255, 0.3], noche: [6, 8, 36, 0.68],
    dragon: [40, 30, 130, 0.38], luz: [255, 255, 255, 0.3], veneno: [100, 30, 130, 0.28], planta: [40, 140, 50, 0.22],
    bicho: [110, 150, 20, 0.22], tierra: [120, 70, 20, 0.3], aire: [180, 220, 255, 0.22], hiper: [255, 190, 70, 0.26],
    aura: [30, 80, 200, 0.3], acero: [24, 34, 48, 0.5],
  };
  function fondo(ms, tipo, { desde = null } = {}) {
    if (reducido()) return Promise.resolve();
    const [r, g, b, a] = FONDOS[tipo];
    const estrellas = tipo === 'noche' ? Array.from({ length: 46 }, () => [entre(0, ANCHO), entre(0, ALTO * 0.75), Math.random()]) : null;
    return efimero(ms, (p, t) => {
      const fuerza = Math.min(1, p / 0.12, (1 - p) / 0.25);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * fuerza})`;
      ctx.fillRect(0, 0, W, H);
      if (estrellas) for (const [sx, sy, f] of estrellas) if (Math.sin(t / 220 + f * 30) > -0.3) chispa4(sx, sy, f < 0.15 ? 1.5 : 0.5, '#ffffff', fuerza * 0.9);
      if (tipo === 'psiquico' && desde) for (let i = 0; i < 4; i++) { const q = (p * 2.2 + i / 4) % 1; aro(desde.x, desde.y, 10 + q * 260, 3, '#ff9ad6', 0.45 * (1 - q) * fuerza); }
      if (tipo === 'tormenta' && Math.random() < 0.03) { ctx.fillStyle = `rgba(255,255,230,${0.3 * fuerza})`; ctx.fillRect(0, 0, W, H); }
    }, { capa: 'suelo' });
  }

  // --- Especiales: cada uno como se ve en los juegos (carga, salida, viaje, impacto y secuela) ---------
  const sentido = (o, d) => Math.atan2(d.y - o.y, d.x - o.x);

  /** Lanzallamas: un chorro de llamas en gota que crecen por el camino y envuelven al rival en fuego. */
  async function lanzallamas(A, D, paleta, { colores = LLAMA_FUEGO, fondoTipo = 'fuego' } = {}) {
    const dir = DIRECCION[A.lado];
    fondo(1800, fondoTipo);
    cargar(boca(A), ['#fff6d0', '#ffd45a', '#ff8a26'], 260, 22);
    await anticipar(A, 260);
    A.ox = dir * 4;
    const llamas = [];
    const viaje = 380;
    const inicio = ahora();
    efimero(900 + viaje, (p, t) => {
      if (t - inicio < 900 && (!llamas.length || t - llamas[llamas.length - 1].nace > 24)) llamas.push({ nace: t, desvio: entre(-1, 1), fase: Math.random() * 6 });
      const o = boca(A); const d = centro(D);
      const angulo = sentido(o, d);
      for (const ll of llamas) {
        const q = (t - ll.nace) / viaje;
        if (q < 0 || q > 1) continue;
        const x = lerp(o.x, d.x, q) + Math.sin(q * 9 + ll.fase) * 2;
        const y = lerp(o.y, d.y, q) + ll.desvio * 6 * q + Math.sin(q * 7 + ll.fase) * 2;
        llama(x, y, 2.8 + q * 6.5, angulo + ll.desvio * 0.25, q > 0.85 ? (1 - q) / 0.15 : 1, colores);
      }
    });
    await pausa(viaje);
    efimero(1200, (p, t) => { // el rival arde: llamas que suben a su alrededor
      const c = centro(D); const w = anchoDe(D); const h = altoDe(D);
      brillo(c.x, c.y, Math.max(w, h) * 0.9, colores[2], 0.45 * (1 - p));
      for (let i = 0; i < 7; i++) {
        const ciclo = (t / 430 + i / 7) % 1;
        llama(c.x + Math.sin(i * 2.4) * w * 0.45, SUELO - ciclo * h * 1.05, 4 + Math.sin(ciclo * Math.PI) * 5, Math.PI / 2, (p > 0.8 ? (1 - p) / 0.2 : 1) * Math.sin(ciclo * Math.PI), colores);
      }
    });
    destellar('#ff9a40', 220, 0.2);
    temblar(3, 400);
    setTimeout(() => soltar(A), 520);
  }

  /** Hidrobomba: un chorro grueso con dos hélices de espuma y una gran salpicadura. */
  async function hidrobomba(A, D, paleta) {
    fondo(1500, 'agua');
    cargar(boca(A), ['#ffffff', '#c8ecff', '#3fa0e6'], 240, 24);
    await anticipar(A, 240);
    const llegada = 260;
    const inicio = ahora();
    efimero(950, (p, t) => {
      const o = boca(A); const d = centro(D);
      const alcance = Math.min(1, (t - inicio) / llegada);
      const fin = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      const angulo = sentido(o, d); const nx = -Math.sin(angulo); const ny = Math.cos(angulo);
      const pasos = 24;
      for (const [color, extra] of [['#0e3a66', 1.6], ['#2f86d6', 0.5], ['#7cc8ff', -0.9]]) {
        ctx.fillStyle = color;
        for (let i = 0; i <= pasos; i++) {
          const q = (i / pasos) * alcance;
          const r = (4 + q * 5 + Math.sin(i * 1.3 - t / 40) * 0.9) * fin + extra;
          if (r <= 0) continue;
          ctx.beginPath(); ctx.arc(X(lerp(o.x, d.x, q)), Y(lerp(o.y, d.y, q)), r * S, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const signo of [1, -1]) { // espuma: dos hélices blancas que giran a lo largo del chorro
        const puntos = [];
        for (let i = 0; i <= pasos; i++) { const q = (i / pasos) * alcance; const onda = Math.sin(q * 16 - t / 35) * (3 + q * 3) * signo * fin; puntos.push([lerp(o.x, d.x, q) + nx * onda, lerp(o.y, d.y, q) + ny * onda]); }
        trazo(puntos, 1.2, '#ffffff', { alfa: 0.9 * fin });
      }
    });
    soltar(A);
    await pausa(llegada);
    const d = centro(D);
    efimero(600, p => { // corona de agua
      for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.15 + (i * 0.7) / 6); const l = 10 + p * 28; trazo([[d.x, d.y], [d.x + Math.cos(a) * l, d.y + Math.sin(a) * l * 1.3]], 2.8 * (1 - p) + 0.5, '#c8ecff', { alfa: 1 - p }); }
    });
    for (let i = 0; i < 3; i++) efimero(600, p => aro(d.x, SUELO, 8 + p * 36, 2, '#c8ecff', 1 - p, 0.35), { retraso: i * 120, capa: 'suelo' });
    for (let i = 0; i < 22; i++) particula({ x: d.x + entre(-8, 8), y: d.y + entre(-6, 6), vx: entre(-110, 110), vy: -entre(60, 200), g: 520, vida: 800, colores: ['#ffffff', '#7cc8ff', '#2f86d6'], tam: 3, forma: 'gota' });
    impacto(d.x, d.y, paleta, 1.2);
  }

  /** Rayo: el cielo se oscurece, se carga temblando y lanza rayos gruesos; dos más caen del cielo sobre el rival. */
  async function rayo(A, D, paleta) {
    fondo(1700, 'tormenta');
    A.quieto = false;
    animar(A, { sy: 0.9, sx: 1.07 }, 200, 'frena');
    await emitir(480, () => {
      A.ox = entre(-1.2, 1.2);
      const c = centro(A); const w = anchoDe(A) * 0.5; const h = altoDe(A) * 0.5;
      if (Math.random() < 0.7) { const z = zigzag([c.x + entre(-w, w), c.y + entre(-h, h)], [c.x + entre(-w, w), c.y + entre(-h, h)], 6, 3); efimero(70, () => rayoGrueso(z, 1.2)); }
      brillo(c.x, c.y, Math.max(w, h) * 1.6, '#ffd83a', 0.35);
    });
    A.ox = 0;
    soltar(A);
    let caminos = null; let cuadroActual = -1;
    efimero(540, (p, t) => { // el rayo principal, que cambia de forma cada 50 ms
      const o = centro(A); const d = centro(D);
      if (Math.floor(t / 50) !== cuadroActual) {
        cuadroActual = Math.floor(t / 50);
        caminos = [zigzag([o.x, o.y], [d.x, d.y], 22, 5), zigzag([o.x, o.y - 6], [d.x + entre(-8, 8), d.y + entre(-10, 10)], 16, 4)];
      }
      const alfa = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      rayoGrueso(caminos[0], 4.2, alfa);
      rayoGrueso(caminos[1], 2.2, alfa * 0.8);
    });
    for (let i = 0; i < 2; i++) { // dos rayos que caen del cielo
      const d0 = centro(D);
      const z = zigzag([d0.x + entre(-30, 30), -12], [d0.x + entre(-6, 6), d0.y], 18, 5);
      efimero(260, p => rayoGrueso(z, 5, 1 - p), { retraso: 120 + i * 180 });
      setTimeout(() => destellar('#fffbe0', 120, 0.55), 120 + i * 180);
    }
    destellar('#fff8c8', 140, 0.45);
    temblar(4, 420);
    await pausa(60);
    emitir(700, () => { // el rival queda cargado
      const c = centro(D); const w = anchoDe(D) * 0.5; const h = altoDe(D) * 0.5;
      if (Math.random() < 0.5) { const z = zigzag([c.x + entre(-w, w), c.y + entre(-h, h)], [c.x + entre(-w, w), c.y + entre(-h, h)], 7, 3); efimero(80, () => rayoGrueso(z, 1.3)); }
      particula({ x: c.x + entre(-w, w), y: c.y + entre(-h, h), vx: entre(-60, 60), vy: entre(-60, 60), arrastre: 4, vida: 260, colores: ['#ffffff', '#ffd83a'], tam: 2, forma: 'chispa' });
    });
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1.3);
  }

  /** Hoja Mágica: hojas de colores que giran a su alrededor y luego persiguen al rival. */
  async function hojaMagica(A, D) {
    const colores = ['#7fd06a', '#ffd75e', '#ff8ab0', '#8ad8ff', '#c69bff', '#b8f07a'];
    fondo(1500, 'planta');
    await anticipar(A, 160);
    soltar(A);
    const n = 9;
    const vuelos = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const curva = (i % 2 ? 1 : -1) * entre(20, 45);
      vuelos.push(efimero(900, (p, t) => {
        const ca = centro(A); const d = centro(D);
        let x; let y;
        if (p < 0.38) { const a = a0 + p * 16; const r = 10 + p * 30; x = ca.x + Math.cos(a) * r; y = ca.y + Math.sin(a) * r * 0.7; }
        else {
          const q = (p - 0.38) / 0.62; const e = q * q;
          const sx = ca.x + Math.cos(a0 + 6.08) * 21.4; const sy = ca.y + Math.sin(a0 + 6.08) * 15;
          x = lerp(sx, d.x, e); y = lerp(sy, d.y, e) + Math.sin(Math.PI * q) * curva;
        }
        hoja(x, y, 4.4, t / 60 + i, colores[i % colores.length]);
        if (Math.random() < 0.35) particula({ x, y, vida: 320, colores: ['#ffffff', colores[i % colores.length]], tam: 1.2, forma: 'estrella', brillo: 2 });
      }, { retraso: i * 35 }));
    }
    await vuelos[0];
    const d = centro(D);
    for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(50, 140), vy: Math.sin(a) * entre(50, 140), arrastre: 2, vida: 600, colores: ['#ffffff', colores[i % 6]], tam: 2, forma: 'estrella', brillo: 3 }); }
    impacto(d.x, d.y, PALETAS_ATAQUE.grass, 1.1);
  }

  /** Rayo Hielo: rayo celeste con destellos que encierra al rival en un bloque de hielo, que se agrieta y estalla. */
  async function rayoHielo(A, D, paleta) {
    fondo(1800, 'hielo');
    cargar(boca(A), ['#ffffff', '#c8f4ff', '#8fe3ef'], 280, 26);
    await anticipar(A, 280);
    soltar(A);
    const inicio = ahora();
    efimero(620, (p, t) => {
      const o = boca(A); const d = centro(D);
      const alcance = Math.min(1, (t - inicio) / 180);
      const fin = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      const f = [lerp(o.x, d.x, alcance), lerp(o.y, d.y, alcance)];
      trazo([[o.x, o.y], f], 8.5 * fin, '#1d4a66');
      trazo([[o.x, o.y], f], 5.6 * fin, '#8fe3ef');
      trazo([[o.x, o.y], f], 2.2 * fin, '#ffffff');
      for (let i = 0; i < 6; i++) { const q = ((t / 300 + i / 6) % 1) * alcance; chispa4(lerp(o.x, d.x, q), lerp(o.y, d.y, q) + Math.sin(i * 3 + t / 60) * 4, 2 + (i % 2), '#ffffff', fin); }
    });
    await pausa(200);
    const d = centro(D);
    const w = anchoDe(D) * 0.62 + 6; const h = altoDe(D) * 0.6 + 6;
    const BLOQUE = [[-1, -0.7], [-0.4, -1], [0.5, -0.92], [1, -0.4], [0.9, 0.6], [0.3, 1], [-0.6, 0.9], [-1, 0.3]];
    efimero(820, p => { // bloque de hielo alrededor del rival
      const crece = Math.min(1, p * 5); const alfa = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      const c = centro(D);
      const puntos = BLOQUE.map(([px, py]) => [X(c.x + px * w * crece), Y(c.y + py * h * crece)]);
      ctx.globalAlpha = 0.55 * alfa; ctx.fillStyle = '#bdefff';
      ctx.beginPath(); puntos.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = alfa; ctx.strokeStyle = '#1d4a66'; ctx.lineWidth = Math.max(1, S * 0.9); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, S * 0.6);
      ctx.beginPath(); ctx.moveTo(X(c.x - w * 0.62 * crece), Y(c.y - h * 0.45 * crece)); ctx.lineTo(X(c.x - w * 0.2 * crece), Y(c.y - h * 0.85 * crece)); ctx.stroke();
      if (p > 0.5) { // grieta
        const g = (p - 0.5) * 2;
        ctx.strokeStyle = '#1d4a66';
        ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y - h * 0.9)); ctx.lineTo(X(c.x - w * 0.2 * g), Y(c.y)); ctx.lineTo(X(c.x + w * 0.3 * g), Y(c.y + h * 0.6 * g)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    setTimeout(() => { // estalla en esquirlas
      const c = centro(D);
      for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; particula({ x: c.x + entre(-w, w) * 0.5, y: c.y + entre(-h, h) * 0.5, vx: Math.cos(a) * entre(60, 160), vy: Math.sin(a) * entre(60, 160) - 30, g: 320, vida: 650, colores: ['#ffffff', '#8fe3ef', '#3a9fb0'], tam: entre(2, 3.5), forma: 'roca', vgiro: entre(-10, 10) }); }
      destellar('#e8fbff', 160, 0.35);
    }, 760);
    impacto(d.x, d.y, paleta, 1.1);
  }

  /** Bomba Lodo: tres bolas de lodo en arco que salpican y dejan un charco tóxico con burbujas. */
  async function bombaLodo(A, D, paleta) {
    fondo(1700, 'veneno');
    await anticipar(A, 200);
    soltar(A);
    const colores = ['#e9bdff', '#a65fc7', '#5c2a78', '#1f0a2a'];
    const lanzar = i => efimero(560, (p, t) => {
      const o = boca(A); const d = centro(D);
      const x = lerp(o.x, d.x + (i - 1) * 9, p);
      const y = lerp(o.y, d.y + (i - 1) * 5, p) - Math.sin(Math.PI * p) * (40 + i * 8);
      bola(x, y, 7.5 + Math.sin(t / 50) * 0.8, colores);
      if (Math.random() < 0.5) particula({ x, y: y + 4, vy: 30, g: 280, vida: 400, colores: [colores[1], colores[2]], tam: 2, forma: 'gota' });
    }, { retraso: i * 140 }).then(() => {
      const d = centro(D); const x = d.x + (i - 1) * 9; const y = d.y + (i - 1) * 5;
      for (let k = 0; k < 10; k++) { const a = -Math.PI * entre(0.05, 0.95); particula({ x, y, vx: Math.cos(a) * entre(50, 140), vy: Math.sin(a) * entre(50, 140), g: 480, vida: 650, colores: [colores[0], colores[1], colores[2]], tam: 3, forma: 'gota' }); }
      impacto(x, y, paleta, 0.7);
      temblar(2, 120);
    });
    const golpes = [0, 1, 2].map(lanzar);
    await golpes[0];
    const d = centro(D);
    efimero(1500, p => { // charco tóxico
      ctx.globalAlpha = 0.7 * Math.min(1, p * 6, (1 - p) * 3);
      ctx.fillStyle = '#3a1450'; ctx.beginPath(); ctx.ellipse(X(d.x), Y(SUELO + 1), 31 * S, 8.5 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a65fc7'; ctx.beginPath(); ctx.ellipse(X(d.x - 3), Y(SUELO), 22 * S, 5.5 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }, { capa: 'suelo' });
    emitir(1300, () => { if (Math.random() < 0.3) particula({ x: d.x + entre(-22, 22), y: SUELO - entre(0, 6), vy: -entre(14, 30), vida: 800, colores: ['#e9bdff'], tam: 2, tamFin: 4, forma: 'burbuja' }); });
  }

  /** Tierra Viva: el suelo se agrieta y brilla bajo el rival; luego estalla en pinchos de roca y una columna de luz. */
  async function tierraViva(A, D, paleta) {
    fondo(1700, 'tierra');
    A.quieto = false;
    await animar(A, { sy: 0.88, sx: 1.08 }, 180, 'frena');
    animar(A, { sx: 1, sy: 1 }, 260, 'rebote').then(() => { A.quieto = true; });
    temblar(3, 600);
    const x = D.x + D.ox;
    const grietas = [0, 1, 2, 3, 4, 5].map(i => zigzag([x, SUELO + 1], [x + Math.cos(i * 1.05) * entre(22, 36), SUELO + 1 + Math.sin(i * 1.05) * entre(5, 9)], 4, 3));
    efimero(1300, p => {
      const largo = Math.min(1, p * 3); const alfa = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      grietas.forEach(g => { const tramo = g.slice(0, Math.max(2, Math.ceil(g.length * largo))); trazo(tramo, 2.4, '#2a1a0c', { alfa }); trazo(tramo, 1.1, '#ffcf6a', { alfa }); });
      brillo(x, SUELO, 30 * largo, '#ff9a2e', 0.5 * alfa);
    }, { capa: 'suelo' });
    await pausa(420);
    const pinchos = [-1, 0, 1].map(i => ({ dx: i * 14 + entre(-3, 3), alto: entre(18, 28) * (i === 0 ? 1.4 : 1), ancho: entre(6, 9) }));
    efimero(850, p => {
      const sube = Math.min(1, p * 5); const alfa = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      trazo([[x, SUELO], [x, SUELO - 110 * sube]], 16 * alfa, '#ff9a2e', { alfa: 0.75 * alfa });
      trazo([[x, SUELO], [x, SUELO - 110 * sube]], 6 * alfa, '#fff3c4', { alfa });
      ctx.globalAlpha = alfa;
      for (const pi of pinchos) {
        const base = x + pi.dx; const cima = SUELO - pi.alto * sube;
        ctx.fillStyle = '#2a1a0c'; triangulo(base - pi.ancho - 1.2, SUELO + 1, base, cima - 2, base + pi.ancho + 1.2, SUELO + 1);
        ctx.fillStyle = '#8a5c30'; triangulo(base - pi.ancho, SUELO, base, cima, base + pi.ancho, SUELO);
        ctx.fillStyle = '#c99a62'; triangulo(base - pi.ancho * 0.15, SUELO, base, cima, base + pi.ancho * 0.6, SUELO);
      }
      ctx.globalAlpha = 1;
    });
    temblar(6, 400);
    for (let i = 0; i < 16; i++) particula({ x: x + entre(-14, 14), y: SUELO, vx: entre(-50, 50), vy: -entre(140, 260), g: 520, vida: 900, colores: [paleta[1], paleta[0], paleta[2]], tam: entre(2, 4), forma: 'roca', vgiro: entre(-8, 8) });
    polvo(x, SUELO, 14);
    const c = centro(D);
    impacto(c.x, c.y, paleta, 1.2);
  }

  /** Tajo Aéreo: tres medias lunas con estela que dejan cortes en el rival. */
  async function tajoAereo(A, D) {
    fondo(1300, 'aire');
    await anticipar(A, 150);
    soltar(A);
    const dir = DIRECCION[A.lado];
    lineasVelocidad(dir, 520);
    const giro = dir > 0 ? 0 : Math.PI;
    const tajos = [0, 1, 2].map(i => efimero(340, p => {
      const o = boca(A); const d = centro(D);
      const lugar = q => [lerp(o.x, d.x, q), lerp(o.y, d.y, q) + (i - 1) * 12 * (1 - q)];
      for (let k = 3; k >= 1; k--) { const [x, y] = lugar(Math.max(0, p - k * 0.07)); medialuna(x, y, 12, giro, 0.22 * (4 - k)); }
      const [x, y] = lugar(p);
      medialuna(x, y, 14, giro);
    }, { retraso: i * 110 }).then(() => {
      const d = centro(D);
      const a = (i - 1) * 0.6 + Math.PI / 4;
      efimero(240, q => trazo([[d.x - Math.cos(a) * 17, d.y - Math.sin(a) * 17], [d.x - Math.cos(a) * 17 + Math.cos(a) * 34 * Math.min(1, q * 3), d.y - Math.sin(a) * 17 + Math.sin(a) * 34 * Math.min(1, q * 3)]], 2.2, '#ffffff', { alfa: 1 - q }));
      impacto(d.x + entre(-6, 6), d.y + entre(-8, 8), PALETAS_ATAQUE.flying, 0.8);
    }));
    await tajos[0];
  }

  /** Psíquico: fondo rosa con ondas, la imagen ondula; eleva al rival, lo retuerce y lo estampa contra el suelo. */
  async function psiquico(A, D) {
    fondo(2100, 'psiquico', { desde: centro(A) });
    A.quieto = false;
    animar(A, { oy: -8, sy: 1.04, sx: 0.97 }, 300, 'frena');
    efimero(900, (p, t) => { // aura que late alrededor del atacante
      const c = centro(A);
      for (let i = 0; i < 2; i++) { const q = (p * 2.4 + i * 0.5) % 1; aro(c.x, c.y, anchoDe(A) * (0.45 + q * 0.6), 2.4, '#ff7ab0', 0.8 * (1 - q)); }
      brillo(c.x, c.y - altoDe(A) * 0.25, 10, '#ffcadf', 0.8);
    });
    await pausa(380);
    ondular(1300, 5);
    D.quieto = false;
    D.tinte = { color: '#ff7ab0', alfa: 0.6 };
    efimero(1000, (p, t) => { const c = centro(D); aro(c.x, c.y, anchoDe(D) * 0.55 + Math.sin(t / 50) * 2, 2, '#ffcadf', 0.9 * (1 - p * 0.5)); for (let i = 0; i < 3; i++) chispa4(c.x + Math.cos(t / 120 + i * 2.1) * anchoDe(D) * 0.6, c.y + Math.sin(t / 120 + i * 2.1) * altoDe(D) * 0.5, 2, '#ffffff'); });
    await animar(D, { oy: -22 }, 360, 'frena');
    await emitir(420, p => { D.ox = Math.sin(p * 50) * 2; });
    D.ox = 0;
    animar(A, { oy: 0, sx: 1, sy: 1 }, 320).then(() => { A.quieto = true; });
    await animar(D, { oy: 0 }, 140, 'acelera');
    polvo(D.x, SUELO, 14);
    temblar(5, 260);
    animar(D.tinte, { alfa: 0 }, 400);
    const d = centro(D);
    impacto(d.x, d.y, PALETAS_ATAQUE.psychic, 1.2);
  }

  /** Zumbido: ondas de sonido con borde que salen en tandas y hacen temblar el campo. colores: [borde, cuerpo, cuerpo 2, claro]. */
  async function zumbido(A, D, paleta, { colores = ['#2a3a08', '#9cc23a', '#c8e64a', '#f4ffc0'], fondoTipo = 'bicho' } = {}) {
    fondo(1300, fondoTipo);
    await anticipar(A, 140);
    soltar(A);
    const dir = DIRECCION[A.lado];
    const ondas = [];
    for (let i = 0; i < 7; i++) {
      ondas.push(efimero(520, p => {
        const o = boca(A); const d = centro(D);
        const x = lerp(o.x, d.x, p); const y = lerp(o.y, d.y, p);
        const r = (9 + p * 22) * S;
        const a0 = dir > 0 ? -0.9 : Math.PI - 0.9; const a1 = dir > 0 ? 0.9 : Math.PI + 0.9;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 1 - p * 0.4;
        for (const [color, grosor] of [[colores[0], 5], [i % 2 ? colores[2] : colores[1], 3.2], [colores[3], 1.1]]) {
          ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, grosor * S);
          ctx.beginPath(); ctx.arc(X(x), Y(y), r, a0, a1); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }, { retraso: i * 75 }));
    }
    temblar(2, 650);
    await ondas[0];
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1);
  }

  /** Joya de Luz: gemas facetadas giran a su alrededor y disparan rayos de luz de colores. */
  async function joyaDeLuz(A, D, paleta) {
    const colores = ['#ff6b8a', '#6be0ff', '#ffe066', '#9dff8a', '#c69bff', '#ffb46b'];
    fondo(1600, 'luz');
    A.quieto = false;
    animar(A, { oy: -5, sy: 1.04, sx: 0.97 }, 380, 'frena');
    const lugar = (i, t, abre) => { const c = centro(A); const a = t / 260 + (i / colores.length) * Math.PI * 2; return [c.x + Math.cos(a) * (14 + 10 * abre), c.y + Math.sin(a) * (10 + 7 * abre)]; };
    await efimero(460, (p, t) => { colores.forEach((color, i) => { const [x, y] = lugar(i, t, p); gemaPixel(x, y, 4.5 + p * 2.5, color, t / 200); chispa4(x, y - 5, 1.5, '#ffffff', p); }); });
    soltar(A);
    const salida = ahora();
    const disparos = colores.map((color, i) => efimero(300, (p, t) => {
      const [sx, sy] = lugar(i, salida, 1); const d = centro(D);
      const x = lerp(sx, d.x, p); const y = lerp(sy, d.y, p);
      trazo([[sx, sy], [x, y]], 3.2 * (1 - p * 0.5), color, { halo: color, alfa: 0.85 });
      trazo([[sx, sy], [x, y]], 1, '#ffffff', { alfa: 0.9 });
      gemaPixel(x, y, 6.5, color, t / 80);
    }, { retraso: i * 45 }));
    await disparos[0];
    const d = centro(D);
    for (let i = 0; i < 5; i++) efimero(320, p => destelloEstrella(d.x + entre(-18, 18), d.y + entre(-20, 20), 3 + p * 9, p), { retraso: i * 50 });
    for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(50, 150), vy: Math.sin(a) * entre(50, 150), arrastre: 2, vida: 550, colores: ['#ffffff', colores[i % colores.length]], tam: 2, forma: 'estrella', brillo: 3 }); }
    impacto(d.x, d.y, paleta, 1.2);
  }

  /** Aura oscura que chisporrotea alrededor de una esfera (Bola Sombra). */
  function auraOscura(x, y, r, t) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t / 160; const l = r * (1.4 + Math.sin(t / 60 + i * 2) * 0.2);
      trazo([[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 1.6, '#b48aff', { alfa: 0.7 });
    }
  }
  /** Bola Sombra: jirones de sombra forman la esfera, que vuela temblando y estalla en humo oscuro. */
  async function bolaSombra(A, D, paleta) {
    fondo(1800, 'sombra');
    const colores = ['#d8c2ff', '#7a4fc0', '#24123f', '#08040f'];
    const dir = DIRECCION[A.lado];
    const frente = () => { const b = boca(A); return { x: b.x + dir * 12, y: b.y }; };
    A.quieto = false;
    animar(A, { ox: -dir * 5, sy: 1.05, sx: 0.96 }, 320, 'frena');
    await efimero(540, (p, t) => {
      const f = frente();
      for (let i = 0; i < 6; i++) { const a = t / 120 + i * 1.05; const r = 26 * (1 - p) + 6; trazo([[f.x + Math.cos(a) * r, f.y + Math.sin(a) * r], [f.x + Math.cos(a + 0.6) * r * 0.7, f.y + Math.sin(a + 0.6) * r * 0.7]], 2.2, '#3d2a66', { alfa: 0.85 }); }
      auraOscura(f.x, f.y, 3 + p * 10, t);
      bola(f.x, f.y, 3 + p * 10, colores);
    });
    const o = frente(); const d = centro(D);
    soltar(A);
    await efimero(420, (p, t) => {
      const x = lerp(o.x, d.x, p); const y = lerp(o.y, d.y, p) - Math.sin(Math.PI * p) * 10;
      auraOscura(x, y, 13, t);
      bola(x, y, 13 + Math.sin(t / 40) * 0.6, colores);
      particula({ x: x - dir * 8, y: y + entre(-4, 4), vx: -dir * 30, vy: -10, vida: 420, colores: ['#3d2a66', '#1a0f2e'], tam: 3, tamFin: 7, forma: 'humo', alfa: 0.7 });
    });
    destellar('#120a20', 300, 0.4);
    for (let i = 0; i < 3; i++) efimero(520, p => aro(d.x, d.y, 8 + p * 50, 3 * (1 - p) + 0.6, '#7a4fc0', 1 - p), { retraso: i * 90 });
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(40, 130), vy: Math.sin(a) * entre(40, 130) - 20, arrastre: 2, vida: 700, colores: ['#7a4fc0', '#3d2a66', '#120a20'], tam: 3, tamFin: 9, forma: 'humo', alfa: 0.8 }); }
    impacto(d.x, d.y, paleta, 1.2);
  }

  /** Pulso Umbrío: todo se oscurece y salen anillos de oscuridad de bordes irregulares. */
  async function pulsoUmbrio(A, D, paleta) {
    fondo(1800, 'oscuro');
    await anticipar(A, 220);
    soltar(A);
    const o = centro(A); const d = centro(D);
    const distancia = Math.hypot(d.x - o.x, d.y - o.y);
    for (let i = 0; i < 4; i++) {
      efimero(720, p => {
        const r = 8 + p * (distancia + 30);
        ctx.globalAlpha = 1 - p * 0.8;
        for (const [color, grosor] of [['#000000', 7], ['#3a1450', 4.5], ['#d0508e', 1.6]]) {
          ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, grosor * S);
          ctx.beginPath();
          for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; const rr = (r + Math.sin(a * 7 + p * 14 + i) * 4) * S; const px = X(o.x) + Math.cos(a) * rr; const py = Y(o.y) + Math.sin(a) * rr * 0.8; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }, { retraso: i * 120 });
    }
    await pausa(720 * ((distancia - 10) / (distancia + 30)));
    emitir(600, () => { const a = Math.random() * Math.PI * 2; const c = centro(D); particula({ x: c.x + Math.cos(a) * 24, y: c.y + Math.sin(a) * 24, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 90, arrastre: 3, vida: 380, colores: ['#d0508e', '#3a1450', '#000000'], tam: 3, tamFin: 6, forma: 'humo', alfa: 0.75 }); });
    impacto(d.x, d.y, paleta, 1.15);
  }

  /** Fuerza Lunar: se hace de noche, sale una luna rosa enorme y de ella baja un rayo sobre el rival. */
  async function fuerzaLunar(A, D, paleta) {
    fondo(2400, 'noche');
    A.quieto = false;
    animar(A, { oy: -6, sy: 1.05, sx: 0.96 }, 380, 'frena');
    const cielo = { x: (A.x + D.x) / 2, y: 42 };
    efimero(1600, (p, t) => { const sube = Math.min(1, p * 3); const alfa = p > 0.8 ? 1 - (p - 0.8) / 0.2 : sube; lunaGrande(cielo.x, cielo.y + (1 - sube) * 22, 16 + Math.sin(t / 200) * 0.6, alfa); });
    await pausa(680);
    soltar(A);
    await efimero(320, p => {
      const d = centro(D); const f = [lerp(cielo.x, d.x, p), lerp(cielo.y, d.y, p)];
      trazo([[cielo.x, cielo.y], f], 10, '#6a2a50');
      trazo([[cielo.x, cielo.y], f], 7, '#f5a0cf');
      trazo([[cielo.x, cielo.y], f], 3, '#ffffff');
    });
    efimero(320, p => { const d = centro(D); trazo([[cielo.x, cielo.y], [d.x, d.y]], 10 * (1 - p), '#f5a0cf', { halo: '#ffe3f2', alfa: 1 - p }); });
    destellar('#ffe3f2', 240, 0.45);
    const d = centro(D);
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(50, 140), vy: Math.sin(a) * entre(50, 140), arrastre: 2.5, vida: 650, colores: ['#ffffff', '#ffe3f2', '#f5a0cf'], tam: 3, forma: 'estrella', brillo: 4 }); }
    impacto(d.x, d.y, paleta, 1.25);
  }

  /** Esfera Aural: un aura de llamas azules lo envuelve y lanza una esfera con un remolino dentro. */
  async function esferaAural(A, D) {
    const paleta = ['#4f9dff', '#d6ebff', '#1f4fb0'];
    const colores = ['#ffffff', '#a8d4ff', '#4f9dff', '#0a1c4a'];
    const dir = DIRECCION[A.lado];
    const frente = () => { const b = boca(A); return { x: b.x + dir * 9, y: b.y + 4 }; };
    fondo(1700, 'aura');
    A.quieto = false;
    animar(A, { ox: -dir * 5, sy: 0.94, sx: 1.05 }, 420, 'frena');
    await efimero(520, (p, t) => {
      const c = centro(A); const w = anchoDe(A); const h = altoDe(A);
      for (let i = 0; i < 6; i++) { const ciclo = (t / 380 + i / 6) % 1; llama(c.x + Math.sin(i * 2.3) * w * 0.45, SUELO - ciclo * h * 1.05, 2.5 + Math.sin(ciclo * Math.PI) * 3, Math.PI / 2, Math.sin(ciclo * Math.PI) * 0.9, LLAMA_AURA); }
      const f = frente(); const r = 2 + p * 10;
      bola(f.x, f.y, r, colores);
      for (let i = 0; i < 2; i++) { const a = t / 70 + i * Math.PI; trazo([[f.x + Math.cos(a) * r * 0.6, f.y + Math.sin(a) * r * 0.6], [f.x + Math.cos(a + 1.2) * r * 0.6, f.y + Math.sin(a + 1.2) * r * 0.6]], 0.9, '#ffffff'); }
    });
    const o = frente(); const d = centro(D);
    soltar(A);
    await efimero(360, (p, t) => {
      const x = lerp(o.x, d.x, p); const y = lerp(o.y, d.y, p) - Math.sin(Math.PI * p) * 12;
      for (let k = 1; k <= 3; k++) { const q = Math.max(0, p - k * 0.07); bola(lerp(o.x, d.x, q), lerp(o.y, d.y, q) - Math.sin(Math.PI * q) * 12, 8 - k * 1.5, colores, 0.25 * (4 - k)); }
      bola(x, y, 12, colores);
      for (let i = 0; i < 2; i++) { const a = t / 50 + i * Math.PI; trazo([[x + Math.cos(a) * 7, y + Math.sin(a) * 7], [x + Math.cos(a + 1.3) * 7, y + Math.sin(a + 1.3) * 7]], 1.3, '#ffffff'); }
    });
    for (let i = 0; i < 3; i++) efimero(440, p => aro(d.x, d.y, 8 + p * 38, 2.6, paleta[0], 1 - p), { retraso: i * 70 });
    destellar('#cfe6ff', 180, 0.35);
    impacto(d.x, d.y, paleta, 1.3);
  }

  // =================================================================================================
  // FAMILIAS DE MOVIMIENTOS (con el anime como referencia). Cada Pokémon lleva 4 movimientos reales
  // (combate.js → movimientosDe) y animacionDe() elige cómo se ve cada uno: por su nombre (ANIMACIONES)
  // y, si no está ahí, por su tipo y clase (POR_TIPO). Cada familia acepta opciones (colores, aura…), así
  // que un mismo gesto sirve para muchos movimientos: Puño Fuego y Puño Hielo son el mismo puñetazo con
  // otra energía.
  // =================================================================================================
  const LLAMA_DRAGON = ['#100a3a', '#3a2fb0', '#6e7cf0', '#cdd3ff', '#ffffff'];
  /** [borde, cuerpo, claro] de la energía de cada estilo (auras, garras, filos, puños…). */
  const TONOS = {
    normal: ['#3a3a3a', '#f4f1e6', '#ffffff'], fuego: ['#5a140a', '#ff7a2e', '#ffd45a'], agua: ['#0e3a66', '#3fa0e6', '#c8ecff'],
    rayo: ['#3a2600', '#ffd83a', '#fff8c8'], hojas: ['#10300f', '#5fbf5a', '#cff59f'], hielo: ['#1d4a66', '#8fe3ef', '#ffffff'],
    lucha: ['#4a140a', '#e9684f', '#ffc9b0'], veneno: ['#2a0a3a', '#a65fc7', '#e9bdff'], tierra: ['#3a240c', '#c4945a', '#f0d7a8'],
    'llama-azul': ['#1d2a5a', '#a9c2ee', '#ffffff'], psi: ['#5a1030', '#f06a9c', '#ffcadf'], bicho: ['#203008', '#9cc23a', '#e4f69e'],
    roca: ['#2a2010', '#b49a66', '#e6d6ad'], sombra: ['#120a24', '#7a4fc0', '#d8c2ff'], dragon: ['#100a3a', '#6e7cf0', '#cdd3ff'],
    siniestro: ['#060408', '#4a3a60', '#c04a8a'], metal: ['#26323a', '#b8c8d2', '#ffffff'], hada: ['#5a1a40', '#f5a0cf', '#ffe3f2'],
    giga: ['#1a0626', '#7a3ab0', '#ff9a2e'],
  };
  const tonosDe = estilo => TONOS[estilo] || TONOS.normal;
  /** Paleta [principal, claro, oscuro] (la de chispaDeAura y estallido) a partir de un estilo. */
  const paletaDe = estilo => { const [borde, cuerpo, claro] = tonosDe(estilo); return [cuerpo, claro, borde]; };
  /** chispaDeAura entiende fuego, llama-azul, rayo, agua, sombra, veneno y hojas; el resto, brillos. */
  const AURA_CHISPA = { siniestro: 'sombra', giga: 'sombra', dragon: 'brillo', psi: 'brillo', metal: 'brillo' };
  const chispa = (x, y, estilo, fuerza = 1) => chispaDeAura(x, y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo), fuerza);

  /** Trazo que se afina en las puntas (zarpazos, cortes, tajos). */
  function trazoAfinado(puntos, ancho, color, alfa = 1) {
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.max(0, alfa);
    ctx.strokeStyle = color;
    const n = puntos.length - 1;
    for (let k = 0; k < n; k++) {
      ctx.lineWidth = Math.max(1, ancho * Math.sin(Math.PI * ((k + 0.5) / n)) * S);
      ctx.beginPath(); ctx.moveTo(X(puntos[k][0]), Y(puntos[k][1])); ctx.lineTo(X(puntos[k + 1][0]), Y(puntos[k + 1][1])); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  /** Puntos de una curva (de a a b tirando hacia c), hasta `hasta` (0–1). */
  function curva(a, c, b, hasta = 1, pasos = 16) {
    const puntos = [];
    for (let i = 0; i <= pasos; i++) {
      const u = (i / pasos) * hasta;
      puntos.push([(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]]);
    }
    return puntos;
  }

  /** Imagen fantasma del Pokémon (estelas de los ataques rápidos): su silueta teñida en otra posición. */
  function fantasma(L, ox, alfa, color = '#ffffff') {
    if (!L.modelo || alfa <= 0) return;
    const { caja, cuadros, total, animado } = L.modelo;
    let actual = cuadros[0];
    if (animado) { let resto = L.reloj % total; for (const c of cuadros) { if (resto < c.ms) { actual = c; break; } resto -= c.ms; } }
    const k = (pixelesPorUnidad(L) / Sreal) * S;
    const ancho = caja.w * k; const alto = caja.h * k;
    if (bufer.width < caja.w || bufer.height < caja.h) { bufer.width = Math.max(bufer.width, caja.w); bufer.height = Math.max(bufer.height, caja.h); }
    bctx.globalCompositeOperation = 'source-over';
    bctx.clearRect(0, 0, bufer.width, bufer.height);
    bctx.drawImage(actual.fuente, caja.x, caja.y, caja.w, caja.h, 0, 0, caja.w, caja.h);
    bctx.globalCompositeOperation = 'source-atop';
    bctx.fillStyle = color;
    bctx.fillRect(0, 0, caja.w, caja.h);
    const x = X(L.x + ox) - ancho / 2; const y = Y(SUELO + L.oy) - alto;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(L.mira < 0 ? x + ancho : x, y);
    if (L.mira < 0) ctx.scale(-1, 1);
    ctx.drawImage(bufer, 0, 0, caja.w, caja.h, 0, 0, ancho, alto);
    ctx.restore();
  }

  /** Aura que envuelve TODO el cuerpo en una embestida: esfera eléctrica, bola de fuego, funda de agua… */
  function auraCuerpo(L, estilo, t) {
    const c = centro(L); const w = anchoDe(L) * 0.6 + 6; const h = altoDe(L) * 0.6 + 6; const r = Math.max(w, h);
    const [borde, cuerpo, claro] = tonosDe(estilo);
    brillo(c.x, c.y, r * 1.5, cuerpo, 0.45);
    if (estilo === 'rayo') { // la esfera eléctrica que crepita (Placaje Eléctrico)
      const contorno = [];
      for (let k = 0; k <= 26; k++) { const a = (k / 26) * Math.PI * 2; const rr = r * (0.92 + Math.random() * 0.16); contorno.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.92]); }
      rayoGrueso(contorno, 1.5);
      if (Math.random() < 0.7) { const a = Math.random() * Math.PI * 2; rayoGrueso(zigzag([c.x, c.y], [c.x + Math.cos(a) * r * 1.4, c.y + Math.sin(a) * r * 1.3], 7, 3), 1.3); }
    } else if (estilo === 'fuego' || estilo === 'llama-azul' || estilo === 'dragon') { // envuelto en llamas
      const colores = estilo === 'fuego' ? LLAMA_FUEGO : estilo === 'dragon' ? LLAMA_DRAGON : LLAMA_AURA;
      for (let i = 0; i < 9; i++) {
        const ciclo = (t / 320 + i / 9) % 1; const a = (i / 9) * Math.PI * 2;
        llama(c.x + Math.cos(a) * w * 0.6, c.y + Math.sin(a) * h * 0.55 - ciclo * h * 0.45, 3.5 + Math.sin(ciclo * Math.PI) * 4.5, Math.PI / 2, Math.sin(ciclo * Math.PI), colores);
      }
    } else if (estilo === 'agua') { // funda de agua que gira (Envite Acuático, Cascada)
      for (let i = 0; i < 3; i++) aro(c.x, c.y, r * (0.85 + i * 0.1), 2.4 - i * 0.5, i ? '#7cc8ff' : '#ffffff', 0.75, 0.8 + 0.18 * Math.sin(t / 90 + i * 2));
    } else if (estilo === 'giga') { // Gigaimpacto: energía morada con vetas naranjas
      for (let i = 0; i < 3; i++) aro(c.x, c.y, r * (0.8 + i * 0.15) + Math.sin(t / 60 + i) * 2, 3 - i * 0.6, [borde, cuerpo, claro][i], 0.85, 0.92);
    } else if (estilo === 'sombra' || estilo === 'siniestro') { // jirones de sombra
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t / 200; trazo([[c.x + Math.cos(a) * r * 0.7, c.y + Math.sin(a) * r * 0.7], [c.x + Math.cos(a + 0.4) * r * 1.15, c.y + Math.sin(a + 0.4) * r * 1.1]], 2.4, cuerpo, { alfa: 0.75 }); }
    } else if (estilo === 'psi' || estilo === 'hada') {
      for (let i = 0; i < 2; i++) { const q = (t / 400 + i * 0.5) % 1; aro(c.x, c.y, r * (0.6 + q * 0.6), 2.2, cuerpo, 0.8 * (1 - q)); }
    } else { // metal, hielo, normal…: un contorno brillante
      aro(c.x, c.y, r * 0.95, 2, claro, 0.6, 0.9);
      if (Math.random() < 0.3) chispa4(c.x + entre(-w, w) * 0.6, c.y + entre(-h, h) * 0.6, 3, '#ffffff');
    }
    if (Math.random() < 0.6) chispa(c.x + entre(-w, w) * 0.5, c.y + entre(-h, h) * 0.5, estilo);
  }

  /** Estallido grande del elemento al chocar (anillo, llamas, rayos…). */
  function estallidoGrande(x, y, estilo) {
    const [borde, cuerpo, claro] = tonosDe(estilo);
    estallido(x, y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo));
    efimero(460, p => aro(x, y, 10 + p * 60, 4.5 * (1 - p) + 0.6, claro, 1 - p));
    if (estilo === 'rayo') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + entre(-0.2, 0.2); const z = zigzag([x, y], [x + Math.cos(a) * 52, y + Math.sin(a) * 42], 10, 4); efimero(280, p => rayoGrueso(z, 2.6, 1 - p), { retraso: i * 18 }); }
    if (estilo === 'fuego' || estilo === 'llama-azul' || estilo === 'dragon') {
      const colores = estilo === 'fuego' ? LLAMA_FUEGO : estilo === 'dragon' ? LLAMA_DRAGON : LLAMA_AURA;
      efimero(520, p => { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; llama(x + Math.cos(a) * (8 + p * 42), y + Math.sin(a) * (8 + p * 34), 4.5 * (1 - p) + 2, a, 1 - p, colores); } });
    }
    if (estilo === 'giga') { destellar(borde, 300, 0.5); for (let i = 0; i < 3; i++) efimero(600, p => aro(x, y, 10 + p * 90, 5 * (1 - p) + 1, [claro, cuerpo, '#ffffff'][i], 1 - p), { retraso: i * 90 }); }
    brillo(x, y, 44, cuerpo, 0.7);
  }

  /** Hasta dónde corre el atacante para chocar de frente contra el rival (sin taparlo). */
  const llegadaHasta = (A, D, extra = 0) => {
    const dir = DIRECCION[A.lado];
    return dir * Math.max(12, dir * (D.x + D.ox - A.x) - (anchoDe(A) * 0.42 + anchoDe(D) * 0.3) - extra);
  };
  const volver = (A, ms = 420) => animar(A, { ox: 0, oy: 0, sx: 1, sy: 1 }, ms).then(() => { A.quieto = true; });
  /** Tamaño de los efectos sobre el rival según lo grande que es. */
  const radioDe = (D, k = 0.75, minimo = 18, maximo = 46) => Math.max(minimo, Math.min(maximo, Math.max(anchoDe(D), altoDe(D)) * k));

  // --- Físicos -------------------------------------------------------------------------------------

  /**
   * Embestida envuelta en su elemento (Placaje Eléctrico, Envite Ígneo, Pájaro Osado, Gigaimpacto…).
   * `giro`: rueda hacia el rival (Giro Rápido, Rodar). `golpes`: varias embestidas seguidas (Golpe).
   */
  async function embestidaAura(A, D, paleta, { aura = null, fuerte = false, giro = false, golpes = 1 } = {}) {
    const dir = DIRECCION[A.lado];
    const control = { activa: true };
    if (aura) efimero(4000, (p, t) => { if (control.activa && A.visible) auraCuerpo(A, aura, t); });
    A.quieto = false;
    await animar(A, { ox: -dir * 7, sy: 0.88, sx: 1.1 }, aura ? 420 : 200, 'frena'); // se agacha y carga
    const llegada = llegadaHasta(A, D);
    for (let g = 0; g < golpes; g++) {
      lineasVelocidad(dir, 360);
      const estela = setInterval(() => {
        const c = centro(A);
        if (aura) chispa(c.x - dir * anchoDe(A) * 0.5, c.y + entre(-altoDe(A) * 0.4, altoDe(A) * 0.4), aura);
        else particula({ x: c.x - dir * anchoDe(A) * 0.4, y: c.y + entre(-altoDe(A) * 0.4, altoDe(A) * 0.4), vx: -dir * 130, arrastre: 4, vida: 240, colores: ['#ffffff', paleta[0]], tam: 2, forma: 'chispa' });
      }, 16);
      if (giro) emitir(210, q => { A.sx = Math.cos(q * Math.PI * 6); });
      A.sy = 1;
      if (!giro) A.sx = 1;
      await animar(A, { ox: llegada }, 210, 'acelera');
      clearInterval(estela);
      A.sx = 1;
      const c = centro(D);
      const ultimo = g === golpes - 1;
      if (ultimo) control.activa = false;
      if (aura && ultimo) estallidoGrande(c.x - dir * 4, c.y, aura);
      else efimero(380, p => aro(c.x - dir * 6, c.y, 8 + p * 46, 4 * (1 - p) + 0.5, '#ffffff', 1 - p, 0.85));
      impacto(c.x, c.y, paleta, fuerte && ultimo ? 1.6 : 1.3);
      temblar(fuerte ? 7 : 4, 280);
      if (fuerte && ultimo) golpeCamara(c.x, 0.8);
      if (!ultimo) { reiniciarGolpe(D, 0.6); await animar(A, { ox: llegada - dir * 26, oy: -6 }, 160, 'frena'); A.oy = 0; }
    }
    animar(A, { ox: llegada * 0.55, oy: -9 }, 180, 'frena').then(() => volver(A));
  }

  /** Ataque rápido: sale disparado dejando imágenes fantasma y una estela (Ataque Rápido, Acua Jet…). */
  async function rafaga(A, D, paleta, { aura = 'normal' } = {}) {
    const dir = DIRECCION[A.lado];
    const [, cuerpo, claro] = tonosDe(aura);
    const huellas = [];
    A.quieto = false;
    await animar(A, { sx: 1.1, sy: 0.9 }, 110, 'frena');
    const desde = A.ox;
    const llegada = llegadaHasta(A, D);
    efimero(620, (p, t) => { // imágenes que se quedan atrás y se desvanecen
      if (huellas.length < 7 && (!huellas.length || t - huellas[huellas.length - 1].t > 18)) huellas.push({ ox: A.ox, t });
      for (const h of huellas) fantasma(A, h.ox, 0.45 * (1 - (t - h.t) / 620), claro);
    });
    efimero(300, p => { const y = centro(A).y; trazo([[A.x + desde, y], [A.x + A.ox, y]], 7 * (1 - p), cuerpo, { halo: claro, alfa: 0.75 * (1 - p) }); });
    if (aura === 'agua') emitir(300, () => particula({ x: A.x + A.ox - dir * 8, y: centro(A).y + entre(-8, 8), vx: -dir * 80, vy: -entre(10, 60), g: 300, vida: 400, colores: ['#ffffff', '#7cc8ff'], tam: 2, forma: 'gota' }));
    else if (aura !== 'normal') emitir(260, () => chispa(A.x + A.ox - dir * 8, centro(A).y + entre(-8, 8), aura));
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 110, 'lineal');
    const c = centro(D);
    impacto(c.x, c.y, paleta, 1.1);
    efimero(260, p => aro(c.x - dir * 4, c.y, 6 + p * 32, 3 * (1 - p) + 0.5, claro, 1 - p, 0.8));
    temblar(3, 160);
    animar(A, { ox: llegada * 0.6 }, 140, 'frena').then(() => volver(A, 280));
  }

  /** Puño (o pie) de píxeles con borde y nudillos, de `color`, mirando hacia `dir`. */
  function punoForma(x, y, tam, dir, color, alfa = 1, pie = false) {
    const T = Math.max(2, tam * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.scale(dir, 1);
    ctx.globalAlpha = alfa;
    const caja = (x0, y0, w, h, r, relleno) => { ctx.fillStyle = relleno; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, r); ctx.fill(); };
    if (pie) {
      caja(-T * 0.95, -T * 0.5, T * 1.9, T * 1.0, T * 0.4, '#140c08');
      caja(-T * 0.85, -T * 0.4, T * 1.7, T * 0.8, T * 0.35, color);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-T * 0.85, T * 0.18, T * 1.7, T * 0.22);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-T * 0.5, -T * 0.3, T * 0.8, T * 0.14);
    } else {
      caja(-T * 0.75, -T * 0.62, T * 1.5, T * 1.24, T * 0.36, '#140c08');
      caja(-T * 0.65, -T * 0.52, T * 1.3, T * 1.04, T * 0.3, color);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 1; i < 4; i++) ctx.fillRect(T * 0.3, -T * 0.52 + i * T * 0.26, T * 0.35, Math.max(1, T * 0.07));
      caja(-T * 0.55, T * 0.22, T * 0.7, T * 0.34, T * 0.15, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-T * 0.45, -T * 0.42, T * 0.55, T * 0.14);
    }
    ctx.restore();
  }

  /**
   * Puñetazos o patadas: uno fuerte con el puño envuelto en su elemento (Puño Fuego, Puño Hielo…) o una
   * lluvia de golpes que acaba en uno enorme (A Bocajarro, Doble Patada…).
   */
  async function punetazos(A, D, paleta, { golpes = 1, aura = null, patada = false } = {}) {
    const dir = DIRECCION[A.lado];
    const [, cuerpo] = tonosDe(aura || 'lucha');
    const color = aura ? cuerpo : '#f4e2c8';
    A.quieto = false;
    await animar(A, { ox: -dir * 6, sy: 0.9, sx: 1.08 }, 180, 'frena');
    if (aura) { const b = boca(A); efimero(260, p => brillo(b.x + dir * 6, b.y + 6, 10 + p * 14, cuerpo, 0.8)); for (let i = 0; i < 8; i++) chispa(b.x + dir * 6 + entre(-6, 6), b.y + 6 + entre(-6, 6), aura); }
    lineasVelocidad(dir, 300);
    const llegada = llegadaHasta(A, D, 6);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 190, 'acelera');
    const r = radioDe(D, 0.45, 14, 34);
    for (let i = 0; i < golpes; i++) {
      const ultimo = i === golpes - 1;
      const c = centro(D);
      const oy = golpes > 1 && !ultimo ? entre(-r * 0.6, r * 0.5) : 0;
      const tam = ultimo ? 11 : 7.5;
      const conPie = patada || (golpes > 3 && i % 3 === 2);
      const ms = ultimo ? 320 : 170;
      efimero(ms, p => {
        const avance = Math.min(1, p / 0.42);
        const x = c.x - dir * r * (1.6 - avance);
        const alfa = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
        if (aura && Math.random() < 0.6) chispa(x, c.y + oy, aura);
        if (ultimo) trazo([[x - dir * 18, c.y + oy], [x, c.y + oy]], tam * 0.8 * alfa, '#ffffff', { alfa: 0.35 * alfa });
        punoForma(x, c.y + oy, tam, dir, color, alfa, conPie);
      });
      await pausa(ms * 0.42);
      impacto(c.x - dir * r * 0.3, c.y + oy, paleta, ultimo ? 1.4 : 0.7);
      temblar(ultimo ? 5 : 2, ultimo ? 240 : 90);
      if (golpes > 1) { polvo(c.x, SUELO, 3); A.ox = llegada + entre(-3, 3); }
      if (!ultimo) { reiniciarGolpe(D, 0.3); await pausa(golpes > 3 ? 40 : 90); }
    }
    const c = centro(D);
    if (aura) estallidoGrande(c.x, c.y, aura);
    else efimero(320, p => aro(c.x - dir * r * 0.3, c.y, 6 + p * r * 1.6, 3.5 * (1 - p) + 0.5, '#ffffff', 1 - p));
    if (golpes > 3) { golpeCamara(c.x, 0.7); marcoImpacto(c.x, c.y); }
    volver(A);
  }

  /** Fauces gigantes de energía, con encías y colmillos, que se cierran sobre el rival. */
  function faucesForma(x, y, r, p, estilo) {
    const cierre = Math.min(1, p / 0.55);
    const abierta = r * 1.15 * (1 - cierre * cierre) + 1;
    const alfa = p > 0.78 ? 1 - (p - 0.78) / 0.22 : Math.min(1, p * 6);
    const [borde, cuerpo, claro] = estilo === 'normal' ? ['#3a1010', '#c4505a', '#ffb0b0'] : tonosDe(estilo);
    const ancho = r * 1.25;
    brillo(x, y, r * 1.8, cuerpo, 0.35 * alfa);
    ctx.globalAlpha = alfa;
    for (const lado of [-1, 1]) { // -1: mandíbula de arriba; 1: la de abajo
      const base = y + lado * abierta;
      const encia = [];
      for (let i = 0; i <= 12; i++) { const u = (i / 12) * 2 - 1; encia.push([x + u * ancho, base + lado * (r * 0.3) * (1 - u * u * 0.6)]); }
      const forma = grosor => {
        ctx.beginPath();
        encia.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py + lado * grosor)) : ctx.moveTo(X(px), Y(py + lado * grosor))));
        for (let i = encia.length - 1; i >= 0; i--) { const u = (i / 12) * 2 - 1; ctx.lineTo(X(encia[i][0]), Y(base + lado * (r * 0.06) * (1 - u * u))); }
        ctx.closePath();
      };
      ctx.fillStyle = '#080404'; forma(3); ctx.fill();
      ctx.fillStyle = borde; forma(0); ctx.fill();
      ctx.fillStyle = cuerpo; forma(-r * 0.12); ctx.fill();
      for (let k = 0; k < 7; k++) { // colmillos (los de las puntas, más largos)
        const u = (k / 6) * 2 - 1;
        const fx = x + u * ancho * 0.86;
        const largo = r * (Math.abs(u) > 0.7 ? 0.55 : 0.38);
        const medio = r * 0.11;
        ctx.fillStyle = '#1a1414';
        triangulo(fx - medio - 1, base - lado, fx + medio + 1, base - lado, fx, base - lado * (largo + 1.5));
        ctx.fillStyle = '#ffffff';
        triangulo(fx - medio, base, fx + medio, base, fx, base - lado * largo);
        ctx.fillStyle = estilo === 'hielo' ? '#bdefff' : estilo === 'fuego' ? '#ffd45a' : estilo === 'rayo' ? '#fff3a0' : '#d8d8e0';
        triangulo(fx, base, fx + medio, base, fx, base - lado * largo);
      }
    }
    ctx.globalAlpha = 1;
    if (Math.random() < 0.5) chispa(x + entre(-ancho, ancho), y + entre(-r, r) * 0.4, estilo === 'normal' ? 'lucha' : estilo);
    void claro;
  }
  /** Mordisco: corre, abre unas fauces enormes de energía sobre el rival y las cierra (Triturar, Colmillo Ígneo…). */
  async function fauces(A, D, paleta, { estilo = 'siniestro', mordiscos = 1 } = {}) {
    const dir = DIRECCION[A.lado];
    A.quieto = false;
    await animar(A, { ox: -dir * 6, sy: 0.92, sx: 1.06 }, 200, 'frena');
    lineasVelocidad(dir, 280);
    const llegada = llegadaHasta(A, D, 10);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 200, 'acelera');
    const r = radioDe(D, 0.72, 18, 44);
    for (let i = 0; i < mordiscos; i++) {
      const c = centro(D);
      efimero(480, p => faucesForma(c.x, c.y, r, p, estilo));
      await pausa(260);
      impacto(c.x, c.y, paleta, 1.25);
      temblar(5, 220);
      if (i < mordiscos - 1) reiniciarGolpe(D, 0.4);
    }
    const c = centro(D);
    const grietas = [0, 1, 2, 3, 4, 5].map(i => zigzag([c.x, c.y], [c.x + Math.cos(i * 1.05 + 0.3) * r * 0.9, c.y + Math.sin(i * 1.05 + 0.3) * r * 0.8], 4, 3));
    efimero(520, p => grietas.forEach(g => trazo(g.slice(0, Math.max(2, Math.ceil(g.length * Math.min(1, p * 4)))), 1.6, tonosDe(estilo)[0], { alfa: 1 - p })));
    if (estilo !== 'siniestro' && estilo !== 'normal') estallido(c.x, c.y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo));
    volver(A);
  }

  /** Una zarpa curva que se afina (garras de sombra, de dragón, metálicas…). */
  function zarpa(c, r, i, p, colores, dir) {
    const avance = Math.min(1, p / 0.45);
    const alfa = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
    const o = (i - 1) * r * 0.36;
    const puntos = curva([c.x + dir * (o - r * 0.85), c.y - r * 1.05], [c.x + dir * (o + r * 0.65), c.y - r * 0.35], [c.x + dir * (o + r * 0.55), c.y + r * 1.0], avance);
    trazoAfinado(puntos, r * 0.26, colores[0], alfa);
    trazoAfinado(puntos, r * 0.17, colores[1], alfa);
    trazoAfinado(puntos, r * 0.06, colores[2], alfa);
  }
  /** Garras gigantes de energía que barren al rival y dejan las marcas brillando (Garra Umbría, Garra Dragón…). */
  async function garrazo(A, D, paleta, { estilo = 'normal' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    efimero(420, (p, t) => { const b = boca(A); for (let i = 0; i < 3; i++) trazo([[b.x + dir * 2, b.y - 6 + i * 4], [b.x + dir * 9, b.y - 9 + i * 4]], 1.4, colores[2], { halo: colores[1], alfa: 0.6 + Math.sin(t / 40) * 0.3 }); });
    await anticipar(A, 360);
    lineasVelocidad(dir, 280);
    const llegada = llegadaHasta(A, D, 14);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 190, 'acelera');
    const c = centro(D);
    const r = radioDe(D, 0.85, 22, 52);
    if (estilo === 'sombra' || estilo === 'siniestro') efimero(420, p => brillo(c.x, c.y - r * 0.3, r * 1.4, colores[1], 0.5 * (1 - p)));
    for (let i = 0; i < 3; i++) efimero(400, p => zarpa(c, r, i, p, colores, dir), { retraso: i * 45 });
    await pausa(150);
    impacto(c.x, c.y, paleta, 1.3);
    temblar(4, 220);
    efimero(800, p => { for (let i = 0; i < 3; i++) { const o = (i - 1) * r * 0.36; trazoAfinado(curva([c.x + dir * (o - r * 0.5), c.y - r * 0.6], [c.x + dir * (o + r * 0.3), c.y - r * 0.15], [c.x + dir * (o + r * 0.35), c.y + r * 0.6]), r * 0.09, colores[2], 1 - p); } });
    volver(A);
  }

  /** Arco de un tajo con los colores del elemento (borde oscuro, cuerpo y filo claro), afinado en las puntas. */
  function arcoColor(x, y, r, desde, hasta, dir, colores, alfa, grosor = 6) {
    const puntos = [];
    for (let i = 0; i <= 18; i++) {
      const a = desde + ((hasta - desde) * i) / 18;
      const angulo = dir > 0 ? a : Math.PI - a;
      puntos.push([x + Math.cos(angulo) * r, y + Math.sin(angulo) * r]);
    }
    brillo(puntos[puntos.length - 1][0], puntos[puntos.length - 1][1], grosor * 2.5, colores[1], 0.6 * alfa);
    trazoAfinado(puntos, grosor * 1.5, colores[0], alfa);
    trazoAfinado(puntos, grosor, colores[1], alfa);
    trazoAfinado(puntos, grosor * 0.35, colores[2], alfa);
  }

  /** Hoja de energía con forma de sable, apuntando en `angulo`. */
  function sable(x, y, largo, angulo, colores, alfa = 1) {
    const L = largo * S; const w = largo * 0.16 * S;
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(angulo);
    ctx.globalAlpha = Math.max(0, Math.min(1, alfa));
    const forma = k => { ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.lineTo(0, -w * k); ctx.lineTo(L * 0.82, -w * 0.45 * k); ctx.lineTo(L, 0); ctx.lineTo(L * 0.82, w * 0.45 * k); ctx.lineTo(0, w * k); ctx.closePath(); };
    ctx.fillStyle = colores[0]; forma(1.5); ctx.fill();
    ctx.fillStyle = colores[1]; forma(1); ctx.fill();
    ctx.strokeStyle = colores[2]; ctx.lineWidth = Math.max(1, w * 0.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.9, 0); ctx.stroke();
    ctx.restore();
  }
  /** Corte de sable: la hoja brilla en su brazo, corre y lanza un gran tajo que deja la marca (Hoja Aguda, Tajo Umbrío…). */
  async function filo(A, D, paleta, { estilo = 'hojas' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    const empunada = { activa: true };
    efimero(1500, (p, t) => { if (!empunada.activa) return; const b = boca(A); brillo(b.x + dir * 12, b.y - 10, 14, colores[1], 0.5); sable(b.x + dir * 2, b.y - 2, 30, dir > 0 ? -0.9 : Math.PI + 0.9, colores, 0.75 + Math.sin(t / 50) * 0.25); });
    await anticipar(A, 380);
    lineasVelocidad(dir, 280);
    const llegada = llegadaHasta(A, D, 12);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 190, 'acelera');
    empunada.activa = false;
    const c = centro(D);
    const r = radioDe(D, 0.8, 22, 48);
    efimero(320, p => {
      const avance = Math.min(1, p * 2.2); const alfa = p > 0.5 ? 1 - (p - 0.5) / 0.5 : 1;
      arcoColor(c.x, c.y, r * 1.15, -2.5, -2.5 + 3.4 * avance, dir, colores, alfa, 8);
      const a = dir > 0 ? -2.5 + 3.4 * avance : Math.PI - (-2.5 + 3.4 * avance);
      sable(c.x + Math.cos(a) * r * 1.15, c.y + Math.sin(a) * r * 1.15, 26, a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), colores, alfa);
    });
    await pausa(130);
    impacto(c.x, c.y, paleta, 1.3);
    temblar(4, 200);
    efimero(650, p => trazoAfinado([[c.x - dir * r * 0.9, c.y - r * 0.8], [c.x, c.y], [c.x + dir * r * 0.9, c.y + r * 0.8]], 4, colores[2], 1 - p));
    if (estilo === 'hojas') for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2; particula({ x: c.x, y: c.y, vx: Math.cos(a) * entre(40, 120), vy: Math.sin(a) * entre(40, 120), arrastre: 2, vida: 650, colores: ['#cff59f', '#5fbf5a', '#2f7a32'], tam: 2.5, forma: 'roca', vgiro: entre(-10, 10) }); }
    else estallido(c.x, c.y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo));
    volver(A);
  }
  /** Tajo a distancia (Espada Santa, Tajo Espacial, Cuchilla Taquión): la marca aparece sobre el rival. */
  async function tajoLejano(A, D, paleta, { estilo = 'lucha' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    if (estilo === 'dragon') fondo(1500, 'dragon');
    efimero(520, (p, t) => { const b = boca(A); sable(b.x, b.y - 4, 30 + p * 10, dir > 0 ? -1.2 + p * 0.4 : Math.PI + 1.2 - p * 0.4, colores, 0.8 + Math.sin(t / 40) * 0.2); brillo(b.x + dir * 14, b.y - 14, 18, colores[1], 0.6); });
    await anticipar(A, 520);
    soltar(A);
    const c = centro(D); const r = radioDe(D, 0.95, 24, 56);
    for (let i = 0; i < 2; i++) {
      const s = i ? -1 : 1;
      efimero(520, p => { const avance = Math.min(1, p * 3); const alfa = p > 0.5 ? 1 - (p - 0.5) / 0.5 : 1; const a = [c.x - dir * r * s, c.y - r * 0.9]; const b = [c.x + dir * r * s, c.y + r * 0.9]; const fin = [lerp(a[0], b[0], avance), lerp(a[1], b[1], avance)]; trazoAfinado([a, [lerp(a[0], fin[0], 0.5), lerp(a[1], fin[1], 0.5)], fin], 9, colores[0], alfa); trazoAfinado([a, [lerp(a[0], fin[0], 0.5), lerp(a[1], fin[1], 0.5)], fin], 5, colores[1], alfa); trazoAfinado([a, [lerp(a[0], fin[0], 0.5), lerp(a[1], fin[1], 0.5)], fin], 2, '#ffffff', alfa); }, { retraso: i * 120 });
    }
    await pausa(200);
    destellar(colores[2], 160, 0.4);
    if (estilo === 'dragon') ondular(500, 4);
    impacto(c.x, c.y, paleta, 1.3);
    temblar(4, 240);
  }

  /** Dos cortes que forman una X brillante sobre el rival (Tijera X, Veneno X, Ala de Acero…). */
  async function tijeras(A, D, paleta, { estilo = 'bicho' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    const cruzadas = { activa: true };
    efimero(1500, (p, t) => { if (!cruzadas.activa) return; const b = boca(A); for (const s of [-1, 1]) sable(b.x - dir * 2, b.y + s * 6, 24, (dir > 0 ? 0 : Math.PI) + s * 0.75 * dir, colores, 0.8 + Math.sin(t / 45) * 0.2); });
    await anticipar(A, 360);
    lineasVelocidad(dir, 280);
    const llegada = llegadaHasta(A, D, 12);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 190, 'acelera');
    cruzadas.activa = false;
    const c = centro(D);
    const r = radioDe(D, 0.7, 20, 44);
    [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]].forEach(([[x0, y0], [x1, y1]], i) => efimero(560, p => {
      const avance = Math.min(1, p * 4); const alfa = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1;
      const desde = [c.x + x0 * r, c.y + y0 * r]; const hasta = [lerp(desde[0], c.x + x1 * r, avance), lerp(desde[1], c.y + y1 * r, avance)];
      const linea = [desde, [lerp(desde[0], hasta[0], 0.5), lerp(desde[1], hasta[1], 0.5)], hasta];
      trazoAfinado(linea, 7, colores[0], alfa);
      trazoAfinado(linea, 4.5, colores[1], alfa);
      trazoAfinado(linea, 1.8, colores[2], alfa);
      if (i === 1 && avance === 1) brillo(c.x, c.y, r * 0.9, colores[1], 0.8 * alfa);
    }, { retraso: i * 90 }));
    await pausa(170);
    impacto(c.x, c.y, paleta, 1.3);
    temblar(4, 220);
    setTimeout(() => { const c2 = centro(D); for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2; particula({ x: c2.x, y: c2.y, vx: Math.cos(a) * entre(50, 140), vy: Math.sin(a) * entre(50, 140), arrastre: 2, vida: 500, colores: ['#ffffff', colores[2], colores[1]], tam: 2, forma: 'estrella', brillo: 3 }); } }, 420);
    volver(A);
  }

  /** Coletazo: su cola se envuelve en el elemento, da una vuelta y barre al rival (Acua Cola, Cola Férrea…). */
  async function colaGiro(A, D, paleta, { estilo = 'agua' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    const tras = () => { const c = centro(A); return { x: c.x - dir * anchoDe(A) * 0.4, y: c.y + altoDe(A) * 0.2 }; };
    efimero(760, (p, t) => { // anillos que giran alrededor de la cola
      const q = tras();
      brillo(q.x, q.y, 16, colores[1], 0.5);
      for (let i = 0; i < 3; i++) aro(q.x, q.y, 6 + i * 3.5, 2.2, i === 1 ? colores[2] : colores[1], 0.85, 0.35 + 0.3 * Math.sin(t / 70 + i * 2));
      if (Math.random() < 0.5) chispa(q.x + entre(-8, 8), q.y + entre(-6, 6), estilo);
    });
    await anticipar(A, 440);
    for (let vuelta = 0; vuelta < 2; vuelta++) { // da una vuelta sobre sí mismo
      await animar(A, { sx: 0.08 }, 70, 'acelera');
      A.mira *= -1;
      await animar(A, { sx: 1 }, 70, 'frena');
    }
    lineasVelocidad(dir, 260);
    const llegada = llegadaHasta(A, D, 8);
    await animar(A, { ox: llegada }, 180, 'acelera');
    const c = centro(D);
    const r = radioDe(D, 0.85, 22, 50);
    efimero(460, p => {
      const avance = Math.min(1, p * 2); const alfa = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1;
      arcoColor(c.x, c.y + 4, r * 1.2, -2.9, -2.9 + 4 * avance, dir, colores, alfa, 11);
      arcoTajo(c.x, c.y + 4, r * 0.95, -2.7, -2.7 + 3.6 * avance, dir, colores[2], alfa * 0.6, 2);
      const a = (dir > 0 ? -2.9 + 4 * avance : Math.PI + 2.9 - 4 * avance);
      if (estilo === 'agua' && Math.random() < 0.8) particula({ x: c.x + Math.cos(a) * r * 1.2, y: c.y + Math.sin(a) * r * 1.2, vx: entre(-60, 60), vy: -entre(40, 140), g: 520, vida: 600, colores: ['#ffffff', '#7cc8ff', '#2f86d6'], tam: 2.6, forma: 'gota' });
      else if (Math.random() < 0.4) chispa(c.x + Math.cos(a) * r * 1.2, c.y + Math.sin(a) * r * 1.2, estilo);
    });
    await pausa(170);
    impacto(c.x, c.y, paleta, 1.3);
    estallido(c.x, c.y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo));
    temblar(5, 240);
    volver(A);
  }

  /** Lianas que salen hacia el rival y lo azotan dos veces (Látigo Cepa, Latigazo, Látigo Ígneo, Atadura…). */
  async function latigos(A, D, paleta, { colores = ['#10300f', '#5fbf5a', '#cff59f'], hojas = true } = {}) {
    await anticipar(A, 200);
    soltar(A);
    const dir = DIRECCION[A.lado];
    await efimero(620, (p, t) => {
      const o = boca(A); const d = centro(D);
      for (const lado of [-1, 1]) {
        const fase = (p * 2 + (lado > 0 ? 0.25 : 0)) % 1;
        const largo = Math.min(1, fase * 1.8);
        const ctl = [lerp(o.x, d.x, 0.5), lerp(o.y, d.y, 0.5) + lado * 34 * Math.sin(fase * Math.PI * 2)];
        const puntos = curva([o.x, o.y + lado * 3], ctl, [d.x - dir * 6, d.y + lado * 8], largo, 18);
        trazo(puntos, 3.6, colores[0]);
        trazo(puntos, 2.2, colores[1]);
        trazo(puntos, 0.7, colores[2]);
        if (hojas) for (let k = 4; k < puntos.length; k += 5) hoja(puntos[k][0], puntos[k][1] - 2, 1.6, t / 200 + k, '#7fd06a');
        else if (Math.random() < 0.3) llama(puntos[puntos.length - 1][0], puntos[puntos.length - 1][1], 3, -Math.PI / 2);
      }
    });
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1.1);
    efimero(260, p => aro(d.x, d.y, 6 + p * 26, 2.5, colores[2], 1 - p));
  }

  /**
   * Terremoto: salta y golpea el suelo; todo tiembla y una grieta corre hasta el rival levantando rocas,
   * que lo lanzan por los aires. Con `pinchos`, del suelo salen cuchillas de roca (Filo del Abismo).
   */
  async function terremoto(A, D, paleta, { pinchos = false } = {}) {
    fondo(1800, 'tierra');
    A.quieto = false;
    await animar(A, { oy: -26, sy: 1.08, sx: 0.94 }, 220, 'frena');
    await animar(A, { oy: 0, sy: 0.8, sx: 1.18 }, 110, 'acelera');
    animar(A, { sx: 1, sy: 1 }, 260, 'rebote').then(() => { A.quieto = true; });
    temblar(10, 1150);
    golpeCamara(A.x, 0.8);
    polvo(A.x + A.ox, SUELO, 18);
    const desde = A.x + A.ox; const hasta = D.x + D.ox + DIRECCION[A.lado] * 22;
    const grieta = zigzag([desde, SUELO + 2], [hasta, SUELO + 2], 6, 5);
    const ramas = grieta.filter((_, i) => i % 5 === 3).map(([gx, gy]) => zigzag([gx, gy], [gx + entre(-16, 16), gy + entre(-10, 12)], 3, 3));
    efimero(1400, p => {
      const largo = Math.min(1, p * 2.4); const alfa = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      const tramo = grieta.slice(0, Math.max(2, Math.ceil(grieta.length * largo)));
      trazo(tramo, 4, '#1e1208', { alfa }); trazo(tramo, 1.4, pinchos ? '#ff9a2e' : '#8a6a42', { alfa });
      ramas.forEach((r, i) => { if (largo > (i + 1) / (ramas.length + 1)) trazo(r, 1.8, '#1e1208', { alfa }); });
    }, { capa: 'suelo' });
    for (let i = 0; i < 4; i++) efimero(620, p => aro(lerp(desde, hasta, p), SUELO, 10 + p * 30, 3.2 - p * 2, '#e6d3a8', 0.8 * (1 - p), 0.32), { retraso: i * 110, capa: 'suelo' });
    emitir(520, p => {
      const x = lerp(desde, hasta, p);
      particula({ x: x + entre(-6, 6), y: SUELO, vx: entre(-30, 30), vy: -entre(90, 190), g: 520, vida: 750, colores: [paleta[1], paleta[0], paleta[2]], tam: entre(2.5, 4.5), forma: 'roca', vgiro: entre(-8, 8) });
      if (Math.random() < 0.35) polvo(x, SUELO, 2);
    });
    await pausa(440);
    D.quieto = false;
    animar(D, { oy: -14 }, 120, 'frena').then(() => animar(D, { oy: 0 }, 180, 'acelera')).then(() => { D.quieto = true; });
    const x = D.x + D.ox;
    for (let i = 0; i < 14; i++) particula({ x: x + entre(-18, 18), y: SUELO, vx: entre(-60, 60), vy: -entre(120, 240), g: 520, vida: 850, colores: [paleta[1], paleta[0], paleta[2]], tam: entre(2.5, 5), forma: 'roca', vgiro: entre(-8, 8) });
    if (pinchos) {
      const filos = [-1, -0.4, 0.3, 1].map(i => ({ dx: i * 18, alto: entre(26, 40), ancho: entre(5, 8) }));
      efimero(800, p => { const sube = Math.min(1, p * 6); const alfa = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1; ctx.globalAlpha = alfa; for (const f of filos) { const base = x + f.dx; ctx.fillStyle = '#2a1a0c'; triangulo(base - f.ancho - 1, SUELO + 1, base, SUELO - f.alto * sube - 2, base + f.ancho + 1, SUELO + 1); ctx.fillStyle = '#b4704a'; triangulo(base - f.ancho, SUELO, base, SUELO - f.alto * sube, base + f.ancho, SUELO); ctx.fillStyle = '#ffcf6a'; triangulo(base - 1, SUELO, base, SUELO - f.alto * sube, base + f.ancho * 0.5, SUELO); } ctx.globalAlpha = 1; });
    }
    polvo(x, SUELO, 16);
    const c = centro(D);
    impacto(c.x, c.y, paleta, 1.3);
  }

  /** Roca de píxeles con caras y borde (colores: [borde, cuerpo, luz]). */
  function rocaPixel(x, y, r, giro, colores = ['#2a2010', '#8a744a', '#c9b27a']) {
    const R = Math.max(2, r * S);
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(giro);
    const forma = k => { ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = R * k * (i % 2 ? 0.86 : 1); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
    ctx.fillStyle = colores[0]; forma(1.18); ctx.fill();
    ctx.fillStyle = colores[1]; forma(1); ctx.fill();
    ctx.fillStyle = colores[2]; ctx.beginPath(); ctx.moveTo(-R * 0.7, -R * 0.2); ctx.lineTo(-R * 0.1, -R * 0.75); ctx.lineTo(R * 0.4, -R * 0.45); ctx.lineTo(-R * 0.15, -R * 0.05); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /** Avalancha: rocas enormes caen sobre el rival (primero se ve su sombra crecer). También de hielo o manzanas. */
  async function avalancha(A, D, paleta, { colores = ['#2a2010', '#8a744a', '#c9b27a'], grande = false } = {}) {
    await anticipar(A, 150);
    soltar(A);
    const d = centro(D);
    const lista = grande ? [0] : [-1, 0, 1, 0.4];
    const rocas = lista.map((i, n) => ({ x: d.x + i * 18 + entre(-4, 4), y: d.y + entre(-6, 8), r: grande ? 20 : entre(8, 12), retraso: 240 + n * 120, giro: entre(-3, 3) }));
    for (const r of rocas) efimero(r.retraso + 380, p => { const q = Math.min(1, (p * (r.retraso + 380)) / (r.retraso + 360)); ctx.globalAlpha = 0.45 * q; ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.ellipse(X(r.x), Y(SUELO + 1), r.r * q * 1.3 * S, r.r * q * 0.4 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }, { capa: 'suelo' });
    const caidas = rocas.map(r => efimero(380, p => rocaPixel(r.x, lerp(-24, r.y, p * p), r.r, p * r.giro, colores), { retraso: r.retraso }).then(() => {
      impacto(r.x, r.y, paleta, grande ? 1.5 : 0.9);
      temblar(grande ? 8 : 4, grande ? 300 : 150);
      polvo(r.x, SUELO, 8);
      for (let i = 0; i < 7; i++) particula({ x: r.x, y: r.y, vx: entre(-90, 90), vy: -entre(40, 150), g: 520, vida: 650, colores: [colores[1], colores[2]], tam: entre(2, 3.5), forma: 'roca', vgiro: entre(-8, 8) });
    }));
    await caidas[0];
  }
  /** Roca Afilada: piedras puntiagudas brillantes giran a su alrededor y salen disparadas contra el rival. */
  async function rocaAfilada(A, D, paleta) {
    const lugar = (i, t, abre) => { const c = centro(A); const a = t / 240 + (i / 5) * Math.PI * 2; return [c.x + Math.cos(a) * (16 + 10 * abre), c.y + Math.sin(a) * (11 + 6 * abre)]; };
    A.quieto = false;
    await efimero(520, (p, t) => { for (let i = 0; i < 5; i++) { const [x, y] = lugar(i, t, p); brillo(x, y, 10, '#8ad8ff', 0.5 * p); gemaPixel(x, y, 4 + p * 2, '#b49a66', t / 160 + i); } });
    soltar(A);
    const salida = ahora();
    const disparos = [0, 1, 2, 3, 4].map(i => efimero(260, p => {
      const [sx, sy] = lugar(i, salida, 1); const d = centro(D);
      const x = lerp(sx, d.x, p); const y = lerp(sy, d.y, p);
      trazo([[lerp(sx, d.x, Math.max(0, p - 0.25)), lerp(sy, d.y, Math.max(0, p - 0.25))], [x, y]], 2.2, '#8ad8ff', { alfa: 0.7 });
      gemaPixel(x, y, 6, '#b49a66', Math.atan2(d.y - sy, d.x - sx) + Math.PI / 2);
    }, { retraso: i * 60 }).then(() => { const d = centro(D); impacto(d.x + entre(-8, 8), d.y + entre(-8, 8), paleta, 0.8); temblar(3, 100); }));
    await disparos[0];
  }

  /** Cuerno o pico que gira como un taladro mientras embiste (Pico Taladro, Megacuerno, Puya Nociva…). */
  async function taladro(A, D, paleta, { estilo = 'normal' } = {}) {
    const dir = DIRECCION[A.lado];
    const colores = tonosDe(estilo);
    const activo = { si: true };
    efimero(1200, (p, t) => {
      if (!activo.si) return;
      const b = boca(A); const largo = 22; const ancho = 9;
      const punta = b.x + dir * (largo + 4); const base = b.x + dir * 4;
      brillo(b.x + dir * 12, b.y, 16, colores[1], 0.5);
      ctx.fillStyle = colores[0]; triangulo(base, b.y - ancho - 1, base, b.y + ancho + 1, punta + dir * 2, b.y);
      ctx.fillStyle = colores[1]; triangulo(base, b.y - ancho, base, b.y + ancho, punta, b.y);
      for (let k = 0; k < 4; k++) { const u = (t / 60 + k / 4) % 1; const x = lerp(base, punta, u); const h = ancho * (1 - u); trazo([[x, b.y - h], [x + dir * 4, b.y + h]], 1.2, colores[2]); }
    });
    await anticipar(A, 300);
    lineasVelocidad(dir, 300);
    const llegada = llegadaHasta(A, D, 6);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 200, 'acelera');
    activo.si = false;
    const c = centro(D);
    impacto(c.x, c.y, paleta, 1.3);
    efimero(380, p => { for (let i = 0; i < 3; i++) aro(c.x - dir * 4, c.y, 6 + ((p * 3 + i / 3) % 1) * 30, 2, colores[2], 1 - p, 1.6); });
    estallido(c.x, c.y, AURA_CHISPA[estilo] || estilo, paletaDe(estilo));
    temblar(4, 220);
    volver(A);
  }

  /** Primer turno de Vuelo, Excavar, Buceo o Golpe Fantasma: se esconde (y queda invisible hasta atacar). */
  async function ocultarse(L, modo) {
    L.quieto = false;
    if (modo === 'aire') { // se agacha y sale volando hacia arriba
      await animar(L, { sy: 0.85, sx: 1.1 }, 160, 'frena');
      polvo(L.x + L.ox, SUELO, 10);
      lineasVelocidad(1, 260);
      await animar(L, { oy: -ALTO, sy: 1.25, sx: 0.85 }, 320, 'acelera');
    } else if (modo === 'sombra') { // se deshace en humo oscuro
      emitir(420, () => { const c = centro(L); particula({ x: c.x + entre(-10, 10), y: c.y + entre(-14, 14), vy: -entre(10, 40), vida: 520, colores: ['#7a4fc0', '#24123f'], tam: 3, tamFin: 7, forma: 'humo', alfa: 0.7 }); });
      await animar(L, { alfa: 0 }, 420, 'lineal');
    } else { // tierra o agua: se hunde
      const agua = modo === 'agua';
      emitir(340, () => particula({ x: L.x + L.ox + entre(-10, 10), y: SUELO, vx: entre(-50, 50), vy: -entre(40, 120), g: 420, vida: 500, colores: agua ? ['#ffffff', '#7cc8ff'] : ['#8a6a42', '#3a2a1a'], tam: 2.5, forma: agua ? 'gota' : 'roca', vgiro: 6 }));
      await animar(L, { oy: 40, alfa: 0, sy: 0.6 }, 360, 'acelera');
    }
    // Queda invisible en su sitio (así los ataques del rival apuntan al lugar correcto y fallan).
    Object.assign(L, { oculto: modo, alfa: 0, oy: 0, sx: 1, sy: 1 });
  }
  /** Lo devuelve a la vista al instante (si lo tocan mientras está escondido o cae K.O.). */
  function revelar(L) {
    if (L.oculto) Object.assign(L, { oculto: null, alfa: 1, oy: 0, ox: 0, sx: 1, sy: 1, quieto: true });
    L.preparado = null;
  }
  /** Ataque por sorpresa desde donde se escondió: cae del cielo, sale del suelo o del agua, o aparece detrás. */
  async function emboscada(A, D, paleta, { modo = 'tierra' } = {}) {
    if (A.oculto !== modo) await ocultarse(A, modo);
    const dir = DIRECCION[A.lado];
    const llegada = llegadaHasta(A, D, -anchoDe(D) * 0.3);
    A.quieto = false;
    if (modo === 'aire') { // su sombra crece sobre el rival y cae en picado
      A.ox = llegada;
      await efimero(420, p => { ctx.globalAlpha = 0.5 * p; ctx.fillStyle = '#1a0e05'; ctx.beginPath(); ctx.ellipse(X(D.x + D.ox), Y(SUELO + 1), (8 + 14 * p) * S, (3 + 4 * p) * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }, { capa: 'suelo' });
      Object.assign(A, { oy: -ALTO, alfa: 1, sy: 1.2, sx: 0.88, oculto: null });
      lineasVelocidad(dir, 200);
      emitir(200, () => particula({ x: A.x + A.ox + entre(-6, 6), y: centro(A).y - altoDe(A) * 0.5, vy: -60, vida: 260, colores: ['#ffffff', '#a9c2ee'], tam: 2, forma: 'chispa' }));
      await animar(A, { oy: -altoDe(D) * 0.3 }, 200, 'acelera');
    } else if (modo === 'sombra') { // reaparece detrás del rival
      A.ox = llegada + dir * anchoDe(D) * 0.9;
      A.mira *= -1;
      efimero(300, p => { const c = centro(A); brillo(c.x, c.y, 30, '#7a4fc0', 0.7 * (1 - p)); });
      Object.assign(A, { oculto: null });
      await animar(A, { alfa: 1 }, 160, 'lineal');
      await animar(A, { ox: llegada + dir * anchoDe(D) * 0.5 }, 110, 'acelera');
    } else { // tierra o agua: un bulto avanza bajo el suelo y sale disparado bajo el rival
      const agua = modo === 'agua';
      const inicio = A.x + A.ox;
      await efimero(480, p => { const x = lerp(inicio, D.x + D.ox, p); ctx.fillStyle = agua ? '#3fa0e6' : '#5a4028'; ctx.beginPath(); ctx.ellipse(X(x), Y(SUELO + 1), 9 * S, 4 * S, 0, Math.PI, 0); ctx.fill(); if (Math.random() < 0.5) polvo(x, SUELO, 1, agua ? '#c8ecff' : '#b89a70'); }, { capa: 'suelo' });
      A.ox = llegada;
      for (let i = 0; i < 16; i++) particula({ x: D.x + D.ox + entre(-10, 10), y: SUELO, vx: entre(-90, 90), vy: -entre(100, 220), g: 520, vida: 700, colores: agua ? ['#ffffff', '#7cc8ff'] : ['#8a6a42', '#3a2a1a'], tam: entre(2, 4), forma: agua ? 'gota' : 'roca', vgiro: entre(-8, 8) });
      Object.assign(A, { alfa: 1, oy: 30, oculto: null });
      await animar(A, { oy: -18, sy: 1.15 }, 160, 'frena');
    }
    const c = centro(D);
    impacto(c.x, c.y, paleta, 1.4);
    temblar(6, 260);
    if (modo === 'sombra') efimero(420, p => trazoAfinado([[c.x + dir * 20, c.y - 22], [c.x, c.y], [c.x - dir * 20, c.y + 22]], 5, '#b48aff', 1 - p));
    await pausa(80);
    if (modo === 'sombra') A.mira *= -1;
    animar(A, { oy: 0, sy: 1, sx: 1 }, 200).then(() => volver(A, 380));
  }

  /** «Nube de pelea» de los dibujos animados: se lanza encima del rival entre polvo y estrellas (Carantoña). */
  async function nubePelea(A, D, paleta) {
    const dir = DIRECCION[A.lado];
    await anticipar(A, 160);
    lineasVelocidad(dir, 300);
    const llegada = llegadaHasta(A, D, -anchoDe(D) * 0.2);
    A.sx = 1; A.sy = 1;
    await animar(A, { ox: llegada }, 220, 'acelera');
    const c = centro(D); const r = radioDe(D, 0.6, 16, 40);
    A.alfa = 0.35;
    emitir(640, () => {
      particula({ x: c.x + entre(-r, r) * 0.9 - dir * 10, y: c.y + entre(-r, r) * 0.6, vx: entre(-20, 20), vy: entre(-20, 20), vida: 380, colores: ['#ffffff', '#ffe8f4', paleta[1]], tam: 6, tamFin: 11, forma: 'humo', alfa: 0.95 });
      if (Math.random() < 0.25) particula({ x: c.x + entre(-r, r) - dir * 10, y: c.y + entre(-r, r) * 0.7, vida: 260, colores: ['#ffffff', paleta[0]], tam: 3, forma: 'estrella', brillo: 4 });
    });
    for (let i = 0; i < 5; i++) setTimeout(() => impacto(c.x + entre(-r, r) * 0.7 - dir * 10, c.y + entre(-r, r) * 0.5, paleta, 0.5), 80 + i * 100);
    await pausa(560);
    A.alfa = 1;
    impacto(c.x, c.y, paleta, 1.2);
    temblar(4, 200);
    volver(A);
  }

  // --- Especiales -------------------------------------------------------------------------------------

  /**
   * Haz de energía con su carga (Hiperrayo, Rayo Solar, Foco Resplandor, Rayo Aurora…).
   * colores: [borde, cuerpo, claro, núcleo]. carga: 'orbe' | 'convergente' | 'sol'. extras: adorno a lo
   * largo del haz ('anillos', 'espiral', 'estrellas', 'cristales', 'zigzag', 'ondas', 'arcoiris').
   * `recarga`: jadea al final (se queda sin fuerzas). `congela`: encierra al rival en hielo.
   */
  async function haz(A, D, paleta, { colores, grosor = 10, carga = 'orbe', extras = null, fondoTipo = null, explosion = 1.2, recarga = false, congela = false } = {}) {
    const dir = DIRECCION[A.lado];
    if (fondoTipo) fondo(1900, fondoTipo);
    const [borde, cuerpo, claro, nucleo = '#ffffff'] = colores;
    const orbe = [nucleo, claro, cuerpo, borde];
    if (carga === 'sol') { // la luz del sol baja del cielo y se concentra
      await efimero(760, p => { const o = boca(A); for (let i = 0; i < 5; i++) { const x = o.x + (i - 2) * 14; trazo([[x + (o.x - x) * p, -10], [o.x, o.y]], 3 * (1 - p) + 0.6, '#fff3a0', { alfa: 0.55 }); } brillo(o.x, o.y, 8 + p * 20, '#fff3a0', 0.7); bola(o.x, o.y, 2 + p * 7, ['#ffffff', '#fff3a0', '#cfe86a', '#3a5a10']); });
    } else if (carga === 'convergente') { // rayos de energía que convergen en un orbe
      efimero(680, (p, t) => { const o = boca(A); for (let i = 0; i < 9; i++) { const a = i * 0.7 + t / 200; const r = 44 * (1 - ((p * 3 + i / 9) % 1)); trazo([[o.x + Math.cos(a) * r, o.y + Math.sin(a) * r], [o.x + Math.cos(a) * (r + 9), o.y + Math.sin(a) * (r + 9)]], 1.5, claro, { alfa: 0.85 }); } bola(o.x, o.y, 2 + p * 7, orbe); });
      await anticipar(A, 680);
    } else { // un orbe que crece
      efimero(460, (p, t) => { const o = boca(A); bola(o.x, o.y, 2 + p * 6, orbe); if (extras === 'estrellas') for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t / 150; chispa4(o.x + Math.cos(a) * (8 + p * 6), o.y + Math.sin(a) * (8 + p * 6), 2.5, '#ffffff', p); } });
      cargar(boca(A), [nucleo, claro, cuerpo], 460, 28);
      await anticipar(A, 460);
    }
    const o = boca(A); const d = centro(D);
    destellar(claro, 160, 0.4);
    temblar(grosor > 14 ? 6 : 3, 700);
    const lugar = q => [lerp(o.x, d.x, q), lerp(o.y, d.y, q)];
    efimero(760, (p, t) => {
      const alcance = Math.min(1, p * 5);
      const fin = [lerp(o.x, d.x, alcance) + dir * 26 * alcance, lerp(o.y, d.y, alcance)];
      const g = (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1) * (grosor + Math.sin(t / 22) * grosor * 0.1);
      const cuerpoActual = extras === 'arcoiris' ? ARCOIRIS[Math.floor(t / 70) % ARCOIRIS.length] : cuerpo;
      trazo([[o.x, o.y], fin], g * 1.35, borde);
      trazo([[o.x, o.y], fin], g, cuerpoActual);
      trazo([[o.x, o.y], fin], g * 0.58, claro);
      trazo([[o.x, o.y], fin], g * 0.24, nucleo);
      bola(o.x, o.y, g * 0.55, orbe);
      if (extras === 'anillos' || extras === 'espiral') for (let i = 0; i < 4; i++) { const [x, y] = lugar(((t / 240 + i / 4) % 1) * alcance); aro(x, y, g * 0.75, 1.5, nucleo, 0.7, 1.6); }
      if (extras === 'espiral') for (const s of [1, -1]) { const puntos = []; for (let k = 0; k <= 20; k++) { const q = (k / 20) * alcance; const [x, y] = lugar(q); puntos.push([x, y + Math.sin(q * 18 - t / 30) * g * 0.9 * s]); } trazo(puntos, 1.4, claro, { alfa: 0.9 }); }
      if (extras === 'estrellas') for (let i = 0; i < 5; i++) { const [x, y] = lugar(((t / 260 + i / 5) % 1) * alcance); chispa4(x, y + Math.sin(i * 5) * g * 0.8, 2.5, '#ffffff'); }
      if (extras === 'cristales') for (let i = 0; i < 6; i++) { const [x, y] = lugar(((t / 300 + i / 6) % 1) * alcance); chispa4(x, y + Math.sin(i * 3 + t / 60) * 4, 2 + (i % 2), '#ffffff'); }
      if (extras === 'zigzag' && Math.random() < 0.6) rayoGrueso(zigzag([o.x, o.y], fin, g, 4), 1.2);
      if (extras === 'ondas') for (let i = 0; i < 3; i++) { const [x, y] = lugar(((t / 300 + i / 3) % 1) * alcance); aro(x, y, g, 1.5, claro, 0.7, 1.4); }
    });
    soltar(A);
    await pausa(150);
    if (congela) { // el rival queda dentro de un bloque de hielo que estalla
      const w = anchoDe(D) * 0.62 + 6; const h = altoDe(D) * 0.6 + 6;
      efimero(780, p => { const crece = Math.min(1, p * 5); const alfa = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1; const c = centro(D); ctx.globalAlpha = 0.55 * alfa; ctx.fillStyle = '#bdefff'; ctx.beginPath(); [[-1, -0.7], [-0.4, -1], [0.5, -0.92], [1, -0.4], [0.9, 0.6], [0.3, 1], [-0.6, 0.9], [-1, 0.3]].forEach(([px, py], i) => (i ? ctx.lineTo(X(c.x + px * w * crece), Y(c.y + py * h * crece)) : ctx.moveTo(X(c.x + px * w * crece), Y(c.y + py * h * crece)))); ctx.closePath(); ctx.fill(); ctx.globalAlpha = alfa; ctx.strokeStyle = '#1d4a66'; ctx.lineWidth = Math.max(1, S * 0.9); ctx.stroke(); ctx.globalAlpha = 1; });
      setTimeout(() => { const c = centro(D); for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; particula({ x: c.x, y: c.y, vx: Math.cos(a) * entre(60, 160), vy: Math.sin(a) * entre(60, 160) - 30, g: 320, vida: 650, colores: ['#ffffff', '#8fe3ef', '#3a9fb0'], tam: entre(2, 3.5), forma: 'roca', vgiro: entre(-10, 10) }); } }, 720);
    }
    efimero(620, p => { aro(d.x, d.y, 8 + p * 48 * explosion, 4 * (1 - p) + 1, claro, 1 - p); brillo(d.x, d.y, 46 * explosion * (1 - p * 0.5), cuerpo, 0.8 * (1 - p)); });
    if (explosion > 1.3) for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(60, 190), vy: Math.sin(a) * entre(60, 190), arrastre: 2, vida: 650, colores: [nucleo, claro, cuerpo, borde], tam: 3, tamFin: 9, forma: 'humo', brillo: 4, alfa: 0.85 }); }
    if (extras === 'estrellas') for (let i = 0; i < 4; i++) efimero(320, p => destelloEstrella(d.x + entre(-16, 16), d.y + entre(-20, 20), 3 + p * 9, p), { retraso: i * 70 });
    if (explosion > 1.5) { golpeCamara(d.x, 1); marcoImpacto(d.x, d.y); }
    impacto(d.x, d.y, paleta, explosion);
    if (recarga) setTimeout(() => { A.quieto = false; animar(A, { sy: 0.9, sx: 1.06 }, 300).then(() => volver(A, 500)); }, 600); // jadea: se queda sin fuerzas
  }

  /** Esfera de energía que se forma delante y sale disparada (Energibola, Onda Certera, Electrocañón…). colores: [claro, medio, oscuro, borde]. */
  async function esfera(A, D, paleta, { colores, radio = 10, estilo = 'normal', arco = 10, fondoTipo = null } = {}) {
    const dir = DIRECCION[A.lado];
    if (fondoTipo) fondo(1600, fondoTipo);
    const frente = () => { const b = boca(A); return { x: b.x + dir * 10, y: b.y }; };
    const remolino = (x, y, r, t) => { for (let i = 0; i < 2; i++) { const a = t / 60 + i * Math.PI; trazo([[x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55], [x + Math.cos(a + 1.3) * r * 0.55, y + Math.sin(a + 1.3) * r * 0.55]], 1.2, colores[0]); } };
    A.quieto = false;
    animar(A, { ox: -dir * 5, sy: 0.95, sx: 1.04 }, 380, 'frena');
    await efimero(460, (p, t) => { const f = frente(); const r = 2 + p * radio; brillo(f.x, f.y, r * 2.4, colores[1], 0.6); bola(f.x, f.y, r, colores); remolino(f.x, f.y, r, t); if (Math.random() < 0.6) chispa(f.x + entre(-r, r) * 2, f.y + entre(-r, r) * 2, estilo); });
    const o = frente(); const d = centro(D);
    soltar(A);
    await efimero(400, (p, t) => {
      const x = lerp(o.x, d.x, p); const y = lerp(o.y, d.y, p) - Math.sin(Math.PI * p) * arco;
      for (let k = 1; k <= 3; k++) { const q = Math.max(0, p - k * 0.07); bola(lerp(o.x, d.x, q), lerp(o.y, d.y, q) - Math.sin(Math.PI * q) * arco, Math.max(1, radio - k * 2), colores, 0.25 * (4 - k)); }
      brillo(x, y, radio * 2.4, colores[1], 0.6);
      bola(x, y, radio, colores);
      remolino(x, y, radio, t);
    });
    destellar(colores[1], 180, 0.3);
    for (let i = 0; i < 3; i++) efimero(480, p => aro(d.x, d.y, 8 + p * 46, 3 * (1 - p) + 0.6, colores[1], 1 - p), { retraso: i * 80 });
    estallido(d.x, d.y, AURA_CHISPA[estilo] || estilo, [colores[1], colores[0], colores[2]]);
    impacto(d.x, d.y, paleta, 1.25);
  }

  /** Ola gigante que barre el campo y se curva al romper (Surf, Agua Lodosa, Onda Tóxica, Onda Ígnea…). */
  async function olaGigante(A, D, paleta, { colores = ['#0e3a66', '#2f86d6', '#7cc8ff', '#ffffff'], alto = 70, fondoTipo = 'agua' } = {}) {
    const dir = DIRECCION[A.lado];
    fondo(1800, fondoTipo);
    A.quieto = false;
    animar(A, { oy: -8, sy: 1.05 }, 300, 'frena');
    const inicio = A.x - dir * 60; const fin = D.x + dir * 90;
    const llegada = 620;
    const ola = efimero(1000, (p, t) => {
      const q = Math.min(1, p * (1000 / llegada));
      const frente = lerp(inicio, fin, q);
      const h = alto * Math.sin(Math.min(1, p * 2.2) * Math.PI * 0.5) * (p > 0.8 ? (1 - p) / 0.2 : 1);
      const atras = frente - dir * 150;
      const cresta = k => SUELO - h * (0.55 + 0.45 * Math.sin(k * Math.PI)) + Math.sin(k * 9 + t / 90) * 2;
      for (const [color, encoge] of [[colores[0], 0], [colores[1], 4], [colores[2], 22]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(X(atras), Y(SUELO + 12));
        for (let k = 0; k <= 20; k++) { const u = k / 20; ctx.lineTo(X(lerp(atras, frente, u)), Y(cresta(u) + encoge)); }
        ctx.quadraticCurveTo(X(frente + dir * 18), Y(SUELO - h * 1.05), X(frente + dir * 10), Y(SUELO - h * 0.55)); // la cresta se curva hacia delante
        ctx.lineTo(X(frente), Y(SUELO + 12));
        ctx.closePath(); ctx.fill();
      }
      for (let k = 0; k < 16; k++) { const u = k / 16; cuadro(lerp(atras, frente, u) + Math.sin(t / 70 + k) * 2, cresta(u) - 1, 2.4, colores[3]); } // espuma
      if (Math.random() < 0.7) particula({ x: frente + dir * 8, y: SUELO - h * 0.9, vx: dir * entre(30, 90), vy: -entre(20, 80), g: 400, vida: 500, colores: [colores[3], colores[2]], tam: 2.5, forma: 'gota' });
    });
    await pausa(llegada * ((D.x - inicio) / (fin - inicio)));
    soltar(A);
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1.3);
    temblar(5, 400);
    D.quieto = false;
    animar(D, { oy: -10 }, 200, 'frena').then(() => animar(D, { oy: 0 }, 260, 'acelera')).then(() => { D.quieto = true; });
    await Promise.race([ola, pausa(120)]);
  }

  /** Nube de tormenta (Trueno). */
  function nubeTormenta(x, y, r, alfa) {
    for (const [dx, dy, k, color] of [[0, 2, 1.1, '#141418'], [-r * 0.7, 3, 0.8, '#1e1e26'], [r * 0.7, 3, 0.85, '#1e1e26'], [-r * 0.3, -3, 0.75, '#2a2a36'], [r * 0.35, -2, 0.7, '#2a2a36']]) disco(x + dx, y + dy, r * k * 0.6, color, alfa);
  }
  /** Moneda dorada de píxeles (Día de Pago, Fiebre Dorada). */
  function moneda(x, y, r, giro) {
    const ancho = Math.abs(Math.cos(giro)) * 0.8 + 0.2;
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.scale(ancho, 1);
    ctx.fillStyle = '#5a3a08'; ctx.beginPath(); ctx.arc(0, 0, (r + 0.8) * S, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 0, r * S, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(-r * 0.4 * S, -r * 0.6 * S, r * 0.35 * S, r * 0.7 * S);
    ctx.restore();
  }
  /**
   * Lo que llega desde el cielo: Trueno (nube y rayos), Llamarada (la estrella de fuego con forma de 大),
   * Cometa Draco (meteoros), Ventisca, Vendaval/Tornado (con `colores`) y Fiebre Dorada (lluvia de monedas).
   */
  async function desdeElCielo(A, D, paleta, { modo = 'trueno', colores = null } = {}) {
    A.quieto = false;
    animar(A, { oy: -6, sy: 1.06, sx: 0.95 }, 320, 'frena');
    if (modo === 'trueno') {
      fondo(1900, 'tormenta');
      efimero(1500, p => { const d = centro(D); nubeTormenta(d.x, 30, 30, Math.min(1, p * 5) * (p > 0.85 ? (1 - p) / 0.15 : 1)); });
      await pausa(520);
      soltar(A);
      const d0 = centro(D);
      for (let i = 0; i < 3; i++) { const z = zigzag([d0.x + entre(-10, 10), 36], [d0.x + entre(-4, 4), d0.y], 16, 5); efimero(240, p => rayoGrueso(z, i ? 3.5 : 6, 1 - p), { retraso: i * 110 }); setTimeout(() => destellar('#fffbe0', 120, 0.6), i * 110); }
      await pausa(40);
    } else if (modo === 'llamarada') { // la estrella de fuego con forma de 大
      const llamas = colores || LLAMA_FUEGO;
      fondo(1800, 'fuego');
      cargar(boca(A), ['#fff6d0', '#ffd45a', '#ff8a26'], 320, 24);
      await pausa(320);
      soltar(A);
      const o = boca(A);
      await efimero(360, p => { const d = centro(D); llama(lerp(o.x, d.x, p), lerp(o.y, d.y, p), 7, Math.atan2(d.y - o.y, d.x - o.x), 1, llamas); });
      const brazos = [-Math.PI / 2, Math.PI + 0.35, -0.35, Math.PI * 0.72, Math.PI * 0.28];
      efimero(900, p => { const d = centro(D); const crece = Math.min(1, p * 4); const alfa = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1; brillo(d.x, d.y, 56 * crece, llamas[2], 0.6 * alfa); for (const a of brazos) for (let k = 1; k <= 5; k++) { const dist = k * 9 * crece; llama(d.x + Math.cos(a) * dist, d.y + Math.sin(a) * dist * 0.9, 6 - k * 0.6, a, alfa, llamas); } });
      destellar('#ff9a40', 260, 0.3);
    } else if (modo === 'cometa') { // lanza un orbe al cielo y caen meteoros
      fondo(2000, 'dragon');
      const o = boca(A);
      await efimero(420, p => { const y = lerp(o.y, -20, p); brillo(o.x, y, 20, '#ff9a2e', 0.7); bola(o.x, y, 8, ['#ffffff', '#ffd45a', '#ff7a2e', '#5a140a']); });
      soltar(A);
      const d0 = centro(D);
      const meteoros = [0, 1, 2, 3, 4].map(i => ({ x: d0.x + entre(-40, 40), y: d0.y + entre(-14, 14), retraso: 120 + i * 130 }));
      const caidas = meteoros.map(m => efimero(380, p => { const x = lerp(m.x - 70, m.x, p); const y = lerp(-30, m.y, p); brillo(x, y, 22, '#ff9a2e', 0.6); for (let k = 1; k <= 4; k++) llama(x - k * 7, y - k * 5.2, 9 - k * 1.5, Math.atan2(5.2, 7), 0.9); bola(x, y, 9, ['#ffffff', '#ffd45a', '#ff7a2e', '#5a140a']); }, { retraso: m.retraso }).then(() => { impacto(m.x, m.y, paleta, 1.1); efimero(420, q => { aro(m.x, m.y, 6 + q * 30, 3 * (1 - q) + 0.5, '#ffd45a', 1 - q); brillo(m.x, m.y, 30 * (1 - q), '#ff7a2e', 0.8); }); temblar(5, 160); polvo(m.x, SUELO, 8); }));
      await caidas[0];
    } else if (modo === 'ventisca') {
      fondo(1900, 'hielo');
      soltar(A);
      const dir = DIRECCION[A.lado];
      emitir(1200, () => {
        for (let i = 0; i < 9; i++) particula({ x: dir > 0 ? -10 : ANCHO + 10, y: entre(0, ALTO), vx: dir * entre(260, 440), vy: entre(-20, 50), vida: 1400, colores: ['#ffffff', '#d8f8ff'], tam: entre(2, 4), forma: Math.random() < 0.35 ? 'estrella' : 'cuadro' });
        if (Math.random() < 0.5) particula({ x: dir > 0 ? -20 : ANCHO + 20, y: entre(20, ALTO - 20), vx: dir * entre(300, 420), vy: entre(-10, 10), vida: 1300, colores: ['#ffffff', '#c8ecff'], tam: 7, tamFin: 14, forma: 'humo', alfa: 0.35 });
      });
      await pausa(520);
      const d = centro(D);
      efimero(900, p => { const c = centro(D); brillo(c.x, c.y, Math.max(anchoDe(D), altoDe(D)), '#e8fbff', 0.6 * (1 - p)); });
      const puntas = Array.from({ length: 11 }, (_, i) => ({ a: (i / 11) * Math.PI * 2, largo: entre(20, 36) }));
      efimero(800, p => cristales(d.x, d.y, puntas, Math.min(1, p * 4), p > 0.7 ? 1 - (p - 0.7) / 0.3 : 0.95, PALETAS_ATAQUE.ice));
    } else if (modo === 'monedas') { // una lluvia de monedas doradas
      fondo(1600, 'hiper');
      soltar(A);
      const d0 = centro(D);
      const monedas = Array.from({ length: 28 }, (_, i) => ({ x: d0.x + entre(-40, 40), y: d0.y + entre(-18, 18), retraso: i * 32, giro: Math.random() * 6 }));
      const caidas = monedas.map(m => efimero(380, (p, t) => { const y = lerp(-20, m.y, p * p); brillo(m.x, y, 8, '#ffd23a', 0.5); moneda(m.x, y, 6, t / 60 + m.giro); }, { retraso: m.retraso }).then(() => { particula({ x: m.x, y: m.y, vx: entre(-80, 80), vy: -entre(60, 140), g: 500, vida: 500, colores: ['#fff3b0', '#ffd23a'], tam: 2, forma: 'estrella', brillo: 2 }); }));
      await caidas[4];
    } else { // vendaval: un tornado sobre el rival (colores: [claro, medio])
      const [claro, medio] = colores || ['#ffffff', '#a9c2ee'];
      fondo(1700, 'aire');
      soltar(A);
      efimero(1100, (p, t) => { const d = centro(D); const alfa = Math.min(1, p * 4) * (p > 0.8 ? (1 - p) / 0.2 : 1); for (let k = 0; k < 10; k++) { const y = SUELO - k * 11; const r = 7 + k * 4; const x = d.x + Math.sin(t / 90 + k) * 5; aro(x, y, r, 4.2, '#1d2a3a', 0.35 * alfa, 0.32); aro(x, y, r, 3, k % 2 ? claro : medio, 0.8 * alfa, 0.32); } if (Math.random() < 0.6) particula({ x: d.x + entre(-20, 20), y: SUELO - entre(0, 90), vx: entre(-90, 90), vy: -entre(20, 60), vida: 500, colores: [claro, medio], tam: 2, forma: 'cuadro' }); });
      D.quieto = false;
      animar(D, { oy: -12 }, 400, 'frena').then(() => animar(D, { oy: 0 }, 200, 'acelera')).then(() => { D.quieto = true; });
      await pausa(380);
    }
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1.3);
    temblar(5, 300);
  }

  /** Fragmento de hielo con brillo (Canto Helado, Carámbano). */
  function cristalHielo(x, y, tam, giro) {
    const T = Math.max(1, tam * S);
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(giro);
    const rombo = r => { ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 1.6); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); };
    ctx.fillStyle = '#1d4a66'; rombo(T * 1.25); ctx.fill();
    ctx.fillStyle = '#8fe3ef'; rombo(T); ctx.fill();
    ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.moveTo(0, -T * 1.5); ctx.lineTo(T * 0.6, 0); ctx.lineTo(0, -T * 0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /** Hueso que gira (Hueso Palo, Huesomerang, Ataque Óseo). */
  function hueso(x, y, tam, giro, color = '#f2ead6') {
    const T = Math.max(1, tam * S);
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(giro);
    for (const [c, k] of [['#3a2e1e', 1.25], [color, 1]]) {
      ctx.fillStyle = c;
      ctx.fillRect(-T * 1.6 * k, -T * 0.32 * k, T * 3.2 * k, T * 0.64 * k);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * T * 1.6, sy * T * 0.38, T * 0.42 * k, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  /** Estrella de cinco puntas (Meteoros). */
  function estrellaPixel(x, y, r, giro, color = '#ffe94a') {
    const R = Math.max(2, r * S);
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(giro);
    const forma = k => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = (i % 2 ? R * 0.45 : R) * k; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
    ctx.fillStyle = '#5a3a08'; forma(1.25); ctx.fill();
    ctx.fillStyle = color; forma(1); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-R * 0.2, -R * 0.45, R * 0.25, R * 0.25);
    ctx.restore();
  }

  /**
   * Varios proyectiles pequeños seguidos (Ascuas, Hoja Afilada, Pin Misil, Burbuja, Meteoros, Día de Pago…).
   * forma: 'llama' | 'hoja' | 'shuriken' | 'cristal' | 'roca' | 'aguja' | 'semilla' | 'escama' | 'hueso' |
   * 'moneda' | 'estrella' | 'burbuja' | 'lodo' | 'bola' (del color del tipo).
   */
  async function proyectiles(A, D, paleta, { forma = 'llama', cuantos = 5 } = {}) {
    await anticipar(A, 170);
    soltar(A);
    const BRILLO = { llama: '#ff9a2e', hoja: '#9be04a', shuriken: '#7cc8ff', cristal: '#c8f4ff', aguja: paleta[0], semilla: '#9be04a', escama: '#8a96ff', moneda: '#ffd23a', estrella: '#ffe94a', burbuja: '#c8ecff' };
    /** Un proyectil en (x, y), de tamaño `k` (1 = normal). */
    const dibujar = (x, y, angulo, t, i, k = 1) => {
      switch (forma) {
        case 'llama': llama(x, y, 5.5 * k, angulo); break;
        case 'hoja': hoja(x, y, 5.5 * k, t / 40 + i, '#7fd06a'); break;
        case 'shuriken': ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(t / 30); ctx.translate(-X(x), -Y(y)); chispa4(x, y, 9 * k, '#1e5f9e'); chispa4(x, y, 6.5 * k, '#7cc8ff'); chispa4(x, y, 3 * k, '#ffffff'); ctx.restore(); break;
        case 'cristal': cristalHielo(x, y, 5 * k, angulo + Math.PI / 2); break;
        case 'roca': rocaPixel(x, y, 7 * k, t / 80 + i); break;
        case 'aguja': trazo([[x - Math.cos(angulo) * 16 * k, y - Math.sin(angulo) * 16 * k], [x, y]], 3.4 * k, '#3a2a10'); trazo([[x - Math.cos(angulo) * 15 * k, y - Math.sin(angulo) * 15 * k], [x, y]], 2 * k, '#f4ffd0'); break;
        case 'semilla': bola(x, y, 5 * k, ['#ffffff', '#cff59f', '#5fbf5a', '#10300f']); break;
        case 'escama': gemaPixel(x, y, 7 * k, '#8a96ff', angulo + Math.PI / 2); break;
        case 'hueso': hueso(x, y, 5.5 * k, t / 40 + i); break;
        case 'moneda': moneda(x, y, 5.5 * k, t / 50 + i); break;
        case 'estrella': estrellaPixel(x, y, 8 * k, t / 90 + i); break;
        case 'burbuja': bola(x, y, 6.5 * k, ['#ffffff', '#c8ecff', '#7cc8ff', '#1e5f9e'], 0.85); break;
        case 'lodo': bola(x, y, 6 * k, ['#f0d7a8', '#c4945a', '#7a5528', '#2a1a0c']); break;
        default: bola(x, y, 6 * k, [paleta[1], paleta[0], paleta[2]]);
      }
    };
    const disparos = Array.from({ length: cuantos }, (_, i) => efimero(forma === 'burbuja' ? 480 : 340, (p, t) => {
      const o = boca(A); const d = centro(D);
      const lugar = q => [lerp(o.x, d.x, q), lerp(o.y, d.y, q) + (forma === 'burbuja' ? Math.sin(q * 12 + i) * 7 : Math.sin(q * Math.PI) * (i % 2 ? 12 : -12))];
      const angulo = Math.atan2(d.y - o.y, d.x - o.x);
      const [x, y] = lugar(p);
      brillo(x, y, 12, BRILLO[forma] || paleta[1], 0.55);
      for (let k = 1; k <= 3; k++) { const [ex, ey] = lugar(Math.max(0, p - k * 0.06)); brillo(ex, ey, 10 - k * 2, BRILLO[forma] || paleta[1], 0.4 - k * 0.1); } // estela de luz
      dibujar(x, y, angulo, t, i);
      if (forma === 'estrella' && Math.random() < 0.6) particula({ x, y, vida: 300, colores: ['#ffffff', '#ffe94a'], tam: 1.8, forma: 'estrella', brillo: 3 });
    }, { retraso: i * 85 }).then(() => {
      const d = centro(D); const x = d.x + entre(-9, 9); const y = d.y + entre(-11, 11);
      impacto(x, y, paleta, 0.7);
      for (let k = 0; k < 5; k++) particula({ x, y, vx: entre(-90, 90), vy: entre(-90, 60), arrastre: 3, vida: 320, colores: ['#ffffff', BRILLO[forma] || paleta[1]], tam: 2, forma: 'chispa' });
      temblar(2, 80);
    }));
    await disparos[0];
  }

  /** Absorber: esferas de energía salen del rival y vuelven al atacante, que brilla (Gigadrenado, Chupavidas…). */
  async function absorber(A, D, paleta, { colores = ['#ffffff', '#cff59f', '#5fbf5a', '#10300f'], fondoTipo = 'planta' } = {}) {
    fondo(1700, fondoTipo);
    await anticipar(A, 160);
    soltar(A);
    const d0 = centro(D);
    efimero(500, p => aro(d0.x, d0.y, 30 * (1 - p) + 4, 2, colores[1], p));
    impacto(d0.x, d0.y, paleta, 1);
    const vuelos = [];
    for (let i = 0; i < 8; i++) vuelos.push(efimero(620, p => { const d = centro(D); const a = centro(A); const x = lerp(d.x, a.x, p); const y = lerp(d.y, a.y, p) - Math.sin(Math.PI * p) * (18 + i * 4) * (i % 2 ? 1 : -1); brillo(x, y, 7, colores[1], 0.6); bola(x, y, 3, colores); }, { retraso: 120 + i * 60 }));
    vuelos.at(-1).then(() => efimero(500, p => { const c = centro(A); brillo(c.x, c.y, anchoDe(A), colores[1], 0.6 * (1 - p)); aro(c.x, c.y, anchoDe(A) * (0.4 + p * 0.5), 2, colores[1], 1 - p); }));
  }

  /** Brillo Mágico: un destello de luz rosa y blanca que sale de él en todas direcciones. */
  async function brilloMagico(A, D, paleta) {
    fondo(1500, 'luz');
    const c = centro(A);
    await efimero(320, p => brillo(c.x, c.y, 10 + p * 30, '#ffe3f2', 0.8));
    soltar(A);
    destellar('#ffe3f2', 300, 0.55);
    efimero(700, p => { for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const r0 = 10 + p * 40; trazo([[c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0], [c.x + Math.cos(a) * (r0 + 30 + p * 140), c.y + Math.sin(a) * (r0 + 30 + p * 140)]], 2.4 * (1 - p) + 0.5, i % 2 ? '#ffffff' : '#f5a0cf', { alfa: 1 - p }); } });
    await pausa(200);
    const d = centro(D);
    for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2; particula({ x: d.x, y: d.y, vx: Math.cos(a) * entre(40, 130), vy: Math.sin(a) * entre(40, 130), arrastre: 2.5, vida: 650, colores: ['#ffffff', '#ffe3f2', '#f5a0cf'], tam: 2.5, forma: 'estrella', brillo: 3 }); }
    impacto(d.x, d.y, paleta, 1.2);
  }

  /** Descarga: rayos que salen del atacante en todas direcciones; el más grueso, hacia el rival. */
  async function descarga(A, D, paleta) {
    fondo(1500, 'tormenta');
    A.quieto = false;
    animar(A, { sy: 0.9, sx: 1.07 }, 200, 'frena');
    await pausa(300);
    soltar(A);
    efimero(560, (p, t) => {
      if (Math.floor(t / 60) % 2) return;
      const c = centro(A);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t / 300; rayoGrueso(zigzag([c.x, c.y], [c.x + Math.cos(a) * 90, c.y + Math.sin(a) * 70], 14, 4), 2.2, 1 - p * 0.6); }
      const d = centro(D); rayoGrueso(zigzag([c.x, c.y], [d.x, d.y], 18, 5), 3.6, 1 - p * 0.5);
    });
    destellar('#fff8c8', 160, 0.5);
    temblar(4, 400);
    await pausa(100);
    const d = centro(D);
    impacto(d.x, d.y, paleta, 1.3);
  }

  /** Gas que rueda hasta el rival y lo envuelve (Polución, Niebla Clara, Vapor Mágico). colores: [claro, medio, oscuro]. */
  async function humo(A, D, paleta, { colores = ['#e9bdff', '#a65fc7', '#3a1450'], fondoTipo = 'veneno' } = {}) {
    fondo(1500, fondoTipo);
    await anticipar(A, 180);
    soltar(A);
    const dir = DIRECCION[A.lado];
    await emitir(520, p => { const o = boca(A); for (let i = 0; i < 2; i++) particula({ x: o.x + dir * 4, y: o.y + entre(-4, 4), vx: dir * entre(160, 240), vy: entre(-30, 30), arrastre: 1.2, vida: 900, colores, tam: 4, tamFin: 12, forma: 'humo', alfa: 0.7 }); void p; });
    const d = centro(D);
    emitir(700, () => particula({ x: d.x + entre(-24, 24), y: d.y + entre(-20, 20), vx: entre(-20, 20), vy: -entre(5, 25), vida: 800, colores, tam: 5, tamFin: 13, forma: 'humo', alfa: 0.6 }));
    impacto(d.x, d.y, paleta, 1);
  }

  /** Pulso Dragón: un dragón de energía con cuerpo de anillos y ojos que brillan cruza el campo y muerde al rival. */
  async function pulsoDragon(A, D, paleta) {
    fondo(1900, 'dragon');
    cargar(boca(A), ['#ffffff', '#cdd3ff', '#6e7cf0'], 380, 34);
    efimero(380, p => { const b = boca(A); brillo(b.x, b.y, 10 + p * 18, '#8a96ff', 0.8); });
    await anticipar(A, 380);
    soltar(A);
    const dir = DIRECCION[A.lado];
    await efimero(640, (p, t) => {
      const o = boca(A); const d = centro(D);
      const cuerpo = [];
      for (let i = 0; i <= 30; i++) { const k = (i / 30) * p; cuerpo.push([lerp(o.x, d.x - dir * 10, k), lerp(o.y, d.y, k) + Math.sin(k * 13 - t / 55) * 12 * Math.sin(k * Math.PI)]); }
      trazo(cuerpo, 16, '#141850');
      trazo(cuerpo, 11.5, '#5a68e0');
      trazo(cuerpo, 5, '#a8b2ff');
      trazo(cuerpo, 1.6, '#ffffff');
      for (let i = 3; i < cuerpo.length - 2; i += 4) aro(cuerpo[i][0], cuerpo[i][1], 7, 1.2, '#cdd3ff', 0.7); // anillos del cuerpo
      if (Math.random() < 0.8) { const [x, y] = cuerpo[Math.floor(Math.random() * cuerpo.length)]; particula({ x, y, vx: entre(-30, 30), vy: entre(-30, 30), vida: 400, colores: ['#ffffff', '#8a96ff'], tam: 2, forma: 'estrella', brillo: 3 }); }
      const [hx, hy] = cuerpo[cuerpo.length - 1];
      brillo(hx, hy, 36, '#8a96ff', 0.8);
      cabezaDragon(hx, hy, 62, dir, Math.min(1, p * 1.6));
    });
    const d = centro(D);
    efimero(420, p => cabezaDragon(d.x - dir * 14, d.y, 62 + p * 10, dir, Math.max(0, 1 - p * 3), 1 - p * 0.8)); // cierra las fauces
    await pausa(120);
    for (let i = 0; i < 3; i++) efimero(560, p => aro(d.x, d.y, 10 + p * 62, 4 * (1 - p) + 0.6, i % 2 ? '#ffffff' : '#8a96ff', 1 - p), { retraso: i * 80 });
    efimero(520, p => { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; llama(d.x + Math.cos(a) * (8 + p * 40), d.y + Math.sin(a) * (8 + p * 32), 4.5 * (1 - p) + 2, a, 1 - p, LLAMA_DRAGON); } });
    destellar('#8a96ff', 220, 0.35);
    temblar(5, 320);
    golpeCamara(d.x, 0.7);
    impacto(d.x, d.y, paleta, 1.4);
  }

  // --- Qué animación usa cada movimiento ------------------------------------------------------------
  const FAMILIAS = {
    embestida: embestidaAura, rafaga, punos: punetazos, fauces, garras: garrazo, filo, tajoLejano, tijeras,
    cola: colaGiro, latigos, terremoto, avalancha, rocaAfilada, taladro, emboscada, nube: nubePelea,
    haz, esfera, ola: olaGigante, cielo: desdeElCielo, proyectiles, absorber, brilloMagico, descarga, humo,
    pulsoDragon, lanzallamas, hidrobomba, rayo, hojaMagica, rayoHielo, bombaLodo, tierraViva, tajoAereo,
    psiquico, zumbido, joyaDeLuz, bolaSombra, pulsoUmbrio, fuerzaLunar, esferaAural,
  };
  // Colores que se repiten: haces [borde, cuerpo, claro, núcleo], esferas [claro, medio, oscuro, borde]…
  const HAZ = {
    hiper: { colores: ['#5a2a08', '#ff9a2e', '#ffe08a', '#ffffff'], grosor: 18, carga: 'convergente', extras: 'espiral', fondoTipo: 'hiper', explosion: 1.7, recarga: true },
    metal: { colores: ['#1e2a33', '#9fb4c2', '#e6f2ff', '#ffffff'], grosor: 13, extras: 'estrellas', fondoTipo: 'acero', explosion: 1.3 },
    aurora: { colores: ['#1d2a5a', '#a8f0ff', '#ffffff', '#ffffff'], grosor: 11, extras: 'arcoiris', fondoTipo: 'hielo' },
    luz: { colores: ['#5a4a10', '#fff3a0', '#ffffff', '#ffffff'], grosor: 13, carga: 'convergente', extras: 'estrellas', fondoTipo: 'luz', explosion: 1.4 },
    hada: { colores: ['#5a1a40', '#f5a0cf', '#ffe3f2', '#ffffff'], grosor: 16, carga: 'convergente', extras: 'estrellas', fondoTipo: 'luz', explosion: 1.6 },
    rayo: { colores: ['#3a2600', '#ffd83a', '#fff8c8', '#ffffff'], grosor: 11, extras: 'zigzag', fondoTipo: 'tormenta' },
    psi: { colores: ['#5a1030', '#f06a9c', '#ffcadf', '#ffffff'], grosor: 10, extras: 'ondas', fondoTipo: 'psiquico' },
    dragon: { colores: ['#100a3a', '#6e7cf0', '#cdd3ff', '#ffffff'], grosor: 16, carga: 'convergente', extras: 'espiral', fondoTipo: 'dragon', explosion: 1.6 },
    sombra: { colores: ['#120a24', '#7a4fc0', '#d8c2ff', '#ffffff'], grosor: 14, carga: 'convergente', extras: 'anillos', fondoTipo: 'noche', explosion: 1.5 },
  };
  const ESFERA = {
    planta: { colores: ['#f4ffc0', '#9be04a', '#3a7a20', '#10300f'], radio: 11, estilo: 'hojas', fondoTipo: 'planta' },
    fuego: { colores: ['#fff6d0', '#ffd45a', '#ff7a2e', '#5a140a'], radio: 11, estilo: 'fuego', fondoTipo: 'fuego' },
    lucha: { colores: ['#ffffff', '#ffd45a', '#e9684f', '#4a140a'], radio: 13, estilo: 'fuego', fondoTipo: 'aura' },
    rayo: { colores: ['#ffffff', '#fff3a0', '#ffd83a', '#3a2600'], radio: 11, estilo: 'rayo', fondoTipo: 'tormenta' },
    agua: { colores: ['#ffffff', '#c8ecff', '#3fa0e6', '#0e3a66'], radio: 10, estilo: 'agua', fondoTipo: 'agua' },
    tierra: { colores: ['#f0d7a8', '#c4945a', '#7a5528', '#2a1a0c'], radio: 10, estilo: 'tierra', fondoTipo: 'tierra' },
    psi: { colores: ['#ffffff', '#ffcadf', '#f06a9c', '#5a1030'], radio: 11, estilo: 'psi', fondoTipo: 'psiquico' },
    normal: { colores: ['#ffffff', '#fff3c4', '#e6d3a8', '#5a4a2a'], radio: 10, estilo: 'normal', fondoTipo: null },
  };
  const OLA_FUEGO = { colores: ['#5a140a', '#d8401a', '#ff8a26', '#ffd45a'], fondoTipo: 'fuego' };
  const VIENTO = (claro, medio) => ({ modo: 'vendaval', colores: [claro, medio] });
  const SONIDO = (colores, fondoTipo) => ({ colores, fondoTipo });
  /** [familia, opciones, 'claves de PokéAPI separadas por espacios']: el anime como referencia. */
  const ANIMACIONES = {};
  for (const [familia, opciones, claves] of [
    // Embestidas envueltas en su elemento
    ['embestida', { aura: 'rayo', fuerte: true }, 'volt-tackle wild-charge supercell-slam bolt-strike aura-wheel'],
    ['embestida', { aura: 'rayo' }, 'spark zing-zap electro-drift nuzzle'],
    ['embestida', { aura: 'fuego', fuerte: true }, 'flare-blitz v-create sacred-fire raging-fury'],
    ['embestida', { aura: 'fuego' }, 'flame-charge flame-wheel temper-flare beak-blast'],
    ['embestida', { aura: 'llama-azul', fuerte: true }, 'brave-bird sky-attack dragon-ascent'],
    ['embestida', { aura: 'dragon', fuerte: true }, 'dragon-rush glaive-rush order-up'],
    ['embestida', { aura: 'dragon', golpes: 3 }, 'outrage'],
    ['embestida', { aura: 'giga', fuerte: true }, 'giga-impact meteor-assault'],
    ['embestida', { aura: 'agua', fuerte: true }, 'wave-crash waterfall'],
    ['embestida', { aura: 'agua', golpes: 3 }, 'triple-dive'],
    ['embestida', { aura: 'metal' }, 'iron-head sunsteel-strike'],
    ['embestida', { aura: 'metal', giro: true }, 'spin-out gear-grind'],
    ['embestida', { aura: 'psi' }, 'zen-headbutt psyshield-bash'],
    ['embestida', { aura: 'hojas', fuerte: true }, 'wood-hammer'],
    ['embestida', { aura: 'hielo', giro: true }, 'ice-spinner ice-ball'],
    ['embestida', { aura: 'hielo', fuerte: true }, 'freeze-shock'],
    ['embestida', { aura: 'bicho' }, 'lunge steamroller skitter-smack'],
    ['embestida', { aura: 'veneno', giro: true }, 'mortal-spin'],
    ['embestida', { aura: 'tierra', fuerte: true }, 'headlong-rush high-horsepower'],
    ['embestida', { aura: 'sombra' }, 'lick astonish last-respects'],
    ['embestida', { aura: 'siniestro' }, 'foul-play payback assurance'],
    ['embestida', { aura: 'lucha', fuerte: true }, 'collision-course body-press submission'],
    ['embestida', { fuerte: true }, 'double-edge head-charge skull-bash head-smash body-slam take-down raging-bull'],
    ['embestida', {}, 'tackle headbutt slam strength rock-climb chip-away retaliate facade secret-power smelling-salts rage'],
    ['embestida', { golpes: 3 }, 'thrash'],
    ['embestida', { giro: true }, 'rapid-spin rollout'],
    // Rápidos (con prioridad)
    ['rafaga', { aura: 'normal' }, 'quick-attack extreme-speed feint covet thief pursuit'],
    ['rafaga', { aura: 'agua' }, 'aqua-jet aqua-step flip-turn'],
    ['rafaga', { aura: 'roca' }, 'accelerock'],
    ['rafaga', { aura: 'sombra' }, 'shadow-sneak'],
    ['rafaga', { aura: 'siniestro' }, 'sucker-punch'],
    ['rafaga', { aura: 'bicho' }, 'u-turn pounce'],
    ['rafaga', { aura: 'hojas' }, 'grassy-glide trailblaze'],
    ['rafaga', { aura: 'llama-azul' }, 'acrobatics aerial-ace'],
    ['rafaga', { aura: 'lucha' }, 'mach-punch vacuum-wave'],
    ['rafaga', { aura: 'metal' }, 'bullet-punch'],
    // Puñetazos y patadas
    ['punos', { golpes: 7 }, 'close-combat arm-thrust comet-punch barrage double-slap population-bomb'],
    ['punos', { golpes: 3, aura: 'agua' }, 'surging-strikes'],
    ['punos', { golpes: 2, aura: 'metal' }, 'double-iron-bash'],
    ['punos', { golpes: 2 }, 'double-hit'],
    ['punos', { golpes: 3, patada: true }, 'double-kick triple-kick'],
    ['punos', { golpes: 3, patada: true, aura: 'hielo' }, 'triple-axel'],
    ['punos', { aura: 'fuego' }, 'fire-punch'],
    ['punos', { aura: 'hielo' }, 'ice-punch ice-hammer'],
    ['punos', { aura: 'rayo' }, 'thunder-punch plasma-fists'],
    ['punos', { aura: 'sombra' }, 'shadow-punch rage-fist'],
    ['punos', { aura: 'siniestro' }, 'wicked-blow throat-chop knock-off lash-out power-trip'],
    ['punos', { aura: 'metal' }, 'meteor-mash gigaton-hammer'],
    ['punos', { aura: 'agua' }, 'jet-punch crabhammer'],
    ['punos', { aura: 'hada' }, 'spirit-break'],
    ['punos', { aura: 'psi' }, 'heart-stamp'],
    ['punos', { aura: 'hojas' }, 'drain-punch ivy-cudgel'],
    ['punos', {}, 'mega-punch dizzy-punch power-up-punch dynamic-punch hammer-arm sky-uppercut brick-break karate-chop rock-smash force-palm revenge wake-up-slap superpower pound vital-throw storm-throw circle-throw'],
    ['punos', { patada: true }, 'mega-kick jump-kick high-jump-kick rolling-kick low-sweep axe-kick stomp'],
    ['punos', { patada: true, aura: 'fuego' }, 'blaze-kick'],
    ['punos', { patada: true, aura: 'rayo' }, 'thunderous-kick'],
    ['punos', { patada: true, aura: 'hojas' }, 'trop-kick'],
    // Mordiscos
    ['fauces', { estilo: 'siniestro', mordiscos: 2 }, 'crunch'],
    ['fauces', { estilo: 'siniestro' }, 'bite jaw-lock'],
    ['fauces', { estilo: 'fuego' }, 'fire-fang'],
    ['fauces', { estilo: 'hielo' }, 'ice-fang'],
    ['fauces', { estilo: 'rayo' }, 'thunder-fang bolt-beak'],
    ['fauces', { estilo: 'veneno' }, 'poison-fang'],
    ['fauces', { estilo: 'psi' }, 'psychic-fangs'],
    ['fauces', { estilo: 'agua' }, 'fishious-rend clamp'],
    ['fauces', { estilo: 'normal' }, 'hyper-fang vice-grip'],
    ['fauces', { estilo: 'bicho' }, 'bug-bite'],
    ['fauces', { estilo: 'hojas' }, 'snap-trap'],
    // Garras, filos y tijeras
    ['garras', { estilo: 'sombra' }, 'shadow-claw'],
    ['garras', { estilo: 'dragon' }, 'dragon-claw breaking-swipe'],
    ['garras', { estilo: 'metal' }, 'metal-claw'],
    ['garras', { estilo: 'veneno' }, 'dire-claw'],
    ['garras', { estilo: 'normal' }, 'scratch fury-swipes slash crush-claw false-swipe'],
    ['filo', { estilo: 'hojas' }, 'leaf-blade solar-blade'],
    ['filo', { estilo: 'psi' }, 'psycho-cut psyblade'],
    ['filo', { estilo: 'siniestro' }, 'night-slash kowtow-cleave false-surrender ceaseless-edge'],
    ['filo', { estilo: 'lucha' }, 'sacred-sword'],
    ['filo', { estilo: 'agua' }, 'aqua-cutter razor-shell'],
    ['filo', { estilo: 'roca' }, 'stone-axe mighty-cleave'],
    ['filo', { estilo: 'fuego' }, 'bitter-blade'],
    ['filo', { estilo: 'normal' }, 'cut'],
    ['tajoLejano', { estilo: 'lucha' }, 'secret-sword'],
    ['tajoLejano', { estilo: 'dragon' }, 'spacial-rend'],
    ['tajoLejano', { estilo: 'metal' }, 'tachyon-cutter'],
    ['tijeras', { estilo: 'bicho' }, 'x-scissor fury-cutter attack-order'],
    ['tijeras', { estilo: 'veneno' }, 'cross-poison'],
    ['tijeras', { estilo: 'lucha' }, 'cross-chop'],
    ['tijeras', { estilo: 'dragon' }, 'dual-chop'],
    ['tijeras', { estilo: 'llama-azul' }, 'wing-attack dual-wingbeat'],
    ['tijeras', { estilo: 'metal' }, 'steel-wing'],
    // Colas y látigos
    ['cola', { estilo: 'agua' }, 'aqua-tail liquidation'],
    ['cola', { estilo: 'metal' }, 'iron-tail'],
    ['cola', { estilo: 'dragon' }, 'dragon-tail dragon-hammer'],
    ['cola', { estilo: 'veneno' }, 'poison-tail'],
    ['cola', { estilo: 'siniestro' }, 'brutal-swing darkest-lariat'],
    ['cola', { estilo: 'normal' }, 'tail-slap'],
    ['latigos', {}, 'vine-whip power-whip bind wrap constrict drum-beating frenzy-plant'],
    ['latigos', { colores: ['#5a140a', '#ff7a2e', '#ffd45a'], hojas: false }, 'fire-lash'],
    // Tierra y roca
    ['terremoto', {}, 'earthquake bulldoze stomping-tantrum thousand-waves lands-wrath'],
    ['terremoto', { pinchos: true }, 'precipice-blades thousand-arrows'],
    ['avalancha', {}, 'rock-slide rock-tomb'],
    ['avalancha', { grande: true }, 'rock-wrecker'],
    ['avalancha', { colores: ['#1d4a66', '#8fe3ef', '#ffffff'] }, 'mountain-gale icicle-crash avalanche'],
    ['avalancha', { colores: ['#3a0a0a', '#d83a3a', '#ffb0a0'], grande: true }, 'grav-apple'],
    ['rocaAfilada', {}, 'stone-edge rock-throw smack-down'],
    ['taladro', { estilo: 'normal' }, 'horn-attack fury-attack hyper-drill'],
    ['taladro', { estilo: 'bicho' }, 'megahorn'],
    ['taladro', { estilo: 'llama-azul' }, 'peck drill-peck pluck'],
    ['taladro', { estilo: 'tierra' }, 'drill-run'],
    ['taladro', { estilo: 'veneno' }, 'poison-jab'],
    ['taladro', { estilo: 'metal' }, 'smart-strike anchor-shot'],
    ['taladro', { estilo: 'hojas' }, 'horn-leech branch-poke needle-arm'],
    ['emboscada', { modo: 'tierra' }, 'dig'],
    ['emboscada', { modo: 'agua' }, 'dive'],
    ['emboscada', { modo: 'aire' }, 'fly bounce flying-press'],
    ['emboscada', { modo: 'sombra' }, 'phantom-force shadow-force spectral-thief feint-attack'],
    ['nube', {}, 'play-rough'],
    // Proyectiles
    ['proyectiles', { forma: 'aguja', cuantos: 6 }, 'pin-missile twineedle fell-stinger poison-sting barb-barrage spike-cannon triple-arrows spirit-shackle'],
    ['proyectiles', { forma: 'semilla', cuantos: 6 }, 'bullet-seed'],
    ['proyectiles', { forma: 'cristal', cuantos: 5 }, 'icicle-spear ice-shard glacial-lance'],
    ['proyectiles', { forma: 'roca', cuantos: 4 }, 'rock-blast ancient-power salt-cure'],
    ['proyectiles', { forma: 'escama', cuantos: 5 }, 'scale-shot dragon-darts'],
    ['proyectiles', { forma: 'hueso', cuantos: 3 }, 'bone-club bonemerang bone-rush shadow-bone'],
    ['proyectiles', { forma: 'moneda', cuantos: 6 }, 'pay-day'],
    ['proyectiles', { forma: 'bola', cuantos: 4 }, 'egg-bomb magnet-bomb poltergeist'],
    ['proyectiles', { forma: 'llama', cuantos: 5 }, 'ember flame-burst mystical-fire fiery-dance infernal-parade'],
    ['proyectiles', { forma: 'hoja', cuantos: 6 }, 'razor-leaf leafage'],
    ['proyectiles', { forma: 'burbuja', cuantos: 6 }, 'bubble bubble-beam'],
    ['proyectiles', { forma: 'shuriken', cuantos: 4 }, 'water-shuriken'],
    ['proyectiles', { forma: 'estrella', cuantos: 6 }, 'swift'],
    ['proyectiles', { forma: 'lodo', cuantos: 5 }, 'mud-shot mud-slap'],
    // Esferas
    ['esfera', ESFERA.planta, 'seed-bomb energy-ball seed-flare apple-acid syrup-bomb'],
    ['esfera', ESFERA.fuego, 'pyro-ball searing-shot'],
    ['esfera', ESFERA.lucha, 'focus-blast'],
    ['esfera', ESFERA.rayo, 'zap-cannon'],
    ['esfera', ESFERA.agua, 'water-pulse octazooka'],
    ['esfera', ESFERA.tierra, 'mud-bomb'],
    ['esfera', ESFERA.psi, 'mist-ball'],
    ['esfera', ESFERA.normal, 'weather-ball hidden-power'],
    // Haces
    ['haz', HAZ.hiper, 'hyper-beam'],
    ['haz', { ...HAZ.hiper, colores: ['#2a0a3a', '#ffffff', '#ffd8ff', '#ffffff'], extras: 'arcoiris' }, 'prismatic-laser'],
    ['haz', { ...HAZ.hiper, colores: ['#3a0610', '#d8203a', '#ff8a9a', '#ffffff'], fondoTipo: 'oscuro' }, 'eternabeam dynamax-cannon'],
    ['haz', { colores: ['#3a5a10', '#9be04a', '#f4ffc0', '#ffffff'], grosor: 16, carga: 'sol', extras: 'anillos', fondoTipo: 'luz', explosion: 1.5 }, 'solar-beam chloroblast'],
    ['haz', { colores: ['#1d4a66', '#8fe3ef', '#ffffff', '#ffffff'], grosor: 10, extras: 'cristales', fondoTipo: 'hielo', congela: true }, 'freeze-dry freezing-glare glaciate'],
    ['haz', HAZ.metal, 'flash-cannon mirror-shot'],
    ['haz', { ...HAZ.metal, grosor: 18, carga: 'convergente', explosion: 1.6 }, 'steel-beam'],
    ['haz', HAZ.aurora, 'aurora-beam signal-beam'],
    ['haz', HAZ.luz, 'photon-geyser luster-purge lumina-crash'],
    ['haz', HAZ.hada, 'fleur-cannon light-of-ruin'],
    ['haz', HAZ.rayo, 'charge-beam electro-shot'],
    ['haz', HAZ.psi, 'psybeam psystrike twin-beam'],
    ['haz', HAZ.dragon, 'dragon-energy core-enforcer roar-of-time'],
    ['haz', { ...HAZ.dragon, colores: ['#0e3a66', '#3fa0e6', '#c8ecff', '#ffffff'], fondoTipo: 'agua' }, 'origin-pulse'],
    ['haz', HAZ.sombra, 'moongeist-beam'],
    ['haz', { ...HAZ.dragon, colores: ['#5a140a', '#ff7a2e', '#ffd45a', '#ffffff'], fondoTipo: 'fuego' }, 'armor-cannon'],
    ['haz', { ...HAZ.luz, colores: ['#2a1a3a', '#c69bff', '#ffffff', '#ffffff'], fondoTipo: 'noche' }, 'meteor-beam'],
    ['haz', { colores: ['#1d2a5a', '#a9c2ee', '#ffffff', '#ffffff'], grosor: 14, carga: 'convergente', extras: 'espiral', fondoTipo: 'aire', explosion: 1.4 }, 'aeroblast'],
    ['haz', { colores: ['#2a2a2a', '#ff7a5a', '#fff3a0', '#ffffff'], grosor: 11, extras: 'arcoiris' }, 'tri-attack'],
    ['haz', { colores: ['#3a0610', '#d8203a', '#ff8a9a', '#ffffff'], grosor: 16, carga: 'convergente', fondoTipo: 'noche', explosion: 1.5 }, 'blood-moon'],
    // Fuego
    ['lanzallamas', {}, 'flamethrower fire-spin incinerate burning-jealousy inferno fire-pledge'],
    ['lanzallamas', { colores: LLAMA_DRAGON, fondoTipo: 'dragon' }, 'dragon-breath'],
    ['lanzallamas', { colores: LLAMA_AURA }, 'blue-flare'],
    ['cielo', { modo: 'llamarada' }, 'fire-blast overheat blast-burn mind-blown eruption'],
    ['ola', OLA_FUEGO, 'heat-wave lava-plume'],
    // Agua
    ['hidrobomba', {}, 'hydro-pump water-gun scald brine snipe-shot hydro-cannon steam-eruption chilling-water water-pledge'],
    ['ola', {}, 'surf water-spout hydro-steam'],
    ['ola', { colores: ['#3a240c', '#8a5c30', '#c99a62', '#f0d7a8'], fondoTipo: 'tierra' }, 'muddy-water'],
    ['ola', { colores: ['#2a0a3a', '#7a3a9a', '#a65fc7', '#e9bdff'], fondoTipo: 'veneno' }, 'sludge-wave'],
    ['ola', { colores: ['#10300f', '#3a8a30', '#9be04a', '#f4ffc0'], fondoTipo: 'planta' }, 'matcha-gotcha grass-pledge'],
    // Eléctrico
    ['cielo', { modo: 'trueno' }, 'thunder wildbolt-storm'],
    ['descarga', {}, 'discharge electroweb'],
    ['absorber', { colores: ['#ffffff', '#fff3a0', '#ffd83a', '#3a2600'], fondoTipo: 'tormenta' }, 'parabolic-charge'],
    ['rayo', {}, 'thunderbolt thunder-shock volt-switch shock-wave thunder-cage'],
    // Planta
    ['hojaMagica', {}, 'magical-leaf leaf-storm petal-dance petal-blizzard flower-trick'],
    ['absorber', {}, 'absorb mega-drain giga-drain'],
    ['absorber', { colores: ['#ffffff', '#ffb0a0', '#d83a3a', '#3a0a0a'], fondoTipo: 'bicho' }, 'leech-life'],
    ['absorber', { colores: ['#ffffff', '#ffe3f2', '#f5a0cf', '#5a1a40'], fondoTipo: 'luz' }, 'draining-kiss'],
    ['absorber', { colores: ['#ffffff', '#d8c2ff', '#7a4fc0', '#120a24'], fondoTipo: 'sombra' }, 'bitter-malice'],
    ['absorber', { colores: ['#ffffff', '#ffb0a0', '#d83a3a', '#3a0a0a'], fondoTipo: 'oscuro' }, 'oblivion-wing'],
    // Hielo
    ['rayoHielo', {}, 'ice-beam'],
    ['cielo', { modo: 'ventisca' }, 'blizzard icy-wind powder-snow frost-breath ice-burn'],
    // Veneno
    ['bombaLodo', {}, 'sludge-bomb sludge gunk-shot acid venoshock acid-spray malignant-chain shell-side-arm'],
    ['humo', {}, 'smog clear-smog'],
    ['humo', { colores: ['#ffe3f2', '#f5a0cf', '#8a3a6a'], fondoTipo: 'luz' }, 'strange-steam'],
    // Tierra
    ['tierraViva', {}, 'earth-power scorching-sands'],
    ['cielo', VIENTO('#f0d7a8', '#c4945a'), 'sand-tomb sandsear-storm'],
    // Volador y vientos
    ['tajoAereo', {}, 'air-slash air-cutter razor-wind esper-wing'],
    ['cielo', VIENTO('#ffffff', '#a9c2ee'), 'hurricane gust bleakwind-storm'],
    ['cielo', VIENTO('#cdd3ff', '#6e7cf0'), 'twister'],
    ['cielo', VIENTO('#ffe3f2', '#f5a0cf'), 'fairy-wind springtide-storm'],
    ['cielo', VIENTO('#ffffff', '#c8d0d8'), 'silver-wind'],
    ['cielo', VIENTO('#d8c2ff', '#7a4fc0'), 'ominous-wind'],
    ['cielo', VIENTO('#c8ecff', '#3fa0e6'), 'whirlpool'],
    ['cielo', VIENTO('#ffd45a', '#ff7a2e'), 'magma-storm'],
    ['cielo', VIENTO('#e4f69e', '#9cc23a'), 'infestation'],
    ['cielo', VIENTO('#cff59f', '#5fbf5a'), 'leaf-tornado'],
    ['cielo', { modo: 'cometa' }, 'draco-meteor'],
    ['cielo', { modo: 'monedas' }, 'make-it-rain'],
    // Psíquico, sonido y los demás
    ['psiquico', {}, 'psychic confusion psyshock extrasensory eerie-spell stored-power mystical-power psycho-boost hyperspace-hole'],
    ['zumbido', {}, 'bug-buzz struggle-bug'],
    ['zumbido', SONIDO(['#3a3a3a', '#e6e3d6', '#ffffff', '#ffffff'], 'hiper'), 'hyper-voice boomburst uproar chatter'],
    ['zumbido', SONIDO(['#060408', '#4a3a60', '#c04a8a', '#ffffff'], 'oscuro'), 'snarl'],
    ['zumbido', SONIDO(['#100a3a', '#6e7cf0', '#cdd3ff', '#ffffff'], 'dragon'), 'clanging-scales'],
    ['zumbido', SONIDO(['#3a2600', '#ffd83a', '#fff8c8', '#ffffff'], 'tormenta'), 'overdrive'],
    ['zumbido', SONIDO(['#0e3a66', '#3fa0e6', '#c8ecff', '#ffffff'], 'agua'), 'sparkling-aria'],
    ['zumbido', SONIDO(['#5a140a', '#ff7a2e', '#ffd45a', '#ffffff'], 'fuego'), 'torch-song'],
    ['zumbido', SONIDO(['#5a1030', '#f06a9c', '#ffcadf', '#ffffff'], 'psiquico'), 'psychic-noise'],
    ['zumbido', SONIDO(['#5a1a40', '#f5a0cf', '#ffe3f2', '#ffffff'], 'luz'), 'alluring-voice disarming-voice'],
    ['joyaDeLuz', {}, 'power-gem diamond-storm'],
    ['bolaSombra', {}, 'shadow-ball hex astral-barrage'],
    ['pulsoUmbrio', {}, 'dark-pulse night-daze fiery-wrath'],
    ['fuerzaLunar', {}, 'moonblast'],
    ['esferaAural', {}, 'aura-sphere'],
    ['brilloMagico', {}, 'dazzling-gleam'],
    ['pulsoDragon', {}, 'dragon-pulse'],
  ]) for (const clave of claves.split(' ')) ANIMACIONES[clave] = [familia, opciones];
  /** Si un movimiento no está en ANIMACIONES: la de su tipo, según sea físico o especial. */
  const POR_TIPO = {
    fisico: {
      normal: ['embestida', {}], fire: ['embestida', { aura: 'fuego' }], water: ['cola', { estilo: 'agua' }], electric: ['embestida', { aura: 'rayo' }],
      grass: ['filo', { estilo: 'hojas' }], ice: ['punos', { aura: 'hielo' }], fighting: ['punos', {}], poison: ['taladro', { estilo: 'veneno' }],
      ground: ['terremoto', {}], flying: ['embestida', { aura: 'llama-azul' }], psychic: ['embestida', { aura: 'psi' }], bug: ['tijeras', { estilo: 'bicho' }],
      rock: ['avalancha', {}], ghost: ['garras', { estilo: 'sombra' }], dragon: ['garras', { estilo: 'dragon' }], dark: ['fauces', { estilo: 'siniestro' }],
      steel: ['embestida', { aura: 'metal' }], fairy: ['nube', {}],
    },
    especial: {
      normal: ['haz', { ...HAZ.hiper, recarga: false, grosor: 12, explosion: 1.2 }], fire: ['lanzallamas', {}], water: ['hidrobomba', {}], electric: ['rayo', {}],
      grass: ['hojaMagica', {}], ice: ['rayoHielo', {}], fighting: ['esferaAural', {}], poison: ['bombaLodo', {}], ground: ['tierraViva', {}],
      flying: ['tajoAereo', {}], psychic: ['psiquico', {}], bug: ['zumbido', {}], rock: ['joyaDeLuz', {}], ghost: ['bolaSombra', {}],
      dragon: ['pulsoDragon', {}], dark: ['pulsoUmbrio', {}], steel: ['haz', HAZ.metal], fairy: ['fuerzaLunar', {}],
    },
  };
  // --- Ataques con sprites de la era GBA (sprites-ataques.js) -----------------------------------------------
  // TODOS los movimientos se dibujan así (lo pidió el usuario: los de antes «se veían muy sencillos»). Cada tipo tiene
  // su tira de 5 fotogramas de 48×48 (carga · proyectil · impacto máximo · expansión · dispersión) y cada movimiento,
  // un PATRÓN: proyectil (especial por defecto), rafaga (varios a la vez), haz (rayos y cañones), cielo (cae de
  // arriba), suelo (sale de debajo del rival), contacto (físico: embiste y golpea) o golpes (varios golpes seguidos).
  const FONDO_DE_TIPO = {
    fire: 'fuego', water: 'agua', electric: 'tormenta', grass: 'planta', ice: 'hielo', fighting: 'aura', poison: 'veneno',
    ground: 'tierra', flying: 'aire', psychic: 'psiquico', bug: 'bicho', rock: 'tierra', ghost: 'sombra', dragon: 'dragon',
    dark: 'oscuro', steel: 'acero', fairy: 'luz', normal: 'hiper',
  };
  const PATRON_HAZ = /beam|cannon|-ray$|^ray|hyper-voice|solar|flash-cannon|blast-burn|frenzy-plant|roar-of-time|prismatic|moongeist|photon|eternabeam|dynamax|spacial-rend|hydro-pump|flamethrower|dragon-pulse|dark-pulse|aura-sphere|focus-blast|energy-ball|origin-pulse|steam-eruption|tri-attack/;
  const PATRON_CIELO = /^thunder$|thunder-cage|blizzard|hurricane|meteor|rock-slide|sky-attack|draco|fire-blast|heat-wave|bolt-strike|wildbolt|bleakwind|icicle-crash|stone-axe|diamond-storm|razor-leaf|leaf-storm|petal-blizzard|spike-cannon|bullet-punch|glacial-lance|fly$|bounce|dive|sky-drop|make-it-rain|astral|hyperspace/;
  const PATRON_SUELO = /earthquake|earth-power|magnitude|bulldoze|fissure|stomping|precipice|thousand|eruption|stone-edge|headlong|high-horsepower|drill-run|dig$|lava-plume|scorching|sludge-wave|surf|muddy-water|whirlpool|ground|sandsear|mortal-spin|rock-wrecker|head-smash/;
  const PATRON_RAFAGA = /bullet|seed|needle|shard|barrage|rock-blast|icicle-spear|pin-missile|shuriken|scale-shot|swift|spikes|water-gun|ember|bubble|absorb|leafage|powder-snow|acid|smog|gust|thunder-shock|razor-shell|mud-shot|sludge|gunk/;
  function patronDe({ clave = '', categoria = 'especial', golpes = 1 } = {}) {
    if (PATRON_SUELO.test(clave)) return 'suelo';
    if (PATRON_CIELO.test(clave)) return 'cielo';
    if (categoria === 'fisico') return golpes > 1 || /double|dual|triple|fury|arm-thrust|comet-punch|surging|bonemerang|tachyon/.test(clave) ? 'golpes' : 'contacto';
    if (PATRON_HAZ.test(clave)) return 'haz';
    if (golpes > 1 || PATRON_RAFAGA.test(clave)) return 'rafaga';
    return 'proyectil';
  }

  /** Un fotograma (0–4) del sprite del tipo en (x, y), a `escala` unidades del mundo por píxel del sprite (píxeles enteros). */
  function spriteAtaque(tipo, fotograma, x, y, escala = 1.4, espejo = false) {
    const k = Math.max(1, Math.round(escala * S));
    const tam = LADO_SPRITE * k;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(X(x)), Math.round(Y(y)));
    if (espejo) ctx.scale(-1, 1);
    ctx.drawImage(hojaDeAtaque(tipo), fotograma * LADO_SPRITE, 0, LADO_SPRITE, LADO_SPRITE, -Math.round(tam / 2), -Math.round(tam / 2), tam, tam);
    ctx.restore();
  }
  /** Píxeles sueltos que saltan (chispas, gotas, fragmentos) con los colores del tipo. */
  function chispasGBA(x, y, tipo, cuantas = 12, fuerza = 1) {
    const colores = coloresDe(tipo);
    for (let i = 0; i < cuantas; i++) {
      const a = Math.random() * Math.PI * 2; const v = entre(60, 190) * fuerza;
      particula({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 220, arrastre: 2, vida: entre(300, 620), colores: [colores[0], colores[1], colores[2]], tam: entre(1.5, 3) });
    }
  }
  const pausa = ms => efimero(ms, () => {});
  /** Carga: la chispa inicial (fotograma 0) delante del atacante, creciendo. */
  function cargaGBA(A, tipo, ms = 300) {
    const dir = DIRECCION[A.lado];
    const b = boca(A);
    cargar({ x: b.x + dir * 6, y: b.y }, coloresDe(tipo).slice(0, 3), ms, 30);
    return efimero(ms, p => spriteAtaque(tipo, 0, b.x + dir * 8, b.y, 0.7 + 0.5 * p, dir < 0));
  }
  /** El proyectil (fotograma 1) de `desde` a `hasta` con una estela; se cumple al llegar. */
  function viajeGBA(desde, hasta, tipo, ms, { escala = 1, arco = 0, espejo = false } = {}) {
    const punto = q => ({ x: desde.x + (hasta.x - desde.x) * q, y: desde.y + (hasta.y - desde.y) * q - Math.sin(q * Math.PI) * arco });
    return efimero(ms, p => {
      const q = CURVAS.acelera(p) * 0.6 + p * 0.4;
      for (let k = 3; k >= 1; k--) { const e = punto(Math.max(0, q - k * 0.07)); spriteAtaque(tipo, 1, e.x, e.y, escala * (1 - k * 0.2), espejo); }
      const c = punto(q);
      spriteAtaque(tipo, 1, c.x, c.y, escala, espejo);
    });
  }
  /** Impacto: impacto máximo → expansión → dispersión en el rival, con temblor, destello y píxeles sueltos. */
  function impactoGBA(x, y, tipo, { escala = 1.5, fuerza = 1, espejo = false } = {}) {
    temblar(3 + 3 * fuerza, 260);
    golpeCamara(x, fuerza);
    destellar('#ffffff', 90, 0.22 * fuerza);
    chispasGBA(x, y, tipo, Math.round(12 * fuerza), fuerza);
    efimero(480, p => {
      const f = p < 0.34 ? 2 : p < 0.67 ? 3 : 4;
      spriteAtaque(tipo, f, x, y, escala * (f === 2 ? 1 : 1 + (p - 0.34) * 0.25), espejo);
    });
  }

  async function ataqueGBA(A, D, ataque) {
    const tipo = ataque.tipo || 'normal';
    const patron = patronDe(ataque);
    const dir = DIRECCION[A.lado];
    const espejo = dir < 0;
    if (A.oculto) revelar(A);
    const d = centro(D);
    const fuerte = (ataque.poder || 60) >= 100;
    if (ataque.categoria !== 'fisico' && FONDOS[FONDO_DE_TIPO[tipo]]) fondo(patron === 'haz' || fuerte ? 1300 : 900, FONDO_DE_TIPO[tipo], { desde: boca(A) });
    switch (patron) {
      case 'contacto': case 'golpes': {
        await anticipar(A, 140);
        const golpes = patron === 'golpes' ? Math.min(5, Math.max(2, ataque.golpes || 3)) : 1;
        const hasta = D.x + D.ox - dir * (anchoDe(D) * 0.45 + anchoDe(A) * 0.35) - A.x;
        efimero(240 + golpes * 160, () => { const c = centro(A); spriteAtaque(tipo, 1, c.x + dir * 6, c.y, 1.05, espejo); });
        await animar(A, { ox: hasta, sx: 1.08, sy: 0.94 }, 170, 'acelera');
        for (let g = 0; g < golpes; g++) {
          if (g) await animar(A, { ox: hasta - dir * 10 }, 70, 'frena').then(() => animar(A, { ox: hasta }, 70, 'acelera'));
          impactoGBA(d.x - dir * 4 + entre(-4, 4), d.y + entre(-6, 6), tipo, { escala: golpes > 1 ? 1.1 : 1.45, fuerza: golpes > 1 ? 0.7 : 1 + (fuerte ? 0.3 : 0), espejo });
          if (fuerte && golpes === 1) marcoImpacto(d.x, d.y);
        }
        animar(A, { ox: 0, sx: 1, sy: 1 }, 320).then(() => { A.quieto = true; });
        return;
      }
      case 'haz': {
        await anticipar(A, 120);
        await cargaGBA(A, tipo, 420);
        soltar(A);
        const b = boca(A);
        const desde = { x: b.x + dir * 10, y: b.y };
        efimero(620, p => { // un chorro de proyectiles pegados que avanza y se queda un momento
          const cabeza = Math.min(1, p * 2.6); const cola = Math.max(0, (p - 0.55) * 2.2);
          for (let q = cola; q <= cabeza; q += 0.07) spriteAtaque(tipo, 1, desde.x + (d.x - desde.x) * q, desde.y + (d.y - desde.y) * q + Math.sin(q * 20 + p * 30) * 1.5, 0.85, espejo);
        });
        await pausa(240);
        impactoGBA(d.x, d.y, tipo, { escala: 1.7, fuerza: 1.3, espejo });
        marcoImpacto(d.x, d.y);
        return;
      }
      case 'cielo': {
        await anticipar(A, 120);
        await cargaGBA(A, tipo, 260);
        soltar(A);
        for (const [k, dx] of (fuerte ? [[0, 0], [1, -14], [2, 14]] : [[0, 0]]).entries()) {
          await viajeGBA({ x: d.x + dx[1] - 30, y: -30 }, { x: d.x + dx[1], y: d.y }, tipo, k ? 160 : 240, { escala: 1.15 });
          impactoGBA(d.x + dx[1], d.y, tipo, { escala: k ? 1.2 : 1.6, fuerza: k ? 0.8 : 1.2 });
        }
        return;
      }
      case 'suelo': {
        await animar(A, { oy: -14 }, 150, 'frena');
        await animar(A, { oy: 0 }, 110, 'acelera');
        temblar(8, 500);
        const pies = pie(D);
        efimero(260, p => spriteAtaque(tipo, 0, pies.x + (A.x - pies.x) * (1 - p), SUELO - 4, 0.9, espejo), { capa: 'suelo' }); // la onda que corre por el suelo
        await pausa(240);
        impactoGBA(pies.x, SUELO - 22, tipo, { escala: 1.8, fuerza: 1.2, espejo });
        efimero(500, p => spriteAtaque(tipo, p < 0.5 ? 3 : 4, pies.x, SUELO - 8, 1.3, espejo), { capa: 'suelo' });
        return;
      }
      case 'rafaga': {
        await anticipar(A, 100);
        await cargaGBA(A, tipo, 220);
        soltar(A);
        const b = boca(A);
        const cuantos = Math.min(5, Math.max(3, ataque.golpes || 4));
        for (let k = 0; k < cuantos; k++) {
          const llega = viajeGBA({ x: b.x + dir * 8, y: b.y }, { x: d.x + entre(-6, 6), y: d.y + entre(-8, 8) }, tipo, 260, { escala: 0.75, arco: entre(-10, 14), espejo });
          if (k < cuantos - 1) { llega.then(() => impactoGBA(d.x + entre(-8, 8), d.y + entre(-8, 8), tipo, { escala: 0.95, fuerza: 0.6, espejo })); await pausa(90); } else { await llega; impactoGBA(d.x, d.y, tipo, { escala: 1.35, fuerza: 1, espejo }); }
        }
        return;
      }
      default: { // proyectil
        await anticipar(A, 120);
        await cargaGBA(A, tipo, 320);
        soltar(A);
        const b = boca(A);
        await viajeGBA({ x: b.x + dir * 10, y: b.y }, d, tipo, fuerte ? 300 : 360, { escala: fuerte ? 1.2 : 1, arco: 8, espejo });
        impactoGBA(d.x, d.y, tipo, { escala: fuerte ? 1.65 : 1.45, fuerza: fuerte ? 1.25 : 1, espejo });
        if (fuerte) marcoImpacto(d.x, d.y);
      }
    }
  }

  /**
   * La animación de un movimiento { clave, tipo, categoria, golpes, poder }: (A, D) => promesa que se cumple al
   * impactar. Desde la v2 del modo aventura todos usan los sprites GBA (ataqueGBA); las familias de antes
   * (ANIMACIONES, POR_TIPO) quedan como `animacionClasica` por si se quieren recuperar.
   */
  function animacionDe(ataque = {}) {
    return (A, D) => ataqueGBA(A, D, ataque);
  }
  // eslint-disable-next-line no-unused-vars
  function animacionClasica({ clave = '', tipo = 'normal', categoria = 'especial' } = {}) {
    const [familia, opciones] = ANIMACIONES[clave] || POR_TIPO[categoria === 'fisico' ? 'fisico' : 'especial'][tipo] || POR_TIPO.fisico.normal;
    const paleta = PALETAS_ATAQUE[tipo] || PALETAS_ATAQUE.directo;
    return (A, D) => FAMILIAS[familia](A, D, paleta, opciones);
  }

  /** Flecha de píxeles que sube (s = −1) o baja (s = 1): una estadística que cambia. colores: [borde, cuerpo]. */
  function flecha(x, y, tam, s, colores, alfa) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alfa));
    for (const [color, k] of [[colores[0], 1.35], [colores[1], 1]]) {
      ctx.fillStyle = color;
      triangulo(x - tam * k, y, x + tam * k, y, x, y + s * tam * 1.4 * k);
      ctx.fillRect(X(x - tam * 0.45 * k), Y(Math.min(y, y - s * tam * 1.3)), tam * 0.9 * k * S, tam * 1.3 * S);
    }
    ctx.globalAlpha = 1;
  }

  /** Señales de un movimiento de carga a medias: el hoyo o las ondas donde se escondió y el brillo del que acumula energía. */
  function dibujarMarcas(capa, t) {
    for (const L of Object.values(luchadores)) {
      if (!L.visible) continue;
      if (capa === 'suelo' && L.oculto === 'tierra') {
        ctx.fillStyle = '#1e1208'; ctx.beginPath(); ctx.ellipse(X(L.x), Y(SUELO + 1), 14 * S, 4.5 * S, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; cuadro(L.x + Math.cos(a) * 17, SUELO + 1 + Math.sin(a) * 5.5, 2.5, '#8a6a42'); }
      }
      if (capa === 'suelo' && L.oculto === 'agua') for (let i = 0; i < 3; i++) { const q = (t / 900 + i / 3) % 1; aro(L.x, SUELO + 1, 6 + q * 22, 1.6, '#c8ecff', 0.8 * (1 - q), 0.32); }
      if (capa === 'aire' && L.preparado) {
        const c = centro(L); const r = Math.max(anchoDe(L), altoDe(L));
        if (L.preparado.modo === 'sol') trazo([[c.x, -10], [c.x, SUELO]], r * 0.5 + Math.sin(t / 150) * 2, '#fff3a0', { alfa: 0.18, aditivo: true });
        brillo(c.x, c.y, r * (0.8 + 0.1 * Math.sin(t / 120)), L.preparado.color, 0.45);
      }
    }
  }

  // --- Entrenadores ------------------------------------------------------------------------------------
  /** Dónde tiene la mano (en el mundo) el entrenador de un lado, en su pose actual. */
  function manoDe(E) {
    const [hx, hy] = manoEntrenador(E.aspecto, E.pose);
    const m = medidasEntrenador(E.aspecto);
    const u = ESCALA_ENTRENADOR * m.unidad;
    const dir = E.lado === 'jugador' ? 1 : -1;
    return { x: E.x + (hx + 0.5 - m.ancho / 2) * u * dir, y: PIES_ENTRENADOR_Y - (m.pies + 0.5 - hy) * u };
  }
  /** Pone una pose un rato (luego vuelve a quieto). */
  function posar(E, pose, ms = 0) {
    if (!E) return;
    E.pose = pose;
    E.hastaPose = ms ? ahora() + ms : 0;
  }
  function dibujarEntrenador(E, t) {
    if (!E?.visible) return;
    if (E.hastaPose && t > E.hastaPose) { E.pose = 'quieto'; E.hastaPose = 0; }
    const m = medidasEntrenador(E.aspecto);
    const bruto = Sreal * ESCALA_ENTRENADOR * m.unidad;
    const entero = Math.max(1, Math.round(bruto));
    // Píxeles enteros (nítido); el tuyo, que va a otra escala, solo si así cambia de tamaño menos de un 8 %.
    const k = bruto < 0.75 ? bruto : m.unidad === 1 || Math.abs(entero - bruto) / bruto < 0.08 ? entero : bruto;
    const ancho = Math.round(m.ancho * k); const alto = Math.round(m.alto * k);
    const respira = E.pose === 'quieto' && !reducido() && Math.floor((t + (E.lado === 'rival' ? 700 : 0)) / 900) % 2 ? 1 : 0;
    const salto = E.celebrando && !reducido() ? Math.abs(Math.sin(t / 160)) * 6 : 0;
    const pies = Y(PIES_ENTRENADOR_Y);
    // sombra bajo los pies
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#1a0e05';
    ctx.beginPath(); ctx.ellipse(X(E.x), pies + S * 0.5, 9 * S * (1 - salto / 30), 2.2 * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const x = Math.round(X(E.x) - ancho / 2);
    const y = Math.round(pies - (m.pies + 1) * k + respira * k - salto * S);
    ctx.save();
    ctx.imageSmoothingEnabled = k < 1;
    if (E.lado === 'rival') { ctx.translate(x + ancho, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
    ctx.drawImage(lienzoEntrenador(E.aspecto, E.pose, E.paso), 0, 0, ancho, alto);
    ctx.restore();
  }
  /** Los dos entrenadores entran caminando desde fuera hasta su sitio. */
  function entrarEntrenadores() {
    for (const E of Object.values(entrenadores)) {
      if (!E) continue;
      E.visible = true;
      if (reducido()) continue;
      const casa = CASA_ENTRENADOR[E.lado];
      E.x = E.lado === 'jugador' ? -20 : ANCHO + 20;
      E.pose = 'paso';
      const inicio = ahora();
      efimero(1100, () => { E.paso = Math.floor((ahora() - inicio) / 150) % 2; }, { capa: 'suelo' });
      animar(E, { x: casa }, 1100, 'frena').then(() => { E.pose = 'quieto'; E.paso = 0; });
    }
  }

  // --- Poké Ball, transición y confeti -------------------------------------------------------------
  /** Una Poké Ball en (x, y), de radio r, girada `giro`; `abierta` (0–1) separa la mitad de arriba. */
  function pokeBall(x, y, r, giro = 0, abierta = 0) {
    const R = r * S;
    ctx.save();
    ctx.translate(Math.round(X(x)), Math.round(Y(y)));
    ctx.rotate(giro);
    const borde = Math.max(1, S * 0.6);
    ctx.fillStyle = '#16120e';
    ctx.beginPath(); ctx.arc(0, 0, R + borde, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e3350d';
    ctx.beginPath(); ctx.arc(0, -abierta * R * 0.5, R, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16120e';
    ctx.fillRect(-R, -Math.max(1, R * 0.12), R * 2, Math.max(2, R * 0.24));
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1, R * 0.13); ctx.strokeStyle = '#16120e'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(-R * 0.6, -R * 0.72, R * 0.28, R * 0.2);
    ctx.restore();
  }
  /** Lanza una Poké Ball desde el borde de su bando hasta su casilla, rebota y se abre. */
  async function lanzarPokeBall(L) {
    const dir = DIRECCION[L.lado];
    const E = entrenadores[L.lado];
    let desde = { x: L.lado === 'jugador' ? -14 : ANCHO + 14, y: SUELO - 46 };
    if (E?.visible) { // el entrenador echa el brazo atrás y la lanza
      posar(E, 'lanza1');
      await pausa(230);
      posar(E, 'lanza2', 520);
      desde = manoDe(E);
    }
    const hasta = { x: L.x, y: SUELO - 4 };
    const r = 4.6;
    sonar('lanzarBall');
    await efimero(560, q => {
      const x = lerp(desde.x, hasta.x, q); const y = lerp(desde.y, hasta.y, q) - Math.sin(Math.PI * q) * 48;
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#1a0e05';
      ctx.beginPath(); ctx.ellipse(X(x), Y(SUELO + 1), 4 * S, 1.4 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      pokeBall(x, y, r, q * 13 * dir);
    });
    sonar('rebote');
    await efimero(240, q => pokeBall(hasta.x, hasta.y - Math.sin(Math.PI * q) * 8, r, Math.sin(q * 9) * 0.4));
    sonar('abrirBall');
    efimero(320, q => pokeBall(hasta.x, hasta.y, r, 0, Math.min(1, q * 3)), { capa: 'aire' });
    efimero(560, q => { // destello de luz y rayos
      brillo(hasta.x, SUELO - 22, 18 + 58 * q, '#ffffff', 1 - q);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + q;
        trazo([[hasta.x + Math.cos(a) * 6, SUELO - 20 + Math.sin(a) * 6], [hasta.x + Math.cos(a) * (14 + q * 40), SUELO - 20 + Math.sin(a) * (14 + q * 40)]], 1.4, '#ffffff', { alfa: 1 - q });
      }
    });
    for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; particula({ x: hasta.x, y: SUELO - 18, vx: Math.cos(a) * entre(40, 110), vy: Math.sin(a) * entre(40, 110), arrastre: 3, vida: 500, colores: ['#ffffff', '#ffd1cc'], tam: 1.6, forma: 'estrella', brillo: 2 }); }
  }
  /** Cortina de franjas negras que se abren (al empezar el combate). */
  function transicion() {
    tapado = false;
    entrarEntrenadores();
    if (reducido()) return Promise.resolve();
    sonar('transicion');
    return efimero(900, q => {
      const n = 10; const alto = H / n;
      ctx.fillStyle = '#000';
      for (let i = 0; i < n; i++) {
        const queda = W * (1 - Math.min(1, Math.max(0, q * 1.7 - i * 0.07)));
        ctx.fillRect(i % 2 ? W - queda : 0, Math.floor(i * alto), queda + 1, Math.ceil(alto) + 1);
      }
    }, { capa: 'pantalla' });
  }
  function confeti() {
    if (reducido()) return;
    const colores = ['#ffd36a', '#ff7a6a', '#7fd0ff', '#9be08f', '#f5a0cf', '#ffffff'];
    emitir(1600, () => {
      for (let i = 0; i < 3; i++) {
        const color = colores[Math.floor(Math.random() * colores.length)];
        particula({ x: entre(0, ANCHO), y: -6, vx: entre(-20, 20), vy: entre(30, 70), g: 40, arrastre: 0.4, vida: 3200, colores: [color, color], tam: 2.2, forma: 'roca', vgiro: entre(-9, 9), giro: Math.random() * 3 });
      }
    });
  }

  /** Destello blanco y retroceso al recibir un golpe. */
  function reiniciarGolpe(L, fuerza = 1) {
    (async () => { for (let i = 0; i < 3; i++) { L.blanco = 1; await pausa(55); L.blanco = 0; await pausa(45); } })();
    L.quieto = false;
    animar(L, { ox: -DIRECCION[L.lado] * 9 * fuerza }, 110, 'frena').then(() => animar(L, { ox: 0 }, 340)).then(() => { L.quieto = true; });
  }

  // --- Bucle de dibujo ---------------------------------------------------------------------------
  function dibujarSombra(L, t) {
    if (!L.visible || !L.modelo) return;
    const ancho = Math.max(16, anchoDe(L) * 0.6 * (1 + L.oy / 140));
    ctx.globalAlpha = 0.34 * L.alfa;
    ctx.fillStyle = '#1a0e05';
    ctx.beginPath(); ctx.ellipse(X(L.x + L.ox), Y(SUELO + 1), (ancho / 2) * S, Math.max(1.5, ancho / 9) * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (L.cargado) { // aro dorado bajo los pies mientras está concentrado
      aro(L.x + L.ox, SUELO + 1, anchoDe(L) * 0.45, 1.5, '#ffd76a', 0.55 + Math.sin(t / 120) * 0.35, 0.3);
      brillo(L.x + L.ox, SUELO - altoDe(L) * 0.3, anchoDe(L) * 0.6, '#ffd76a', 0.18);
    }
  }

  function dibujarLuchador(L, t) {
    if (!L.visible || !L.modelo) return;
    if (L.parpadeo && Math.floor(t / 70) % 2) return;
    const { caja, cuadros, total, animado } = L.modelo;
    let actual = cuadros[0];
    if (animado) {
      let resto = L.reloj % total;
      for (const c of cuadros) { if (resto < c.ms) { actual = c; break; } resto -= c.ms; }
    }
    const k = pixelesPorUnidad(L);
    // Sin GIF (unos pocos de la 9.ª generación), el sprite fijo «vive»: respira y de vez en cuando da un saltito.
    let respira = 0; let estira = 0;
    if (!animado && L.quieto && !reducido()) {
      const ciclo = t / 1000 + L.fase;
      const aire = Math.sin(ciclo * 2.6);
      respira = aire * 0.8 + Math.max(0, Math.sin(ciclo * 1.1)) ** 14 * 6;
      estira = aire * 0.03;
    }
    const ancho = Math.round(caja.w * k * L.sx * (1 - estira * 0.6));
    const alto = Math.round(caja.h * k * L.sy * (1 + estira));
    const x = Math.round(X(L.x + L.ox) - ancho / 2);
    const y = Math.round(Y(SUELO + L.oy - respira) - alto);
    ctx.save();
    ctx.globalAlpha = L.alfa;
    ctx.imageSmoothingEnabled = k < 1;
    ctx.translate(L.mira < 0 ? x + ancho : x, y);
    if (L.mira < 0) ctx.scale(-1, 1);
    ctx.drawImage(actual.fuente, caja.x, caja.y, caja.w, caja.h, 0, 0, ancho, alto);
    const capa = L.blanco > 0 ? { color: '#ffffff', alfa: L.blanco } : L.tinte.alfa > 0.01 ? L.tinte
      : L.estado === 'congelado' ? { color: '#bdefff', alfa: 0.5 } : null;
    if (capa) { // tiñe solo el dibujo (no el fondo transparente) usando un lienzo auxiliar
      if (bufer.width < caja.w || bufer.height < caja.h) { bufer.width = Math.max(bufer.width, caja.w); bufer.height = Math.max(bufer.height, caja.h); }
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, bufer.width, bufer.height);
      bctx.drawImage(actual.fuente, caja.x, caja.y, caja.w, caja.h, 0, 0, caja.w, caja.h);
      bctx.globalCompositeOperation = 'source-atop';
      bctx.fillStyle = capa.color;
      bctx.fillRect(0, 0, caja.w, caja.h);
      ctx.globalAlpha = L.alfa * capa.alfa;
      ctx.drawImage(bufer, 0, 0, caja.w, caja.h, 0, 0, ancho, alto);
    }
    ctx.restore();
  }

  function dibujarParticula(p, t) {
    const vida = (t - p.nacio) / p.vida;
    const color = p.colores ? mezclar(p.colores, vida) : p.color;
    const tam = p.tamFin == null ? p.tam : lerp(p.tam, p.tamFin, vida);
    const alfa = p.alfa * (vida > 0.6 ? 1 - (vida - 0.6) / 0.4 : 1);
    if (p.brillo) brillo(p.x, p.y, p.brillo * (1 - vida * 0.4), p.colores ? p.colores[Math.min(p.colores.length - 1, 1)] : color, alfa * 0.6);
    ctx.globalAlpha = alfa;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const px = X(p.x); const py = Y(p.y); const r = Math.max(1, tam * S);
    switch (p.forma) {
      case 'humo': ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); break;
      case 'burbuja': ctx.lineWidth = Math.max(1, S * 0.6); ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke(); break;
      case 'chispa': {
        const v = Math.hypot(p.vx, p.vy) || 1; const largo = Math.min(14, v * 0.05) * S;
        ctx.lineWidth = Math.max(1, tam * S * 0.6);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - (p.vx / v) * largo, py - (p.vy / v) * largo); ctx.stroke();
        break;
      }
      case 'gota': {
        const v = Math.hypot(p.vx, p.vy) || 1;
        ctx.beginPath(); ctx.ellipse(px, py, r * 1.4, r * 0.8, Math.atan2(p.vy, p.vx), 0, Math.PI * 2); ctx.fill();
        void v;
        break;
      }
      case 'estrella': {
        const l = Math.round(r * 1.6); const g = Math.max(1, Math.round(r * 0.5));
        ctx.fillRect(Math.round(px - l), Math.round(py - g / 2), l * 2, g);
        ctx.fillRect(Math.round(px - g / 2), Math.round(py - l), g, l * 2);
        break;
      }
      case 'roca': {
        ctx.save(); ctx.translate(px, py); ctx.rotate(p.giro);
        ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
        ctx.restore();
        break;
      }
      default: { const lado = Math.max(1, Math.round(r)); ctx.fillRect(Math.round(px - lado / 2), Math.round(py - lado / 2), lado, lado); }
    }
    ctx.globalAlpha = 1;
  }

  function emisores() {
    if (reducido()) return;
    for (const L of Object.values(luchadores)) {
      if (!L.visible || !L.modelo) continue;
      if (L.preparado && Math.random() < 0.4) particula({ x: L.x + L.ox + entre(-anchoDe(L) * 0.5, anchoDe(L) * 0.5), y: SUELO - entre(0, altoDe(L)), vy: -entre(20, 45), vida: 700, colores: ['#ffffff', L.preparado.color], tam: 1.6, forma: 'estrella', brillo: 3 });
      if (L.cargado && Math.random() < 0.35) particula({ x: L.x + L.ox + entre(-anchoDe(L) * 0.4, anchoDe(L) * 0.4), y: SUELO - entre(0, altoDe(L) * 0.6), vy: -entre(18, 34), vida: 600, colores: ['#fff3c4', '#ffd76a'], tam: 1.5, brillo: 2 });
      if (L.rareza && Math.random() < 0.06) particula({ x: L.x + L.ox + entre(-anchoDe(L) * 0.5, anchoDe(L) * 0.5), y: SUELO - entre(0, altoDe(L)), vy: -10, vida: 700, colores: ['#ffe9a8'], tam: 1.2, brillo: 2 });
      const w = anchoDe(L); const h = altoDe(L); const x = L.x + L.ox;
      if (L.listo && Math.random() < 0.3) { // rebosa energía: chispas de colores que suben
        particula({ x: x + entre(-w * 0.5, w * 0.5), y: SUELO - entre(0, h), vy: -entre(20, 45), vida: 800, colores: ['#ffffff', ARCOIRIS[Math.floor(Math.random() * ARCOIRIS.length)]], tam: 1.6, forma: 'estrella', brillo: 3 });
      }
      if (L.estado === 'quemado' && Math.random() < 0.22) particula({ x: x + entre(-w * 0.35, w * 0.35), y: SUELO - entre(0, h * 0.7), vy: -entre(20, 45), vida: 520, colores: FUEGO, tam: 2, tamFin: 4, brillo: 3, forma: 'humo', alfa: 0.8 });
      if (L.estado === 'envenenado' && Math.random() < 0.12) particula({ x: x + entre(-w * 0.35, w * 0.35), y: SUELO - entre(0, h * 0.6), vy: -entre(10, 20), vida: 900, colores: ['#e9bdff', '#a65fc7'], tam: 1.5, tamFin: 3, forma: 'burbuja' });
      if (L.estado === 'paralizado' && Math.random() < 0.05) {
        const c = centro(L); const z = zigzag([c.x - w * 0.3, c.y + entre(-h * 0.3, h * 0.3)], [c.x + w * 0.3, c.y + entre(-h * 0.3, h * 0.3)], 5, 3);
        efimero(90, () => trazo(z, 1, '#ffffff', { halo: '#ffd83a' }));
      }
      if (L.estado === 'congelado' && Math.random() < 0.05) particula({ x: x + entre(-w * 0.4, w * 0.4), y: SUELO - entre(0, h), vida: 500, colores: ['#ffffff', '#bdefff'], tam: 1.5, forma: 'estrella', brillo: 2 });
      if (L.estado === 'dormido' && Math.random() < 0.015) { const c = cabeza(L); textoFlotante('Z', c.x + DIRECCION[L.lado] * 8, c.y + 4, { tamano: 1.3, color: '#cfd8ff', ms: 1700 }); }
    }
  }

  /** Pinceles que usa el ambiente del escenario (escenarios.js); ctx y S cambian según la capa. */
  const pinceles = {
    get ctx() { return ctx; }, get S() { return S; }, get reducido() { return reducido(); },
    X: x => X(x), Y: y => Y(y), cuadro, brillo, aro, trazo, particula, llama, chispa4, entre,
  };

  // --- Clima: lo que cae o flota sobre el campo -----------------------------------------------------
  const gotas = clima === 'lluvia' || clima === 'granizo'
    ? Array.from({ length: clima === 'lluvia' ? 160 : 90 }, () => ({ x: entre(-40, ANCHO), y: entre(-20, ALTO), v: entre(0.8, 1.2) })) : [];
  const granos = clima === 'arena' ? Array.from({ length: 150 }, () => ({ x: entre(0, ANCHO), y: entre(0, ALTO), v: entre(0.6, 1.4) })) : [];
  const nieblas = clima === 'niebla' ? Array.from({ length: 8 }, (_, i) => ({ x: entre(0, ANCHO), y: entre(30, ALTO - 30), r: entre(70, 120), v: entre(4, 10) * (i % 2 ? 1 : -1) })) : [];
  const FILTRO_CLIMA = { lluvia: 'rgba(20,35,70,0.2)', granizo: 'rgba(170,210,240,0.14)', arena: 'rgba(190,150,90,0.18)', niebla: 'rgba(10,15,25,0.22)', sol: 'rgba(255,190,90,0.07)' };
  function dibujarClima(t, dt) {
    if (!clima) return;
    const mueve = reducido() ? 0 : dt;
    ctx.fillStyle = FILTRO_CLIMA[clima];
    ctx.fillRect(0, 0, W, H);
    if (clima === 'sol') { // rayos de luz desde la esquina y motas doradas
      brillo(20, 0, 230, '#ffd27a', 0.42 + Math.sin(t / 900) * 0.06);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.05 + Math.sin(t / 1300 + i * 1.7) * 0.025;
        ctx.fillStyle = '#ffe3a0';
        ctx.beginPath();
        ctx.moveTo(X(10), Y(-10)); ctx.lineTo(X(150 + i * 90), Y(ALTO + 10)); ctx.lineTo(X(190 + i * 90), Y(ALTO + 10));
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (Math.random() < 0.08 && mueve) particula({ x: entre(0, ANCHO), y: entre(40, ALTO), vy: -entre(4, 10), vx: entre(3, 8), vida: 2200, colores: ['#fff3c4'], tam: 1, alfa: 0.7, brillo: 2 });
    }
    if (clima === 'lluvia' || clima === 'granizo') {
      const lluvia = clima === 'lluvia';
      ctx.strokeStyle = 'rgba(200,222,255,0.55)';
      ctx.lineWidth = Math.max(1, S * 0.55);
      ctx.beginPath();
      for (const g of gotas) {
        g.y += (lluvia ? 320 : 150) * g.v * mueve;
        g.x += (lluvia ? 70 : 20 + Math.sin(t / 500 + g.v * 9) * 25) * g.v * mueve;
        if (g.y > ALTO + 10) { g.y = -10; g.x = entre(-40, ANCHO); }
        if (lluvia) { ctx.moveTo(X(g.x), Y(g.y)); ctx.lineTo(X(g.x - 3 * g.v), Y(g.y - 10 * g.v)); }
      }
      ctx.stroke();
      if (!lluvia) for (const g of gotas) cuadro(g.x, g.y, 1.6 * g.v, '#f4fbff');
      if (lluvia && mueve && Math.random() < 0.35) { // salpicaduras en el suelo
        const x = entre(30, ANCHO - 30); const y = entre(40, ALTO - 20);
        efimero(380, q => aro(x, y, 1 + q * 5, 1, '#d6e6ff', 0.6 * (1 - q), 0.4), { capa: 'suelo' });
      }
    }
    if (clima === 'arena') {
      ctx.fillStyle = 'rgba(232,198,140,0.75)';
      for (const g of granos) {
        g.x -= 230 * g.v * mueve;
        g.y += Math.sin(t / 300 + g.v * 20) * 12 * mueve;
        if (g.x < -10) { g.x = ANCHO + 10; g.y = entre(0, ALTO); }
        ctx.fillRect(Math.round(X(g.x)), Math.round(Y(g.y)), Math.max(2, Math.round(5 * g.v * S)), Math.max(1, Math.round(S * 0.7)));
      }
    }
    if (clima === 'niebla') {
      for (const n of nieblas) {
        n.x += n.v * mueve;
        if (n.x > ANCHO + n.r) n.x = -n.r; if (n.x < -n.r) n.x = ANCHO + n.r;
        ctx.globalAlpha = 0.2;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(texturaBrillo('#dfe4ee'), X(n.x - n.r), Y(n.y - n.r * 0.6), n.r * 2 * S, n.r * 1.2 * S);
        ctx.imageSmoothingEnabled = false;
      }
      ctx.globalAlpha = 1;
    }
  }

  // --- Ondulación de la imagen (Psíquico): franjas desplazadas del propio lienzo -------------------
  const ondas = [];
  function ondular(ms, amplitud = 4) { if (!reducido()) ondas.push({ inicio: ahora(), ms, amplitud }); }
  function aplicarOndas(t) {
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i];
      const p = (t - o.inicio) / o.ms;
      if (p >= 1) { ondas.splice(i, 1); continue; }
      const amplitud = o.amplitud * Math.sin(Math.PI * p) * (W / ANCHO);
      const franja = Math.max(2, Math.round(H / 90));
      for (let y = 0; y < H; y += franja) {
        const dx = Math.round(Math.sin(y / (H / 9) + t / 70) * amplitud);
        if (dx) ctx.drawImage(lienzo, 0, y, W, franja, dx, y, W, franja);
      }
    }
  }

  function dibujarCapa(capa, t, dt) {
    for (let i = efimeros.length - 1; i >= 0; i--) {
      const e = efimeros[i];
      if (e.capa !== capa || t < e.inicio) continue;
      const p = (t - e.inicio) / e.ms;
      if (p >= 1) { efimeros.splice(i, 1); e.listo(); continue; }
      e.dibujar(p, t, dt);
    }
  }

  function cuadroDeAnimacion() {
    if (!activo) return;
    const t = ahora();
    const dt = Math.min(50, t - anterior) / 1000;
    anterior = t;
    Sreal = (lienzo.width / ANCHO) * camara.zoom;
    usar('real');

    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const p = Math.min(1, (t - tw.inicio) / tw.ms);
      const e = tw.curva(p);
      for (const k in tw.destino) tw.objeto[k] = lerp(tw.desde[k], tw.destino[k], e);
      if (p >= 1) { tweens.splice(i, 1); tw.listo(); }
    }
    emisores();
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      if (t - p.nacio > p.vida) { particulas.splice(i, 1); continue; }
      const freno = Math.max(0, 1 - p.arrastre * dt);
      p.vx *= freno; p.vy *= freno;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.giro += p.vgiro * dt;
    }
    for (const L of Object.values(luchadores)) L.reloj += dt * 1000;

    const fuerza = t < temblor.hasta ? temblor.fuerza * ((temblor.hasta - t) / temblor.ms) : 0;
    sacudida = { x: Math.round(entre(-fuerza, fuerza) * (lienzo.width / ANCHO)), y: Math.round(entre(-fuerza, fuerza) * 0.5 * (lienzo.width / ANCHO)) };

    usar('real');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(campo, X(0), Y(0), ANCHO * S, ALTO * S);
    // Capa de efectos del suelo (debajo de los Pokémon): escenario, fondos de los movimientos, charcos…
    usar('suelo');
    ctx.clearRect(0, 0, W, H);
    ambiente.suelo(pinceles, t);
    dibujarMarcas('suelo', t);
    dibujarCapa('suelo', t, dt);
    for (const p of particulas) if (p.capa === 'suelo') dibujarParticula(p, t);
    componer(capaSuelo);
    for (const E of Object.values(entrenadores)) dibujarEntrenador(E, t);
    for (const L of Object.values(luchadores)) dibujarSombra(L, t);
    for (const L of Object.values(luchadores)) dibujarLuchador(L, t);
    // Capa de efectos del aire (encima): ataques, partículas, clima y destellos de pantalla.
    usar('aire');
    ctx.clearRect(0, 0, W, H);
    ambiente.aire(pinceles, t);
    dibujarMarcas('aire', t);
    dibujarCapa('aire', t, dt);
    for (const p of particulas) if (p.capa !== 'suelo') dibujarParticula(p, t);
    dibujarClima(t, dt);
    dibujarCapa('pantalla', t, dt);
    componer(capaAire);
    aplicarOndas(t);
    if (tapado) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }

    const escalaTexto = valor => Math.max(2, Math.round((W / ANCHO) * valor));
    for (let i = textos.length - 1; i >= 0; i--) {
      const tx = textos[i];
      const p = (t - tx.inicio) / tx.ms;
      if (p >= 1) { textos.splice(i, 1); continue; }
      ctx.globalAlpha = p > 0.65 ? 1 - (p - 0.65) / 0.35 : 1;
      const sube = 22 * (1 - (1 - Math.min(1, p * 1.6)) ** 2);
      dibujarTexto(ctx, tx.texto, X(tx.x), Y(tx.y - sube), { escala: escalaTexto(tx.tamano), color: tx.color, alinear: 'centro' });
    }
    if (rotulo) { // placa con el nombre del movimiento, bajo el atacante
      const p = (t - rotulo.inicio) / rotulo.ms;
      if (p >= 1) rotulo = null;
      else {
        const escala = escalaTexto(1.15);
        const ancho = anchoTexto(rotulo.texto, escala) + escala * 8;
        const alto = escala * 11;
        const entra = Math.min(1, p * 8);
        const x = Math.round(Math.min(W - ancho - 4, Math.max(4, X(luchadores[rotulo.lado].x) - ancho / 2)));
        const y = Math.round(Y(SUELO + 20) + (1 - entra) * escala * 4);
        ctx.globalAlpha = p > 0.82 ? 1 - (p - 0.82) / 0.18 : entra;
        ctx.fillStyle = '#0a0806'; ctx.fillRect(x - escala, y - escala, ancho + escala * 2, alto + escala * 2);
        ctx.fillStyle = rotulo.color; ctx.fillRect(x, y, ancho, alto);
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, ancho, escala * 2);
        dibujarTexto(ctx, rotulo.texto, x + ancho / 2, y + escala * 2, { escala, color: '#ffffff', alinear: 'centro' });
      }
    }
    if (anuncio) {
      const p = (t - anuncio.inicio) / anuncio.ms;
      if (p >= 1) anuncio = null;
      else {
        ctx.globalAlpha = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
        const escala = escalaTexto(p < 0.06 ? 3.2 : 2.6);
        const y = Math.round(H * 0.24);
        ctx.fillStyle = 'rgba(12,8,4,0.55)';
        ctx.fillRect(0, y - escala * 3, W, escala * 13);
        dibujarTexto(ctx, anuncio.texto, W / 2, y, { escala, color: COLOR_TONO[anuncio.tono] || '#fff', alinear: 'centro' });
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(cuadroDeAnimacion);
  }
  requestAnimationFrame(cuadroDeAnimacion);

  // --- Lo que usa simulacro.js ---------------------------------------------------------------
  return {
    /** Empieza a descargar y decodificar los modelos de antemano (para que entren sin esperas). */
    precargar(lista) { lista.filter(Boolean).forEach(cargarModelo); },

    /** Pone (o quita, con datos = null) al Pokémon de un bando. datos: { clave, animados, sprite, imagen, altura, rareza } */
    async poner(lado, datos, { entrada = false } = {}) {
      const L = luchadores[lado];
      if (!datos) { L.visible = false; L.clave = null; return; }
      if (L.clave === datos.clave && L.visible && !entrada) return;
      const modelo = await cargarModelo(datos);
      if (!modelo) { L.visible = false; return; }
      const escala = Math.min(altoObjetivo(datos.altura) / (modelo.altoTipico || modelo.caja.h), ANCHO_MAXIMO / modelo.caja.w);
      Object.assign(L, { modelo, escala, x: posicionDe(lado, modelo.caja.w * escala), clave: datos.clave, rareza: datos.rareza || null, ox: 0, oy: 0, sx: 1, sy: 1, alfa: 1, blanco: 0, tinte: { color: '#ffffff', alfa: 0 }, parpadeo: false, cargado: false, oculto: null, preparado: null, visible: true, quieto: true });
      if (!entrada || reducido()) return;
      // Sale de su Poké Ball: vuela, rebota, se abre con un destello y el Pokémon crece desde la luz.
      L.visible = false;
      L.quieto = false;
      await lanzarPokeBall(L);
      if (L.rareza) efimero(900, p => { const c = { x: L.x, y: SUELO }; brillo(c.x, c.y - 60, 70 * (1 - p), '#ffe9a8', 0.5 * (1 - p)); trazo([[c.x, -10], [c.x, c.y]], 18 * (1 - p), '#fff6d0', { alfa: 0.5 * (1 - p), aditivo: true }); });
      Object.assign(L, { visible: true, blanco: 1, sx: 0.15, sy: 0.15 });
      animar(L, { blanco: 0 }, 520, 'lineal');
      await animar(L, { sx: 1.1, sy: 1.1 }, 280, 'frena');
      polvo(L.x, SUELO, 8);
      efimero(420, p => aro(L.x, SUELO, 8 + p * 30, 2, '#f0e2c0', 0.8 * (1 - p), 0.3), { capa: 'suelo' });
      await animar(L, { sx: 1, sy: 1 }, 260, 'rebote');
      L.quieto = true;
    },

    /**
     * Anima el movimiento de `lado` y se cumple en el instante del impacto.
     * ataque: { clave (de PokéAPI), tipo, categoria: 'fisico' | 'especial' } (combate.js → crearAtaque).
     */
    async atacar(lado, ataque = {}) {
      const A = luchadores[lado];
      const D = luchadores[lado === 'jugador' ? 'rival' : 'jugador'];
      A.preparado = null;
      if (reducido()) { revelar(A); const c = centro(D); impacto(c.x, c.y, PALETAS_ATAQUE[ataque.tipo] || PALETAS_ATAQUE.directo, 1); return; }
      posar(entrenadores[lado], 'ordena', 700);
      await animacionDe(ataque)(A, D);
      if (A.oculto) revelar(A);
    },

    /**
     * Primer turno de un movimiento de carga: se esconde ('aire', 'tierra', 'agua', 'sombra') o se queda
     * brillando mientras acumula energía ('sol', 'brillo'). El turno siguiente, atacar() lo suelta.
     */
    async preparar(lado, modo, tipo) {
      const L = luchadores[lado];
      if (['aire', 'tierra', 'agua', 'sombra'].includes(modo)) {
        if (reducido()) Object.assign(L, { oculto: modo, alfa: 0 });
        else await ocultarse(L, modo);
        return;
      }
      L.preparado = { modo, color: modo === 'sol' ? '#fff3a0' : (PALETAS_ATAQUE[tipo] || PALETAS_ATAQUE.directo)[1] };
      if (reducido()) return;
      L.quieto = false;
      if (modo === 'sol') await efimero(700, p => { const c = centro(L); for (let i = 0; i < 5; i++) { const x = c.x + (i - 2) * 12; trazo([[x + (c.x - x) * p, -10], [c.x, c.y]], 3 * (1 - p) + 0.5, '#fff3a0', { alfa: 0.5 }); } });
      else { cargar(centro(L), ['#ffffff', L.preparado.color, L.preparado.color], 600, 40); await animar(L, { sy: 0.9, sx: 1.06 }, 300, 'frena'); }
      await animar(L, { sx: 1, sy: 1 }, 260, 'rebote');
      L.quieto = true;
    },

    /** El movimiento falla: el rival lo esquiva de un salto (o, si está escondido, solo se ve el letrero). */
    esquivar(lado, texto = '¡Falló!') {
      const L = luchadores[lado];
      if (!L.visible) return;
      const k = L.oculto ? { x: L.x, y: SUELO - 50 } : cabeza(L);
      textoFlotante(texto, k.x, k.y, { tamano: 1.4, color: COLOR_TONO.nulo });
      if (L.oculto || reducido()) return;
      L.quieto = false;
      animar(L, { ox: -DIRECCION[lado] * 16, oy: -8 }, 140, 'frena').then(() => animar(L, { ox: 0, oy: 0 }, 260)).then(() => { L.quieto = true; });
    },

    /** Recupera vida (Gigadrenado…): destellos verdes que suben y el número en verde. */
    curar(lado, cantidad) {
      const L = luchadores[lado];
      if (!L.visible) return;
      const k = L.oculto ? { x: L.x, y: SUELO - 50 } : cabeza(L);
      textoFlotante('+' + cantidad, k.x, k.y - 4, { tamano: 1.5, color: '#9be08f' });
      if (reducido() || L.oculto) return;
      const c = centro(L); const w = anchoDe(L);
      L.tinte = { color: '#9be08f', alfa: 0.45 };
      animar(L.tinte, { alfa: 0 }, 600, 'lineal');
      for (let i = 0; i < 14; i++) particula({ x: c.x + entre(-w * 0.45, w * 0.45), y: SUELO - entre(0, altoDe(L) * 0.8), vy: -entre(20, 50), vida: 700, colores: ['#ffffff', '#9be08f'], tam: 1.8, forma: 'estrella', brillo: 3 });
    },

    /** Una estadística sube (flechas rojas que suben) o baja (flechas azules que caen). */
    etapas(lado, sube) {
      const L = luchadores[lado];
      if (!L.visible || L.oculto || reducido()) return;
      const colores = sube ? ['#5a1408', '#ff6a3a'] : ['#0a1e5a', '#4a8aff'];
      L.tinte = { color: colores[1], alfa: 0.5 };
      animar(L.tinte, { alfa: 0 }, 800, 'lineal');
      const w = anchoDe(L); const h = altoDe(L);
      for (let i = 0; i < 9; i++) {
        const dx = ((i % 3) - 1) * w * 0.32 + entre(-4, 4);
        efimero(620, p => { const y = sube ? lerp(SUELO - 4, SUELO - h * 1.05, p) : lerp(SUELO - h * 1.05, SUELO - 4, p); flecha(L.x + L.ox + dx, y, 3.2, sube ? -1 : 1, colores, Math.sin(Math.PI * p)); }, { retraso: i * 70 });
      }
    },

    /** Placa con el nombre del movimiento bajo el Pokémon de `lado`, del color de su tipo. */
    rotulo(lado, texto, color = '#8a917e') { rotulo = { lado, texto, color, inicio: ahora(), ms: 1600 }; },

    /** Reacción al golpe: destello, retroceso, tinte del tipo y el número de daño (o «sin efecto» si es ×0). */
    golpear(lado, { danio, mult, certero, ataque }) {
      const L = luchadores[lado];
      const c = cabeza(L);
      if (mult === 0) {
        L.quieto = false;
        animar(L, { oy: -12, ox: -DIRECCION[lado] * 9 }, 150, 'frena').then(() => animar(L, { oy: 0, ox: 0 }, 200)).then(() => { L.quieto = true; });
        textoFlotante('Sin efecto', c.x, c.y, { tamano: 1.2, color: COLOR_TONO.nulo });
        return;
      }
      reiniciarGolpe(L, mult >= 2 ? 1.4 : 1);
      const tinte = TINTES[ataque?.tipo];
      if (tinte) { L.tinte = { color: tinte, alfa: 0.55 }; animar(L.tinte, { alfa: 0 }, 650, 'lineal'); }
      if (mult >= 2 || certero) {
        temblar(5, 300);
        marcoImpacto(centro(L).x, centro(L).y);
        golpeCamara(L.x + L.ox, mult >= 4 ? 1.4 : 1);
      }
      const color = mult >= 2 ? COLOR_TONO.fuerte : mult < 1 ? '#d8e2e8' : '#ffffff';
      textoFlotante('-' + danio, c.x, c.y - 6, { tamano: mult >= 2 ? 2.4 : 1.8, color });
      const etiqueta = { 4: '×4', 2: '×2', 0.5: '×1/2', 0.25: '×1/4' }[mult];
      if (etiqueta) textoFlotante(etiqueta, c.x, c.y + 12, { tamano: 1.1, color });
      if (certero) textoFlotante('¡Certero!', c.x, c.y + 22, { tamano: 1.1, color: COLOR_TONO.fuerte });
    },

    /** Se agacha y queda envuelto en chispas doradas (hasta que ataque o se retire). */
    concentrar(lado) {
      const L = luchadores[lado];
      L.cargado = true;
      L.quieto = false;
      animar(L, { sx: 1.12, sy: 0.86 }, 140).then(() => animar(L, { sx: 1, sy: 1 }, 240, 'rebote')).then(() => { L.quieto = true; });
      efimero(500, p => aro(L.x + L.ox, SUELO - altoDe(L) * 0.4, anchoDe(L) * (0.3 + p * 0.6), 2, '#ffd76a', 1 - p));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        particula({ x: L.x + L.ox + Math.cos(a) * 22, y: SUELO - 4 + Math.sin(a) * 7, vy: -entre(25, 50), vida: 700, colores: ['#fff3c4', '#ffd76a'], tam: 2, brillo: 3 });
      }
    },

    cargado(lado, valor) { luchadores[lado].cargado = valor; },

    /** Vuelve a su Poké Ball: un rayo rojo lo absorbe hacia su lado del campo. */
    async retirar(lado) {
      const L = luchadores[lado];
      revelar(L);
      if (!L.visible) return;
      const c = centro(L);
      const E = entrenadores[lado];
      if (E?.visible) posar(E, 'ordena', 600);
      const lejos = E?.visible ? manoDe(E) : { x: lado === 'jugador' ? -14 : ANCHO + 14, y: SUELO - 46 };
      sonar('retirar');
      if (!reducido()) efimero(460, q => trazo([[c.x, c.y], [lejos.x, lejos.y]], 3.2 * (1 - q * 0.6), '#ff4a3a', { halo: '#ff9a8a', alfa: 1 - q }));
      L.quieto = false;
      L.tinte = { color: '#ff3a2a', alfa: 0.85 };
      await animar(L, { sx: 0.1, sy: 0.1, alfa: 0.4 }, 320, 'acelera');
      Object.assign(L, { visible: false, alfa: 1, sx: 1, sy: 1, tinte: { color: '#ffffff', alfa: 0 }, estado: null, listo: false });
    },

    /**
     * Evolución: el campo se oscurece, el Pokémon se vuelve de luz, su silueta alterna entre la forma
     * vieja y la nueva cada vez más deprisa y estalla en la nueva. Con `mega`, en colores de arcoíris.
     * datos: como en poner(). Se cumple al terminar (unos 4 s).
     */
    async evolucionar(lado, datos, { mega = false } = {}) {
      const L = luchadores[lado];
      const nuevo = await cargarModelo(datos);
      if (!nuevo) return;
      const escala = Math.min(altoObjetivo(datos.altura) / (nuevo.altoTipico || nuevo.caja.h), ANCHO_MAXIMO / nuevo.caja.w);
      const forma = { modelo: nuevo, escala, x: posicionDe(lado, nuevo.caja.w * escala) };
      revelar(L);
      const antes = { modelo: L.modelo, escala: L.escala, x: L.x };
      const final = { ...forma, clave: datos.clave, rareza: datos.rareza || null, listo: false };
      if (reducido()) { Object.assign(L, final); return; }
      const colores = mega ? ARCOIRIS : ['#ffffff', '#cfe8ff', '#fff3c4'];
      L.quieto = false;
      L.cargado = false;
      sonar('evolucion');
      efimero(4300, q => { // el campo se oscurece alrededor
        ctx.globalAlpha = 0.6 * Math.min(1, q * 6, (1 - q) * 5);
        ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      }, { capa: 'suelo' });
      efimero(4300, (q, t) => { // halo de luz (de colores si es mega)
        const c = centro(L);
        const color = mega ? ARCOIRIS[Math.floor(t / 90) % ARCOIRIS.length] : '#ffffff';
        brillo(c.x, c.y, Math.max(anchoDe(L), altoDe(L)) * (0.9 + Math.sin(t / 120) * 0.1), color, 0.55 * Math.min(1, q * 5, (1 - q) * 4));
        if (mega) for (let i = 0; i < 3; i++) aro(c.x, c.y, (altoDe(L) * 0.5 + 6) * (1 + 0.15 * Math.sin(t / 150 + i * 2)), 1.6, ARCOIRIS[(Math.floor(t / 120) + i * 2) % ARCOIRIS.length], 0.7 * Math.min(1, q * 5, (1 - q) * 4));
      });
      emitir(1500, () => { // chispas que se juntan en él
        const c = centro(L); const a = Math.random() * Math.PI * 2; const r = entre(34, 70);
        particula({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 2.2, vida: 450, colores: ['#ffffff', colores[Math.floor(Math.random() * colores.length)]], tam: 2, forma: 'estrella', brillo: 3 });
      });
      await animar(L, { blanco: 1 }, 700, 'lineal');
      let intervalo = 330;
      let nueva = false;
      const inicio = ahora();
      while (ahora() - inicio < 2300) { // silueta que alterna, cada vez más deprisa
        nueva = !nueva;
        Object.assign(L, nueva ? forma : antes);
        await pausa(intervalo);
        intervalo = Math.max(45, intervalo * 0.8);
      }
      Object.assign(L, final);
      sonar('evolucionFin');
      destellar('#ffffff', 650, 0.9);
      temblar(4, 300);
      const c = centro(L);
      for (let i = 0; i < 3; i++) efimero(700, q => aro(c.x, c.y, 10 + q * 90, 3 * (1 - q) + 0.5, colores[i % colores.length], 1 - q), { retraso: i * 110 });
      for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2; particula({ x: c.x, y: c.y, vx: Math.cos(a) * entre(60, 200), vy: Math.sin(a) * entre(60, 200), arrastre: 2, vida: 900, colores: ['#ffffff', colores[i % colores.length]], tam: 2.4, forma: 'estrella', brillo: 4 }); }
      await animar(L, { blanco: 0 }, 650, 'lineal');
      L.sx = 1.14; L.sy = 0.88;
      await animar(L, { sx: 1, sy: 1 }, 380, 'rebote');
      L.quieto = true;
    },

    /** Marca (o quita) el estado alterado de un Pokémon, con un golpe de efecto al ponerlo. */
    estado(lado, tipo) {
      const L = luchadores[lado];
      L.estado = tipo;
      if (!tipo || reducido() || !L.visible) return;
      const c = centro(L); const w = anchoDe(L);
      if (tipo === 'quemado') for (let i = 0; i < 18; i++) particula({ x: c.x + entre(-w * 0.4, w * 0.4), y: SUELO - entre(0, altoDe(L) * 0.5), vy: -entre(30, 70), vida: 600, colores: FUEGO, tam: 3, tamFin: 6, brillo: 4, forma: 'humo', alfa: 0.85 });
      if (tipo === 'envenenado') for (let i = 0; i < 14; i++) particula({ x: c.x + entre(-w * 0.4, w * 0.4), y: c.y + entre(-10, 10), vy: -entre(15, 40), vida: 900, colores: ['#e9bdff', '#a65fc7'], tam: 2, tamFin: 4, forma: 'burbuja' });
      if (tipo === 'paralizado') { for (let i = 0; i < 4; i++) { const z = zigzag([c.x + entre(-w * 0.5, w * 0.5), c.y - 20], [c.x + entre(-w * 0.5, w * 0.5), c.y + 20], 8, 3); efimero(240, q => trazo(z, 1.4, '#ffffff', { halo: '#ffd83a', alfa: 1 - q }), { retraso: i * 60 }); } temblar(2, 200); }
      if (tipo === 'congelado') { const puntas = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2, largo: entre(14, 24) })); efimero(700, q => cristales(c.x, c.y, puntas, Math.min(1, q * 4), q > 0.6 ? 1 - (q - 0.6) / 0.4 : 0.95, PALETAS_ATAQUE.ice)); }
      if (tipo === 'dormido') for (let i = 0; i < 3; i++) setTimeout(() => { const k = cabeza(L); textoFlotante('Z', k.x + DIRECCION[lado] * (6 + i * 5), k.y + 4 - i * 4, { tamano: 1.2 + i * 0.3, color: '#cfd8ff', ms: 1600 }); }, i * 250);
    },

    /** No puede moverse este turno (dormido, congelado, paralizado, recargando o amedrentado). */
    async noActua(lado, tipo) {
      const L = luchadores[lado];
      revelar(L); // si estaba escondido (Vuelo, Excavar…), el movimiento se pierde y vuelve a la vista
      if (reducido() || !L.visible) return;
      L.quieto = false;
      if (tipo === 'paralizado') { this.estado(lado, 'paralizado'); await emitir(500, q => { L.ox = Math.sin(q * 70) * 1.5; }); L.ox = 0; }
      else if (tipo === 'dormido') { for (let i = 0; i < 3; i++) setTimeout(() => { const k = cabeza(L); textoFlotante('Z', k.x + DIRECCION[lado] * (6 + i * 5), k.y + 4 - i * 4, { tamano: 1.3 + i * 0.3, color: '#cfd8ff', ms: 1500 }); }, i * 220); await animar(L, { sy: 0.94, sx: 1.04 }, 400).then(() => animar(L, { sy: 1, sx: 1 }, 400)); }
      else if (tipo === 'recarga') { // jadea, con gotas de sudor
        const k = cabeza(L);
        textoFlotante('...', k.x, k.y, { tamano: 1.6, color: '#cfd8ff' });
        for (let i = 0; i < 4; i++) setTimeout(() => particula({ x: k.x + entre(-8, 8), y: k.y + 6, vx: entre(-30, 30), vy: -entre(30, 60), g: 300, vida: 600, colores: ['#ffffff', '#8ad8ff'], tam: 2, forma: 'gota' }), i * 120);
        for (let i = 0; i < 2; i++) { await animar(L, { sy: 0.9, sx: 1.06 }, 260); await animar(L, { sy: 1, sx: 1 }, 260); }
      } else if (tipo === 'amedrentado') { // da un respingo hacia atrás
        const k = cabeza(L);
        textoFlotante('!', k.x, k.y, { tamano: 2.2, color: COLOR_TONO.fuerte });
        await animar(L, { ox: -DIRECCION[lado] * 8, sy: 0.92 }, 90, 'frena');
        await emitir(300, q => { L.ox = -DIRECCION[lado] * 8 + Math.sin(q * 50) * 1.5; });
        await animar(L, { ox: 0, sy: 1 }, 240);
      } else { await emitir(500, q => { L.ox = Math.sin(q * 40) * 0.8; }); L.ox = 0; }
      L.quieto = true;
    },

    /** Pierde vida por su estado (quemado o envenenado) o por el retroceso de su movimiento: un estallido y el número. */
    danioEstado(lado, tipo, danio, color = '#ffffff') {
      const L = luchadores[lado];
      if (!L.visible) return;
      const c = centro(L); const k = cabeza(L);
      (async () => { L.blanco = 0.6; await pausa(90); L.blanco = 0; })();
      if (tipo === 'retroceso') { if (!reducido() && !L.oculto) { impacto(c.x, c.y, PALETAS_ATAQUE.directo, 0.6); reiniciarGolpe(L, 0.5); } }
      else if (!reducido()) for (let i = 0; i < 12; i++) particula({ x: c.x + entre(-12, 12), y: c.y + entre(-12, 12), vy: -entre(20, 60), vx: entre(-30, 30), vida: 600, colores: tipo === 'quemado' ? FUEGO : ['#e9bdff', '#a65fc7'], tam: 2.5, tamFin: 5, forma: tipo === 'quemado' ? 'humo' : 'burbuja', alfa: 0.85 });
      textoFlotante('-' + danio, k.x, k.y - 4, { tamano: 1.5, color });
    },

    /** Rebosa energía (puede evolucionar): chispas de colores a su alrededor. */
    listo(lado, valor) { luchadores[lado].listo = valor; },

    /** Transición de entrada (franjas negras que se abren). Hasta llamarla, el lienzo está en negro. */
    transicion,

    /** K.O.: se tambalea, parpadea, suelta polvo y desaparece. */
    async ko(lado) {
      const L = luchadores[lado];
      posar(entrenadores[lado], 'triste', 1300);
      revelar(L);
      L.cargado = false;
      L.quieto = false;
      await animar(L, { ox: -DIRECCION[lado] * 6, sy: 0.9 }, 200, 'frena');
      L.parpadeo = true;
      await pausa(520);
      L.parpadeo = false;
      polvo(L.x + L.ox, SUELO, 14);
      await animar(L, { alfa: 0, oy: 6, sy: 0.7 }, 300);
      L.visible = false;
    },

    /** Saltitos de victoria (y confeti si ganas tú). */
    async celebrar(lado) {
      const L = luchadores[lado];
      const ganador = entrenadores[lado];
      const perdedor = entrenadores[lado === 'jugador' ? 'rival' : 'jugador'];
      if (ganador) { posar(ganador, 'celebra'); ganador.celebrando = true; setTimeout(() => { ganador.celebrando = false; }, 2400); }
      if (perdedor) posar(perdedor, 'triste');
      if (lado === 'jugador') confeti();
      if (!L.visible) return;
      L.quieto = false;
      for (let i = 0; i < 3; i++) { await animar(L, { oy: -14 }, 220, 'frena'); await animar(L, { oy: 0 }, 200, 'acelera'); polvo(L.x, SUELO, 3); }
      L.quieto = true;
    },

    /** Pose de un entrenador durante `ms` (o hasta otra orden): 'ordena', 'celebra', 'triste'… */
    entrenador(lado, pose, ms = 0) { posar(entrenadores[lado], pose, ms); },

    /** Alto en el mundo de los dos Pokémon (lo usan las pruebas de tamaños). */
    medidas() { return { jugador: Math.round(altoDe(luchadores.jugador)), rival: Math.round(altoDe(luchadores.rival)) }; },

    /** Letrero grande: tono fuerte, ko, inicio, victoria o nulo. */
    anunciar(texto, tono = 'normal') { anuncio = { texto, tono, inicio: ahora(), ms: 1300 }; },

    /** Para el bucle de dibujo (al cerrar la ventana). */
    detener() { detenida = true; activo = false; observador.disconnect(); },

    /** Pausa (o reanuda) el bucle de dibujo sin perder nada: lo usa la muestra de la portada cuando no se ve. */
    pausar(si) {
      if (detenida || si === !activo) return;
      activo = !si;
      if (activo) { anterior = ahora(); requestAnimationFrame(cuadroDeAnimacion); }
    },
  };
}
