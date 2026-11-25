// Entrenadores en pixel art (modo aventura y Duelo). Hay dos clases y nada más:
//
// 1. ESTILO ANIME: tu entrenador, Kael y cualquier entrenador que no sea de los juegos (también un rival de los juegos
//    cuyo sprite no carga). Un sprite de 57×108 (unas 4,9 cabezas, cara de anime con ojos grandes y brillo) pasado a
//    letras por material desde la referencia que dio el usuario (pixel art ampliado ×5; volteado para mirar a la
//    derecha). Sus colores se cambian conservando las sombras del original (tonoComo) y tiene piezas
//    (ENTRENADOR_ANIME, datos.js): pañuelo o sin él (el pañuelo se vuelve pelo), peinado corto, de punta o largo,
//    camiseta de rayas o lisa, pirata o largo, bandolera o sin bolsa. Por datos, además, `ojos` (Kael los tiene
//    rojos). Su lienzo mide 63×112: el sprite con margen para moverlo en las poses.
//
// 2. LOS DE LOS JUEGOS (rivales): un aspecto con `sprite` (clave de SPRITES_ENTRENADOR) usa su sprite de 80×80, que se
//    carga de Pokémon Showdown la primera vez que se necesita (cargarSprite). Mientras llega, su lienzo está vacío
//    (los retratos se vuelven a pintar solos al cargar) y, si no carga (sin conexión), se dibuja en estilo anime con
//    el resto de su aspecto. Showdown no deja leer sus píxeles desde otra web, así que la caja de cada dibujo viene
//    medida en datos.js. Miran a la izquierda: se voltean para que, como los nuestros, miren a la derecha.
//
// Una sola imagen por entrenador: las poses (quieto, paso 0 o 1, lanza1, lanza2, ordena, celebra, triste) la mueven
// (un paso, inclinarse, un salto; triste, más oscura). Mira a la derecha; el rival se dibuja volteado. La arena, el
// mapa y los retratos piden sus medidas a medidasDe() y la mano (de donde sale la Poké Ball) a manoDe().
//
// Letras del sprite anime: K contorno · pañuelo a b c, emblema x · pelo h H u · piel s S d · ojos o (blanco) r (iris)
// e (sombra) · camiseta j J U q (color) w i E L (blanco) · correa g G n · bolsa B F Q · pantalón p P m, puño y ·
// zapatillas z Z v (color) k O Y V (blanco).

import { ASPECTO_ENTRENADOR, ASPECTO_INICIAL, ENTRENADOR_ANIME, SPRITES_ENTRENADOR, URL_ENTRENADORES } from './datos.js';

export const MAX_NOMBRE = 12;

