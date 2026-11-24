// Sprites de los ataques en pixel art de la era GBA (16 bits, el estilo de los juegos de Rubí, Zafiro y Esmeralda).
// Para cada tipo se pinta, píxel a píxel y con semilla fija, una TIRA de 5 fotogramas de 48×48 (240×48):
//   0 carga (chispa inicial) · 1 proyectil o formación · 2 impacto máximo · 3 expansión con partículas · 4 dispersión.
// Reglas (las pidió el usuario): sin suavizado ni transparencias parciales (alfa 0 o 255); un contorno exterior grueso
// y muy oscuro; el núcleo blanco (o muy pálido) rodeado de 2–3 tonos saturados hacia el borde; píxeles sueltos
// alrededor (chispas, gotas, fragmentos). Las paletas de fuego, agua, eléctrico, planta y fantasma son las exactas
// que pidió; las de los demás tipos siguen la misma estructura: [borde, tonos de fuera hacia dentro…, núcleo].
//
// Cómo se pinta: cada forma suma «intensidad» (0–1) en un campo de 48×48 (bolas, lenguas de fuego, rayos en zigzag,
// hojas, cristales, rocas, estrellas, anillos, medias lunas); el campo se cuantiza a los tonos de la paleta y luego se
// rodea de contorno (8 vecinos y un píxel más por debajo, para que pese). arena-pixel.js los usa en TODOS los
// movimientos (carga → viaje → impacto), del tipo de cada uno.

export const LADO_SPRITE = 48;
export const FOTOGRAMAS = 5;

/** [borde, tonos…, núcleo] */
export const PALETAS_GBA = {
  fire: ['#5a0000', '#d81800', '#ff7800', '#ffe800', '#ffffff'],
  water: ['#001848', '#0058d8', '#18b8ff', '#98f0ff', '#ffffff'],
  electric: ['#482800', '#d89000', '#fff018', '#ffffff'],
  grass: ['#083008', '#188818', '#78e818', '#e8ffb8'],
  ghost: ['#180028', '#581088', '#c838e8', '#f8b8ff'],
  ice: ['#002848', '#1878c8', '#78d0f8', '#c8f8ff', '#ffffff'],
  dragon: ['#100840', '#4020c0', '#7858f8', '#b8a8ff', '#ffffff'],
  dark: ['#000000', '#2a1018', '#702030', '#e04858', '#ffd0d8'],
  poison: ['#280020', '#801878', '#d040b0', '#ff98e8', '#ffffff'],
  bug: ['#203000', '#689000', '#a8d818', '#e8ff90'],
  rock: ['#281800', '#785830', '#b89058', '#e8d0a0'],
  ground: ['#301800', '#986020', '#d8a048', '#f8e0a0'],
  fighting: ['#480800', '#c03000', '#ff8030', '#ffd8a0', '#ffffff'],
  normal: ['#303030', '#909090', '#d0d0d0', '#ffffff'],
  flying: ['#183058', '#5888c8', '#a8d0f8', '#ffffff'],
  psychic: ['#480028', '#c01870', '#ff60b0', '#ffc8e8', '#ffffff'],
  steel: ['#202830', '#607080', '#a8b8c8', '#e8f0f8', '#ffffff'],
  fairy: ['#500838', '#d84898', '#ff98d0', '#ffe0f0', '#ffffff'],
};
/** La forma de los efectos de cada tipo. */
const FORMA = {
  fire: 'llama', dragon: 'llama', water: 'agua', poison: 'burbujas', electric: 'rayo', grass: 'hojas', bug: 'hojas',
  ghost: 'sombra', dark: 'sombra', ice: 'cristal', steel: 'cristal', rock: 'rocas', ground: 'rocas',
  fighting: 'estrella', normal: 'estrella', fairy: 'destellos', psychic: 'ondas', flying: 'viento',
};

const N = LADO_SPRITE;
const C = N / 2;

