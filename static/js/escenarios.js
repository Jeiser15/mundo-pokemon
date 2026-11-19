// Escenarios del Duelo Pokémon, en pixel art (los usa arena-pixel.js y, como vista previa, duelo.js).
//
// El mundo mide 480×270 unidades (1 unidad = 1 píxel del fondo). Cada escenario se dibuja una sola vez,
// píxel a píxel, con una semilla fija (siempre sale igual): un fondo al fondo (muro, mar, bosque…), el
// suelo donde se lucha con dos PLATAFORMAS (una por Pokémon, como en los juegos) y adornos alrededor.
// Lo que se mueve (lava, olas, luciérnagas, nieve, antorchas…) lo dibuja crearAmbiente() en cada fotograma
// con los pinceles de la arena: `suelo` (detrás de los Pokémon) y `aire` (delante).
//
//   bosque — claro de un bosque antiguo: troncos gigantes, raíces, un arroyo, un corro de setas y rayos de luz;
//   volcan — cráter volcánico: río y cascada de lava, grietas que brillan, obsidiana y fumarolas;
//   playa  — costa tropical: mar con olas, muelle, palmeras, una barca y una poza con estrellas de mar;
//   cueva  — cueva de cristal: cristales gigantes que iluminan de colores, estalactitas y un lago subterráneo;
//   nieve  — cumbre nevada al anochecer: montañas, aurora, pinos con nieve, un estanque helado y faroles;
//   ruinas — ruinas antiguas: muro con arco, columnas con antorchas, baldosas con arena y un mosaico de runas.

export const ANCHO = 480;
export const ALTO = 270;
export const SUELO = 178;                          // línea de los pies de los luchadores
export const CASA = { jugador: 150, rival: 330 };  // dónde se coloca cada uno (y su plataforma)

const lerp = (a, b, t) => a + (b - a) * t;

/** Números al azar repetibles (mulberry32): el escenario sale siempre igual. */
function generador(semilla) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const paleta = (...colores) => colores.map(aRgb);
// Tramado ordenado (Bayer 4×4): los degradados se hacen con puntitos, como en el pixel art de los juegos.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16);
const umbral = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
/** Un color de la paleta según n (0–1), con tramado entre tonos vecinos. */
const tonoDe = (colores, n, x, y) => colores[Math.max(0, Math.min(colores.length - 1, Math.floor(n * colores.length + (umbral(x, y) - 0.5) * 0.95)))];

/** Ruido suave: una rejilla de valores al azar interpolada (manchas grandes y blandas). */
function ruido(azar, celda) {
  const columnas = Math.ceil(ANCHO / celda) + 2;
  const valores = Array.from({ length: columnas * (Math.ceil(ALTO / celda) + 2) }, azar);
  const v = (i, j) => valores[j * columnas + i];
  return (x, y) => {
    const gx = Math.max(0, x) / celda; const gy = Math.max(0, y) / celda;
    const i = Math.floor(gx); const j = Math.floor(gy);
    let fx = gx - i; let fy = gy - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(v(i, j), v(i + 1, j), fx), lerp(v(i, j + 1), v(i + 1, j + 1), fx), fy);
  };
}

/** Pinceles de píxel nítido (sin suavizado) sobre un contexto 2D. */
function herramientas(ctx) {
  const punto = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const elipse = (cx, cy, rx, ry, c) => {
    ctx.fillStyle = c;
    for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) {
      const a = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
      ctx.fillRect(Math.round(cx) - a, Math.round(cy) + dy, a * 2 + 1, 1);
    }
  };
  /** Polígono relleno por filas (bordes de píxel, sin difuminar). */
  const poligono = (puntos, c) => {
    ctx.fillStyle = c;
    const ys = puntos.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const cortes = [];
      for (let i = 0; i < puntos.length; i++) {
        const [x0, y0] = puntos[i]; const [x1, y1] = puntos[(i + 1) % puntos.length];
        const yc = y + 0.5;
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) cortes.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      cortes.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cortes.length; k += 2) ctx.fillRect(Math.round(cortes[k]), y, Math.max(1, Math.round(cortes[k + 1]) - Math.round(cortes[k])), 1);
    }
  };
  /** Línea de píxeles (Bresenham), de `grosor` píxeles. */
  const linea = (x0, y0, x1, y1, c, grosor = 1) => {
    ctx.fillStyle = c;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      ctx.fillRect(x0 - Math.floor(grosor / 2), y0 - Math.floor(grosor / 2), grosor, grosor);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  const trazo = (puntos, c, grosor = 1) => { for (let i = 1; i < puntos.length; i++) linea(puntos[i - 1][0], puntos[i - 1][1], puntos[i][0], puntos[i][1], c, grosor); };
  return { ctx, punto, rect, elipse, poligono, linea, trazo };
}

/** Rellena todo el lienzo píxel a píxel: colorDe(x, y) → [r, g, b]. */
function pintarTerreno(ctx, colorDe) {
  const imagen = ctx.createImageData(ANCHO, ALTO);
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
    const [r, g, b] = colorDe(x, y);
    const i = (y * ANCHO + x) * 4;
    imagen.data[i] = r; imagen.data[i + 1] = g; imagen.data[i + 2] = b; imagen.data[i + 3] = 255;
  }
  ctx.putImageData(imagen, 0, 0);
}

/**
 * Luces de colores sobre lo ya dibujado (cristales, lava, faroles…), en escalones con tramado.
 * luces: [{ x, y, r, ry?, color: '#rrggbb', fuerza }]. Con fuerza negativa, oscurece (sombras, viñeta).
 */
function iluminar(ctx, luces) {
  const imagen = ctx.getImageData(0, 0, ANCHO, ALTO);
  const d = imagen.data;
  const fuentes = luces.map(l => ({ ...l, rgb: aRgb(l.color || '#000000'), ry: l.ry || l.r }));
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
    let r = 0; let g = 0; let b = 0; let sombra = 0;
    for (const l of fuentes) {
      const dx = (x - l.x) / l.r; const dy = (y - l.y) / l.ry; const d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const f = Math.floor((1 - Math.sqrt(d2)) ** 1.6 * 5 + umbral(x, y)) / 5 * Math.abs(l.fuerza);
      if (l.fuerza < 0) sombra = Math.max(sombra, f);
      else { r += l.rgb[0] * f; g += l.rgb[1] * f; b += l.rgb[2] * f; }
    }
    if (!r && !g && !b && !sombra) continue;
    const i = (y * ANCHO + x) * 4;
    const k = 1 - Math.min(0.9, sombra);
    d[i] = Math.min(255, d[i] * k + r); d[i + 1] = Math.min(255, d[i + 1] * k + g); d[i + 2] = Math.min(255, d[i + 2] * k + b);
  }
  ctx.putImageData(imagen, 0, 0);
}

/** Plataforma de batalla bajo cada Pokémon: un óvalo con borde, cara y brillo (y un adorno propio). */
function plataformas(h, { borde, cara, luz, sombra = 'rgba(0,0,0,0.28)', adorno = null }) {
  for (const x of [CASA.jugador, CASA.rival]) {
    const y = SUELO + 2;
    h.elipse(x + 2, y + 3, 35, 12, sombra);
    h.elipse(x, y, 34, 11, borde);
    h.elipse(x, y - 1, 32, 9, cara);
    h.elipse(x - 8, y - 4, 15, 3, luz);
    if (adorno) adorno(x, y);
  }
}

// --- Bosque antiguo -------------------------------------------------------------------------------------
const MUSGO = paleta('#203a1d', '#294823', '#32562a', '#3c6431', '#477239', '#548141');
const TIERRA_BOSQUE = paleta('#3a2a1b', '#463220', '#523b26', '#5e452d');
const ARROYO = [[-8, 150], [22, 172], [44, 198], [58, 226], [66, 252], [70, 278]];
const TRONCOS = [[-4, 30], [38, 22], [86, 34], [140, 20], [190, 30], [246, 24], [300, 36], [352, 22], [400, 30], [452, 34]];