// --- Color ------------------------------------------------------------------------------------------------------
const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const aRgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const aHex = rgb => '#' + rgb.map(v => limitar(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mezcla = (a, b, t) => { const x = aRgb(a); const y = aRgb(b); return aHex(x.map((v, i) => v + (y[i] - v) * t)); };

function aHsl(c) {
  const [r, g, b] = aRgb(c).map(v => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function deHsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return aHex([f(0), f(8), f(4)].map(v => v * 255));
}

/**
 * Un tono del original pasado a otro color base: el mismo giro de tono y cambio de saturación, y la claridad en la
 * misma proporción (hacia el negro si es más oscuro, hacia el blanco si es más claro). Con el color original, el
 * tono original tal cual.
 */
function tonoComo(nuevo, original, tono) {
  if (nuevo === original) return tono;
  const [h0, s0, l0] = aHsl(original); const [h1, s1, l1] = aHsl(tono); const [h, s, l] = aHsl(nuevo);
  const dh = ((h1 - h0 + 540) % 360) - 180;
  const luz = l1 <= l0 ? l * (l1 / l0) : l + (1 - l) * ((l1 - l0) / (1 - l0));
  return deHsl((h + dh + 360) % 360, limitar(s + (s1 - s0)), limitar(luz, 0.03, 0.98));
}

// --- Aspecto --------------------------------------------------------------------------------------------------
const valido = (valor, lista) => lista.includes(valor);

/**
 * Las piezas de un aspecto de antes (gorras, chaquetas, pantalones y peinados del dibujo antiguo, que ya no existe)
 * pasadas a las del estilo anime, con sus colores: sin gorra → sin pañuelo y con cualquier otra, pañuelo; camiseta
 * de rayas o lisa; pirata o largo; peinado de punta, largo (largo o coleta) o corto.
 */
function aAnime(aspecto) {
  const { gorras, camisetas, pantalones, peinados } = ENTRENADOR_ANIME;
  return {
    ...aspecto,
    gorra: aspecto.gorra in gorras ? aspecto.gorra : aspecto.gorra === undefined ? undefined : 'bandana',
    chaqueta: aspecto.chaqueta in camisetas ? aspecto.chaqueta : aspecto.chaqueta === undefined ? undefined : 'lisa',
    pantalon: aspecto.pantalon in pantalones ? aspecto.pantalon
      : aspecto.pantalon === undefined || aspecto.pantalon === 'corto' || aspecto.pantalon === 'falda' ? 'pirata' : 'largo',
    peinado: aspecto.peinado in peinados ? aspecto.peinado : aspecto.peinado === 'coleta' ? 'largo' : 'corto',
  };
}

/** Un aspecto completo y válido (lo que falte o no exista se toma del inicial; los de antes, pasados al anime). */
export function normalizarAspecto(aspecto) {
  if (!aspecto || typeof aspecto !== 'object' || !Object.keys(aspecto).length) return { ...ASPECTO_INICIAL };
  const { gorras, camisetas, pantalones, bolsas, peinados } = ENTRENADOR_ANIME;
  const { colores, pieles, pelos } = ASPECTO_ENTRENADOR;
  const hexes = colores.map(([, c]) => c);
  const origen = aAnime(aspecto);
  const a = { ...ASPECTO_INICIAL };
  if (origen.gorra in gorras) a.gorra = origen.gorra;
  if (origen.chaqueta in camisetas) a.chaqueta = origen.chaqueta;
  if (origen.pantalon in pantalones) a.pantalon = origen.pantalon;
  if (origen.bolsa in bolsas) a.bolsa = origen.bolsa;
  if (origen.peinado in peinados) a.peinado = origen.peinado;
  for (const clave of ['colorGorra', 'colorChaqueta', 'colorPantalon']) if (valido(origen[clave], hexes)) a[clave] = origen[clave];
  if (valido(origen.piel, pieles)) a.piel = origen.piel;
  if (valido(origen.pelo, pelos.map(([, c]) => c))) a.pelo = origen.pelo;
  if (/^#[0-9a-f]{6}$/.test(origen.ojos)) a.ojos = origen.ojos;
  if (origen.sprite in SPRITES_ENTRENADOR) a.sprite = origen.sprite;
  return a;
}

// --- Tu entrenador, guardado en este navegador ------------------------------------------------------
const CLAVE = 'pokedex.entrenador';
let enMemoria = null; // si el navegador no deja guardar, dura lo que dure la visita

/** Tu entrenador: { nombre, aspecto } o null si aún no lo has creado. */
export function leerEntrenador() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado && typeof guardado.nombre === 'string' && guardado.nombre.trim()) {
      return { nombre: guardado.nombre.trim().slice(0, MAX_NOMBRE), aspecto: normalizarAspecto(guardado.aspecto) };
    }
  } catch { /* sin almacenamiento o dato roto */ }
  return enMemoria;
}

export function guardarEntrenador({ nombre, aspecto }) {
  const limpio = { nombre: String(nombre).trim().slice(0, MAX_NOMBRE), aspecto: normalizarAspecto(aspecto) };
  enMemoria = limpio;
  try { localStorage.setItem(CLAVE, JSON.stringify(limpio)); } catch { /* navegación privada: solo dura esta visita */ }
  document.dispatchEvent(new CustomEvent('entrenador-cambiado'));
  return limpio;
}

// --- Estilo anime -------------------------------------------------------------------------------------------
const ANIME = [
  '.......................KKKKKKca',
  '.....................KccaaacccaKK',
  '....................KcaaaabbbaaccK',
  '..................KKaaaaabxxxbbaaaK',
  '................bcaaaaaabbxxxxbaaaa',
  '..............bccaaaaaaabxxxxxbaaaaK',
  '.............bbbcKaaaaaaaaabbbaaaaacK',
  '.............ccbcKaaaacchhhcccbbbaacK',
  '...............ccKaccSsshHHHKhccccaac',
  '.................cKhhhSsHshHshhKhhcaa',
  '.................KKhHShSsshssHhshhhcK',
  '................KdKHsKShssssshSKshKK',
  '................KdKsSeKosssssKoeSHKdK',
  '................KSKsSoKKsssssKKoSsKSK',
  '................KSKssorKsssssKrossKSK',
  '................KSSSssrSsssssSrssSSSK',
  '.................KSdsssssssssssssdSK',
  '..................KKssssssSssssssKK',
  '...................KSsssssssssssSK',
  '....................KSsssSSSsssdK',
  '...................KKKdsssssssdK',
  '.....................KKKSsssSKK',
  '....................KKEdKKKKdKK',
  '..................KKwwEdSSSSdEwKK',
  '.................KLwwwLdSsSSdLwwwK',
  '................KULwwwLGssSSdGLwwwK',
  '...............KUwwLwwwGGssSSGLwwwGG',
  '..............KiiwwLwwwLGGGGGGwwwKGGG',
  '..............KiUwwwLwwwLGGGGLwwLKGGKK',
  '..............KiUUwwwLLwwLGGLwwLjGGKjj',
  '.............KiiLUwwwwwLLwwGwwLwGGGKULK',
  '.............KiiLUJJUUUUwLLLLLwnGGGwULK',
  '............KiiiLUjjjjjjUUUUUJnGGGGwULK',
  '............KiiiLUjjjjjjjjjjjnnGGnwwULK',
  '...........KiiiiiLUJUUUJJjjjjGGGGnUUULK',
  '...........KiiiiiLUwwLLLJUUUGGGGnjjjULiK',
  '..........KiiiiiiLUwwwwwLLLnnGGGGjjjUiiK',
  '.........KiiiiiiLKUwwwwwwwnGnnGGUUUUUiiK',
  '........KJLiiiiiKgUwLLLwwnGGGnnwLLLLUiiiK',
  '.......KjjjiiiiKKgUJUUULnnnGnnwwwwwwUiiiK',
  '......KjjjJJLLK.KgUjjjjGGnnnnLLwwwwwUiiUKK',
  '......KjjjjJJK.KggUjjjnGGGGnUUUUJLLLUUUjjUK.......KKK',
  '.....KjjjjjjK..KggUUjnGGGGnjjjjjjJUUUjjjjjU......KSSKKK',
  '.....KjjjjjjK..KFFUwGGGGGnjjjjjjjjjjKjjjjjjUUKKK.KKSdssK',
  '....KjjjjjjK..KFFnnGGGGGnUUJJjjjjjjjKjjjjJJjUiiiKKdsddSSK',
  '....KJjjjjjK..KFFnGGGGGGwwLLJJUUUUUUKjjjJiiiiiUdSssdSSSSK',
  '...KLjjjjjK...KFKGGGGGGwwwwwwLLLLLLLKJjiiiiiiUjddSsSSSSSK',
  '..KwiLjJJJK..KFFBBGGGGwwwwwwwwwwwwwwKKiiLLLiijdSssSSSSSK',
  '..KwiiiLLLK..KBBBBBGnEwwwwwwwwwwwwwwK.KKKLLiUjdSSSSSSSK',
  '.KwiiiiiiiK..KBBBBBKLLLLwwwwLLLLLLLLK....KKLjjjKSSSSKK',
  '.KwUUjiiiK...KBBBBPPPPKKKKKKKKKKKPPPPK.....KKjjjKKKKK',
  '.KjjjjjjjK...KBBBKFFPppppppPPPpppppPpK.......KKKKKKK',
  '.KKKjUUUUK...KBBBKFFPppppppPPPpppppPpK........KKKK',
  '..KdKKKKKK....FBBKFFPppppppPpPpppppPpK',
  '.KSSSSd.......KBKFFPpppppppPpPpppppPpK',
  '.KssSSd........KKFFPpppppppPpPppppppPpK',
  'KSssssSd........KFPFpppppppPpPppppppPpK',
  'KsssssSSd.......KPpppppppppPpPpppppppPK',
  'KssssSSSd......KppppppppppppPPPPppppppK',
  'KsssSddSK......KppppppppppppPPpppppppppK',
  '.KssSSddK......KpppppppppppPKppppppppppK',
  '.KdSSSSK......KPpppppppppppPKppppppppppK',
  '..KdSSd.......KppppppppppppKKppppppppppK',
  '....dd........KpppppppppppPKKpppppppppppK',
  '..............Kppppppppppp..KpppppppppppK',
  '.............Kppppppppppp....KppppppppppK',
  '.............Kppppppppppp....KppppppppppK',
  '.............Kppppppppppp....KpppppppppppK',
  '............KpppppppppppPK...KpppppppppppK',
  '............KpppppppppppPK...KPppppppppppK',
  '...........KppppppppppppPK...KPppppppppppPK',
  '...........KPppppppppppPK.....KpppppppppppK',
  '..........KPPPPppppppPPPK.....KPPppppppPPPK',
  '..........KPPPPPPPPPPPPPK.....KPPPPPPPPPPPPK',
  '..........KPPPPPPPPPPPPPK.....KPPPPPPPPPPPPK',
  '..........KPPPPPPPPPPPPK......KPPPPPPPPPPPPK',
  '..........KPPPPPPPPPPPPK......KPPPPPPPPPPPPK',
  '...........KPPPPPPPPPPPK.......KPPPPPPPPPKK',
  '...........KKKKKKKKKKKK........KKKKKKKKKKK',
  '...........KPPPPPPPyyK.........KKyyPPPPPPK',
  '...........KPPPPPPPyyK..........KyyPPPPPPK',
  '...........KKKKKKKKKK............KKKKKKKKK',
  '...........KdSSSSSSK..............KSSSSSSK',
  '...........KSssssSSK..............KSSssssK',
  '...........KSsssssK...............KSsssssK',
  '...........KssssssK................KsssssK',
  '...........KssssssK................KsssssK',
  '...........KsssssK.................KsssssK',
  '...........KssssSK..................KssssS',
  '...........SssssK...................KsssssK',
  '..........KSsssSK...................KsssssK',
  '..........KssssK....................KSssssK',
  '..........KssssK.....................KssssK',
  '..........KsssSK.....................KssssK',
  '.........KSsssK......................KSsssK',
  '.........KSsssK......................KSSKKKK',
  '.........KKKKsK......................KKvzzzzK',
  '........KzzzvKK.....................KkkkzzzzK',
  '........KzzzvkK.....................KVVkzkkkvK',
  '.......KvkkzzkK.....................KYYVkVkkkKK',
  '.......KkkkkYkK.....................KYYYVkVkkkVKK',
  '......KkkkkkYkY.....................KYYYYVkVVzzzzKK',
  '.....KYkkkkYkYYK....................KYYYYYVkzzzzzzvK',
  '....KYzzzzYkYYYK....................KVVVYYYVkzzzzzzK',
  '...KkzzzzvkYYYYK.....................KKKVVVVkzzzzzzK',
  '...KkzzvvvkYYVVK........................KVVVVVVVVVK',
  '...KVVVVVVVVVKK..........................KKKKKKKKK',
  '....KKKKKKKKK',
];
const ANCHO_ANIME = 63;   // el lienzo: el sprite con 3 píxeles a cada lado y 2 arriba (para moverlo en las poses)
const ALTO_ANIME = 112;
const PIES_ANIME = 108;   // fila de las suelas en el lienzo
const UNIDAD_ANIME = 0.72; // unidades del mundo de la arena por píxel: mide ~76, como los rivales de los juegos
const POSE = { quieto: [0, 0], paso: [0, 0], lanza1: [-2, 0], lanza2: [3, 0], ordena: [2, 0], celebra: [0, -2], triste: [0, 2] };
/** La mano extendida (en el lienzo, de pie): de ahí sale la Poké Ball. */
const MANO_ANIME = [56, 47];

function paletaAnime(a) {
  const azul = '#1a5b8c'; const gris = '#586070';
  const gorra = t => tonoComo(a.colorGorra, azul, t);
  const camiseta = t => tonoComo(a.colorChaqueta, azul, t);
  const pantalon = t => tonoComo(a.colorPantalon, gris, t);
  const piel = t => tonoComo(a.piel, '#f8d0b8', t);
  return {
    K: '#0d0b12',
    a: gorra('#1a5b8c'), b: gorra('#144870'), c: gorra('#12334a'), x: '#2c2626',
    // El pelo: con el color original, sus tonos; con otro, sombra y brillo moderados (con la proporción del original,
    // casi negro, un pelo claro se llenaba de rayas oscuras).
    h: a.pelo, H: a.pelo === '#2a1d16' ? '#150b07' : mezcla(a.pelo, '#1a1830', 0.38), u: mezcla(a.pelo, '#ffffff', 0.3),
    s: piel('#f8d0b8'), S: piel('#d09870'), d: piel('#82553c'),
    o: '#e8e8f8', r: a.ojos || '#593123', e: '#c0b8d0',
    j: camiseta('#1a5b8c'), J: camiseta('#144870'), U: camiseta('#12334a'), q: camiseta('#3a7cb0'),
    w: '#e8e8f8', i: '#ffffff', E: '#c0b8d0', L: '#9890b8',
    g: '#586070', G: '#384050', n: '#1d222b',
    B: '#9890b8', F: '#586070', Q: '#c0b8d0',
    p: pantalon('#586070'), P: pantalon('#384050'), m: pantalon('#1d222b'), y: pantalon('#9890b8'),
    z: gorra('#1a5b8c'), Z: gorra('#144870'), v: gorra('#12334a'),
    k: '#e8e8f8', O: '#ffffff', Y: '#c0b8d0', V: '#9890b8',
  };
}

const CAMISETA = new Set('jJUwiELq');
/** El pelo de punta: cuatro mechones que salen hacia atrás y arriba de la cabeza. [columna, fila, letras]. */
const PINCHOS = [
  [16, 0, 'KK'], [16, 1, 'KuhhhK'], [17, 2, 'KhhH'], [17, 3, 'K'],
  [8, 3, 'KK'], [8, 4, 'KuuhhhhhK'], [9, 5, 'KHhhhhK'], [11, 6, 'KHH'],
  [11, 7, 'KK'], [9, 8, 'KuhhhhK'], [8, 9, 'KHhhhhhhhK'], [7, 10, 'KKHHHK'], [7, 11, 'KK'],
];
const VECINOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Lo que se pinta encima solo donde no hay nada (así queda detrás de la cabeza y del cuerpo). */
const ponerDetras = (filas, x, y, l) => { if (filas[y] && filas[y][x] === '.') filas[y][x] = l; };

/**
 * El pelo largo: un mechón a cada lado de la cabeza que cae por detrás hasta los hombros y se afina en la punta
 * (fuera del contorno de cada fila: sigue la forma de la cabeza, el cuello y los hombros).
 */
function peloLargo(filas) {
  for (let y = 6; y <= 27; y++) {
    const f = filas[y];
    const izquierda = f.findIndex(l => l !== '.');
    if (izquierda < 0) continue;
    const derecha = f.length - 1 - [...f].reverse().findIndex(l => l !== '.');
    const ancho = y < 9 ? 2 : y <= 23 ? 4 : 27 - y;
    for (let k = 1; k <= ancho; k++) {
      const l = k === ancho ? 'K' : k === 1 ? 'H' : y < 13 && k === 2 ? 'u' : 'h';
      ponerDetras(filas, izquierda - k, y, l);
      ponerDetras(filas, derecha + k, y, l);
    }
  }
}

/** El sprite con las piezas de su aspecto (filas de letras). */
function plantillaAnime(a) {
  let filas = ANIME.map(f => [...f.padEnd(57, '.')]);
  if (a.gorra === 'ninguna') { // el pañuelo se vuelve pelo (el nudo, un mechón)
    const PELO = { a: 'h', b: 'h', c: 'h', x: 'h' };
    filas = filas.map(f => f.map(l => PELO[l] || l));
    for (let y = 1; y <= 3; y++) for (let x = 22; x <= 31; x++) if (filas[y][x] === 'h') filas[y][x] = 'u'; // brillo arriba
    for (let y = 5; y <= 9; y++) for (let x = 0; x <= 18; x++) if (filas[y][x] === 'h') filas[y][x] = 'H';  // sombra detrás
    for (let y = 0; y < 10; y++) for (let x = 1; x < 56; x++) { // las costuras del pañuelo dentro del pelo, fuera
      if (filas[y][x] === 'K' && 'hHu'.includes(filas[y][x - 1]) && 'hHu'.includes(filas[y][x + 1])) filas[y][x] = 'H';
    }
  }
  if (a.peinado === 'pinchos') { // mechones de punta hacia atrás
    for (const [x0, y, trazo] of PINCHOS) [...trazo].forEach((l, k) => { if (l !== '.') ponerDetras(filas, x0 + k, y, l); });
  }
  if (a.peinado === 'largo') peloLargo(filas);
  if (a.chaqueta === 'lisa') { // lo blanco de la camiseta, del color de la camiseta
    const LISA = { w: 'j', i: 'q', E: 'J', L: 'J', U: 'j', J: 'j' };
    filas = filas.map(f => f.map(l => LISA[l] || l));
  }
  if (a.pantalon === 'largo') { // desde el puño hasta el tobillo, pantalón
    for (let y = 72; y <= 95; y++) {
      const f = filas[y];
      let x = 0;
      while (x < f.length) {
        if (f[x] === '.') { x++; continue; }
        let fin = x;
        while (fin + 1 < f.length && f[fin + 1] !== '.') fin++;
        for (let k = x; k <= fin; k++) {
          if (k === x || k === fin) { if (f[k] !== 'K') f[k] = 'P'; continue; }
          if ('sSdyPp'.includes(f[k]) || (f[k] === 'K' && (y === 78 || y === 81))) f[k] = k === x + 1 || k === fin - 1 ? 'P' : 'p';
        }
        x = fin + 1;
      }
    }
  }
  if (a.bolsa === 'ninguna') quitarBandolera(filas);
  return filas;
}

/** Quita la bolsa (deja su hueco transparente) y la correa (la tapa con la camiseta de su misma fila). */
function quitarBandolera(filas) {
  const alto = filas.length; const ancho = filas[0].length;
  const vacio = (x, y) => x < 0 || y < 0 || x >= ancho || y >= alto || filas[y][x] === '.';
  const tocadas = [];
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    if ('BFQ'.includes(filas[y][x])) { filas[y][x] = '.'; tocadas.push([x, y]); }
  }
  for (let y = 0; y < 50; y++) {
    const original = [...filas[y]];
    for (let x = 0; x < ancho; x++) {
      if (!'gGn'.includes(original[x])) continue;
      let relleno = 'K';
      for (let d = 1; d < ancho; d++) {
        if (CAMISETA.has(original[x - d])) { relleno = original[x - d]; break; }
        if (CAMISETA.has(original[x + d])) { relleno = original[x + d]; break; }
      }
      filas[y][x] = relleno;
      tocadas.push([x, y]);
    }
  }
  // Contorno donde quedó un borde nuevo, y fuera los trozos del contorno de la bolsa que se quedan sueltos.
  for (const [x, y] of tocadas) {
    for (const [vx, vy] of [[x, y], ...VECINOS.map(([dx, dy]) => [x + dx, y + dy])]) {
      if (vacio(vx, vy) || filas[vy][vx] === 'K') continue;
      if (VECINOS.some(([dx, dy]) => vacio(vx + dx, vy + dy))) filas[vy][vx] = 'K';
    }
  }
  const relleno = (x, y) => !vacio(x, y) && filas[y][x] !== 'K';
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      if (filas[y][x] !== 'K') continue;
      const cerca = [...VECINOS, [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => relleno(x + dx, y + dy));
      if (!cerca) filas[y][x] = '.';
    }
  }
}