/** Números al azar repetibles (mulberry32). */
function generador(semilla) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Primitivas: suman intensidad en el campo F (se queda el máximo) ------------------------------------------
function poner(F, x, y, v) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = y * N + x;
  if (v > F[i]) F[i] = v;
}
/** Bola: más intensa en el centro. `borde` (0–1) es la intensidad que le queda en el filo. */
function bola(F, cx, cy, r, v = 1, borde = 0.25) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const d = Math.hypot(x - cx, y - cy) / r;
    if (d <= 1) poner(F, x, y, v * (borde + (1 - borde) * (1 - d * d)));
  }
}
/** Lengua: un trazo que adelgaza de r0 a r1 (llamas, chorros, rayos de luz). */
function lengua(F, x0, y0, x1, y1, r0, r1, v = 1) {
  const largo = Math.hypot(x1 - x0, y1 - y0) || 1;
  for (let k = 0; k <= largo * 2; k++) {
    const q = k / (largo * 2);
    bola(F, x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, Math.max(0.6, r0 + (r1 - r0) * q), v * (1 - q * 0.45), 0.3);
  }
}
/** Rayo en zigzag (eléctrico). */
function zigzag(F, x0, y0, x1, y1, ancho, v, azar, quiebros = 4) {
  const puntos = [[x0, y0]];
  for (let k = 1; k < quiebros; k++) {
    const q = k / quiebros; const nx = -(y1 - y0); const ny = x1 - x0; const l = Math.hypot(nx, ny) || 1;
    const d = (azar() - 0.5) * 10;
    puntos.push([x0 + (x1 - x0) * q + (nx / l) * d, y0 + (y1 - y0) * q + (ny / l) * d]);
  }
  puntos.push([x1, y1]);
  for (let k = 1; k < puntos.length; k++) lengua(F, puntos[k - 1][0], puntos[k - 1][1], puntos[k][0], puntos[k][1], ancho * (1 - (k - 1) / puntos.length * 0.5), ancho * (1 - k / puntos.length * 0.5), v);
}
/** Forma alargada y puntiaguda (hoja con su nervio, o cristal) centrada en (cx, cy), girada `a`. */
function huso(F, cx, cy, largo, ancho, a, v = 1) {
  const ca = Math.cos(a); const sa = Math.sin(a);
  const r = Math.max(largo, ancho) + 1;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const u = ((x - cx) * ca + (y - cy) * sa) / largo; const w = (-(x - cx) * sa + (y - cy) * ca) / ancho;
    const perfil = 1 - u * u; // más ancho en medio, en punta en los extremos
    if (Math.abs(u) <= 1 && Math.abs(w) <= perfil) poner(F, x, y, v * (0.35 + 0.65 * (1 - Math.abs(w) / Math.max(0.01, perfil))));
  }
}
/** Roca angulosa (rombo deformado). */
function roca(F, cx, cy, r, a, v = 1, azar = Math.random) {
  const ca = Math.cos(a); const sa = Math.sin(a); const k = 0.7 + azar() * 0.5;
  for (let y = Math.floor(cy - r * 1.5); y <= Math.ceil(cy + r * 1.5); y++) for (let x = Math.floor(cx - r * 1.5); x <= Math.ceil(cx + r * 1.5); x++) {
    const u = ((x - cx) * ca + (y - cy) * sa) / r; const w = (-(x - cx) * sa + (y - cy) * ca) / (r * k);
    const d = Math.max(Math.abs(u) * 0.8 + Math.abs(w) * 0.45, Math.abs(w) * 0.9 + Math.abs(u) * 0.3);
    if (d <= 1) poner(F, x, y, v * (0.3 + 0.7 * (1 - d)) * (u < 0 && w < 0 ? 1 : 0.8)); // cara iluminada arriba a la izquierda
  }
}
/** Estrella de `puntas` puntas (el «¡pum!» de los golpes). */
function estrella(F, cx, cy, rIn, rOut, puntas, giro = 0, v = 1) {
  for (let y = Math.floor(cy - rOut); y <= Math.ceil(cy + rOut); y++) for (let x = Math.floor(cx - rOut); x <= Math.ceil(cx + rOut); x++) {
    const a = Math.atan2(y - cy, x - cx) - giro; const d = Math.hypot(x - cx, y - cy);
    const radio = rIn + (rOut - rIn) * Math.pow(Math.abs(Math.cos((a * puntas) / 2)), 3);
    if (d <= radio) poner(F, x, y, v * (0.3 + 0.7 * (1 - d / radio)));
  }
}
/** Anillo (ondas psíquicas, burbujas). */
function anillo(F, cx, cy, r, grosor, v = 1, desde = 0, hasta = Math.PI * 2) {
  for (let y = Math.floor(cy - r - grosor); y <= Math.ceil(cy + r + grosor); y++) for (let x = Math.floor(cx - r - grosor); x <= Math.ceil(cx + r + grosor); x++) {
    const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
    let a = Math.atan2(y - cy, x - cx); if (a < 0) a += Math.PI * 2;
    if (d <= grosor && a >= desde && a <= hasta) poner(F, x, y, v * (0.35 + 0.65 * (1 - d / grosor)));
  }
}
/** Media luna (cortes de viento). */
function medialuna(F, cx, cy, r, a, grosor, v = 1) {
  const ox = Math.cos(a) * grosor; const oy = Math.sin(a) * grosor;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const d1 = Math.hypot(x - cx, y - cy); const d2 = Math.hypot(x - cx + ox, y - cy + oy);
    if (d1 <= r && d2 > r) poner(F, x, y, v * (0.3 + 0.7 * Math.min(1, (d2 - r) / grosor)));
  }
}
/** Destello de cuatro puntas (hada, cristales, chispas). */
function destello(F, cx, cy, r, v = 1) {
  lengua(F, cx - r, cy, cx + r, cy, 0.8, 0.8, v); lengua(F, cx, cy - r, cx, cy + r, 0.8, 0.8, v);
  bola(F, cx, cy, Math.max(1, r * 0.35), v, 0.8);
}
/** Píxeles sueltos alrededor (chispas, gotas, fragmentos): cuadraditos de 1 o 2 píxeles. */
function sueltos(F, cuantos, rMin, rMax, azar, v = 0.85, cx = C, cy = C) {
  for (let k = 0; k < cuantos; k++) {
    const a = azar() * Math.PI * 2; const r = rMin + azar() * (rMax - rMin);
    const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r;
    poner(F, x, y, v); if (azar() < 0.5) { poner(F, x + 1, y, v); poner(F, x, y + 1, v); poner(F, x + 1, y + 1, v * 0.9); }
  }
}
/** Ruido suave (para que los bordes de las llamas y las sombras no sean círculos perfectos). */
function ruido(semilla) {
  const azar = generador(semilla); const celda = 6; const n = Math.ceil(N / celda) + 2;
  const valores = Array.from({ length: n * n }, azar);
  return (x, y) => {
    const gx = x / celda; const gy = y / celda; const i = Math.floor(gx); const j = Math.floor(gy);
    const fx = gx - i; const fy = gy - j; const v = (a, b) => valores[Math.max(0, Math.min(n - 1, b)) * n + Math.max(0, Math.min(n - 1, a))];
    const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
    return (v(i, j) * (1 - sx) + v(i + 1, j) * sx) * (1 - sy) + (v(i, j + 1) * (1 - sx) + v(i + 1, j + 1) * sx) * sy;
  };
}
/** Borde irregular: rebaja el campo con ruido (las llamas y las sombras lamen hacia fuera). */
function deshilachar(F, n, fuerza = 0.5) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (F[i]) F[i] *= 1 - fuerza + fuerza * 2 * n(x, y) * 0.9; }
}