function bosque(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 22); const tierra = ruido(azar, 46);
  pintarTerreno(ctx, (x, y) => {
    let n = manchas(x, y) * 0.72 + azar() * 0.28;
    const claro = Math.hypot((x - 240) / 200, (y - 172) / 80); // el claro del centro, más iluminado
    n += 0.22 * Math.max(0, 1 - claro);
    if (tierra(x, y) > 0.7 && y > 70) return tonoDe(TIERRA_BOSQUE, n, x, y);
    return tonoDe(MUSGO, n, x, y);
  });
  // Fondo: el bosque cerrado y los troncos gigantes con sus raíces.
  h.rect(0, 0, ANCHO, 60, '#101e10');
  for (let i = 0; i < 70; i++) { const x = azar() * ANCHO; h.elipse(x, azar() * 18, 10 + azar() * 12, 7 + azar() * 6, azar() < 0.5 ? '#14281a' : '#1a321e'); }
  for (const [x, w] of TRONCOS) {
    const base = 54 + Math.round(azar() * 8);
    h.rect(x - w / 2, 0, w, base, '#2a1c12');
    h.rect(x - w / 2 + 2, 0, w - 4, base, '#3e2a1a');
    for (let k = 0; k < w / 5; k++) h.rect(x - w / 2 + 3 + k * 5 + azar() * 2, 0, 1, base, azar() < 0.5 ? '#2a1c12' : '#54391f');
    h.rect(x - w / 2 + 3, 0, 3, base, '#6a4a2c'); // luz por la izquierda
    for (const s of [-1, 1]) for (let r = 0; r < 2; r++) { // raíces que se hunden en el musgo
      const largo = 10 + azar() * 16; const ancho = 4 + azar() * 4; const sale = x + s * (w / 2 - 4 - r * 6);
      h.poligono([[sale - ancho / 2, base - 8], [sale + ancho / 2, base - 8], [sale + s * largo + 1, base + 6 + r * 3], [sale + s * largo - 2, base + 7 + r * 3]], '#3a2818');
    }
  }
  // Sombra donde el bosque se junta con el claro.
  for (let y = 56; y < 76; y++) for (let x = 0; x < ANCHO; x++) if (umbral(x, y) < (76 - y) / 22) h.punto(x, y, 'rgba(10,20,10,0.35)');
  // Arroyo que baja por la izquierda, con piedras en la orilla.
  for (let i = 1; i < ARROYO.length; i++) {
    const [x0, y0] = ARROYO[i - 1]; const [x1, y1] = ARROYO[i];
    for (let q = 0; q <= 1; q += 0.04) {
      const x = lerp(x0, x1, q); const y = lerp(y0, y1, q); const r = 11 + i * 1.5;
      h.elipse(x, y, r + 3, 4, '#2a3a28'); h.elipse(x, y, r, 3.5, '#2a5a78'); h.elipse(x - 2, y, r - 4, 2, '#336a8a');
    }
  }
  for (let i = 1; i < ARROYO.length; i++) for (let q = 0; q < 1; q += 0.25) {
    const [x0, y0] = ARROYO[i - 1]; const [x1, y1] = ARROYO[i];
    const x = lerp(x0, x1, q); const y = lerp(y0, y1, q);
    h.rect(x - 3, y - 1, 4, 1, '#5aa0c0');
    for (const s of [-1, 1]) if (azar() < 0.6) { const px = x + s * (15 + i * 1.5 + azar() * 3); h.elipse(px, y, 2.5, 1.5, '#6a6a60'); h.punto(px - 1, y - 1, '#9a9a8a'); }
  }
  // Tronco caído abajo a la derecha, con anillos y musgo.
  h.poligono([[372, 246], [474, 228], [478, 242], [376, 260]], '#2a1c12');
  h.poligono([[373, 247], [473, 230], [476, 238], [375, 255]], '#5a3c22');
  h.trazo([[376, 248], [472, 231]], '#7a5632');
  for (let i = 0; i < 18; i++) h.punto(380 + i * 5, 246 - i * 0.9 - 1, i % 2 ? '#4f8a3c' : '#6aa04a');
  h.elipse(374, 253, 4, 7, '#3a2818'); h.elipse(374, 253, 3, 5, '#8a6a42'); h.elipse(374, 253, 1, 2, '#5a3c22');
  // Helechos y arbustos en los bordes.
  const arbusto = (x, y, r) => { h.elipse(x + 2, y + 3, r, r * 0.7, 'rgba(8,16,8,0.4)'); h.elipse(x, y, r, r * 0.75, '#1f3f22'); h.elipse(x - 2, y - 2, r * 0.7, r * 0.5, '#2f5a2c'); h.elipse(x - r * 0.4, y - r * 0.4, r * 0.3, r * 0.22, '#4f8a3c'); };
  for (const [x, y, r] of [[8, 90, 14], [470, 96, 15], [12, 128, 10], [472, 150, 12], [120, 264, 12], [210, 268, 10], [300, 266, 13], [10, 268, 14], [468, 204, 10]]) arbusto(x, y, r);
  // Corro de setas alrededor del claro (las de las hadas), sin pisar las plataformas.
  const seta = (x, y, roja) => {
    h.rect(x - 1, y - 2, 2, 3, '#e8dcc0');
    h.elipse(x, y - 3, 3, 1.5, roja ? '#b8301e' : '#9a6a3a');
    h.punto(x - 1, y - 4, roja ? '#ffffff' : '#c89a5a'); if (roja) h.punto(x + 1, y - 3, '#ffffff');
  };
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const x = 240 + Math.cos(a) * 168; const y = 172 + Math.sin(a) * 60;
    if (y < 82 || y > 252 || Math.hypot(x - CASA.jugador, y - SUELO) < 40 || Math.hypot(x - CASA.rival, y - SUELO) < 40) continue;
    seta(x + azar() * 4, y + azar() * 3, i % 3 !== 0);
  }
  for (let i = 0; i < 9; i++) { const [tx] = TRONCOS[Math.floor(azar() * TRONCOS.length)]; const x = tx + (azar() - 0.5) * 30; const y = 66 + azar() * 8; h.rect(x, y - 2, 1, 2, '#a8c8c0'); h.elipse(x, y - 3, 2, 1, '#5ad8e0'); } // setas que brillan junto a los troncos
  // Hojas caídas y florecillas.
  for (let i = 0; i < 260; i++) {
    const x = azar() * ANCHO; const y = 70 + azar() * 200;
    if (azar() < 0.3) h.punto(x, y, ['#c88a3a', '#d8b04a', '#a0582a'][Math.floor(azar() * 3)]);
    else if (azar() < 0.25) h.punto(x, y, ['#f4efe0', '#c8a0ff', '#ffd75e'][Math.floor(azar() * 3)]);
    else { h.punto(x, y, '#6aa04a'); h.punto(x, y + 1, '#2a4a22'); }
  }
  // Plataformas: círculos de musgo mullido con flores.
  plataformas(h, {
    borde: '#1f3a1c', cara: '#4c8038', luz: '#6aa04a',
    adorno: (x, y) => { for (let i = 0; i < 10; i++) { const a = azar() * Math.PI * 2; h.punto(x + Math.cos(a) * 26, y + Math.sin(a) * 7, ['#ffd75e', '#f4efe0', '#f2a0c0'][i % 3]); } },
  });
  // Luz del sol que entra en el claro y sombra en las esquinas.
  iluminar(ctx, [
    { x: 240, y: 168, r: 230, ry: 100, color: '#3a3418', fuerza: 0.9 },
    { x: 0, y: 270, r: 160, fuerza: -0.5 }, { x: 480, y: 270, r: 140, fuerza: -0.4 },
  ]);
}

// --- Cráter volcánico -----------------------------------------------------------------------------------
const BASALTO = paleta('#171315', '#1e181c', '#262024', '#2e262c', '#383036', '#443a40');
const LAVA = ['#7a1a08', '#c8320c', '#ff5a10', '#ff8a20', '#ffc040', '#fff0a0'];
const RIO_LAVA = y => 46 + Math.sin(y / 31) * 2; // borde de arriba del río (por x)
const FUMAROLAS = [[96, 92], [392, 104], [208, 238], [452, 196]];
const POZA_LAVA = { x: 44, y: 250, rx: 76, ry: 26 };
const CASCADA = { x: 322, ancho: 18 };