const cacheAnime = new Map();
function lienzoAnime(a, pose, paso) {
  const clave = JSON.stringify(a) + pose + paso;
  if (cacheAnime.has(clave)) return cacheAnime.get(clave);
  const paleta = paletaAnime(a);
  const filas = plantillaAnime(a);
  const [adelante, arriba] = POSE[pose] || POSE.quieto;
  const dy = 2 + arriba - (pose === 'paso' && paso ? 1 : 0);
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_ANIME;
  lienzo.height = ALTO_ANIME;
  const ctx = lienzo.getContext('2d');
  const imagen = ctx.createImageData(ANCHO_ANIME, ALTO_ANIME);
  const luz = pose === 'triste' ? 0.72 : 1; // triste: más oscuro
  filas.forEach((fila, y) => fila.forEach((l, x) => {
    if (l === '.' || !paleta[l]) return;
    const px = x + 3 + adelante; const py = y + dy;
    if (px < 0 || py < 0 || px >= ANCHO_ANIME || py >= ALTO_ANIME) return;
    const [r, g, b] = aRgb(paleta[l]);
    imagen.data.set([r * luz, g * luz, b * luz, 255], (py * ANCHO_ANIME + px) * 4);
  }));
  ctx.putImageData(imagen, 0, 0);
  cacheAnime.set(clave, lienzo);
  return lienzo;
}