// --- Cada forma, fotograma a fotograma (mirando a la derecha) --------------------------------------------------
const FORMAS = {
  llama(F, f, azar, n) {
    if (f === 0) { bola(F, C, C + 4, 6, 0.95); for (let k = 0; k < 3; k++) lengua(F, C - 3 + k * 3, C + 2, C - 4 + k * 4 + (azar() - 0.5) * 4, C - 8 - azar() * 4, 3, 0.5, 0.8); sueltos(F, 5, 9, 14, azar); }
    if (f === 1) { bola(F, C + 5, C, 11, 1, 0.3); lengua(F, C + 2, C - 2, C - 18, C - 6, 8, 1, 0.75); lengua(F, C + 2, C + 3, C - 16, C + 7, 7, 1, 0.7); lengua(F, C, C, C - 21, C + 1, 5, 0.5, 0.6); deshilachar(F, n, 0.45); sueltos(F, 6, 14, 22, azar, 0.7, C - 6); }
    if (f === 2) { bola(F, C, C, 17, 1, 0.35); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + azar() * 0.3; const l = 19 + azar() * 4 + (Math.sin(a) < 0 ? 3 : 0); lengua(F, C, C, C + Math.cos(a) * l, C + Math.sin(a) * l - 2, 6, 0.6, 0.85); } deshilachar(F, n, 0.35); sueltos(F, 10, 20, 23, azar); }
    if (f === 3) { anillo(F, C, C, 15, 5, 0.75); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.3; lengua(F, C + Math.cos(a) * 14, C + Math.sin(a) * 14, C + Math.cos(a) * 22, C + Math.sin(a) * 22 - 3, 4, 0.5, 0.85); } bola(F, C, C, 6, 0.55); deshilachar(F, n, 0.4); sueltos(F, 14, 8, 23, azar, 0.9); }
    if (f === 4) { for (let k = 0; k < 7; k++) { const a = azar() * Math.PI * 2; const r = 10 + azar() * 11; bola(F, C + Math.cos(a) * r, C + Math.sin(a) * r - 3, 2 + azar() * 1.5, 0.8); } sueltos(F, 10, 6, 22, azar, 0.6); }
  },
  agua(F, f, azar, n, { burbujas = false } = {}) {
    const gota = (x, y, r, v = 1) => { bola(F, x, y, r, v); lengua(F, x, y, x, y - r * 1.8, r * 0.8, 0.4, v * 0.9); };
    const burbuja = (x, y, r, v = 1) => { anillo(F, x, y, r, Math.max(1.2, r * 0.35), v); poner(F, x - r * 0.4, y - r * 0.4, 1); };
    const pieza = burbujas ? burbuja : gota;
    if (f === 0) { bola(F, C, C, 5, 0.95); for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.6; pieza(C + Math.cos(a) * 11, C + Math.sin(a) * 11, 2.4, 0.85); } }
    if (f === 1) { bola(F, C + 6, C, 10, 1, 0.3); lengua(F, C + 2, C, C - 20, C - 3, 7, 1.5, 0.7); lengua(F, C, C + 4, C - 17, C + 8, 5, 1, 0.6); for (let k = 0; k < 4; k++) pieza(C - 8 - k * 4, C - 9 + azar() * 18, 1.8, 0.8); }
    if (f === 2) {
      bola(F, C, C + 3, 14, 1, 0.3);
      for (let k = 0; k < 9; k++) { const a = Math.PI + (k / 8) * Math.PI; const l = 17 + azar() * 5; lengua(F, C, C, C + Math.cos(a) * l, C + Math.sin(a) * l, 4, 1.6, 0.85); pieza(C + Math.cos(a) * (l + 2), C + Math.sin(a) * (l + 2), 2, 0.9); }
      anillo(F, C, C + 12, 16, 2.5, 0.7, 0, Math.PI);
      if (burbujas) for (let k = 0; k < 5; k++) burbuja(C - 14 + k * 7, C + 8 - azar() * 18, 2.5 + azar() * 2, 0.9);
    }
    if (f === 3) { for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pieza(C + Math.cos(a) * 18, C + Math.sin(a) * 15, 2.6, 0.9); } bola(F, C, C, 7, 0.6); anillo(F, C, C, 12, 2, 0.6); sueltos(F, 8, 6, 22, azar, 0.8); }
    if (f === 4) { for (let k = 0; k < 7; k++) pieza(C - 18 + azar() * 36, C - 4 + azar() * 22, 1.8 + azar(), 0.75); sueltos(F, 6, 8, 22, azar, 0.6); }
  },
  rayo(F, f, azar) {
    if (f === 0) { bola(F, C, C, 4, 1, 0.6); for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; zigzag(F, C, C, C + Math.cos(a) * 11, C + Math.sin(a) * 11, 1.6, 0.9, azar, 2); } sueltos(F, 6, 12, 18, azar); }
    if (f === 1) { bola(F, C + 4, C, 8, 1, 0.4); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + azar(); zigzag(F, C + 4, C, C + 4 + Math.cos(a) * 18, C + Math.sin(a) * 16, 2, 0.9, azar, 3); } zigzag(F, C - 2, C, C - 21, C + 2, 2.2, 0.8, azar, 4); sueltos(F, 8, 14, 22, azar); }
    if (f === 2) { bola(F, C, C, 11, 1, 0.45); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + azar() * 0.4; zigzag(F, C, C, C + Math.cos(a) * 23, C + Math.sin(a) * 23, 2.8, 0.95, azar, 4); } sueltos(F, 10, 16, 23, azar, 1); }
    if (f === 3) { for (let k = 0; k < 7; k++) { const a = azar() * Math.PI * 2; const r = 9 + azar() * 8; zigzag(F, C + Math.cos(a) * r, C + Math.sin(a) * r, C + Math.cos(a) * (r + 10), C + Math.sin(a) * (r + 10), 1.6, 0.9, azar, 3); } bola(F, C, C, 4, 0.8); sueltos(F, 14, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 6; k++) { const a = azar() * Math.PI * 2; const r = 8 + azar() * 13; destello(F, C + Math.cos(a) * r, C + Math.sin(a) * r, 2, 0.9); } }
  },
  hojas(F, f, azar) {
    const hoja = (x, y, l, a, v = 1) => { huso(F, x, y, l, l * 0.45, a, v); lengua(F, x - Math.cos(a) * l * 0.8, y - Math.sin(a) * l * 0.8, x + Math.cos(a) * l * 0.8, y + Math.sin(a) * l * 0.8, 0.5, 0.5, v); };
    if (f === 0) { hoja(C, C, 6, -0.6); sueltos(F, 5, 9, 14, azar); }
    if (f === 1) { for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; hoja(C + 2 + Math.cos(a) * 9, C + Math.sin(a) * 9, 7, a + 1.2); } sueltos(F, 6, 14, 20, azar); }
    if (f === 2) { estrella(F, C, C, 6, 15, 8, 0.2, 1); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; hoja(C + Math.cos(a) * 16, C + Math.sin(a) * 16, 6.5, a); } sueltos(F, 10, 18, 23, azar); }
    if (f === 3) { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + azar() * 0.4; hoja(C + Math.cos(a) * 18, C + Math.sin(a) * 17, 5, a + azar()); } bola(F, C, C, 4, 0.6); sueltos(F, 12, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 4; k++) hoja(C - 16 + k * 10 + azar() * 4, C + 2 + azar() * 16, 3.5, azar() * 3); sueltos(F, 6, 8, 22, azar, 0.6); }
  },
  sombra(F, f, azar, n) {
    const hebra = (x, y, a, l, v = 0.85) => { const mx = x + Math.cos(a) * l * 0.55; const my = y + Math.sin(a) * l * 0.55; const b = a + 0.9; lengua(F, x, y, mx, my, 3.5, 2.2, v); lengua(F, mx, my, mx + Math.cos(b) * l * 0.5, my + Math.sin(b) * l * 0.5, 2.2, 0.6, v); };
    if (f === 0) { bola(F, C, C, 6, 0.95, 0.3); for (let k = 0; k < 3; k++) hebra(C, C, (k / 3) * Math.PI * 2, 10, 0.7); deshilachar(F, n, 0.3); }
    if (f === 1) { bola(F, C + 3, C, 12, 1, 0.3); for (let k = 0; k < 5; k++) hebra(C + 3, C, (k / 5) * Math.PI * 2 + 0.4, 18, 0.75); deshilachar(F, n, 0.45); sueltos(F, 6, 16, 22, azar, 0.7); }
    if (f === 2) { bola(F, C, C, 17, 1, 0.3); for (let k = 0; k < 8; k++) hebra(C, C, (k / 8) * Math.PI * 2, 23, 0.8); deshilachar(F, n, 0.4); sueltos(F, 10, 19, 23, azar); }
    if (f === 3) { anillo(F, C, C, 16, 4.5, 0.8); for (let k = 0; k < 6; k++) hebra(C + Math.cos(k) * 14, C + Math.sin(k) * 14, k + 0.6, 10, 0.75); bola(F, C, C, 5, 0.5); deshilachar(F, n, 0.5); sueltos(F, 12, 8, 23, azar, 0.8); }
    if (f === 4) { for (let k = 0; k < 5; k++) { const a = azar() * Math.PI * 2; hebra(C + Math.cos(a) * 12, C + Math.sin(a) * 12, a, 9, 0.6); } sueltos(F, 8, 6, 22, azar, 0.6); }
  },
  cristal(F, f, azar) {
    const esquirla = (x, y, l, a, v = 1) => huso(F, x, y, l, Math.max(1.6, l * 0.28), a, v);
    if (f === 0) { for (let k = 0; k < 4; k++) esquirla(C + Math.cos(k * Math.PI / 2) * 4, C + Math.sin(k * Math.PI / 2) * 4, 5, k * Math.PI / 2); destello(F, C, C, 3, 1); sueltos(F, 4, 10, 14, azar); }
    if (f === 1) { esquirla(C + 4, C, 14, 0); esquirla(C - 2, C - 7, 9, -0.25); esquirla(C - 2, C + 7, 9, 0.25); sueltos(F, 6, 14, 22, azar, 0.7, C - 6); }
    if (f === 2) { bola(F, C, C, 7, 1, 0.6); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; esquirla(C + Math.cos(a) * 12, C + Math.sin(a) * 12, k % 2 ? 9 : 12, a); } sueltos(F, 10, 19, 23, azar); }
    if (f === 3) { for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.2; esquirla(C + Math.cos(a) * 17, C + Math.sin(a) * 17, 5, a + 0.8); } destello(F, C, C, 5, 0.9); sueltos(F, 10, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 6; k++) { const a = azar() * Math.PI * 2; const r = 8 + azar() * 13; destello(F, C + Math.cos(a) * r, C + Math.sin(a) * r, 2.5, 0.9); } }
  },
  rocas(F, f, azar) {
    if (f === 0) { for (let k = 0; k < 3; k++) roca(F, C - 6 + k * 6, C + 4 - (k % 2) * 5, 3, azar() * 3, 0.9, azar); sueltos(F, 5, 9, 14, azar, 0.7); }
    if (f === 1) { roca(F, C + 2, C, 10, 0.4, 1, azar); roca(F, C - 13, C - 6, 4, 1, 0.85, azar); roca(F, C - 11, C + 8, 3.5, 2, 0.85, azar); sueltos(F, 6, 14, 22, azar, 0.6, C - 8); }
    if (f === 2) { bola(F, C, C + 2, 15, 0.55, 0.3); estrella(F, C, C, 5, 13, 6, 0.3, 1); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; roca(F, C + Math.cos(a) * 17, C + Math.sin(a) * 16, 4, a, 0.95, azar); } sueltos(F, 10, 18, 23, azar, 0.8); }
    if (f === 3) { anillo(F, C, C + 4, 15, 4, 0.5); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; roca(F, C + Math.cos(a) * 20, C + Math.sin(a) * 18, 3, a, 0.9, azar); } sueltos(F, 12, 6, 23, azar, 0.7); }
    if (f === 4) { for (let k = 0; k < 6; k++) roca(F, C - 18 + azar() * 36, C + azar() * 20, 1.8, azar() * 3, 0.85, azar); sueltos(F, 8, 8, 22, azar, 0.5); }
  },
  estrella(F, f, azar) {
    if (f === 0) { destello(F, C, C, 7, 1); sueltos(F, 4, 9, 13, azar); }
    if (f === 1) { estrella(F, C + 2, C, 5, 13, 6, 0.2, 1); sueltos(F, 6, 14, 20, azar); }
    if (f === 2) { estrella(F, C, C, 9, 23, 8, 0.15, 1); estrella(F, C, C, 4, 12, 8, 0.55, 1); sueltos(F, 10, 19, 23, azar); }
    if (f === 3) { estrella(F, C, C, 12, 22, 10, 0.4, 0.75); bola(F, C, C, 10, 0.2, 1); sueltos(F, 16, 6, 23, azar, 0.9); }
    if (f === 4) { for (let k = 0; k < 5; k++) { const a = azar() * Math.PI * 2; const r = 9 + azar() * 12; estrella(F, C + Math.cos(a) * r, C + Math.sin(a) * r, 1, 4, 4, 0.3, 0.9); } }
  },
  destellos(F, f, azar) {
    if (f === 0) { destello(F, C, C, 7, 1); destello(F, C + 9, C - 7, 3, 0.9); }
    if (f === 1) { destello(F, C + 3, C, 12, 1); destello(F, C - 9, C - 8, 5, 0.9); destello(F, C - 7, C + 9, 4, 0.9); sueltos(F, 6, 14, 22, azar, 0.8); }
    if (f === 2) { bola(F, C, C, 9, 1, 0.5); destello(F, C, C, 22, 1); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.5; destello(F, C + Math.cos(a) * 15, C + Math.sin(a) * 15, 4.5, 0.95); } }
    if (f === 3) { for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; destello(F, C + Math.cos(a) * 18, C + Math.sin(a) * 18, 3.5, 0.9); } destello(F, C, C, 8, 0.8); sueltos(F, 10, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 6; k++) { const a = azar() * Math.PI * 2; const r = 6 + azar() * 15; destello(F, C + Math.cos(a) * r, C + Math.sin(a) * r, 2.5, 0.85); } }
  },
  ondas(F, f, azar) {
    if (f === 0) { bola(F, C, C, 5, 1, 0.5); anillo(F, C, C, 9, 1.4, 0.8); }
    if (f === 1) { bola(F, C + 4, C, 7, 1, 0.5); anillo(F, C + 4, C, 12, 1.8, 0.85); anillo(F, C + 4, C, 18, 1.6, 0.7, -1.1 + Math.PI * 2, Math.PI * 2); anillo(F, C + 4, C, 18, 1.6, 0.7, 0, 1.1); }
    if (f === 2) { bola(F, C, C, 11, 1, 0.45); anillo(F, C, C, 15, 2.4, 0.9); anillo(F, C, C, 21, 2, 0.75); sueltos(F, 8, 22, 23, azar); }
    if (f === 3) { for (let k = 0; k < 4; k++) anillo(F, C, C, 19, 2.2, 0.8, k * Math.PI / 2 + 0.2, k * Math.PI / 2 + 1.1); anillo(F, C, C, 11, 1.6, 0.6); bola(F, C, C, 4, 0.7); sueltos(F, 12, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 3; k++) anillo(F, C, C, 22, 1.2, 0.6, k * 2.1, k * 2.1 + 0.6); sueltos(F, 8, 8, 22, azar, 0.7); }
  },
  viento(F, f, azar) {
    if (f === 0) { medialuna(F, C, C, 8, 0, 3, 0.9); sueltos(F, 4, 10, 14, azar); }
    if (f === 1) { medialuna(F, C + 4, C, 16, Math.PI, 5, 1); medialuna(F, C - 6, C, 10, Math.PI, 3, 0.8); sueltos(F, 5, 16, 22, azar, 0.7); }
    if (f === 2) { for (let k = 0; k < 3; k++) medialuna(F, C, C, 20 - k * 4, (k / 3) * Math.PI * 2, 6, 1 - k * 0.1); bola(F, C, C, 6, 1, 0.6); sueltos(F, 10, 19, 23, azar); }
    if (f === 3) { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; medialuna(F, C + Math.cos(a) * 14, C + Math.sin(a) * 14, 7, a + Math.PI, 3, 0.85); } sueltos(F, 12, 6, 23, azar); }
    if (f === 4) { for (let k = 0; k < 4; k++) medialuna(F, C - 14 + k * 9, C - 8 + azar() * 16, 5, Math.PI, 2, 0.7); }
  },
};

