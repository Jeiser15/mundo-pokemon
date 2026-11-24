// Entrenadores en pixel art (modo aventura y Duelo): el tuyo, que creas eligiendo gorra, chaqueta, pantalón,
// peinado y colores, y los rivales. Inspirados en el ESTILO de los entrenadores de combate de la 4.ª generación
// (vista de tres cuartos, mirando a la derecha; el rival se voltea): no copian a ningún personaje.
//
// LIENZO: 48×72 píxeles, unas 4,5 cabezas de alto (la cabeza mide 16 filas, de la 3 a la 18; las suelas están en la
// fila 69 y debajo queda sitio para el contorno). Postura en contrapposto: el peso en la pierna de delante (la de
// la izquierda del dibujo, recta) y la otra relajada, con la rodilla un poco adelantada.
//
// CAPAS. Cada pieza es [columna, fila, filas] en coordenadas del lienzo (todas comparten el mismo origen, arriba
// a la izquierda; el punto es transparente). Se componen en este orden, cada capa encima de la anterior:
//   pelo de atrás → brazo de atrás → pierna de atrás → pierna de delante y caderas → falda → torso y chaqueta →
//   cabeza, cara y mechones → gorra → brazo de delante.
//
// COLOR (hue-shifting). Cada material tiene una RAMPA de cuatro tonos sacada de su color base (rampa()): la luz
// sube la claridad y gira el tono hacia el amarillo cálido; la sombra y la sombra profunda la bajan y lo giran
// hacia el azul violáceo (la piel, hacia el rojo). Los colores casi grises toman ese tinte directamente.
//
// CONTORNO SELECTIVO (sel-out). No hay una línea negra pareja: cada capa calcula su propio borde de un píxel y lo
// tiñe con una versión muy oscura del píxel vecino (su sombra profunda mezclada con #181420). Es más claro en los
// bordes iluminados (arriba y a la izquierda: la luz viene de ahí) y en lo alto del dibujo (gorra, hombros), y casi
// negro abajo y en el lado de la sombra. Donde el borde cae encima de otra capa (el brazo sobre la chaqueta) se
// suaviza con el color de debajo: así se lee la separación sin ensuciar.
//
// Letras de los mapas (luz · base · sombra · profunda):
//   piel t s S d · pelo L h H X · gorra l c C v · chaqueta q j J o · manga (hasta el codo) a A Q, raya x ·
//   antebrazo f F V, puño u · camiseta w W · pantalón g p P G (en las piernas se vuelven piel o calcetín según el
//   pantalón) · zapatillas k z Z y Y (suela) · bufanda y lazos b B · cinturón n, botones y hebillas N ·
//   ojos e (oscuro), E (iris), i (brillo) · boca m, boca abierta M · Poké Ball r R (rojo) y K (franja).
//
// Poses: quieto (Poké Ball en la mano) · paso (caminando: 0 o 1) · lanza1 (brazo atrás con la Poké Ball) ·
//        lanza2 (la suelta, con un paso adelante) · ordena (señala al frente) · celebra (puño arriba) ·
//        triste (cabeza gacha, ojos cerrados).

import { ASPECTO_ENTRENADOR, ASPECTO_INICIAL } from './datos.js';

export const ANCHO_ENTRENADOR = 48;
export const ALTO_ENTRENADOR = 72;
export const PIES_ENTRENADOR = 69;      // fila de las suelas
/** Dónde tiene la mano (con la Poké Ball) en cada pose, en píxeles del lienzo. */
export const MANO = { quieto: [24, 33], paso: [15, 44], lanza1: [9, 4], lanza2: [42, 25], ordena: [44, 18], celebra: [14, 3], triste: [15, 44] };
export const MAX_NOMBRE = 12;