// --- Sprites de los juegos (rivales) ------------------------------------------------------------------
const LADO_SPRITE = 80;   // los de los juegos miden 80×80
const PIES_SPRITE = 78;   // se colocan con los pies en esta fila
const sprites = new Map(); // nombre → { estado: 'cargando' | 'listo' | 'error', imagen, promesa }

/** Empieza a cargar (una sola vez) el sprite de un entrenador de los juegos. */
function cargarSprite(nombre) {
  if (!sprites.has(nombre)) {
    const imagen = new Image(); // sin crossOrigin: Showdown no lo permite (se puede pintar, no leer)
    const s = { estado: 'cargando', imagen };
    s.promesa = new Promise(listo => {
      imagen.onload = () => { s.estado = 'listo'; listo(); };
      imagen.onerror = () => { s.estado = 'error'; listo(); };
    });
    imagen.decoding = 'async';
    imagen.src = `${URL_ENTRENADORES}${nombre}.png`;
    sprites.set(nombre, s);
  }
  return sprites.get(nombre);
}

/** Su sprite, si es un entrenador de los juegos y no ha fallado al cargar (si falla, va en estilo anime). */
const spriteDe = a => (a.sprite && cargarSprite(a.sprite).estado !== 'error' ? cargarSprite(a.sprite) : null);