// --- Pintar la tira ------------------------------------------------------------------------------------------
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

/** Pasa un campo a píxeles de la paleta con su contorno grueso. Devuelve los índices (0 = vacío, 1 = borde). */
function cuantizar(F, niveles) {
  const G = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const v = F[i];
    if (v < 0.16) continue;
    G[i] = 2 + Math.min(niveles - 1, Math.floor(((v - 0.16) / 0.84) * niveles));
  }
  const lleno = (x, y) => x >= 0 && y >= 0 && x < N && y < N && G[y * N + x] >= 2;
  const borde = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (G[y * N + x]) continue;
    let cerca = false;
    for (let dy = -1; dy <= 1 && !cerca; dy++) for (let dx = -1; dx <= 1; dx++) if (lleno(x + dx, y + dy)) { cerca = true; break; }
    if (cerca || lleno(x, y - 2) || lleno(x - 2, y)) borde.push(y * N + x); // un píxel más por abajo y a la derecha: pesa
  }
  for (const i of borde) G[i] = 1;
  return G;
}

const cache = new Map();

/**
 * La tira de 5 fotogramas (240×48) del ataque de `tipo` (clave de PokéAPI: 'fire', 'water'…). Mira a la derecha:
 * para el rival se dibuja volteada. Con caché.
 */
