// El mapa del modo aventura: un archipiélago en pixel art con las nueve regiones, una isla cada una, unidas por
// la ruta del viaje. Cada isla tiene su paisaje (REGIONES_AVENTURA[…].paisaje: pradera, otoño, trópico, nieve,
// urbe, jardines, islas, colinas y el cráter de Paldea), su estadio y una bandera si ya ganaste su copa; las que
// aún no puedes visitar están apagadas y con niebla. Tu entrenador está de pie en la isla de la copa en curso.
//
// El paisaje se pinta una vez (mundo de 960×400, con semilla fija: siempre sale igual) y en cada fotograma se le
// añade lo que se mueve: destellos y espuma del mar, nubes con su sombra, un barco que hace la ruta, gaviotas,
// las banderas, el brillo de tu isla y tu entrenador respirando. `viajar()` lo hace caminar por la ruta hasta la
// isla siguiente al ganar una copa. Se pausa solo si no se ve (otra vista, otra pestaña o fuera de pantalla).

import { REGIONES_AVENTURA } from './datos.js';
import { lienzoEntrenador, medidasDe } from './entrenador.js';
import { pixel } from './escenarios.js';

const { herramientas, ruido, generador, paleta, tonoDe, umbral, aRgb } = pixel;

export const ANCHO_MAPA = 960;
export const ALTO_MAPA = 400;
/** Tu entrenador (estilo anime, 112 de alto) se dibuja reducido en el mapa: así mide lo que una isla pequeña. */
const ESCALA_MAPA = 0.6;
/** Centro de cada isla (en el orden de las regiones) y su tamaño. */
export const ISLAS = [[86, 258], [190, 158], [292, 266], [394, 164], [496, 270], [598, 164], [700, 264], [800, 160], [890, 256]]
  .map(([x, y], i) => ({ x, y, rx: i === 8 ? 56 : 48, ry: i === 8 ? 38 : 34 }));
/** Dónde se pone el entrenador (los pies) y el estadio en cada isla. */
const pies = i => ({ x: ISLAS[i].x - 14, y: ISLAS[i].y + 10 });
const estadioDe = i => ({ x: ISLAS[i].x + 16, y: ISLAS[i].y - 6 });

const MAR = paleta('#123c74', '#164784', '#1b5394', '#215fa2', '#2a6db0', '#347cbc');
const BAJIO = paleta('#2f8cbc', '#3a9ec8', '#4ab2d2', '#5cc4da');
const ARENA = paleta('#d8c08a', '#e4cf9a', '#efdcac');
const PAISAJES = {
  pradera: { suelo: paleta('#3a8a36', '#469a3e', '#54aa48', '#64b852', '#78c45e'), acantilado: '#5a4028' },
  otono: { suelo: paleta('#8a7a34', '#a08a3a', '#b89440', '#c89a44', '#d6a64c'), acantilado: '#5a3a24' },
  tropico: { suelo: paleta('#2a7a3a', '#348a40', '#3e9a46', '#4aaa4e', '#5cba58'), acantilado: '#4a3a26' },
  nieve: { suelo: paleta('#b8c6dc', '#c8d4e8', '#d8e2f2', '#e6eef8', '#f4f8fe'), acantilado: '#6a7a98' },
  urbe: { suelo: paleta('#5e7a52', '#6a8a5a', '#788e6a', '#8a9a80', '#9aa894'), acantilado: '#4a4a52' },
  jardines: { suelo: paleta('#3e8a44', '#4a9a4c', '#58aa56', '#68b85e', '#7ac468'), acantilado: '#5a4a34' },
  islas: { suelo: paleta('#3a8a3a', '#469a40', '#56aa48', '#66b850', '#7ac45a'), acantilado: '#6a5030' },
  colinas: { suelo: paleta('#3e7a3a', '#4a8a42', '#56984a', '#62a652', '#70b25c'), acantilado: '#4a3e2c' },
  crater: { suelo: paleta('#6a3a3a', '#7a4440', '#8a4e44', '#9a5a4a', '#a86a52'), acantilado: '#3a1e22' },
};
/** Islotes de Alola (desplazamiento y tamaño relativos). */
const ISLOTES = [[-18, -8, 0.56], [18, -6, 0.5], [-4, 14, 0.5], [24, 16, 0.32]];

// --- El paisaje (se pinta una vez por estado) -------------------------------------------------------------