/** Se cumple cuando el entrenador ya se puede dibujar (al instante si es de estilo anime). */
export function prepararEntrenador(aspecto) {
  const a = normalizarAspecto(aspecto);
  return a.sprite ? cargarSprite(a.sprite).promesa : Promise.resolve();
}

/** La caja del dibujo de un sprite ya colocado en el lienzo (volteado, centrado y con los pies en la fila 78). */
function cajaColocada(nombre) {
  const [x0, y0, x1, y1] = SPRITES_ENTRENADOR[nombre];
  const ancho = x1 - x0 + 1;
  const izquierda = Math.round(LADO_SPRITE / 2 - ancho / 2);
  return { x0: izquierda, x1: izquierda + ancho - 1, y0: y0 + PIES_SPRITE - y1, y1: PIES_SPRITE };
}

const cacheSprites = new Map();
function lienzoSprite(nombre, imagen, pose, paso) {
  const clave = nombre + pose + paso;
  if (cacheSprites.has(clave)) return cacheSprites.get(clave);
  const [x0, , x1, y1] = SPRITES_ENTRENADOR[nombre];
  const [adelante, arriba] = POSE[pose] || POSE.quieto;
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO_SPRITE;
  lienzo.height = LADO_SPRITE;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Volteado (mira a la derecha), con el centro de su dibujo en el centro del lienzo y los pies en la fila 78.
  const desplazamiento = Math.round((x0 + x1 + 1) / 2 - LADO_SPRITE / 2) + adelante;
  ctx.translate(LADO_SPRITE + desplazamiento, PIES_SPRITE - y1 + arriba - (pose === 'paso' && paso ? 1 : 0));
  ctx.scale(-1, 1);
  if (pose === 'triste') ctx.filter = 'brightness(0.72) saturate(0.6)';
  ctx.drawImage(imagen, 0, 0);
  cacheSprites.set(clave, lienzo);
  return lienzo;
}