export function hojaDeAtaque(tipo) {
  const clave = tipo in PALETAS_GBA ? tipo : 'normal';
  if (cache.has(clave)) return cache.get(clave);
  const paleta = PALETAS_GBA[clave].map(hex);
  const niveles = paleta.length - 1;
  const lienzo = document.createElement('canvas');
  lienzo.width = N * FOTOGRAMAS;
  lienzo.height = N;
  const ctx = lienzo.getContext('2d');
  const imagen = ctx.createImageData(N * FOTOGRAMAS, N);
  const semilla = [...clave].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  for (let f = 0; f < FOTOGRAMAS; f++) {
    const F = new Float32Array(N * N);
    const azar = generador(semilla + f * 977);
    const forma = FORMA[clave] || 'estrella';
    FORMAS[forma === 'burbujas' ? 'agua' : forma](F, f, azar, ruido(semilla + f * 131), { burbujas: forma === 'burbujas' });
    const G = cuantizar(F, niveles - 1 + 1);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const indice = G[y * N + x];
      if (!indice) continue;
      const [r, g, b] = indice === 1 ? paleta[0] : paleta[Math.min(niveles, indice - 1)];
      const k = (y * N * FOTOGRAMAS + f * N + x) * 4;
      imagen.data[k] = r; imagen.data[k + 1] = g; imagen.data[k + 2] = b; imagen.data[k + 3] = 255;
    }
  }
  ctx.putImageData(imagen, 0, 0);
  cache.set(clave, lienzo);
  return lienzo;
}

/** Los colores de la paleta de un tipo (para las partículas sueltas de la arena): de dentro hacia fuera. */
export const coloresDe = tipo => [...(PALETAS_GBA[tipo] || PALETAS_GBA.normal)].reverse();