const W = ANCHO_ENTRENADOR;
const H = ALTO_ENTRENADOR;
const CONTORNO = '#181420';

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
/** Gira el tono `h` hacia `meta` como mucho `grados` (por el camino corto del círculo). */
const acercar = (h, meta, grados) => { const d = ((meta - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(Math.abs(d), grados) + 360) % 360; };

const rampas = new Map();
/**
 * Los cuatro tonos de un material: luz (más clara y cálida), base, sombra y sombra profunda (más oscuras y frías).
 * `calido` y `frio`: hacia qué tonos giran la luz y las sombras; `giro`: cuántos grados giran las sombras;
 * `saturar`: cuánto se saturan.
 */
function rampa(base, { calido = 52, frio = 258, giro = 14, saturar = 0.06 } = {}) {
  const clave = base + calido + frio + giro + saturar;
  if (rampas.has(clave)) return rampas.get(clave);
  const [h, s, l] = aHsl(base);
  const gris = s < 0.13;
  const oscuro = l < 0.28;
  const tono = (meta, grados, ds, dl, sGris) => deHsl(gris ? meta : acercar(h, meta, grados),
    gris ? Math.max(s, sGris) : limitar(s + ds), limitar(l + dl, 0.05, 0.97));
  const r = {
    luz: tono(calido, 12, 0.04, oscuro ? 0.15 : l > 0.82 ? 0.07 : 0.12, 0.1),
    base,
    sombra: tono(frio, giro, saturar, oscuro ? -0.07 : l > 0.82 ? -0.13 : -0.15, 0.14),
    profunda: tono(frio, giro * 2, saturar / 2, oscuro ? -0.13 : l > 0.82 ? -0.27 : -0.29, 0.2),
  };
  rampas.set(clave, r);
  return r;
}
/** La piel: luz hacia el melocotón y sombras hacia el rosa tostado, sin saturar (si no, se ve roja). */
const rampaPiel = c => rampa(c, { calido: 45, frio: 340, giro: 6, saturar: -0.1 });

const contornos = new Map();
/** Sel-out: el color del borde junto a un píxel `c` en la fila `y`. */
function contorno(c, y, iluminado, debajo) {
  const clave = c + y + iluminado + (debajo || '');
  if (contornos.has(clave)) return contornos.get(clave);
  let k = 0.3 + 0.52 * (y / H) + (iluminado ? -0.17 : 0.13);
  if (debajo) k -= 0.18;
  let tinta = mezcla(rampa(c, { giro: 10, saturar: 0 }).profunda, CONTORNO, limitar(k, 0.08, 1));
  if (debajo) tinta = mezcla(tinta, debajo, 0.2);
  contornos.set(clave, tinta);
  return tinta;
}

const BLANCO = '#f3efe6';
function paletaDe(a) {
  const piel = rampaPiel(a.piel);
  const pelo = rampa(a.pelo);
  const gorra = rampa(a.colorGorra);
  const chaqueta = rampa(a.colorChaqueta);
  const pantalon = rampa(a.colorPantalon);
  const camiseta = rampa(BLANCO);
  const chaleco = a.chaqueta === 'chaleco';
  const manga = chaleco ? camiseta : chaqueta;
  const antebrazo = chaleco ? piel : chaqueta;
  const puno = chaleco ? piel.base : a.chaqueta === 'deportiva' ? camiseta.base : a.chaqueta === 'sudadera' ? chaqueta.sombra : chaqueta.luz;
  return {
    t: piel.luz, s: piel.base, S: piel.sombra, d: piel.profunda,
    L: pelo.luz, h: pelo.base, H: pelo.sombra, X: pelo.profunda,
    l: gorra.luz, c: gorra.base, C: gorra.sombra, v: gorra.profunda,
    q: chaqueta.luz, j: chaqueta.base, J: chaqueta.sombra, o: chaqueta.profunda,
    a: manga.base, A: manga.sombra, Q: manga.profunda, x: a.chaqueta === 'deportiva' ? camiseta.base : manga.luz,
    f: antebrazo.base, F: antebrazo.sombra, V: antebrazo.profunda, u: puno,
    w: camiseta.base, W: camiseta.sombra,
    b: gorra.base, B: gorra.sombra,
    n: '#2c2433', N: '#e0c67a',
    g: pantalon.luz, p: pantalon.base, P: pantalon.sombra, G: pantalon.profunda,
    k: gorra.luz, z: gorra.base, Z: gorra.sombra, y: '#f1ebdc', Y: '#bdb1a0',
    7: BLANCO, 8: camiseta.sombra, 9: BLANCO, 0: camiseta.sombra,
    e: '#1c1830', E: '#34508e', i: '#ffffff', m: piel.profunda, M: '#4a1a28',
    r: '#e8402a', R: '#a3202e', K: '#231c2a',
  };
}

// --- Cabeza (columna 16, fila 3) ------------------------------------------------------------------------------
const CABEZA = [16, 3, [
  '.....hhhhhhh.....',
  '...hhhhLLLLhhh...',
  '..hhhhLLLLLLhhhh.',
  '.hhhhhhLLLLhhhhhh',
  '.HhhhhhhhhhhhhhhH',
  'HHhhhhhhhhhhhhhhh',
  'HHhhhhhhhhhhhhhhh',
  'XHHhhhhhhhhhhhhhh',
  'XHHhhhhhhhhshhhsh',
  'XHHhhhhhsstsshsss',
  'XHHhhSsSsssssssss',
  'XHHhhSsSssssssssS',
  'XHHhhSsSsssssssss',
  '.XHhhhSssssssssS.',
  '..XHHdSssssssmss.',
  '....XHddSSsssss..',
]];
// La cara: ojos de 2×3 con su brillo (columnas 25–26 y 29–30, filas 13–15), cejas en la 12 y la boca en la 17.
const OJO = { normal: ['ee', 'ie', 'EE'], cerrado: ['ss', 'ee', 'ss'], contento: ['ss', 'ee', 'ss'], decidido: ['ee', 'ie', 'EE'] };
const CEJAS = { decidido: [[25, 12, 'HH'], [29, 12, 'HX']], triste: [[25, 12, 'Hh'], [30, 12, 'H']] };
const BOCA = { abierta: [[28, 17, 'mM'], [29, 18, 'm']], triste: [[28, 17, 'dm']] };

function cara(gesto) {
  const ojo = OJO[gesto] || OJO.normal;
  const trazos = [];
  ojo.forEach((fila, k) => trazos.push([25, 13 + k, fila], [29, 13 + k, fila]));
  trazos.push(...(CEJAS[gesto] || []));
  if (gesto === 'contento' || gesto === 'decidido') trazos.push(...BOCA.abierta);
  if (gesto === 'cerrado') trazos.push(...BOCA.triste);
  return trazos;
}

// --- Peinados -----------------------------------------------------------------------------------------------------
const PELO_ATRAS = {
  corto: null,
  pinchos: [9, 1, [
    '...........H......H',
    '..........Hh.....Hh......H',
    '.....H...Hhh....Hhh.....Hh',
    '.....HH.Hhhh...Hhhh....Hhh',
    '......HHhhhhh.HhhhhhhHHhhh',
    '...HHHhhhhhhhhhhhhhhhhhhh',
    'HHHhhhhhhhhhhhhh',
    '.XHHhhhhhhhh',
    '...XHhhhhhhh',
    'XHHHhhhhhhh',
    '.XXHhhhhhhh',
    '...XHhhhhh',
    '..XXHhhhhh',
    '....XHhhh',
    '...XXhhhh',
    '.....XHh',
  ]],
  largo: [11, 5, [
    '.....hhhh',
    '...hhhhhhh',
    '..hhhhhhhh',
    '.hhhLhhhhh',
    '.hhhLhhhhh',
    'hhhhLhhhhh',
    'hhhhhLhhhh',
    'hhhhhLhhhh',
    'Hhhhhhhhhh',
    'Hhhhhhhhhh',
    'Hhhhhhhhhh',
    'Hhhhhhhhhh',
    'HHhhhhhhhh',
    'HHhhhhhhhh',
    'XHhhhhhhhh',
    'XHHhhhhhhh',
    'XHHhhhhhh.',
    'XHHhhhhhh.',
    'XHHhhhhhh.',
    'XHHhhhhhh.',
    'XXHhhhhhh.',
    'XXHHhhhhh.',
    '.XHHhhhhh.',
    '.XHHhhhhh.',
    '.XXHhhhhh.',
    '.XXHHhhhH.',
    '..XHHhhhH.',
    '..XXHhhH..',
    '..XXHhhH..',
    '...XHhH...',
    '...XHH.H..',
    '....X..H..',
  ]],
  coleta: [7, 4, [
    '...........bB',
    '.........hbbbB',
    '.......hhhhbbB',
    '.....hhhhhhhH',
    '...hhhhLhhhH',
    '..hhhLhhhhH',
    '.hhhLhhhhH',
    '.hhLhhhhH',
    'hhhhhhhH',
    'hhhhhhH',
    'Hhhhhh',
    'Hhhhh',
    'XHhhH',
    '.XHhH',
    '.XHH',
    '..XH',
    '...X',
  ]],
};
// Mechones de delante (encima de la cara).
const PELO_DELANTE = {
  largo: [19, 10, ['..hh', '.hhh', 'hhhh', 'hhhH', 'hhhH', 'hhhH', 'hhH.', 'hhH.', 'hhH.', 'hhH.', 'hHH.', 'hH..', 'HH..', 'H...']],
  pinchos: [26, 10, ['...h...h', '..hh..hhh', '.hh..hh.h']],
  coleta: [30, 11, ['hhh', '.hh', '..h']],
};

// --- Gorras ------------------------------------------------------------------------------------------------------
const GORRAS = {
  ninguna: null,
  clasica: [14, 1, [
    '........cccccc',
    '......ccccllllcc',
    '....cccccllllllcc',
    '...ccccccclllllccc',
    '..Cccccccccllllcccc',
    '..Ccccccccccccccccc',
    '..CCccccccccccccccc',
    '...CCcccccccccccccccc',
    '...CCCccccccccccccccqlll',
    '....CCCCCCCCCCCCCCCvvvvvvv',
  ]],
  reves: [7, 1, [
    '...............cccccc',
    '.............ccccllllcc',
    '...........cccccllllllcc',
    '..........cccccccllllllcc',
    '.........Cccccccccclllcccc',
    '.........Ccccccccccccccccc',
    '.........CCccccccccccccccc',
    '.lllcccCCCcccccccccccvvccc',
    'lccccccCCCCcccccccccvvvvcc',
    '.vvvvvvvvCCCCCCCCCCCCCCCC',
  ]],
  lana: [14, 1, [
    '........www',
    '.......wwwwW',
    '.......WwwWW',
    '.....cccWWccc',
    '....cccccccccccc',
    '...ccccccccccccccc',
    '..Cccccccccccccccc',
    '..Cccccccccccccccc',
    '..CCccccccccccccccc',
    '..lclclclclclclclcl',
    '..vlvlvlvlvlvlvlvlv',
  ]],
  visera: [15, 8, [
    '.ccccccccccccccccc',
    '.llllllllllllllllllllll',
    '..CCCCCCCCCCCCCCCvvvvvvv',
  ]],
  explorador: [8, 1, [
    '.............cccccc',
    '...........cccclllcc',
    '..........cccclllllcc',
    '..........cccccllllcc',
    '..........cccccccccccc',
    '..........nnnnnnnnnnnnn',
    '..........CCCCCCCCCCCCC',
    '....lllccccccccccccccccclll',
    '.lllccccccccccccccccccccccccl',
    '..CCvvvvvvvvvvvvvvvvvvvvvvCC',
  ]],
};

// --- Torsos (columna 15, fila 17) ----------------------------------------------------------------------------
const CHAQUETAS = {
  cazadora: [15, 17, [
    '',
    '........sSd',
    '........SSd',
    '.....qqjwwWjq',
    '...qqjjjwwwwjjJ',
    '..qjjjjjjwwwqjjJ',
    '.qjjjjjjjwwwqjjjJ',
    '.qjjjjjjjwwwqjjjJJ',
    '.jjjjjjjjwwwqjjjjJ',
    '.jjjjjjjjwwwqjjjjJ',
    '.jjjjjjjjwwWqjjjjJ',
    '.Jjjjjjjjwwwqjjjjo',
    '.Jjjjjjjjwwwqjjjjo',
    '.Jjjjojjjwwwqjjjjo',
    '..Jjjojjjwwwqjjjo',
    '..Jjjjjjjwwwqjjjo',
    '..Jjjjjjjwwwqjjjo',
    '..Jjjjjjjwwwqjjjo',
    '..JJjjjjjwwWqjjJo',
    '...JjjjjjwWWqjJo',
    '...JJjjjjWWWqJJo',
    '...oJoJoJoJoJoJo',
    '...JoJoJoJoJoJoJ',
  ]],
  sudadera: [15, 17, [
    '..JJjjq',
    '.JJjjjjqsSd',
    '.JjjjjjjqSSq',
    '.Jjjjjjjjqqqjq',
    '..qjjjjjjjwjwjjJ',
    '..qjjjjjjjwjwjjjJ',
    '.qjjjjjjjjwjwjjjJJ',
    '.qjjjjjjjjjjjjjjJJ',
    '.jjjjjjjjjjjjjjjjJ',
    '.jjjjjjjjjjjjjjjjJ',
    '.jjjjjjjjjjjjjjjjJ',
    '.Jjjjjjjjjjjjjjjjo',
    '.Jjjjjjjjjjjjjjjjo',
    '.Jjjjjjjjjjjjjjjjo',
    '..Jjjjjjqoooooqjo',
    '..Jjjjjjojjjjjojo',
    '..Jjjjjjojjjjjojo',
    '..Jjjjjjojjjjjojo',
    '..JJjjjjojjjjjoJo',
    '...JjjjjoooooooJ',
    '...JJjjjjjjjjjJJ',
    '...qqqqqqqqqqqqq',
    '...oJoJoJoJoJoJo',
  ]],
  chaleco: [15, 17, [
    '',
    '........sSd',
    '.......wSSdw',
    '.....wwwWSSWww',
    '...wwjjjwwwwjjw',
    '..wwjjjjjwwwqjjW',
    '.wwjjjjjjwwwqjjjW',
    '.wjjjjjjjwwwqjjjWW',
    '.wjjjjjjjwwwqjjjjW',
    '.Wjjjjjjjwwwqjjjjj',
    '.Wjjqqqjjwwwqjjjjj',
    '.Jjjjjjjjwwwqjjjjo',
    '.Jjjjjjjjwwwqjjjjo',
    '.Jjjjjjjjwwwqjjjjo',
    '..JjjjjjjwwwqNjjo',
    '..Jjjqqqjwwwqjjjo',
    '..Jjjqqqjwwwqjjjo',
    '..JjjjjjjwwwqNjjo',
    '..JJjjjjjwWWqjjJo',
    '...JjjjjjWWWqjJo',
    '...WWWWWWWWWWWWW',
    '...nnnnnnNnnnnnn',
    '...nnnnnnnnnnnnn',
  ]],
  deportiva: [15, 17, [
    '.......qjjjj',
    '.......qjSdjj',
    '......qjjjjjjj',
    '.....qwjjjjwjjq',
    '...wwjjjjjjwjjjw',
    '..wjjjjjjjjwjjjjw',
    '.qjjjjjjjjjwjjjjJw',
    '.qjjjjjjjjjwjjjjJJ',
    '.jjjjjjjjjjwjjjjJJ',
    '.jjjjjjjjjjwjjjjjJ',
    '.jjjjjjjjjjwjjjjjJ',
    '.Jjjjjjjjjjwjjjjjo',
    '.Jjjjjjjjjjwjjjjjo',
    '.Jjjjjjjjjjwjjjjjo',
    '..Jjjjjjjjjwjjjjo',
    '..Jjjjjjjjjwjjjjo',
    '..Jjjjjjjjjwjjjjo',
    '..Jjjjjjjjjwjjjjo',
    '..JJjjjjjjjwjjjJo',
    '...JjjjjjjjwjjJo',
    '...JJjjjjjjwjJJo',
    '...wwwwwwwwwwwww',
    '...JJJJJJJJJJJJJ',
  ]],
  abrigo: [14, 17, [
    '........bbbbb',
    '......bbbbbbbB',
    '.....bbbbbbbbbB',
    '.....qBbbbbbbbBjq',
    '....qqjjjjbbbBjjjJ',
    '...qjjjjjjbbbqjjjjJ',
    '..qjjjjjjjbbBqjjjjJJ',
    '..qjjjjjjjbbbqjjjjJJ',
    '..jjjjjjjjbbBqjjjjJJ',
    '..jjjjjjjjbbbqNjjjjJ',
    '..jjjjjjjjbBbqjjjjjJ',
    '..Jjjjjjjjb.bqjjjjjo',
    '..Jjjjjjjjb.bqjjjjjo',
    '..Jjjjjjjjjjjqjjjjjo',
    '...JjjjjjjjjjqNjjjo',
    '...Jjjjjjjjjjqjjjjo',
    '...Jjjjjjjjjjqjjjjo',
    '...Jjjjjjjjjjqjjjjo',
    '...JJjjjjjjjjqjjjJo',
    '....JjjjjjjjjqjjJo',
    '....JjjjjjjjjqjjJo',
    '...nnnnnnnnnnnNnnn',
    '...Jjjjjjjjjjjqjjjo',
    '...Jjjjjjjjjjjqjjjjo',
    '...Jjjjjjjjjjj.qjjjo',
    '..Jjjjjjjjjjjj.qjjjo',
    '..Jjjjojjjjjjj..qjjjo',
    '..Jjjjojjjjjjj..qjjjo',
    '.JJjjjojjjjjjjj..qjjjo',
    '.JJjjjojjjjjjjj..qjjjjo',
    '.JJjjjojjjjjjjj...qjjjo',
    '.JJjjjojjjjjjjj...qjjjjo',
    'JJJjjjojjjjjjjjj...qjjjo',
    'JJJjjjojjjjjjjjj...qjjjjo',
    'JJJjjjojjjjjjjjj...qjjjjo',
    'JJJJjjojjjjjjjjj...qjjjjo',
    'JJJJJJJJJJJJJJJJ....JJJJo',
  ]],
};

// --- Piernas: la de atrás (derecha del dibujo) y la de delante con las caderas ------------------------------
const PIERNAS = {
  // De pie, en contrapposto: el peso en la de delante (recta) y la de atrás relajada, con la rodilla adelantada.
  quieto: {
    atras: [24, 42, [
      '.PpppppG',
      '.PpppppG',
      '.PppppppG',
      '..PppppppG',
      '..PppppppG',
      '..PppppppG',
      '...PppppppG',
      '...PppppppG',
      '...PppppppG',
      '....PpppppG',
      '....PpppppG',
      '....PpppppG',
      '....PppppG',
      '....PppppG',
      '...PpppppG',
      '...PppppG',
      '...PppppG',
      '...PppppG',
      '...PppppG',
      '...PppppG',
      '...PppppG',
      '...PPPPPG',
      '...kzzzzz',
      '...zzzzzzzz',
      '...zzzzzzzzz',
      '...ZzzzzzzzzZ',
      '...yyyyyyyyyy',
      '...YYYYYYYYYY',
    ]],
    delante: [17, 39, [
      '.gppppppppppppP',
      '.gppppppppppppP',
      '.gpppppppppppPP',
      '.gppppppppppPPP',
      '.gpppppppPPPPP',
      '.gpppppppP',
      '.gpppppppP',
      '.gpppppppP',
      '.gpppppppP',
      '.gppppppP',
      '.gppppppP',
      '..gpppppP',
      '..gpppppP',
      '..gpppppP',
      '..gpppppP',
      '..gpppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '..PPPPPP',
      '..kzzzzz',
      '.kzzzzzzzz',
      '.zzzzzzzzzz',
      '.ZzzzzzzzzZ',
      '.yyyyyyyyyy',
      '.YYYYYYYYYY',
    ]],
  },
  // Zancada: la de atrás adelante y la de delante atrás (también al lanzar y al ordenar: da un paso).
  zancada: {
    atras: [24, 42, [
      '.PpppppG',
      '.PppppppG',
      '..PppppppG',
      '..PppppppG',
      '...PppppppG',
      '...PppppppG',
      '....PppppppG',
      '....PpppppG',
      '.....PpppppG',
      '.....PpppppG',
      '......PpppppG',
      '......PppppG',
      '......PppppG',
      '.......PppppG',
      '.......PppppG',
      '.......PppppG',
      '........PppppG',
      '........PppppG',
      '........PppppG',
      '........PppppG',
      '........PppppG',
      '........PPPPPG',
      '........kzzzzzz',
      '........zzzzzzzzz',
      '........zzzzzzzzzz',
      '........ZzzzzzzzzzZ',
      '........yyyyyyyyyyy',
      '........YYYYYYYYYYY',
    ]],
    delante: [11, 39, [
      '.......gppppppppppppP',
      '.......gppppppppppppP',
      '.......gpppppppppppPP',
      '......gppppppppppPPPP',
      '......gpppppppPPPP',
      '......gppppppP',
      '.....gppppppP',
      '.....gppppppP',
      '....gppppppP',
      '....gpppppP',
      '...gppppppP',
      '...gpppppP',
      '...gpppppP',
      '..gpppppP',
      '..gppppP',
      '..gppppP',
      '..gppppP',
      '.gppppP',
      '.gppppP',
      '.gppppP',
      '.gppppP',
      'gppppP',
      'gppppP',
      'gppppP',
      'PPPPPP',
      'kzzzzz',
      'zzzzzzzz',
      'zzzzzzzzz',
      'ZzzzzzzzZ',
      'yyyyyyyyy',
      'YYYYYYYYY',
    ]],
  },
  // Paso intermedio: la de delante recta y la de atrás doblada, con el pie en el aire.
  cruce: {
    atras: [23, 42, [
      '..PpppppG',
      '..PppppppG',
      '...PppppppG',
      '...PppppppG',
      '....PppppppG',
      '....PppppppG',
      '.....PppppppG',
      '.....PppppppG',
      '.....PppppppG',
      '.....PpppppG',
      '....PppppppG',
      '....PppppG',
      '...PpppppG',
      '...PppppG',
      '...PppppG',
      '..PpppppG',
      '..PppppG',
      '..PppppG',
      '..PppppG',
      '..PPPPPG',
      '..kzzzzz',
      '..zzzzzzzz',
      '..ZzzzzzzzZ',
      '..yyyyyyyyy',
      '..YYYYYYYYY',
    ]],
    delante: null, // la misma que de pie
  },
};
PIERNAS.cruce.delante = PIERNAS.quieto.delante;

// Falda (encima de las piernas, debajo de la chaqueta), con sus tablas.
const FALDA = [15, 39, [
  '..gppppppppppppP',
  '..gpppppppppppppP',
  '..gppPpppPppppPppP',
  '.gpppPpppPpppppPppP',
  '.gpppPppppPppppPpppP',
  '.gpppPppppPppppPpppP',
  'gppppPppppPpppppPpppP',
  'gppppPppppPpppppPpppP',
  'gGpppGppppGpppppGpppG',
  'GGGGGGGGGGGGGGGGGGGGG',
]];

// Filas donde cambia cada parte de la pierna (para vestirla según el pantalón).
const MUSLO = 46;       // por encima, caderas (siempre pantalón o falda)
const CORTO_HASTA = 53; // el pantalón corto llega hasta aquí
const RODILLA = 55;
const TOBILLO = 63;     // dobladillo del pantalón largo
const A_PIEL = { g: 't', p: 's', P: 'S', G: 'd' };
const A_CALCETIN = { g: '7', p: '7', P: '8', G: '8' };
const A_RAYA = { g: '9', G: '0' };

/** La pieza de una pierna con el pantalón que toca: largo, corto (piel desde la rodilla) o falda (piel y calcetines). */
function vestir(pieza, tipo) {
  if (!pieza) return null;
  const [x0, y0, filas] = pieza;
  return [x0, y0, filas.map((fila, k) => {
    const y = y0 + k;
    let cambio = null;
    if (tipo === 'deportivo') cambio = A_RAYA;
    else if (tipo === 'corto') cambio = y >= TOBILLO - 2 ? A_CALCETIN : y >= CORTO_HASTA ? A_PIEL : null;
    else if (tipo === 'falda') cambio = y >= RODILLA + 2 ? A_CALCETIN : y >= MUSLO ? A_PIEL : null;
    return cambio ? fila.replace(/[gpPG]/g, l => cambio[l] || l) : fila;
  })];
}

// --- Brazos ------------------------------------------------------------------------------------------------------
// El de atrás asoma por la derecha del cuerpo (en sombra).
const BRAZOS_ATRAS = {
  colgado: [30, 21, [
    '..AAA',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '.AAAAQ',
    '..AAAQ',
    '..FFFV',
    '..FFFFV',
    '..FFFFV',
    '..FFFFV',
    '..FFFFV',
    '..FFFFV',
    '..FFFFV',
    '..FFFFV',
    '..uuuuV',
    '..SSSSd',
    '..SSSSd',
    '..SSSdd',
    '...Sdd',
  ]],
  // Señala al frente con el índice: sale de detrás del pecho, así no tapa la cara.
  ordena: [28, 17, [
    '...............ss',
    '.............uusss',
    '...........fuussssS',
    '.........fffuusssSS',
    '.......afffffuSSSS',
    '.....aaaafffFFuSS',
    '..aaaaaaaFFFF',
    '.aaaaaaAAA',
    '.aaaaaAA',
    '.aaaAAQ',
    '.AAAAQ',
    '..AAQ',
  ]],
};

// El de delante, según la pose.
const BRAZOS = {
  // Sostiene la Poké Ball delante, a la altura de la cintura.
  quieto: [12, 20, [
    '...qaa',
    '..qaaaa',
    '..aaaaaA',
    '.qaaaaaA',
    '.aaaaaaA',
    '.aaaaaAA',
    '.axaaaAA',
    '.axaaaAA',
    '.axaaaAA',
    '.axaaaAA',
    '.axaaaA...rrrr',
    '.axaaaA..rrirrR',
    '..aaaaA..rrrrRR',
    '..ffffFF.KKwwKK',
    '..fffffFFwwwwwW',
    '...ufffffswwwW',
    '....uusssssSS',
    '......ssSSS',
  ]],
  colgado: [12, 20, [
    '...qaa',
    '..qaaaa',
    '..aaaaaA',
    '.qaaaaaA',
    '.aaaaaaA',
    '.aaaaaAA',
    '.axaaaAA',
    '.axaaaAA',
    '.axaaaA',
    '.axaaaA',
    '.axaaaA',
    '.axaaaA',
    '.aaaaaA',
    '.ffffFF',
    '.ffffFF',
    '.ffffFF',
    '.ffffFF',
    '.ffffF',
    '.ffffF',
    '.ffffF',
    '.ffffF',
    '.uuuuF',
    '.ssssS',
    '.sssSS',
    '.sSsSS',
    '..SSd',
  ]],
  // Brazo atrás y arriba, con la Poké Ball por encima de la cabeza.
  lanza1: [5, 1, [
    '...rrrr',
    '..rrirrR',
    '..rrrrRR',
    '..KKwwKK',
    '..wwwwwW',
    '..swwwWs',
    '..sssssS',
    '...sssS',
    '...uuuu',
    '...ffffF',
    '...ffffF',
    '...fffffF',
    '....ffffF',
    '....aaaaaA',
    '.....aaaaaA',
    '.....qaaaaaA',
    '......qaaaaaA',
    '.......qaaaaaA',
    '........qaaaaaA',
    '.........qaaaaA',
    '..........qaaaA',
    '...........aaA',
  ]],
  // La suelta: el brazo estirado hacia delante, la mano abierta.
  lanza2: [14, 20, [
    '..qqaaaa',
    '.qaaaaaaaaaa',
    '.aaaaaaaaaaaaaff',
    '.aaxxxxxaaaaaafffffff',
    '..AAaaaaaaaaafffffffffuu.ss',
    '....AAAAAAAAAFFfffffffuusssss',
    '...............FFFFFFFuussssS',
    '......................uuSsSS',
    '.........................SS',
  ]],
  // Puño en alto.
  celebra: [10, 1, [
    '...ssss',
    '..sssssS',
    '..ssssSS',
    '..SsSsSS',
    '...uuuuu',
    '...ffffF',
    '...ffffF',
    '...ffffF',
    '...ffffF',
    '...ffffF',
    '...ffffFF',
    '...aaaaaA',
    '...aaaaaA',
    '...aaaaaA',
    '....aaaaaA',
    '....aaaaaA',
    '.....aaaaaA',
    '.....qaaaaA',
    '......qaaaaA',
    '......qaaaaA',
    '.......qaaaA',
    '........aaA',
  ]],
};

/** El brazo que cuelga, balanceado al caminar: desde el codo, `dx` píxeles adelante (+) o atrás (−). */
function balancear([x0, y0, filas], dx) {
  return [x0, y0, filas.map((fila, k) => (k < 13 || !dx ? fila : dx > 0 ? '.'.repeat(dx) + fila : fila.slice(-dx)))];
}

// --- Aspecto --------------------------------------------------------------------------------------------------
const valido = (valor, lista) => lista.includes(valor);
/** Un aspecto completo y válido (lo que falte o no exista se toma del inicial). */
export function normalizarAspecto(aspecto = {}) {
  const { gorras, chaquetas, pantalones, peinados, colores, pieles, pelos } = ASPECTO_ENTRENADOR;
  const hexes = colores.map(([, c]) => c);
  const a = { ...ASPECTO_INICIAL };
  if (!aspecto || typeof aspecto !== 'object') return a;
  if (aspecto.gorra in gorras) a.gorra = aspecto.gorra;
  if (aspecto.chaqueta in chaquetas) a.chaqueta = aspecto.chaqueta;
  if (aspecto.pantalon in pantalones) a.pantalon = aspecto.pantalon;
  if (aspecto.peinado in peinados) a.peinado = aspecto.peinado;
  if (valido(aspecto.colorGorra, hexes)) a.colorGorra = aspecto.colorGorra;
  if (valido(aspecto.colorChaqueta, hexes)) a.colorChaqueta = aspecto.colorChaqueta;
  if (valido(aspecto.colorPantalon, hexes)) a.colorPantalon = aspecto.colorPantalon;
  if (valido(aspecto.piel, pieles)) a.piel = aspecto.piel;
  if (valido(aspecto.pelo, pelos.map(([, c]) => c))) a.pelo = aspecto.pelo;
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

// --- Composición -----------------------------------------------------------------------------------------------

const mover = (pieza, dx, dy) => pieza && [pieza[0] + dx, pieza[1] + dy, pieza[2]];
const moverTrazos = (trazos, dx, dy) => trazos.map(([x, y, t]) => [x + dx, y + dy, t]);

/** Las capas (de atrás adelante) de un entrenador en una pose: cada una, una lista de piezas. */
function capasDe(a, pose, paso) {
  const triste = pose === 'triste';
  const [cx, cy] = triste ? [1, 2] : [0, 0]; // la cabeza gacha
  const gesto = triste ? 'cerrado' : pose === 'celebra' ? 'contento' : pose === 'ordena' || pose === 'lanza2' ? 'decidido' : 'normal';
  const piernas = pose === 'paso' ? (paso ? PIERNAS.cruce : PIERNAS.zancada) : pose === 'lanza2' || pose === 'ordena' ? PIERNAS.zancada : PIERNAS.quieto;
  const brazo = pose === 'paso' ? balancear(BRAZOS.colgado, paso ? -1 : 2) : triste || pose === 'ordena' ? BRAZOS.colgado : BRAZOS[pose] || BRAZOS.quieto;
  const caraYPelo = [mover(CABEZA, cx, cy), mover(PELO_DELANTE[a.peinado], cx, cy)];
  return [
    { piezas: [mover(PELO_ATRAS[a.peinado], cx, cy)] },
    { piezas: [pose === 'ordena' ? BRAZOS_ATRAS.ordena : BRAZOS_ATRAS.colgado] },
    { piezas: [vestir(piernas.atras, a.pantalon)] },
    { piezas: [vestir(piernas.delante, a.pantalon)] },
    a.pantalon === 'falda' && a.chaqueta !== 'abrigo' ? { piezas: [FALDA] } : null,
    { piezas: [CHAQUETAS[a.chaqueta] || CHAQUETAS.cazadora] },
    { piezas: caraYPelo, trazos: moverTrazos(cara(gesto), cx, cy) },
    { piezas: [mover(GORRAS[a.gorra], cx, cy)] },
    { piezas: [brazo] },
  ].filter(Boolean);
}

/** Pinta las letras de una capa en una rejilla de colores (null = transparente). */
function rasterizar({ piezas, trazos = [] }, paleta) {
  const color = new Array(W * H).fill(null);
  const poner = (x, y, letra) => { if (x >= 0 && y >= 0 && x < W && y < H && paleta[letra]) color[y * W + x] = paleta[letra]; };
  for (const pieza of piezas) {
    if (!pieza) continue;
    const [x0, y0, filas] = pieza;
    filas.forEach((fila, dy) => { for (let dx = 0; dx < fila.length; dx++) if (fila[dx] !== '.') poner(x0 + dx, y0 + dy, fila[dx]); });
  }
  for (const [x, y, texto] of trazos) for (let dx = 0; dx < texto.length; dx++) if (texto[dx] !== '.') poner(x + dx, y, texto[dx]);
  return color;
}

function dibujar(a, pose, paso) {
  const paleta = paletaDe(a);
  const final = new Array(W * H).fill(null);
  for (const capa of capasDe(a, pose, paso)) {
    const color = rasterizar(capa, paleta);
    const bordes = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (color[i]) continue;
      // El vecino a la derecha o debajo: este borde está arriba o a la izquierda de la forma (lado iluminado).
      let vecino = null; let iluminado = false;
      if (x + 1 < W && color[i + 1]) { vecino = color[i + 1]; iluminado = true; } else if (y + 1 < H && color[i + W]) { vecino = color[i + W]; iluminado = true; } else if (x > 0 && color[i - 1]) vecino = color[i - 1];
      else if (y > 0 && color[i - W]) vecino = color[i - W];
      if (vecino) bordes.push([i, contorno(vecino, y, iluminado, final[i])]);
    }
    for (const [i, c] of bordes) final[i] = c;
    color.forEach((c, i) => { if (c) final[i] = c; });
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  const imagen = ctx.createImageData(W, H);
  final.forEach((c, i) => {
    if (!c) return;
    const [r, g, b] = aRgb(c);
    imagen.data.set([r, g, b, 255], i * 4);
  });
  ctx.putImageData(imagen, 0, 0);
  return lienzo;
}

const cache = new Map();

/**
 * El lienzo (48×72) de un entrenador con ese aspecto, en esa pose. `paso` (0 o 1) alterna las piernas al caminar.
 * Mira a la derecha; para el rival, se dibuja volteado.
 */
export function lienzoEntrenador(aspecto, pose = 'quieto', paso = 0) {
  const a = normalizarAspecto(aspecto);
  const clave = JSON.stringify(a) + pose + paso;
  if (!cache.has(clave)) cache.set(clave, dibujar(a, pose, paso));
  return cache.get(clave);
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

/** Vuelve a pintar un retrato ya creado (el creador lo usa al cambiar una pieza o en su animación). */
export function pintarRetrato(lienzo, aspecto, { escala = 4, pose = 'quieto', paso = 0, volteado = false, dy = 0 } = {}) {
  lienzo.width = W * escala;
  lienzo.height = H * escala;
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.save();
  if (volteado) { ctx.translate(lienzo.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(lienzoEntrenador(aspecto, pose, paso), 0, dy * escala, lienzo.width, lienzo.height);
  ctx.restore();
}