function volcan(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 18); const coladas = ruido(azar, 50);
  pintarTerreno(ctx, (x, y) => {
    const n = manchas(x, y) * 0.82 + azar() * 0.18;
    if (coladas(x, y) > 0.66) return tonoDe(paleta('#2a1a1a', '#34201e', '#3e2622'), n, x, y); // coladas antiguas, rojizas
    return tonoDe(BASALTO, n, x, y);
  });
  // Pared del cráter arriba: roca con aristas.
  const pared = [];
  for (let x = 0; x <= ANCHO; x += 12) pared.push([x, 22 + Math.sin(x / 23) * 6 + azar() * 8]);
  h.poligono([[0, 0], ...pared, [ANCHO, 0]], '#120e10');
  h.trazo(pared, '#3a2a2a', 2);
  for (let i = 0; i < 60; i++) { const x = azar() * ANCHO; const y = azar() * 24; h.rect(x, y, 2 + azar() * 6, 1, azar() < 0.5 ? '#2a2024' : '#0c0a0a'); }
  // Río de lava al pie de la pared, con costras.
  for (let x = 0; x < ANCHO; x++) {
    const arriba = Math.round(RIO_LAVA(x) - 6 + Math.sin(x / 9) * 1.5); const abajo = Math.round(RIO_LAVA(x) + 10 + Math.sin(x / 13 + 1) * 2);
    for (let y = arriba; y <= abajo; y++) {
      const borde = Math.min(y - arriba, abajo - y);
      const i = borde < 1 ? 0 : borde < 2 ? 1 : borde < 4 ? 2 + (umbral(x, y) > 0.5 ? 1 : 0) : 3 + (umbral(x, y) > 0.3 ? 1 : 0);
      h.punto(x, y, LAVA[i]);
    }
  }
  for (let i = 0; i < 22; i++) { const x = azar() * ANCHO; h.elipse(x, RIO_LAVA(x) + 2 + azar() * 4, 3 + azar() * 5, 1.5, '#3a1a12'); } // costras flotando
  // Cascada de lava que cae por la pared.
  for (let y = 0; y < RIO_LAVA(CASCADA.x); y++) {
    const w = CASCADA.ancho / 2 + Math.sin(y / 5) * 1.5;
    for (let x = -w; x <= w; x++) h.punto(CASCADA.x + x, y, LAVA[Math.min(5, 2 + Math.round((1 - Math.abs(x) / w) * 3 * (0.6 + umbral(x | 0, y) * 0.5)))]);
  }
  // Poza de lava abajo a la izquierda.
  h.elipse(POZA_LAVA.x, POZA_LAVA.y, POZA_LAVA.rx + 4, POZA_LAVA.ry + 3, '#100a0a');
  h.elipse(POZA_LAVA.x, POZA_LAVA.y, POZA_LAVA.rx, POZA_LAVA.ry, LAVA[1]);
  h.elipse(POZA_LAVA.x, POZA_LAVA.y + 1, POZA_LAVA.rx - 6, POZA_LAVA.ry - 4, LAVA[2]);
  h.elipse(POZA_LAVA.x + 4, POZA_LAVA.y + 2, POZA_LAVA.rx - 18, POZA_LAVA.ry - 10, LAVA[3]);
  for (let i = 0; i < 9; i++) h.elipse(POZA_LAVA.x - 40 + azar() * 90, POZA_LAVA.y - 12 + azar() * 22, 3 + azar() * 4, 1.5, '#3a1a12');
  // Grietas que brillan por todo el suelo.
  for (let i = 0; i < 26; i++) {
    let x = azar() * ANCHO; let y = 70 + azar() * 195; let dir = azar() * Math.PI * 2;
    for (let k = 0; k < 14 + azar() * 22; k++) {
      dir += (azar() - 0.5) * 1.1;
      const nx = x + Math.cos(dir) * 2; const ny = y + Math.sin(dir) * 1.2;
      h.linea(x, y + 1, nx, ny + 1, '#0c0808'); h.linea(x, y, nx, ny, k % 5 === 0 ? '#ffc040' : '#e0501a');
      x = nx; y = ny;
    }
  }
  // Obsidiana: cristales negros y morados en los bordes.
  const obsidiana = (x, y, alto) => {
    h.poligono([[x - 4, y], [x + 4, y], [x + 1, y - alto], [x - 1, y - alto + 1]], '#0a0610');
    h.poligono([[x - 2, y], [x, y], [x, y - alto + 2]], '#3a2a5a');
    h.punto(x - 1, y - alto + 3, '#9a8acf');
  };
  for (const [x, y, n] of [[20, 120, 4], [462, 128, 5], [440, 262, 4], [150, 258, 3], [470, 80, 3], [12, 82, 3]]) for (let i = 0; i < n; i++) obsidiana(x + (i - n / 2) * 7 + azar() * 3, y + azar() * 4, 10 + azar() * 12);
  // Rocas sueltas con el borde iluminado por la lava.
  for (const [x, y, r] of [[200, 94, 6], [268, 250, 7], [360, 240, 5], [118, 210, 5], [420, 160, 6], [60, 170, 5]]) {
    h.elipse(x + 2, y + 2, r, r * 0.6, 'rgba(0,0,0,0.4)'); h.elipse(x, y, r, r * 0.65, '#2a2226'); h.elipse(x - 1, y - 1, r * 0.7, r * 0.4, '#3e3438'); h.rect(x - r + 1, y - 1, 2, 2, '#ff8a3a');
  }
  // Fumarolas (de ellas sale humo).
  for (const [x, y] of FUMAROLAS) { h.elipse(x, y, 7, 3, '#4a4044'); h.elipse(x, y, 4, 2, '#0a0606'); h.punto(x, y, '#ff5a10'); }
  // Plataformas: roca volcánica enfriada, con el borde agrietado al rojo.
  plataformas(h, {
    borde: '#0e0a0c', cara: '#3a3036', luz: '#544a50',
    adorno: (x, y) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + azar() * 0.3; h.linea(x + Math.cos(a) * 26, y + Math.sin(a) * 7, x + Math.cos(a) * 33, y + Math.sin(a) * 9.5, i % 2 ? '#e0501a' : '#ff8a20'); } },
  });
  // Resplandor rojizo de la lava.
  iluminar(ctx, [
    { x: 240, y: 52, r: 300, ry: 46, color: '#5a1a04', fuerza: 0.9 },
    { x: CASCADA.x, y: 40, r: 60, color: '#6a2408', fuerza: 0.9 },
    { x: POZA_LAVA.x, y: POZA_LAVA.y, r: 140, ry: 70, color: '#6a2408', fuerza: 0.9 },
    { x: 480, y: 270, r: 160, fuerza: -0.35 },
  ]);
}

// --- Costa tropical -------------------------------------------------------------------------------------
const MAR = paleta('#103a6a', '#17528a', '#1f6ca4', '#2888bc', '#3aa6cc', '#5ac4d6');
const ARENA = paleta('#d2b984', '#dcc490', '#e4ce9c', '#ecd8a8', '#f2e2b6');
/** Borde del agua (ondulado). */
const ORILLA = x => 60 + Math.sin(x / 41) * 4 + Math.sin(x / 13) * 1.5;
const MUELLE = { x: 368, ancho: 30, hasta: 96 };
const POZA_MAREA = { x: 420, y: 236, rx: 34, ry: 13 };