function forma(i, ruidoBorde) {
  const isla = ISLAS[i];
  const paisaje = REGIONES_AVENTURA[i].paisaje;
  return (x, y) => {
    const borde = (ruidoBorde(x * 0.5, y * 0.5) - 0.5) * 0.42;
    if (paisaje === 'islas') {
      return Math.min(...ISLOTES.map(([dx, dy, k]) => Math.hypot((x - isla.x - dx) / (isla.rx * k), (y - isla.y - dy) / (isla.ry * k)) - borde));
    }
    return Math.hypot((x - isla.x) / isla.rx, (y - isla.y) / isla.ry) - borde;
  };
}

/** El mapa quieto: mar, ruta, islas con su paisaje, estadios y banderas. `estado`: { actual, conquistas: Set }. */
function pintarPaisaje(estado) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_MAPA;
  lienzo.height = ALTO_MAPA;
  const ctx = lienzo.getContext('2d');
  const h = herramientas(ctx);
  const azar = generador(20261124);
  const manchas = ruido(azar, 20); const olas = ruido(azar, 9); const bordes = ruido(azar, 14);
  const formas = ISLAS.map((_, i) => forma(i, bordes));
  const imagen = ctx.createImageData(ANCHO_MAPA, ALTO_MAPA);
  const d = imagen.data;
  const tierra = new Int8Array(ANCHO_MAPA * ALTO_MAPA).fill(-1); // qué isla hay en cada píxel
  const mar = new Uint8Array(ANCHO_MAPA * ALTO_MAPA);              // 1 = mar abierto (para los destellos)
  for (let y = 0; y < ALTO_MAPA; y++) for (let x = 0; x < ANCHO_MAPA; x++) {
    let cerca = Infinity; let cual = -1;
    for (let i = 0; i < ISLAS.length; i++) {
      if (Math.abs(x - ISLAS[i].x) > 90 || Math.abs(y - ISLAS[i].y) > 70) continue;
      const v = formas[i](x, y);
      if (v < cerca) { cerca = v; cual = i; }
    }
    let rgb;
    if (cerca < 0.86) { // tierra
      tierra[y * ANCHO_MAPA + x] = cual;
      const { suelo } = PAISAJES[REGIONES_AVENTURA[cual].paisaje];
      let n = manchas(x * 0.5, y * 0.5) * 0.6 + azar() * 0.15 + 0.15;
      n += (ISLAS[cual].y - y) / ISLAS[cual].ry * 0.12 + (ISLAS[cual].x - x) / ISLAS[cual].rx * 0.06; // luz de arriba a la izquierda
      rgb = tonoDe(suelo, n, x, y);
    } else if (cerca < 1) rgb = tonoDe(ARENA, manchas(x * 0.5, y * 0.5) + (azar() - 0.5) * 0.3, x, y);
    else if (cerca < 1.32) rgb = tonoDe(BAJIO, 1 - (cerca - 1) / 0.32 + (olas(x * 0.5, y * 0.5) - 0.5) * 0.4, x, y);
    else {
      mar[y * ANCHO_MAPA + x] = 1;
      let n = olas(x * 0.5, y * 0.5) * 0.5 + manchas(x * 0.5, y * 0.5) * 0.3 + Math.max(0, 1.9 - cerca) * 0.4;
      if (Math.sin(x / 6 + y * 0.8 + olas(x * 0.5, y * 0.5) * 9) > 0.94) n += 0.35; // rizos del oleaje
      rgb = tonoDe(MAR, n, x, y);
    }
    const k = (y * ANCHO_MAPA + x) * 4;
    d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
  }
  // Acantilados: la cara de tierra que asoma por debajo de cada isla (relieve).
  for (let x = 0; x < ANCHO_MAPA; x++) for (let y = ALTO_MAPA - 1; y > 0; y--) {
    const i = tierra[(y - 1) * ANCHO_MAPA + x];
    if (i < 0 || tierra[y * ANCHO_MAPA + x] >= 0) continue;
    const [r, g, b] = aRgb(PAISAJES[REGIONES_AVENTURA[i].paisaje].acantilado);
    for (let k = 0; k < 3 && y + k < ALTO_MAPA; k++) {
      if (tierra[(y + k) * ANCHO_MAPA + x] >= 0) break;
      const q = ((y + k) * ANCHO_MAPA + x) * 4; const f = 1 - k * 0.16;
      d[q] = r * f; d[q + 1] = g * f; d[q + 2] = b * f;
    }
  }
  ctx.putImageData(imagen, 0, 0);
  lienzo.mar = mar;

  // La ruta: trazos de puntos de isla a isla (dorada en lo ya recorrido).
  for (let i = 0; i < ISLAS.length - 1; i++) {
    const hecho = estado.conquistas.has(i);
    tramo(i).forEach(([x, y], k) => { if (k % 4 < 2) { h.rect(x, y, 2, 2, 'rgba(10,30,60,0.35)'); h.rect(x, y - 1, 2, 2, hecho ? '#ffd86a' : '#e8f2ff'); } });
  }

  // Paisaje de cada isla.
  ISLAS.forEach((isla, i) => decorar(h, i, tierra, generador(4100 + i * 97)));

  // Estadios y banderas.
  ISLAS.forEach((_, i) => {
    const [a, b] = REGIONES_AVENTURA[i].colores;
    const { x, y } = estadioDe(i);
    h.elipse(x + 1, y + 2, 12, 6, 'rgba(10,20,30,0.35)');
    h.elipse(x, y, 12, 6, '#1e2436'); h.elipse(x, y - 1, 11, 5, a); h.elipse(x, y - 1, 7, 3, '#3a9a4a'); h.elipse(x - 1, y - 2, 4, 1, '#5ab85e');
    for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; h.punto(x + Math.cos(t) * 9.5, y - 1 + Math.sin(t) * 4, k % 2 ? b : '#ffffff'); }
    for (const [dx, dy] of [[-12, -6], [12, -6], [-12, 3], [12, 3]]) { h.rect(x + dx, y + dy - 4, 1, 5, '#c8ccd8'); h.rect(x + dx - 1, y + dy - 5, 3, 1, '#fff6c8'); }
  });

  // Las islas que aún no puedes visitar: apagadas, como bajo la niebla.
  const bloqueadas = ISLAS.map((_, i) => i).filter(i => i > estado.actual && !estado.conquistas.has(i));
  if (bloqueadas.length) {
    const img = ctx.getImageData(0, 0, ANCHO_MAPA, ALTO_MAPA); const p = img.data;
    for (const i of bloqueadas) {
      const { x: cx, y: cy, rx, ry } = ISLAS[i];
      for (let y = Math.max(0, cy - ry - 16); y < Math.min(ALTO_MAPA, cy + ry + 18); y++) for (let x = Math.max(0, cx - rx - 26); x < Math.min(ANCHO_MAPA, cx + rx + 26); x++) {
        const dd = Math.hypot((x - cx) / (rx + 16), (y - cy) / (ry + 14));
        if (dd > 1) continue;
        const f = 0.55 * Math.min(1, (1 - dd) * 3);
        const q = (y * ANCHO_MAPA + x) * 4; const gris = (p[q] + p[q + 1] + p[q + 2]) / 3;
        p[q] = p[q] + (gris * 0.8 + 40 - p[q]) * f; p[q + 1] = p[q + 1] + (gris * 0.85 + 46 - p[q + 1]) * f; p[q + 2] = p[q + 2] + (gris * 0.9 + 70 - p[q + 2]) * f;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return lienzo;
}

/** Los puntos de la ruta entre la isla i y la siguiente (una curva suave por el mar). */
function tramo(i) {
  const a = ISLAS[i]; const b = ISLAS[i + 1];
  const desde = { x: a.x + 8, y: a.y + (b.y < a.y ? -a.ry * 0.7 : a.ry * 0.7) };
  const hasta = { x: b.x - 8, y: b.y + (b.y < a.y ? b.ry * 0.7 : -b.ry * 0.7) };
  const control = { x: (desde.x + hasta.x) / 2 + 10, y: (desde.y + hasta.y) / 2 };
  const puntos = [];
  const largo = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  for (let k = 0; k <= largo; k++) {
    const q = k / largo;
    puntos.push([Math.round((1 - q) ** 2 * desde.x + 2 * (1 - q) * q * control.x + q * q * hasta.x), Math.round((1 - q) ** 2 * desde.y + 2 * (1 - q) * q * control.y + q * q * hasta.y)]);
  }
  return puntos;
}

/** Árboles, montañas, edificios… según el paisaje de la isla. */
function decorar(h, i, tierra, azar) {
  const isla = ISLAS[i];
  const paisaje = REGIONES_AVENTURA[i].paisaje;
  const esTierra = (x, y) => tierra[Math.round(y) * ANCHO_MAPA + Math.round(x)] === i;
  const libre = (x, y) => esTierra(x, y) && esTierra(x, y + 4) && Math.hypot(x - estadioDe(i).x, (y - estadioDe(i).y) * 1.6) > 17 && Math.hypot(x - pies(i).x, (y - pies(i).y) * 1.4) > 11;
  const sitios = n => {
    const lista = [];
    for (let k = 0; k < n * 12 && lista.length < n; k++) {
      const x = isla.x + (azar() - 0.5) * isla.rx * 1.8; const y = isla.y + (azar() - 0.5) * isla.ry * 1.7;
      if (libre(x, y) && lista.every(([a, b]) => Math.hypot(a - x, b - y) > 6)) lista.push([x, y]);
    }
    return lista.sort((a, b) => a[1] - b[1]);
  };
  const arbol = (x, y, copa, sombra, luz) => {
    h.elipse(x + 1, y + 1, 4, 2, 'rgba(10,30,10,0.35)'); h.rect(x, y - 3, 1, 4, '#4a3220');
    h.elipse(x, y - 6, 4, 4, sombra); h.elipse(x - 1, y - 7, 3, 3, copa); h.punto(x - 2, y - 9, luz);
  };
  const pino = (x, y, nieve) => {
    h.elipse(x + 1, y + 1, 3, 1.5, 'rgba(10,20,40,0.35)');
    h.poligono([[x - 4, y], [x + 4, y], [x, y - 11]], '#1e4a36'); h.poligono([[x - 3, y - 4], [x + 3, y - 4], [x, y - 11]], '#2a5e44');
    if (nieve) { h.punto(x, y - 10, '#ffffff'); h.rect(x - 2, y - 5, 2, 1, '#ffffff'); h.rect(x + 1, y - 1, 2, 1, '#e8f0ff'); }
  };
  const palmera = (x, y) => {
    h.linea(x, y, x + 2, y - 9, '#7a5a34', 1);
    for (const [dx, dy] of [[-4, -1], [4, 0], [-3, -3], [3, -3], [0, -4]]) h.linea(x + 2, y - 9, x + 2 + dx, y - 9 + dy + 1, '#2e8a3a');
  };
  const montana = (x, y, w, alto, roca, nieve) => {
    h.poligono([[x - w, y], [x + w, y], [x, y - alto]], roca);
    h.poligono([[x, y - alto], [x + w, y], [x + w * 0.3, y]], 'rgba(0,0,0,0.22)');
    if (nieve) h.poligono([[x - w * 0.3, y - alto * 0.7], [x + w * 0.3, y - alto * 0.7], [x, y - alto]], '#ffffff');
  };
  const casita = (x, y, tejado) => { h.rect(x - 2, y - 3, 5, 4, '#efe6d6'); h.poligono([[x - 3, y - 3], [x + 3, y - 3], [x, y - 6]], tejado); h.punto(x, y - 1, '#5a3a24'); };
  switch (paisaje) {
    case 'pradera':
      for (const [x, y] of sitios(9)) arbol(x, y, '#3f9a3e', '#1e5a26', '#7ad06a');
      for (const [x, y] of sitios(3)) casita(x, y, '#d8433a');
      for (const [x, y] of sitios(14)) h.punto(x, y, azar() < 0.5 ? '#ffe06a' : '#ffffff');
      break;
    case 'otono':
      for (const [x, y] of sitios(10)) arbol(x, y, ['#e0702a', '#c8402a', '#f0a030'][Math.floor(azar() * 3)], '#7a2a1a', '#ffd06a');
      { const [x, y] = sitios(1)[0] || [isla.x - 20, isla.y - 8]; for (let k = 0; k < 4; k++) { h.rect(x - 4 + k, y - 4 - k * 3, 9 - k * 2, 3, k % 2 ? '#c8402e' : '#a83424'); h.rect(x - 5 + k, y - 5 - k * 3, 11 - k * 2, 1, '#2e3440'); } }
      break;
    case 'tropico':
      montana(isla.x - 16, isla.y - 2, 18, 22, '#6a4a34', false);
      h.elipse(isla.x - 16, isla.y - 23, 4, 1.5, '#ff6a2a'); h.punto(isla.x - 16, isla.y - 24, '#ffd06a');
      for (const [x, y] of sitios(7)) palmera(x, y);
      for (const [x, y] of sitios(5)) arbol(x, y, '#2e9a46', '#155a2a', '#6ad06a');
      break;
    case 'nieve':
      montana(isla.x - 10, isla.y - 4, 20, 30, '#6a7a98', true); montana(isla.x - 30, isla.y + 4, 14, 18, '#7a8aa8', true);
      for (const [x, y] of sitios(10)) pino(x, y, true);
      break;
    case 'urbe':
      for (const [x, y] of sitios(10)) { const alto = 6 + Math.floor(azar() * 14); h.rect(x - 3, y - alto, 6, alto, azar() < 0.5 ? '#4a5470' : '#5a6684'); h.rect(x - 3, y - alto, 1, alto, '#8a96b4'); for (let k = y - alto + 2; k < y - 1; k += 3) { h.punto(x - 1, k, '#ffe08a'); h.punto(x + 1, k, azar() < 0.5 ? '#ffe08a' : '#2a3048'); } }
      h.rect(isla.x + isla.rx - 4, isla.y + 4, 26, 2, '#c8ccd8'); for (let k = 0; k < 26; k += 5) h.rect(isla.x + isla.rx - 4 + k, isla.y + 6, 1, 4, '#8a90a0'); // puente
      break;
    case 'jardines': {
      const [tx, ty] = [isla.x - 18, isla.y - 2]; // una torre muy alta de hierro (inventada)
      h.poligono([[tx - 6, ty], [tx + 6, ty], [tx + 1, ty - 34], [tx - 1, ty - 34]], '#4a5068'); h.poligono([[tx - 3, ty], [tx + 3, ty], [tx, ty - 14]], '#7a9a5a');
      for (let k = 6; k < 30; k += 6) h.rect(tx - 5 + k / 6, ty - k, 10 - k / 3, 1, '#8a90a8');
      h.punto(tx, ty - 35, '#ffd86a');
      for (const [x, y] of sitios(6)) arbol(x, y, '#3a9a46', '#1a5a2a', '#7ad06a');
      for (const [x, y] of sitios(22)) h.punto(x, y, ['#ff8ab8', '#ffe06a', '#ffffff', '#c88aff'][Math.floor(azar() * 4)]);
      break;
    }
    case 'islas':
      for (const [x, y] of sitios(9)) palmera(x, y);
      montana(isla.x - 2, isla.y + 12, 10, 14, '#6a4a34', false);
      for (const [x, y] of sitios(8)) h.punto(x, y, '#ff8ab8');
      break;
    case 'colinas':
      for (let k = 0; k < 5; k++) { const y = isla.y - 18 + k * 9; for (let x = isla.x - isla.rx; x < isla.x + isla.rx; x++) if (esTierra(x, y) && umbral(x, y) < 0.6) h.punto(x, y + Math.round(Math.sin(x / 7 + k) * 1.5), '#2e5a2a'); }
      { const [x, y] = [isla.x - 20, isla.y - 6]; h.rect(x - 8, y - 8, 16, 8, '#8a8a96'); for (let k = 0; k < 16; k += 3) h.rect(x - 8 + k, y - 10, 2, 2, '#8a8a96'); h.rect(x - 2, y - 14, 4, 6, '#9a9aa6'); h.rect(x - 1, y - 17, 1, 3, '#c8ccd8'); h.rect(x, y - 17, 3, 2, '#e0408a'); h.rect(x - 1, y - 4, 2, 4, '#3a3040'); }
      for (const [x, y] of sitios(6)) arbol(x, y, '#3a8a3e', '#1a4a22', '#6ac06a');
      break;
    case 'crater': {
      const [cx, cy] = [isla.x - 6, isla.y + 2];
      h.elipse(cx, cy, 26, 15, '#3a1e2a'); h.elipse(cx, cy + 1, 22, 12, '#24121e'); h.elipse(cx, cy + 3, 14, 7, '#1a0c18');
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const x = cx + Math.cos(a) * 18; const y = cy + Math.sin(a) * 9; h.poligono([[x - 1, y], [x + 2, y], [x + 0.5, y - 4 - (k % 3) * 2]], k % 2 ? '#c88aff' : '#ff6a8a'); }
      for (const [x, y] of sitios(4)) montana(x, y, 5, 8, '#8a4a3a', false);
      break;
    }
    default: break;
  }
}

// --- Lo que se mueve ---------------------------------------------------------------------------------------

function pintarNube(w, azar) {
  const lienzo = document.createElement('canvas'); lienzo.width = w + 8; lienzo.height = Math.ceil(w * 0.5);
  const h = herramientas(lienzo.getContext('2d'));
  for (let k = 0; k < 5; k++) { const x = 4 + w * (0.2 + azar() * 0.6); const r = w * (0.16 + azar() * 0.1); h.elipse(x, w * 0.3, r, r * 0.55, '#c8d8ec'); }
  for (let k = 0; k < 5; k++) { const x = 4 + w * (0.2 + azar() * 0.6); const r = w * (0.14 + azar() * 0.08); h.elipse(x, w * 0.25, r, r * 0.55, '#f4f8fd'); h.elipse(x - r * 0.2, w * 0.22, r * 0.5, r * 0.25, '#ffffff'); }
  return lienzo;
}

/**
 * Crea el mapa en un <canvas>. `alPulsar(i)`: al pulsar una isla (el lienzo no es un botón; la vista pone
 * botones encima, uno por región, para el teclado y los lectores de pantalla).
 */
export function crearMapa(lienzo) {
  const ctx = lienzo.getContext('2d');
  const mundo = document.createElement('canvas'); mundo.width = ANCHO_MAPA; mundo.height = ALTO_MAPA;
  const m = mundo.getContext('2d');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const azar = Math.random;
  let estado = { actual: 0, conquistas: new Set(), aspecto: null, seleccion: null, claveFondo: '' };
  let fondo = null;
  let viaje = null;       // { desde, hasta, inicio, duracion, listo }
  let fiesta = 0;         // hasta cuándo celebra el entrenador (fuegos)
  let pausado = false;
  let reloj = 0;
  const nubes = [[120, 92, 60], [420, 78, 70], [720, 96, 54], [300, 350, 64], [860, 342, 58]].map(([x, y, w]) => ({ x, y, w, v: 3 + azar() * 4, lienzo: pintarNube(w, azar) }));
  const destellos = [];

  function medir() {
    const r = lienzo.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)); const hh = Math.max(1, Math.round(r.height * dpr));
    if (lienzo.width !== w || lienzo.height !== hh) { lienzo.width = w; lienzo.height = hh; }
  }
  const observador = new ResizeObserver(() => { medir(); dibujar(performance.now()); });
  observador.observe(lienzo);

  function posicionViaje(t) {
    const { desde, hasta, inicio, duracion } = viaje;
    const q = Math.min(1, (t - inicio) / duracion);
    const ruta = [[pies(desde).x, pies(desde).y], ...tramo(desde).filter((_, k) => k % 3 === 0), [pies(hasta).x, pies(hasta).y]];
    const pos = q * (ruta.length - 1); const k = Math.floor(pos); const f = pos - k;
    const [ax, ay] = ruta[k]; const [bx, by] = ruta[Math.min(ruta.length - 1, k + 1)];
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, q, mira: bx >= ax ? 1 : -1 };
  }

  function dibujarEntrenador(t) {
    if (!estado.aspecto) return;
    let x; let y; let pose = 'quieto'; let paso = 0; let mira = 1; let dy = 0;
    if (viaje) {
      const v = posicionViaje(t);
      ({ x, y, mira } = v);
      pose = 'paso'; paso = Math.floor(t / 140) % 2;
      if (v.q >= 1) { const listo = viaje.listo; viaje = null; listo(); }
    } else {
      ({ x, y } = pies(estado.actual));
      if (t < fiesta) { pose = 'celebra'; dy = -Math.abs(Math.sin(t / 150)) * 4; } else if (!reducido.matches) dy = Math.floor(t / 700) % 2 ? -1 : 0;
    }
    m.globalAlpha = 0.35; m.fillStyle = '#0a1420';
    m.beginPath(); m.ellipse(x, y + 1, 8, 2.5, 0, 0, Math.PI * 2); m.fill(); m.globalAlpha = 1;
    const sprite = lienzoEntrenador(estado.aspecto, pose, paso);
    const medidas = medidasDe(estado.aspecto);
    const escala = medidas.unidad === 1 ? 1 : ESCALA_MAPA; // el tuyo (estilo anime) es más grande: se reduce
    m.save();
    m.translate(Math.round(x), Math.round(y + dy - (medidas.pies + 1) * escala));
    if (mira < 0) m.scale(-1, 1);
    m.imageSmoothingEnabled = escala !== 1;
    m.drawImage(sprite, -medidas.ancho * escala / 2, 0, medidas.ancho * escala, medidas.alto * escala);
    m.restore();
    const cabeza = (medidas.pies - (medidas.unidad === 1 ? 70 : 104)) * escala; // la flecha, encima de la cabeza
    if (!viaje && t >= fiesta) { // flecha que señala «estás aquí»
      const fy = Math.round(y - (medidas.pies + 1) * escala + cabeza) - 10 + (reducido.matches ? 0 : Math.round(Math.sin(t / 250) * 2));
      m.fillStyle = '#1b1622'; m.fillRect(Math.round(x) - 4, fy - 1, 9, 2); m.fillRect(Math.round(x) - 3, fy + 1, 7, 2); m.fillRect(Math.round(x) - 2, fy + 3, 5, 2); m.fillRect(Math.round(x) - 1, fy + 5, 3, 1);
      m.fillStyle = '#ffd86a'; m.fillRect(Math.round(x) - 3, fy, 7, 1); m.fillRect(Math.round(x) - 2, fy + 1, 5, 2); m.fillRect(Math.round(x) - 1, fy + 3, 3, 2);
    }
  }

  function dibujar(t) {
    if (!fondo) return;
    m.drawImage(fondo, 0, 0);
    const mover = !reducido.matches;
    // Destellos del mar.
    if (mover && azar() < 0.5) destellos.push({ x: Math.floor(azar() * ANCHO_MAPA), y: Math.floor(azar() * ALTO_MAPA), nacio: t });
    for (let k = destellos.length - 1; k >= 0; k--) {
      const s = destellos[k]; const edad = (t - s.nacio) / 900;
      if (edad > 1) { destellos.splice(k, 1); continue; }
      if (fondo.mar[s.y * ANCHO_MAPA + s.x]) { // solo sobre el mar abierto
        m.globalAlpha = Math.sin(edad * Math.PI); m.fillStyle = '#e8f6ff'; m.fillRect(s.x, s.y, 2, 1); m.globalAlpha = 1; }
    }
    // Espuma que late alrededor de las islas.
    ISLAS.forEach((isla, i) => {
      const fase = Math.sin(t / 900 + i * 1.3);
      m.globalAlpha = 0.18 + fase * 0.08; m.strokeStyle = '#ffffff'; m.lineWidth = 1;
      m.beginPath(); m.ellipse(isla.x, isla.y + 2, isla.rx * (1.12 + fase * 0.03), isla.ry * (1.12 + fase * 0.03), 0, 0, Math.PI * 2); m.stroke(); m.globalAlpha = 1;
    });
    // El brillo de tu isla.
    const { x: ax, y: ay, rx, ry } = ISLAS[estado.actual];
    const pulso = 0.5 + Math.sin(t / 600) * 0.5;
    const [ca] = REGIONES_AVENTURA[estado.actual].colores;
    m.globalAlpha = 0.25 + pulso * 0.25; m.strokeStyle = ca; m.lineWidth = 2;
    m.beginPath(); m.ellipse(ax, ay + 2, rx * 1.28 + pulso * 3, ry * 1.28 + pulso * 2, 0, 0, Math.PI * 2); m.stroke(); m.globalAlpha = 1;
    if (estado.seleccion != null && estado.seleccion !== estado.actual) {
      const s = ISLAS[estado.seleccion];
      m.setLineDash([3, 3]); m.strokeStyle = '#ffffff'; m.globalAlpha = 0.8; m.lineWidth = 1;
      m.beginPath(); m.ellipse(s.x, s.y + 2, s.rx * 1.3, s.ry * 1.3, 0, 0, Math.PI * 2); m.stroke(); m.setLineDash([]); m.globalAlpha = 1;
    }
    // Banderas (ondean) en las copas ganadas y luz en los focos de los estadios.
    ISLAS.forEach((_, i) => {
      const { x, y } = estadioDe(i);
      if (estado.conquistas.has(i)) {
        const [a, b] = REGIONES_AVENTURA[i].colores; const ola = mover ? Math.floor(t / 220 + i) % 2 : 0;
        m.fillStyle = '#e8e8ee'; m.fillRect(x - 1, y - 22, 1, 16);
        m.fillStyle = a; m.fillRect(x, y - 22 + ola, 7, 2); m.fillStyle = b; m.fillRect(x, y - 20 + ola, 7, 2);
        m.fillStyle = '#ffd86a'; m.fillRect(x - 2, y - 24, 3, 2);
      }
      if (i === estado.actual && mover) { m.globalAlpha = 0.35 + pulso * 0.3; m.fillStyle = '#fff6c8'; for (const [dx, dy] of [[-12, -11], [12, -11]]) m.fillRect(x + dx - 1, y + dy, 3, 1); m.globalAlpha = 1; }
    });
    // Cráter de Paldea: un brillo violeta que respira.
    { const c = ISLAS[8]; m.globalAlpha = 0.18 + Math.sin(t / 700) * 0.1; m.fillStyle = '#c86aff'; m.beginPath(); m.ellipse(c.x - 6, c.y + 3, 12, 6, 0, 0, Math.PI * 2); m.fill(); m.globalAlpha = 1; }
    // Un barco que hace la ruta de punta a punta.
    if (mover) {
      const vuelta = (t / 60000) % 2; const q = vuelta < 1 ? vuelta : 2 - vuelta;
      const tramoN = Math.min(ISLAS.length - 2, Math.floor(q * (ISLAS.length - 1)));
      const ruta = tramo(tramoN); const p = ruta[Math.floor((q * (ISLAS.length - 1) - tramoN) * (ruta.length - 1))] || ruta[0];
      const [bx, by] = [p[0] + 6, p[1] + 10];
      m.fillStyle = 'rgba(255,255,255,0.5)'; m.fillRect(bx - (vuelta < 1 ? 9 : -6), by + 2, 4, 1);
      m.fillStyle = '#5a3a24'; m.fillRect(bx - 4, by, 9, 2); m.fillRect(bx - 3, by + 2, 7, 1);
      m.fillStyle = '#ffffff'; m.fillRect(bx, by - 6, 1, 6); m.fillRect(bx + 1, by - 5, 3, 4); m.fillStyle = '#e04848'; m.fillRect(bx, by - 7, 2, 1);
    }
    // Tu entrenador.
    dibujarEntrenador(t);
    // Fuegos artificiales al ganar una copa.
    if (t < fiesta && mover) for (let k = 0; k < 3; k++) {
      const q = ((t / 900) + k / 3) % 1; const { x, y } = estadioDe(estado.actual);
      const fx = x - 10 + k * 14; const fy = y - 50 - k * 6;
      for (let r = 0; r < 8; r++) { const a = (r / 8) * Math.PI * 2; m.fillStyle = ['#ffd86a', '#ff6a8a', '#6ae0ff'][k]; m.globalAlpha = 1 - q; m.fillRect(Math.round(fx + Math.cos(a) * q * 14), Math.round(fy + Math.sin(a) * q * 14), 2, 2); }
      m.globalAlpha = 1;
    }
    // Nubes con su sombra en el mar, y gaviotas.
    for (const n of nubes) {
      const x = mover ? ((n.x + (t / 1000) * n.v) % (ANCHO_MAPA + n.w * 2)) - n.w : n.x;
      m.globalAlpha = 0.16; m.fillStyle = '#06142a'; m.beginPath(); m.ellipse(x + n.w / 2 + 14, n.y + n.w * 0.5, n.w * 0.42, n.w * 0.13, 0, 0, Math.PI * 2); m.fill();
      m.globalAlpha = 0.9; m.drawImage(n.lienzo, Math.round(x), Math.round(n.y)); m.globalAlpha = 1;
    }
    if (mover) {
      const f = (t % 24000) / 24000;
      for (let k = 0; k < 4; k++) {
        const x = -20 + f * (ANCHO_MAPA + 40) + Math.abs(k - 1.5) * -8; const y = 90 + Math.sin(f * 12) * 8 + Math.abs(k - 1.5) * 5;
        const ala = Math.floor(t / 180 + k) % 2;
        m.fillStyle = '#f4f8ff'; m.fillRect(Math.round(x), Math.round(y), 1, 1); m.fillRect(Math.round(x) - 2, Math.round(y) - ala, 2, 1); m.fillRect(Math.round(x) + 1, Math.round(y) - ala, 2, 1);
      }
    }
    // Al lienzo visible, ampliado sin suavizar.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mundo, 0, 0, lienzo.width, lienzo.height);
  }

  function bucle(t) {
    reloj = 0;
    if (pausado) return;
    dibujar(t);
    reloj = requestAnimationFrame(bucle);
  }
  const arrancar = () => { if (!reloj && !pausado) reloj = requestAnimationFrame(bucle); };

  return {
    /** Cambia lo que se ve: región en curso, copas ganadas, aspecto del entrenador y región señalada. */
    pintar({ actual, conquistas, aspecto, seleccion = null }) {
      const clave = actual + '|' + [...conquistas].sort().join(',');
      estado = { ...estado, actual: viaje ? estado.actual : actual, conquistas: new Set(conquistas), aspecto, seleccion };
      if (clave !== estado.claveFondo) { fondo = pintarPaisaje({ actual, conquistas: new Set(conquistas) }); estado.claveFondo = clave; }
      medir();
      dibujar(performance.now());
      arrancar();
    },
    /** Camina por la ruta de la isla `desde` a la `hasta` (devuelve una promesa que se cumple al llegar). */
    viajar(desde, hasta) {
      if (reducido.matches || desde === hasta) return Promise.resolve();
      return new Promise(listo => {
        estado.actual = desde;
        viaje = { desde, hasta, inicio: performance.now(), duracion: 2600, listo: () => { estado.actual = hasta; listo(); } };
        arrancar();
      });
    },
    celebrar(ms = 4200) { fiesta = performance.now() + ms; arrancar(); },
    pausar(si) { pausado = si; if (!si) arrancar(); else if (reloj) { cancelAnimationFrame(reloj); reloj = 0; } },
  };
}