const VACIO = document.createElement('canvas');
VACIO.width = LADO_SPRITE;
VACIO.height = LADO_SPRITE;

// --- Lo que usan la arena, el mapa y la página ----------------------------------------------------------

/** Lo que mide el lienzo de un entrenador: ancho, alto, fila de los pies y unidades del mundo de la arena por píxel. */
export function medidasDe(aspecto) {
  return spriteDe(normalizarAspecto(aspecto))
    ? { ancho: LADO_SPRITE, alto: LADO_SPRITE, pies: PIES_SPRITE, unidad: 1 }
    : { ancho: ANCHO_ANIME, alto: ALTO_ANIME, pies: PIES_ANIME, unidad: UNIDAD_ANIME };
}

/** Dónde tiene la mano en esa pose (de ahí sale la Poké Ball), en píxeles de su lienzo. */
export function manoDe(aspecto, pose = 'quieto') {
  const a = normalizarAspecto(aspecto);
  const [adelante, arriba] = POSE[pose] || POSE.quieto;
  if (spriteDe(a)) {
    const { x0, x1, y0, y1 } = cajaColocada(a.sprite);
    if (pose === 'lanza1') return [x0 + 6 + adelante, y0 + 8];
    return [Math.min(LADO_SPRITE - 2, x1 - 4 + adelante), Math.round(y0 + (y1 - y0) * 0.42)];
  }
  return pose === 'lanza1' ? [34 + adelante, 26] : [MANO_ANIME[0] + adelante, MANO_ANIME[1] + arriba];
}