function playa(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 16); const olas = ruido(azar, 10);
  pintarTerreno(ctx, (x, y) => {
    const borde = ORILLA(x);
    if (y < borde) { // mar: más hondo arriba, turquesa en la orilla
      const n = (y / borde) * 0.75 + olas(x * 2, y * 3) * 0.25;
      return tonoDe(MAR, n, x, y);
    }
    let n = manchas(x, y) * 0.6 + azar() * 0.25 + 0.15;
    if (y < borde + 7) n -= 0.55; // arena mojada
    n += Math.sin((x + y * 0.6) / 4 + manchas(x, y) * 6) * 0.08; // ondas del viento en la arena
    return tonoDe(ARENA, n, x, y);
  });
  // Espuma fija en la orilla (la que se mueve la dibuja el ambiente).
  for (let x = 0; x < ANCHO; x++) if (umbral(x, 0) < 0.7) h.punto(x, ORILLA(x) - 1, '#e8f6f8');
  // Muelle de madera que entra en el mar.
  const { x: mx, ancho: mw, hasta } = MUELLE;
  for (const px of [mx - mw / 2 + 2, mx + mw / 2 - 4]) for (let y = 4; y < hasta; y += 18) { h.rect(px, y + 6, 3, 6, '#2a1a0e'); }
  for (let y = 0; y < hasta; y += 4) { h.rect(mx - mw / 2, y, mw, 3, y % 8 ? '#8a5e34' : '#9a6c3e'); h.rect(mx - mw / 2, y + 3, mw, 1, '#4a3018'); }
  h.rect(mx - mw / 2 - 1, 0, 2, hasta, '#5a3c20'); h.rect(mx + mw / 2 - 1, 0, 2, hasta, '#5a3c20');
  h.elipse(mx + mw / 2 + 5, 30, 4, 4, '#ffffff'); h.elipse(mx + mw / 2 + 5, 30, 2, 2, '#2a88bc'); h.rect(mx + mw / 2 + 1, 29, 2, 2, '#e04848'); h.rect(mx + mw / 2 + 8, 29, 2, 2, '#e04848'); // flotador
  // Barca varada en la arena (arriba a la izquierda).
  h.elipse(72, 86, 22, 8, 'rgba(60,40,10,0.3)');
  h.poligono([[50, 78], [92, 78], [86, 90], [56, 90]], '#4a2a14');
  h.poligono([[52, 79], [90, 79], [85, 88], [57, 88]], '#b8582a');
  h.rect(54, 79, 34, 2, '#f0e0c0'); h.rect(62, 81, 2, 7, '#7a3a18'); h.rect(76, 81, 2, 7, '#7a3a18');
  h.linea(92, 80, 104, 96, '#d8c8a0'); // la cuerda
  // Palmeras (tronco curvo y copa de hojas).
  const palmera = (x, y, lado) => {
    h.elipse(x + 18 * lado, y + 6, 22, 7, 'rgba(70,50,10,0.28)');
    const tronco = []; for (let i = 0; i <= 8; i++) tronco.push([x + Math.sin(i / 8 * 1.2) * 10 * lado, y - i * 6]);
    for (let i = 1; i < tronco.length; i++) { h.linea(tronco[i - 1][0], tronco[i - 1][1], tronco[i][0], tronco[i][1], '#5a3c1e', 5); h.linea(tronco[i][0] - 1, tronco[i][1], tronco[i][0] + 1, tronco[i][1], '#8a6236', 2); }
    const [cx, cy] = tronco[tronco.length - 1];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.2; const largo = 18 + (k % 2) * 5;
      const puntas = []; for (let s = 0; s <= 6; s++) { const q = s / 6; puntas.push([cx + Math.cos(a) * largo * q, cy + Math.sin(a) * largo * q * 0.6 + q * q * 7]); }
      h.trazo(puntas, '#1f5a26', 3); h.trazo(puntas, k % 2 ? '#3f8a3a' : '#4f9a42', 1);
    }
    h.elipse(cx, cy + 1, 3, 2, '#6a4a1e'); h.punto(cx - 2, cy + 2, '#8a6a2e'); h.punto(cx + 2, cy + 2, '#8a6a2e');
  };
  palmera(22, 150, 1); palmera(14, 262, 1); palmera(462, 168, -1); palmera(150, 274, 1);
  // Poza de marea con rocas, algas y estrellas de mar.
  const { x: px, y: py, rx, ry } = POZA_MAREA;
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; h.elipse(px + Math.cos(a) * (rx + 2), py + Math.sin(a) * (ry + 2), 4, 3, '#6a6458'); h.punto(px + Math.cos(a) * (rx + 2) - 1, py + Math.sin(a) * (ry + 2) - 1, '#9a9484'); }
  h.elipse(px, py, rx, ry, '#2a7a98'); h.elipse(px, py + 1, rx - 4, ry - 3, '#3a9ab4');
  for (let i = 0; i < 5; i++) h.trazo([[px - 20 + i * 9, py + 6], [px - 19 + i * 9, py + 1], [px - 21 + i * 9, py - 4]], '#2a6a3a');
  const estrella = (x, y, c) => { h.punto(x, y, c); h.punto(x - 1, y, c); h.punto(x + 1, y, c); h.punto(x, y - 1, c); h.punto(x - 1, y + 1, c); h.punto(x + 1, y + 1, c); };
  estrella(px + 10, py - 2, '#f07a3a'); estrella(px - 12, py + 3, '#e84a7a');
  // Conchas, estrellas de mar y huellas.
  for (let i = 0; i < 46; i++) {
    const x = azar() * ANCHO; const y = ORILLA(x) + 10 + azar() * (ALTO - 80);
    if (Math.hypot(x - CASA.jugador, (y - SUELO) * 3) < 44 || Math.hypot(x - CASA.rival, (y - SUELO) * 3) < 44) continue;
    if (azar() < 0.15) estrella(x, y, ['#f07a3a', '#e84a7a', '#f0c040'][Math.floor(azar() * 3)]);
    else { const c = ['#fff4e6', '#f6c3c8', '#f0a060', '#e8d0ff'][Math.floor(azar() * 4)]; h.punto(x, y, c); h.punto(x + 1, y, c); h.punto(x, y + 1, '#b89a6a'); }
  }
  for (let i = 0; i < 9; i++) { const x = 190 + i * 11; const y = 248 - i * 3 + (i % 2) * 4; h.elipse(x, y, 1.5, 1, '#c4a872'); } // huellas
  // Castillo de arena.
  h.rect(250, 246, 16, 8, '#c8a872'); h.rect(248, 242, 4, 6, '#d4b47e'); h.rect(264, 242, 4, 6, '#d4b47e'); h.rect(255, 238, 6, 8, '#dcbc88');
  h.rect(255, 236, 1, 2, '#c8a872'); h.rect(258, 236, 1, 2, '#c8a872'); h.rect(260, 236, 1, 2, '#c8a872'); h.rect(257, 231, 1, 5, '#7a5a3a'); h.rect(258, 231, 3, 2, '#e04848');
  // Plataformas: dos círculos dibujados con un palo en la arena (como hacen los niños para jugar).
  for (const x of [CASA.jugador, CASA.rival]) {
    const y = SUELO + 2;
    for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; const r = 33 + Math.sin(a * 3 + x) * 1.2; h.punto(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.32, '#b8975e'); h.punto(x + Math.cos(a) * r, y + 1 + Math.sin(a) * r * 0.32, '#f6e8c4'); }
    h.elipse(x, y, 24, 7, 'rgba(255,248,220,0.18)');
  }
  iluminar(ctx, [{ x: 240, y: 170, r: 260, ry: 120, color: '#2a2210', fuerza: 0.6 }, { x: 480, y: 0, r: 120, color: '#203040', fuerza: 0.5 }]);
}

// --- Cueva de cristal -----------------------------------------------------------------------------------
const ROCA_CUEVA = paleta('#0d0a16', '#130f20', '#1a142a', '#211a36', '#2a2142', '#352a52');
const CRISTAL = {
  cian: ['#0a2e3c', '#157a96', '#4ac8e4', '#d0f8ff'], magenta: ['#3e0a34', '#9a2a80', '#e862c8', '#ffd6f4'],
  ambar: ['#3e2408', '#a8641a', '#ecb04a', '#fff0c0'], verde: ['#0a3220', '#178a52', '#52e09a', '#d0ffe6'],
};
const CRISTALES = [
  { x: 56, y: 92, color: 'cian', n: 7, alto: 50 }, { x: 424, y: 90, color: 'magenta', n: 8, alto: 56 },
  { x: 34, y: 252, color: 'ambar', n: 7, alto: 44 }, { x: 448, y: 248, color: 'verde', n: 7, alto: 46 },
  { x: 236, y: 54, color: 'cian', n: 5, alto: 26 }, { x: 166, y: 262, color: 'magenta', n: 4, alto: 22 },
];
const LAGO = { x: 314, y: 74, rx: 46, ry: 11 };
const ESTALACTITAS = [40, 96, 150, 196, 288, 344, 392, 446];

