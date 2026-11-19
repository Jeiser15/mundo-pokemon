// Fuente de píxeles 5×7 para escribir en el lienzo de la arena (arena-pixel.js): números de daño
// y letreros. Cada letra son 7 filas de 5 píxeles ('#' = píxel encendido). Solo hay mayúsculas sin
// tilde, cifras y unos pocos signos: el texto se normaliza antes de dibujarlo.

const GLIFOS = {
  A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .###.', H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####', 3: '####. ....# ....# .###. ....# ....# ####.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ....# .###.',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', '¡': '..#.. ..... ..#.. ..#.. ..#.. ..#.. ..#..',
  '.': '..... ..... ..... ..... ..... ..... ..#..', '-': '..... ..... ..... .###. ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....', '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  '×': '..... #...# .#.#. ..#.. .#.#. #...# .....', ' ': '..... ..... ..... ..... ..... ..... .....',
};
// Cada glifo pasa a una lista de [columna, fila] encendidas.
const PIXELES = Object.fromEntries(Object.entries(GLIFOS).map(([letra, dibujo]) => [letra,
  dibujo.split(' ').flatMap((fila, y) => [...fila].flatMap((c, x) => (c === '#' ? [[x, y]] : [])))]));

/** «¡Ventaja ×½!» → «¡VENTAJA ×1/2!»: mayúsculas, sin tildes y con las fracciones escritas. */
export const normalizarTexto = texto => texto.replaceAll('½', '1/2').replaceAll('¼', '1/4')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Ancho en píxeles de un texto a cierta escala (cada letra ocupa 5 + 1 de separación). */
export const anchoTexto = (texto, escala = 1) => Math.max(0, normalizarTexto(texto).length * 6 - 1) * escala;

/**
 * Escribe en el lienzo con la fuente de píxeles.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} texto
 * @param {number} x  borde izquierdo (o centro si alinear = 'centro')
 * @param {number} y  borde superior
 * @param {object} [o] escala (entera), color, borde (color del contorno o null), alinear ('izq' | 'centro')
 */
export function dibujarTexto(ctx, texto, x, y, { escala = 1, color = '#fff', borde = '#1b1410', alinear = 'izq' } = {}) {
  const limpio = normalizarTexto(texto);
  const inicio = Math.round(alinear === 'centro' ? x - anchoTexto(limpio, escala) / 2 : x);
  const pintar = (dx, dy, relleno) => {
    ctx.fillStyle = relleno;
    [...limpio].forEach((letra, i) => {
      for (const [px, py] of PIXELES[letra] || PIXELES[' ']) {
        ctx.fillRect(inicio + (i * 6 + px) * escala + dx, Math.round(y) + py * escala + dy, escala, escala);
      }
    });
  };
  if (borde) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2]]) pintar(dx * escala, dy * escala, borde);
  }
  pintar(0, 0, color);
}