/**
 * El lienzo de un entrenador con ese aspecto, en esa pose (`paso`, 0 o 1, al caminar). Mira a la derecha; para el
 * rival, se dibuja volteado. Uno de los juegos cuyo sprite aún no ha llegado devuelve un lienzo vacío.
 */
export function lienzoEntrenador(aspecto, pose = 'quieto', paso = 0) {
  const a = normalizarAspecto(aspecto);
  const sprite = spriteDe(a);
  if (sprite) return sprite.estado === 'listo' ? lienzoSprite(a.sprite, sprite.imagen, pose, paso) : VACIO;
  delete a.sprite;
  return lienzoAnime(a, pose, paso);
}

/**
 * Un retrato para la página: un <canvas> con el entrenador ampliado `escala` veces sin suavizar (pixel art).
 * `volteado`: mirando a la izquierda (el rival).
 */
export function retratoEntrenador(aspecto, { escala = 4, pose = 'quieto', volteado = false, clase = 'retrato-entrenador' } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.className = clase;
  pintarRetrato(lienzo, aspecto, { escala, pose, volteado });
  lienzo.setAttribute('aria-hidden', 'true');
  return lienzo;
}

const pendientes = new WeakMap(); // retrato → lo último que se pidió pintar en él (por si el sprite llega tarde)

/**
 * Vuelve a pintar un retrato ya creado (el creador lo usa al cambiar una pieza o en su animación). Los de estilo
 * anime llevan la clase `retrato-anime`: la página les da su propio alto (múltiplos de 112; los de los juegos, de 80).
 */
export function pintarRetrato(lienzo, aspecto, opciones = {}) {
  const { escala = 4, pose = 'quieto', paso = 0, volteado = false, dy = 0 } = opciones;
  const a = normalizarAspecto(aspecto);
  const sprite = spriteDe(a);
  const { ancho, alto } = medidasDe(a);
  lienzo.classList.toggle('retrato-anime', !sprite);
  lienzo.width = ancho * escala;
  lienzo.height = alto * escala;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.save();
  if (volteado) { ctx.translate(lienzo.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(lienzoEntrenador(a, pose, paso), 0, dy * escala, lienzo.width, lienzo.height);
  ctx.restore();
  const pedido = {};
  pendientes.set(lienzo, pedido);
  if (sprite?.estado === 'cargando') sprite.promesa.then(() => { if (pendientes.get(lienzo) === pedido) pintarRetrato(lienzo, aspecto, opciones); });
}