function cueva(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 14); const losas = ruido(azar, 40);
  pintarTerreno(ctx, (x, y) => {
    let n = manchas(x, y) * 0.65 + azar() * 0.25 + (losas(x, y) > 0.6 ? 0.15 : 0);
    if (y < 50) n *= 0.6;
    return tonoDe(ROCA_CUEVA, n, x, y);
  });
  // Pared de la cueva arriba, con vetas, y estalactitas.
  const pared = []; for (let x = 0; x <= ANCHO; x += 10) pared.push([x, 40 + Math.sin(x / 19) * 5 + azar() * 6]);
  h.poligono([[0, 0], ...pared, [ANCHO, 0]], '#0a0812');
  for (let i = 0; i < 26; i++) { const y = 6 + azar() * 34; const x = azar() * ANCHO; h.rect(x, y, 10 + azar() * 30, 1, '#1a1428'); }
  h.trazo(pared, '#2a2040', 2);
  for (const x of ESTALACTITAS) { const largo = 12 + azar() * 14; const base = 40 + Math.sin(x / 19) * 5; h.poligono([[x - 5, base - 4], [x + 5, base - 4], [x, base + largo]], '#1c1630'); h.linea(x - 3, base - 2, x - 1, base + largo - 4, '#3a3058'); }
  // Lago subterráneo, con el reflejo de los cristales.
  h.elipse(LAGO.x, LAGO.y, LAGO.rx + 3, LAGO.ry + 2, '#06040c');
  h.elipse(LAGO.x, LAGO.y, LAGO.rx, LAGO.ry, '#0e1a34');
  h.elipse(LAGO.x - 6, LAGO.y - 1, LAGO.rx - 12, LAGO.ry - 4, '#142446');
  for (let i = 0; i < 7; i++) h.rect(LAGO.x - 34 + i * 10, LAGO.y - 4 + (i % 3) * 3, 5, 1, i % 2 ? '#e862c8' : '#4ac8e4');
  // Estalagmitas por el suelo, en los bordes.
  for (const [x, y, alto] of [[104, 96, 16], [372, 98, 14], [16, 168, 20], [466, 170, 18], [92, 250, 12], [388, 258, 14], [220, 262, 10], [300, 92, 9]]) {
    h.elipse(x, y, 7, 2, 'rgba(0,0,0,0.4)');
    h.poligono([[x - 6, y], [x + 6, y], [x + 1, y - alto], [x - 1, y - alto]], '#211a36');
    h.poligono([[x - 6, y], [x - 1, y], [x - 1, y - alto + 1]], '#3a2e58');
  }
  // Cristales gigantes: prismas con una cara clara y otra oscura.
  const prisma = (x, y, alto, inclina, c) => {
    const w = 4 + alto / 8; const tx = x + inclina * alto; const ty = y - alto;
    h.poligono([[x - w, y], [x + w, y], [tx + w * 0.6, ty + w], [tx, ty], [tx - w * 0.6, ty + w]], c[0]);
    h.poligono([[x - w + 1, y - 1], [x, y - 1], [tx, ty + 2], [tx - w * 0.6 + 1, ty + w]], c[2]);
    h.poligono([[x, y - 1], [x + w - 1, y - 1], [tx + w * 0.6 - 1, ty + w], [tx, ty + 2]], c[1]);
    h.linea(x - w / 2, y - 3, tx - 1, ty + 4, c[3]);
  };
  for (const cr of CRISTALES) {
    const c = CRISTAL[cr.color];
    h.elipse(cr.x, cr.y + 2, 14 + cr.n * 2, 4, '#06040a');
    for (let i = 0; i < cr.n; i++) {
      const lado = (i - (cr.n - 1) / 2);
      prisma(cr.x + lado * 6.5 + azar() * 2, cr.y, cr.alto * (1 - Math.abs(lado) * 0.18) * (0.75 + azar() * 0.3), lado * 0.12 + (azar() - 0.5) * 0.1, c);
    }
  }
  // Musgo luminoso.
  for (let i = 0; i < 70; i++) { const x = azar() * ANCHO; const y = 60 + azar() * 205; if (azar() < 0.6) h.punto(x, y, azar() < 0.5 ? '#2a8a9a' : '#5ad8e0'); }
  // Plataformas: losas de roca con un anillo de runas que brillan.
  plataformas(h, {
    borde: '#0a0812', cara: '#2a2142', luz: '#3e3260',
    adorno: (x, y) => { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; if (i % 3) h.punto(x + Math.cos(a) * 25, y + Math.sin(a) * 6.5, '#5ad8f0'); } },
  });
  iluminar(ctx, [
    ...CRISTALES.map(cr => ({ x: cr.x, y: cr.y - cr.alto / 2, r: 60 + cr.alto * 2.4, ry: 40 + cr.alto, color: CRISTAL[cr.color][1], fuerza: 0.75 })),
    { x: 240, y: 175, r: 170, ry: 70, color: '#1a1a3a', fuerza: 0.8 },
  ]);
}

// --- Cumbre nevada --------------------------------------------------------------------------------------
const NIEVE = paleta('#a8b6d0', '#b8c6dc', '#c8d4e8', '#d6e0f0', '#e4ebf6', '#f2f6fc');
const CIELO = paleta('#1c1a44', '#2a2458', '#3e3070', '#5a3e84', '#7e4e92', '#a8629a');
const ESTANQUE = { x: 240, y: 214, rx: 70, ry: 16 };
const FAROLES = [[118, 86], [362, 86]];

function nieve(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 24); const ventisqueros = ruido(azar, 60);
  pintarTerreno(ctx, (x, y) => {
    if (y < 34) return tonoDe(CIELO, 1 - y / 34, x, y); // cielo del anochecer
    const n = manchas(x, y) * 0.5 + ventisqueros(x, y) * 0.35 + azar() * 0.15 + 0.12;
    return tonoDe(NIEVE, n, x, y);
  });
  for (let i = 0; i < 26; i++) h.punto(azar() * ANCHO, azar() * 22, azar() < 0.3 ? '#ffffff' : '#c8c0e8'); // estrellas
  // Montañas: las lejanas azuladas y la cresta cercana nevada.
  const cordillera = (base, altura, paso, c1, c2, nieveCumbre) => {
    const puntos = []; for (let x = -20; x <= ANCHO + 20; x += paso) puntos.push([x, base - azar() * altura]);
    h.poligono([[-20, base + 6], ...puntos, [ANCHO + 20, base + 6]], c1);
    for (let i = 1; i < puntos.length - 1; i++) {
      const [x, y] = puntos[i];
      if (y < base - altura * 0.45) { h.poligono([[x - 7, y + 8], [x, y], [x + 7, y + 8], [x + 3, y + 6], [x, y + 9], [x - 3, y + 6]], nieveCumbre); h.linea(x, y, x + 6, y + 14, c2); }
    }
  };
  cordillera(38, 24, 30, '#5a5a8e', '#4a4a7a', '#d8d8f0');
  cordillera(52, 16, 22, '#8a96c0', '#6a76a4', '#eef2fa');
  for (let y = 54; y < 62; y++) for (let x = 0; x < ANCHO; x++) if (umbral(x, y) > (62 - y) / 8) h.punto(x, y, '#c8d4e8'); // la nieve sube hasta la cresta
  // Estanque helado con grietas y reflejos.
  const { x: ex, y: ey, rx, ry } = ESTANQUE;
  h.elipse(ex, ey + 1, rx + 4, ry + 3, '#9aaccc');
  h.elipse(ex, ey, rx, ry, '#7ab6d8');
  h.elipse(ex - 8, ey - 2, rx - 14, ry - 5, '#9ad0ea');
  for (let i = 0; i < 4; i++) h.linea(ex - 40 + i * 22, ey - 8 + (i % 2) * 6, ex - 52 + i * 22, ey + 6, '#ffffff');
  let gx = ex - 30; let gy = ey; for (let k = 0; k < 16; k++) { const nx = gx + 4 + azar() * 3; const ny = gy + (azar() - 0.5) * 5; h.linea(gx, gy, nx, ny, '#4a86b0'); gx = nx; gy = Math.max(ey - ry + 4, Math.min(ey + ry - 4, ny)); }
  // Pinos nevados en los bordes (vistos de frente-arriba).
  const pino = (x, y, alto) => {
    h.elipse(x + 6, y + 2, alto * 0.45, alto * 0.14, 'rgba(60,70,120,0.35)');
    h.rect(x - 1, y - 4, 3, 5, '#4a3020');
    for (let t = 0; t < 4; t++) {
      const yb = y - 3 - t * alto * 0.22; const w = alto * 0.38 * (1 - t * 0.2);
      h.poligono([[x - w, yb], [x + w, yb], [x, yb - alto * 0.34]], '#12382c');
      h.poligono([[x - w, yb], [x, yb - alto * 0.34], [x, yb]], '#1c4a38');
      h.poligono([[x - w * 0.75, yb - 2], [x, yb - alto * 0.3], [x + w * 0.5, yb - 3], [x + w * 0.2, yb - 1]], '#eef4fc'); // nieve encima
    }
  };
  for (const [x, y, a] of [[14, 110, 40], [40, 92, 30], [466, 112, 42], [440, 94, 28], [18, 214, 36], [462, 222, 40], [48, 262, 30], [430, 268, 32], [100, 276, 26]]) pino(x, y, a);
  // Faroles de piedra (con su luz cálida) y rocas con nieve.
  for (const [x, y] of FAROLES) {
    h.elipse(x, y + 1, 9, 3, 'rgba(60,70,120,0.4)');
    h.rect(x - 2, y - 10, 4, 10, '#6a6a7a'); h.rect(x - 6, y - 16, 12, 6, '#7a7a8a'); h.rect(x - 4, y - 15, 8, 4, '#ffcf6a');
    h.poligono([[x - 8, y - 16], [x + 8, y - 16], [x, y - 22]], '#5a5a6a'); h.rect(x - 7, y - 18, 14, 2, '#f4f8ff');
  }
  for (const [x, y, r] of [[196, 98, 7], [300, 260, 8], [86, 180, 6], [400, 176, 6], [356, 232, 5]]) { h.elipse(x, y, r, r * 0.6, '#5a6070'); h.elipse(x - 1, y - 2, r * 0.8, r * 0.35, '#f4f8ff'); }
  // Huellas que cruzan el campo.
  for (let i = 0; i < 16; i++) { const x = 60 + i * 24; const y = 140 + Math.sin(i / 2) * 8 + (i % 2) * 4; h.elipse(x, y, 1.5, 1, '#a8b6d0'); h.punto(x - 2, y - 2, '#a8b6d0'); h.punto(x + 2, y - 2, '#a8b6d0'); }
  // Plataformas: nieve pisada, con el borde amontonado.
  plataformas(h, { borde: '#a8b8d4', cara: '#d6e0ee', luz: '#f4f8ff', sombra: 'rgba(60,70,120,0.3)' });
  iluminar(ctx, [
    ...FAROLES.map(([x, y]) => ({ x, y: y - 10, r: 58, ry: 34, color: '#5a3a10', fuerza: 0.8 })),
    { x: 240, y: 0, r: 300, ry: 60, color: '#2a1a40', fuerza: 0.35 },
    { x: 0, y: 270, r: 140, fuerza: -0.25 }, { x: 480, y: 270, r: 140, fuerza: -0.25 },
  ]);
}

// --- Ruinas antiguas ------------------------------------------------------------------------------------
const ARENISCA = paleta('#9a7a50', '#a8865a', '#b69264', '#c29e6e', '#cfab7a', '#dab886');
const ARENA_RUINAS = paleta('#cfb27a', '#d9bc86', '#e2c690');
const ANTORCHAS = [[64, 108], [416, 108], [52, 236], [428, 238]];
const MOSAICO = { x: 240, y: 176, rx: 64, ry: 22 };

function ruinas(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 20); const dunas = ruido(azar, 44);
  const LOSA = 22; const LOSA_ALTO = 15; // losas grandes, más bajas que anchas por la perspectiva
  const tonoLosa = new Map();
  pintarTerreno(ctx, (x, y) => {
    const arena = dunas(x, y) + (Math.abs(x - 240) / 240) * 0.25;
    const n = manchas(x, y) * 0.5 + azar() * 0.2;
    if (arena > 0.78) return tonoDe(ARENA_RUINAS, n + 0.3, x, y);
    const fila = Math.floor(y / LOSA_ALTO); const col = Math.floor(x / LOSA);
    const lx = x % LOSA; const ly = y % LOSA_ALTO;
    if (lx === 0 || ly === 0) return aRgb('#8a6c48'); // juntas
    const clave = fila * 100 + col;
    if (!tonoLosa.has(clave)) tonoLosa.set(clave, azar());
    let t = tonoLosa.get(clave) * 0.5 + n;
    if (lx === 1 || ly === 1) t += 0.25; // canto iluminado
    if (lx === LOSA - 1 || ly === LOSA_ALTO - 1) t -= 0.25;
    return tonoDe(ARENISCA, t, x, y);
  });
  // Grietas y hierba entre las losas.
  for (let i = 0; i < 40; i++) { let x = azar() * ANCHO; let y = 64 + azar() * 200; for (let k = 0; k < 6 + azar() * 8; k++) { h.punto(x, y, '#6a5034'); x += azar() < 0.6 ? 1 : 0; y += Math.round((azar() - 0.5) * 2); } }
  for (let i = 0; i < 120; i++) { const x = Math.round(azar() * 22) * 22; const y = 60 + azar() * 205; h.punto(x, y, '#6a8a3a'); h.punto(x, y - 1, '#8aaa4a'); } // hierba en las juntas
  // Muro del templo al fondo, con un gran arco oscuro y dos estatuas guardianas.
  h.rect(0, 0, ANCHO, 58, '#6a5038');
  for (let fila = 0; fila < 5; fila++) for (let x = -(fila % 2) * 12; x < ANCHO; x += 24) {
    h.rect(x + 1, fila * 11 + 1, 22, 9, ['#8a6c48', '#967650', '#7e6242'][Math.floor(azar() * 3)]);
    h.rect(x + 1, fila * 11 + 1, 22, 1, '#a8885e');
  }
  h.rect(0, 55, ANCHO, 4, '#4a3624');
  h.poligono([[212, 58], [212, 22], [222, 10], [240, 5], [258, 10], [268, 22], [268, 58]], '#1a120c'); // el arco
  h.poligono([[216, 58], [216, 24], [224, 14], [240, 9], [256, 14], [264, 24], [264, 58]], '#24180e');
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; h.rect(240 + Math.cos(a) * 32 - 3, 34 + Math.sin(a) * 30 - 3, 6, 5, '#a8885e'); } // dovelas
  h.elipse(240, 2, 7, 5, '#d8a84a'); h.elipse(240, 2, 4, 3, '#8a5a1a'); // sol tallado
  const estatua = x => {
    h.rect(x - 9, 44, 18, 14, '#7e6242'); h.rect(x - 9, 44, 18, 2, '#a8885e');
    h.poligono([[x - 7, 44], [x + 7, 44], [x + 6, 26], [x + 2, 20], [x - 2, 20], [x - 6, 26]], '#8a7a6a');
    h.poligono([[x - 6, 26], [x - 9, 16], [x - 3, 21]], '#8a7a6a'); h.poligono([[x + 6, 26], [x + 9, 16], [x + 3, 21]], '#8a7a6a'); // orejas
    h.rect(x - 4, 26, 2, 2, '#3a2a1a'); h.rect(x + 2, 26, 2, 2, '#3a2a1a'); h.rect(x - 7, 30, 3, 14, '#9a8a7a');
  };
  estatua(180); estatua(300);
  for (let i = 0; i < 16; i++) { const x = azar() * ANCHO; const largo = 8 + azar() * 26; for (let y = 0; y < largo; y++) h.punto(x + Math.sin(y / 4) * 1.5, y, y % 3 ? '#3a6a2a' : '#5a8a3a'); } // enredaderas
  // Columnas con antorcha (cuencos de fuego encima; la llama la anima el ambiente).
  for (const [x, y] of ANTORCHAS) {
    h.elipse(x + 3, y + 2, 12, 4, 'rgba(40,24,10,0.4)');
    h.rect(x - 7, y - 26, 14, 26, '#8a6c48'); h.rect(x - 7, y - 26, 3, 26, '#b6966a'); h.rect(x + 4, y - 26, 3, 26, '#6a5034');
    for (let k = 0; k < 3; k++) h.rect(x - 7, y - 24 + k * 8, 14, 1, '#6a5034');
    h.rect(x - 9, y - 30, 18, 4, '#9a7a50');
    h.elipse(x, y - 31, 7, 2.5, '#3a2618'); h.elipse(x, y - 32, 5, 1.5, '#ff8a20');
  }
  // Columna caída abajo, partida en tambores.
  for (let i = 0; i < 4; i++) { const x = 150 + i * 19; const y = 252 - i * 2; h.elipse(x, y, 9, 8, '#6a5034'); h.rect(x - 9, y - 8, 17, 16, '#b69264'); h.rect(x - 9, y - 8, 17, 3, '#d0ae7e'); h.rect(x - 9, y + 6, 17, 2, '#7e6242'); h.elipse(x + 9, y, 3, 8, '#a8865a'); }
  // Dunas de arena en las esquinas.
  for (const [x, y, r] of [[0, 270, 70], [480, 262, 60], [480, 70, 30]]) for (let k = 0; k < 4; k++) h.elipse(x, y, r - k * 12, (r - k * 12) * 0.45, ['#cfb27a', '#d9bc86', '#e2c690', '#ead09a'][k]);
  // Mosaico central: anillo de runas y un sol en el centro.
  const { x: mx, y: my, rx, ry } = MOSAICO;
  h.elipse(mx, my, rx + 3, ry + 2, '#5a3c22');
  h.elipse(mx, my, rx, ry, '#8a5a32');
  h.elipse(mx, my, rx - 10, ry - 4, '#5a3c22');
  h.elipse(mx, my, rx - 12, ry - 5, '#a8784a');
  h.elipse(mx, my, 14, 5, '#d8a84a'); h.elipse(mx, my, 10, 3, '#f0c860');
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; h.linea(mx + Math.cos(a) * 16, my + Math.sin(a) * 6, mx + Math.cos(a) * 34, my + Math.sin(a) * 13, '#d8a84a'); }
  for (let i = 0; i < 14; i++) { // runas en el anillo
    const a = (i / 14) * Math.PI * 2; const x = mx + Math.cos(a) * (rx - 5); const y = my + Math.sin(a) * (ry - 2);
    const forma = i % 4;
    h.punto(x, y - 1, '#f0c860'); h.punto(x, y + 1, '#f0c860');
    if (forma === 0) h.punto(x - 1, y, '#f0c860'); else if (forma === 1) h.punto(x + 1, y, '#f0c860'); else if (forma === 2) { h.punto(x - 1, y - 1, '#f0c860'); h.punto(x + 1, y + 1, '#f0c860'); } else h.punto(x, y, '#f0c860');
  }
  // Plataformas: estrados de piedra tallada con un borde dorado.
  plataformas(h, {
    borde: '#5a4028', cara: '#c29e6e', luz: '#dab886',
    adorno: (x, y) => { for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; h.punto(x + Math.cos(a) * 29, y - 1 + Math.sin(a) * 7.5, '#d8a84a'); } },
  });
  iluminar(ctx, [
    ...ANTORCHAS.map(([x, y]) => ({ x, y: y - 20, r: 64, ry: 40, color: '#5a2a08', fuerza: 0.8 })),
    { x: 240, y: 34, r: 44, ry: 28, fuerza: -0.6 },
    { x: 240, y: 170, r: 240, ry: 110, color: '#2a2010', fuerza: 0.5 },
  ]);
}

const DIBUJOS = { bosque, volcan, playa, cueva, nieve, ruinas };

/** El fondo de un escenario (lienzo de 480×270). Si la clave no existe (una guardada de antes), el primero. */
export function dibujarFondo(escenario) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  (DIBUJOS[escenario] || bosque)(ctx, generador(20261118));
  return lienzo;
}

// --- Lo que se mueve en cada escenario ------------------------------------------------------------------
/**
 * Ambiente animado de un escenario. Devuelve { suelo(p, t), aire(p, t) }: dibujan detrás o delante de los
 * Pokémon con los pinceles de la arena `p` ({ ctx, S, X, Y, cuadro, brillo, aro, trazo, particula, llama,
 * chispa4, reducido, entre }). Con movimiento reducido no suelta partículas.
 */
export function crearAmbiente(escenario) {
  const azar = Math.random;
  switch (escenario in DIBUJOS ? escenario : 'bosque') {
    case 'bosque': {
      const luciernagas = Array.from({ length: 16 }, () => ({ x: 40 + azar() * 400, y: 70 + azar() * 180, fase: azar() * 10, v: 0.4 + azar() * 0.6 }));
      const rayos = [[110, 0.9], [250, 1.3], [372, 1.7]];
      return {
        suelo(p, t) {
          for (let i = 1; i < ARROYO.length; i++) { // destellos del agua que baja
            const q = ((t / 1400 + i / ARROYO.length) % 1);
            const [x0, y0] = ARROYO[i - 1]; const [x1, y1] = ARROYO[i];
            p.cuadro(lerp(x0, x1, q) - 2, lerp(y0, y1, q), 1.5, 'rgba(200,240,255,0.8)');
          }
          for (const [x, fase] of rayos) p.brillo(x + 40, 150, 46, '#fff3b0', 0.12 + Math.sin(t / 900 + fase) * 0.05); // charcos de luz
        },
        aire(p, t) {
          for (const [x, fase] of rayos) { // rayos de sol que entran entre los árboles
            const alfa = 0.07 + Math.sin(t / 900 + fase) * 0.03;
            p.ctx.globalCompositeOperation = 'lighter'; p.ctx.globalAlpha = alfa; p.ctx.fillStyle = '#fff3b0';
            p.ctx.beginPath(); p.ctx.moveTo(p.X(x - 10), p.Y(0)); p.ctx.lineTo(p.X(x + 14), p.Y(0)); p.ctx.lineTo(p.X(x + 70), p.Y(200)); p.ctx.lineTo(p.X(x + 30), p.Y(200)); p.ctx.closePath(); p.ctx.fill();
            p.ctx.globalCompositeOperation = 'source-over'; p.ctx.globalAlpha = 1;
          }
          for (const l of luciernagas) { // luciérnagas que flotan y parpadean
            const x = l.x + Math.sin(t / 1300 * l.v + l.fase) * 18; const y = l.y + Math.sin(t / 900 * l.v + l.fase * 2) * 10;
            const luz = Math.max(0, Math.sin(t / 500 + l.fase));
            if (luz > 0.2) { p.brillo(x, y, 6, '#d8ff6a', luz * 0.7); p.cuadro(x, y, 1, '#f4ffb0'); }
          }
          if (!p.reducido && azar() < 0.02) p.particula({ x: azar() * ANCHO, y: -4, vx: p.entre(-10, 10), vy: p.entre(14, 24), g: 0, vida: 9000, colores: [['#c88a3a', '#d8b04a', '#6aa04a'][Math.floor(azar() * 3)]], tam: 2, forma: 'roca', vgiro: p.entre(-3, 3) }); // hojas que caen
        },
      };
    }
    case 'volcan': {
      const burbujas = [];
      return {
        suelo(p, t) {
          for (let x = 0; x < ANCHO; x += 6) { // corriente del río de lava
            const q = (x + t / 30) % 36;
            if (q < 10) p.cuadro(x, RIO_LAVA(x) + 2 + Math.sin((x + t / 40) / 9) * 2, 2, '#fff0a0');
          }
          for (let y = 2; y < RIO_LAVA(CASCADA.x); y += 5) { const q = (y + t / 20) % 20; if (q < 6) p.cuadro(CASCADA.x + Math.sin(y + t / 200) * 3, y, 2, '#fff0a0'); }
          p.brillo(POZA_LAVA.x, POZA_LAVA.y, 70, '#ff6a1a', 0.25 + Math.sin(t / 700) * 0.08);
          p.brillo(CASCADA.x, 40, 26, '#ff8a20', 0.3 + Math.sin(t / 300) * 0.08);
          if (!p.reducido && azar() < 0.05) burbujas.push({ x: POZA_LAVA.x - 50 + azar() * 90, y: POZA_LAVA.y - 10 + azar() * 18, nace: t });
          if (!p.reducido && azar() < 0.04) { const x = azar() * ANCHO; burbujas.push({ x, y: RIO_LAVA(x) + 2, nace: t }); }
          for (let i = burbujas.length - 1; i >= 0; i--) { // burbujas de lava que se hinchan y revientan
            const b = burbujas[i]; const q = (t - b.nace) / 700;
            if (q >= 1) { burbujas.splice(i, 1); if (!p.reducido) for (let k = 0; k < 4; k++) p.particula({ x: b.x, y: b.y, vx: p.entre(-30, 30), vy: -p.entre(30, 70), g: 200, vida: 500, colores: ['#fff0a0', '#ff8a20', '#7a1a08'], tam: 1.5, capa: 'suelo' }); continue; }
            p.aro(b.x, b.y, 1 + q * 3, 1, '#ffc040', 1, 0.7);
          }
        },
        aire(p) {
          if (p.reducido) return;
          if (azar() < 0.35) p.particula({ x: azar() * ANCHO, y: ALTO + 4, vx: p.entre(-8, 8), vy: -p.entre(18, 46), vida: 5000, colores: ['#fff0a0', '#ff8a20', '#c8320c'], tam: 1.3, brillo: 2 }); // ascuas
          for (const [x, y] of FUMAROLAS) if (azar() < 0.06) p.particula({ x, y: y - 2, vx: p.entre(-6, 6), vy: -p.entre(10, 20), vida: 2600, colores: ['#6a6266', '#3a3438'], tam: 3, tamFin: 9, forma: 'humo', alfa: 0.4 });
        },
      };
    }
    case 'playa': {
      return {
        suelo(p, t) {
          const sube = Math.sin(t / 1100) * 3; // la ola sube y baja por la arena
          for (let x = 0; x < ANCHO; x += 2) {
            const y = ORILLA(x) + sube + Math.sin(x / 9 + t / 400) * 1;
            p.cuadro(x, y, 2, 'rgba(255,255,255,0.9)');
            if ((x / 2) % 3 === 0) p.cuadro(x + 1, y - 2, 1, 'rgba(210,240,255,0.7)');
            if (sube > 0 && (x / 2) % 2 === 0) p.cuadro(x, y + 2, 1, 'rgba(120,180,200,0.35)');
          }
          for (let i = 0; i < 3; i++) { // crestas de olas que llegan desde el fondo
            const y = ((t / 60 + i * 20) % 60);
            for (let x = (i * 37) % 40; x < ANCHO; x += 40) if (y < ORILLA(x) - 4) p.cuadro(x + Math.sin(y) * 4, y, 3, 'rgba(220,245,255,0.55)');
          }
          for (let i = 0; i < 6; i++) { const x = (i * 83 + Math.floor(t / 900) * 37) % ANCHO; const y = 8 + ((i * 29) % 40); if (Math.sin(t / 200 + i) > 0.4) p.chispa4(x, y, 1.5, '#ffffff', 0.8); } // destellos en el agua
          const ciclo = (t / 16000) % 1; // un cangrejo que cruza la arena de lado
          if (ciclo < 0.5) {
            const x = lerp(-10, ANCHO + 10, ciclo * 2); const y = 258 + Math.sin(t / 90) * 0.6;
            p.cuadro(x, y, 3, '#d84a2a'); p.cuadro(x - 2, y - 2, 1.5, '#f06a3a'); p.cuadro(x + 2, y - 2, 1.5, '#f06a3a');
            p.cuadro(x - 1, y - 1, 1, '#ffffff'); p.cuadro(x + 1, y - 1, 1, '#ffffff');
          }
          const gaviota = (t / 11000) % 1; // la sombra de una gaviota que pasa
          if (gaviota < 0.6) { const x = lerp(ANCHO + 20, -20, gaviota / 0.6); const y = 120 + Math.sin(gaviota * 9) * 20; const ala = Math.sin(t / 120) * 2; p.trazo([[x - 6, y - ala], [x, y], [x + 6, y - ala]], 1.6, 'rgba(60,40,10,0.25)'); }
        },
        aire() {},
      };
    }
    case 'cueva': {
      const gotas = [];
      return {
        suelo(p, t) {
          for (const [i, cr] of CRISTALES.entries()) p.brillo(cr.x, cr.y - cr.alto / 2, 22 + cr.alto * 0.6, CRISTAL[cr.color][2], 0.18 + Math.sin(t / 800 + i * 1.7) * 0.1);
          if (!p.reducido && azar() < 0.012) gotas.push({ x: LAGO.x - 30 + azar() * 60, nace: t });
          for (let i = gotas.length - 1; i >= 0; i--) { // gotas del techo que caen al lago
            const g = gotas[i]; const q = (t - g.nace) / 900;
            if (q >= 1.8) { gotas.splice(i, 1); continue; }
            if (q < 1) p.cuadro(g.x, lerp(40, LAGO.y, q * q), 1.2, '#9ad8ff');
            else p.aro(g.x, LAGO.y, 1 + (q - 1) * 14, 1, '#7ac8f0', 1 - (q - 1) / 0.8, 0.3);
          }
          for (let i = 0; i < 5; i++) { const x = LAGO.x - 30 + ((t / 50 + i * 17) % 60); p.cuadro(x, LAGO.y - 2 + (i % 3) * 3, 1, 'rgba(255,200,255,0.6)'); }
        },
        aire(p, t) {
          for (const [i, cr] of CRISTALES.entries()) { // destellos en la punta de los cristales
            const brilla = Math.sin(t / 400 + i * 2.3);
            if (brilla > 0.75) p.chispa4(cr.x + Math.sin(i * 4) * 6, cr.y - cr.alto * 0.9, 2 + (brilla - 0.75) * 10, '#ffffff', (brilla - 0.75) * 4);
          }
          if (!p.reducido && azar() < 0.08) { const cr = CRISTALES[Math.floor(azar() * CRISTALES.length)]; p.particula({ x: cr.x + p.entre(-20, 20), y: cr.y - p.entre(0, cr.alto), vx: p.entre(-6, 6), vy: -p.entre(4, 12), vida: 3000, colores: ['#ffffff', CRISTAL[cr.color][2]], tam: 1.2, brillo: 3 }); }
        },
      };
    }
    case 'nieve': {
      return {
        suelo(p, t) {
          for (let i = 0; i < 3; i++) { // aurora que ondula sobre las montañas
            p.ctx.globalCompositeOperation = 'lighter'; p.ctx.globalAlpha = 0.16;
            p.ctx.fillStyle = ['#4af0a0', '#6ac8ff', '#c87aff'][i];
            for (let x = 0; x < ANCHO; x += 3) { const y = 6 + i * 6 + Math.sin(x / 40 + t / 1500 + i) * 5; p.ctx.fillRect(p.X(x), p.Y(y), 3 * p.S, (5 + Math.sin(x / 17 + t / 900) * 2) * p.S); }
            p.ctx.globalCompositeOperation = 'source-over'; p.ctx.globalAlpha = 1;
          }
          for (const [x, y] of FAROLES) p.brillo(x, y - 13, 16 + Math.sin(t / 130 + x) * 1.5, '#ffcf6a', 0.55);
          for (let i = 0; i < 5; i++) { const brilla = Math.sin(t / 350 + i * 2.1); if (brilla > 0.7) p.chispa4(ESTANQUE.x - 50 + i * 24, ESTANQUE.y - 6 + (i % 2) * 6, 2, '#ffffff', (brilla - 0.7) * 3); }
        },
        aire(p) {
          if (p.reducido) return;
          if (azar() < 0.5) p.particula({ x: p.entre(-20, ANCHO), y: -4, vx: p.entre(4, 16), vy: p.entre(14, 30), vida: 12000, colores: ['#ffffff'], tam: azar() < 0.2 ? 2 : 1.2, alfa: 0.9 }); // nieve
        },
      };
    }
    default: { // ruinas
      return {
        suelo(p, t) {
          for (const [i, [x, y]] of ANTORCHAS.entries()) p.brillo(x, y - 30, 26 + Math.sin(t / 110 + i) * 3, '#ff9a3a', 0.45);
          const pulso = 0.35 + Math.sin(t / 900) * 0.25; // las runas del mosaico laten
          for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; p.brillo(MOSAICO.x + Math.cos(a) * (MOSAICO.rx - 5), MOSAICO.y + Math.sin(a) * (MOSAICO.ry - 2), 4, '#ffd86a', pulso); }
          p.brillo(MOSAICO.x, MOSAICO.y, 16, '#ffd86a', pulso * 0.6);
        },
        aire(p, t) {
          for (const [i, [x, y]] of ANTORCHAS.entries()) { // llamas de las antorchas
            for (let k = 0; k < 3; k++) p.llama(x + Math.sin(t / 90 + k * 2 + i) * 1.5, y - 33 - k * 3, 4.5 - k, Math.PI / 2 + Math.sin(t / 120 + k) * 0.25, 0.95);
          }
          if (!p.reducido && azar() < 0.15) p.particula({ x: -6, y: p.entre(60, ALTO), vx: p.entre(60, 120), vy: p.entre(-8, 8), vida: 5000, colores: ['#f0d8a0', '#d8bc86'], tam: 1, alfa: 0.6 }); // arena que vuela
          if (!p.reducido && azar() < 0.1) { const [x, y] = ANTORCHAS[Math.floor(azar() * ANTORCHAS.length)]; p.particula({ x, y: y - 36, vx: p.entre(-6, 6), vy: -p.entre(20, 40), vida: 900, colores: ['#fff0a0', '#ff8a20'], tam: 1, brillo: 2 }); }
        },
      };
    }
  }
}
