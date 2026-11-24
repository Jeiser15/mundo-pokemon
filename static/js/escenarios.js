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
//   ruinas — ruinas antiguas: muro con arco, columnas con antorchas, baldosas con arena y un mosaico de runas;
//   jardin — jardín de los cerezos: pagoda tras el muro, cerezos en flor, grava rastrillada, estanque con carpas y
//            puente rojo, farolillos de piedra y pétalos al viento;
//   desierto — cañón del desierto: mesetas rojas con estratos, dunas, oasis, cactus, un esqueleto enorme, calima
//            y un matojo que rueda;
//   ciudad — azotea de noche: rascacielos con ventanas, neones, depósito de agua, helipuerto, charcos que reflejan
//            las luces y ventiladores que giran;
//   cielo  — pilar celeste: losas antiguas por encima de un mar de nubes, columnas rotas, islas flotantes, nubes y
//            ráfagas de viento que pasan.
//   estadio — (solo modo aventura: eliminatorias y final) el estadio de la copa de noche: gradas llenas con los
//             colores de la región, focos, paneles de luz, el emblema de las nueve estrellas y el público delante.

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

// --- Estadio de la copa (modo aventura) ------------------------------------------------------------------
const LOSA_ESTADIO = paleta('#121624', '#161b2b', '#1b2133', '#20273c', '#262e46', '#2d3651', '#35405e');
const FOCOS_ESTADIO = [[18, 2], [462, 2]];
const EMBLEMA = { x: 240, y: 178, rx: 40, ry: 13 };
const ANILLO = { x: 240, y: 178, rx: 212, ry: 72 };
const oscurecer = (hex, f) => '#' + aRgb(hex).map(v => Math.min(255, Math.round(v * f)).toString(16).padStart(2, '0')).join('');

function estadio(ctx, azar, { colores = ['#c8d2e6', '#8fa8d8'] } = {}) {
  const h = herramientas(ctx);
  const [ca, cb] = colores;
  const manchas = ruido(azar, 26);
  // Suelo de losas pulidas, más claro en el centro (lo iluminan los focos).
  pintarTerreno(ctx, (x, y) => {
    const lx = x % 40; const ly = (y - 70) % 22;
    let n = manchas(x, y) * 0.45 + azar() * 0.1 + 0.15;
    n += 0.42 * Math.max(0, 1 - Math.hypot((x - 240) / 250, (y - 178) / 100));
    if (lx === 0 || ly === 0) n -= 0.18;
    if (lx === 1 || ly === 1) n += 0.08;
    return tonoDe(LOSA_ESTADIO, n, x, y);
  });
  // Gradas: cielo de noche, techo con bombillas y ocho filas de público con los colores de la región.
  h.rect(0, 0, ANCHO, 70, '#0a0d17');
  for (let i = 0; i < 40; i++) h.punto(azar() * ANCHO, azar() * 7, azar() < 0.5 ? '#56628a' : '#c8d2f0');
  h.rect(0, 7, ANCHO, 4, '#1a2033');
  for (let x = 0; x < ANCHO; x += 12) { h.linea(x, 7, x + 6, 10, '#2c3552'); h.linea(x + 6, 10, x + 12, 7, '#2c3552'); }
  for (let x = 6; x < ANCHO; x += 24) { h.punto(x, 11, '#fff4d0'); h.punto(x, 12, '#8a7a5a'); }
  const pieles = ['#f0c8a0', '#d8a878', '#b07850', '#7a4a30'];
  const camisetas = [ca, ca, cb, cb, '#e9ecf1', '#2b2b36', '#d8433a', '#3a66d4', '#e6bd3a'];
  for (let fila = 0; fila < 8; fila++) {
    const y = 13 + fila * 6;
    const luz = 0.55 + fila * 0.06; // las filas de arriba, más en sombra
    h.rect(0, y + 4, ANCHO, 2, oscurecer('#2a3150', luz));
    for (let x = (fila % 2) * 2; x < ANCHO; x += 4) {
      if (azar() < 0.07) continue;
      const camiseta = camisetas[Math.floor(azar() * camisetas.length)];
      h.rect(x, y + 2, 3, 2, oscurecer(camiseta, luz));
      h.rect(x + 1, y, 2, 2, oscurecer(pieles[Math.floor(azar() * pieles.length)], luz));
      if (azar() < 0.05) h.rect(x + 1, y - 2, 1, 2, oscurecer(camiseta, luz)); // un brazo en alto con su bufanda
    }
  }
  // Pancartas con los colores de la región colgadas de la barandilla.
  for (let x = 20, i = 0; x < ANCHO; x += 64, i++) {
    const color = i % 2 ? cb : ca;
    h.rect(x, 54, 22, 9, oscurecer(color, 0.7)); h.rect(x, 54, 22, 1, color);
    for (let k = 0; k < 3; k++) h.rect(x + 4 + k * 6, 57, 3, 3, color);
    h.rect(x + 2, 63, 2, 1, oscurecer(color, 0.5)); h.rect(x + 18, 63, 2, 1, oscurecer(color, 0.5));
  }
  // Barrera con paneles de luz (el ambiente hace correr la luz por ellos).
  h.rect(0, 63, ANCHO, 7, '#0c0f1a'); h.rect(0, 63, ANCHO, 1, '#3a4466');
  for (let x = 2; x < ANCHO; x += 30) h.rect(x, 65, 26, 3, '#161b2c');
  // Focos en las esquinas: torre y panel de lámparas.
  for (const [fx, fy] of FOCOS_ESTADIO) {
    h.rect(fx - 1, fy + 10, 3, 30, '#252c44');
    h.rect(fx - 12, fy, 25, 11, '#1a2033'); h.rect(fx - 12, fy, 25, 1, '#3a4466');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) h.rect(fx - 10 + i * 4, fy + 2 + j * 4, 3, 3, '#fffbe8');
  }
  // El gran anillo del campo, con la línea de la región dentro.
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    h.punto(ANILLO.x + Math.cos(a) * ANILLO.rx, ANILLO.y + Math.sin(a) * ANILLO.ry, '#56628a');
    if (i % 2) h.punto(ANILLO.x + Math.cos(a) * (ANILLO.rx - 6), ANILLO.y + Math.sin(a) * (ANILLO.ry - 3), oscurecer(ca, 0.7));
  }
  // Emblema del centro: un anillo con nueve estrellas (las nueve regiones) y una línea, como una Poké Ball.
  const { x: ex, y: ey, rx, ry } = EMBLEMA;
  h.elipse(ex, ey, rx + 2, ry + 1, '#0d1120');
  h.elipse(ex, ey, rx, ry, '#2a3352');
  h.elipse(ex, ey, rx - 3, ry - 2, '#1a2036');
  h.rect(ex - rx + 3, ey, (rx - 3) * 2, 1, '#8a96bc');
  h.elipse(ex, ey, 8, 3, '#8a96bc'); h.elipse(ex, ey, 5, 2, '#1a2036'); h.elipse(ex, ey, 2, 1, '#e9ecf1');
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
    const x = ex + Math.cos(a) * (rx - 1.5); const y = ey + Math.sin(a) * (ry - 0.5);
    h.punto(x, y, '#e9ecf1'); h.punto(x - 1, y, '#8a96bc'); h.punto(x + 1, y, '#8a96bc');
  }
  // Plataformas de metal con un aro del color de la región.
  plataformas(h, {
    borde: '#3a4466', cara: '#222a42', luz: '#56628a',
    adorno: (x, y) => { for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2; h.punto(x + Math.cos(a) * 29, y - 1 + Math.sin(a) * 7.5, ca); } },
  });
  // Primera fila del público, a contraluz, delante del campo.
  h.rect(0, 258, ANCHO, 12, '#06080f'); h.rect(0, 256, ANCHO, 2, '#2a3150');
  for (let x = -2; x < ANCHO; x += 7 + Math.floor(azar() * 3)) { h.elipse(x + 3, 256, 3, 4, '#06080f'); if (azar() < 0.15) h.rect(x + 5, 246, 2, 8, '#06080f'); }
  iluminar(ctx, [
    { x: 240, y: 175, r: 260, ry: 105, color: '#2a3250', fuerza: 0.55 },
    ...FOCOS_ESTADIO.map(([x, y]) => ({ x, y: y + 5, r: 40, ry: 26, color: '#8a8060', fuerza: 0.7 })),
    { x: 240, y: 300, r: 300, ry: 80, fuerza: -0.5 },
  ]);
}

// --- Jardín de los cerezos ------------------------------------------------------------------------------
const GRAVA = paleta('#8e8a80', '#9c988c', '#aaa69a', '#b8b4a8', '#c6c2b6', '#d2cec2');
const MUSGO_JARDIN = paleta('#34522a', '#3f6032', '#4a6e3a', '#567c42', '#628a4a');
const CIELO_JARDIN = paleta('#6aaedc', '#84bee4', '#a0ceea', '#bcdcee', '#e6dcea', '#f4dce6');
const ESTANQUE_JARDIN = { x: 92, y: 236, rx: 74, ry: 24 };
const FAROLILLOS = [[52, 112], [428, 112]];
const CEREZOS = [[26, 20, 30], [118, 14, 24], [206, 24, 18], [292, 16, 24], [462, 22, 30]];
/** La distancia «ovalada» a la plataforma más cercana (para los surcos de la grava rastrillada). */
const surco = (x, y) => Math.min(Math.hypot(x - CASA.jugador, (y - SUELO) * 2.8), Math.hypot(x - CASA.rival, (y - SUELO) * 2.8));

function jardin(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 18); const musgo = ruido(azar, 34);
  pintarTerreno(ctx, (x, y) => {
    if (y < 36) return tonoDe(CIELO_JARDIN, y / 36, x, y);
    let n = manchas(x, y) * 0.4 + azar() * 0.18 + 0.28;
    if (musgo(x, y) > 0.76 && y > 70) return tonoDe(MUSGO_JARDIN, n + (musgo(x, y) - 0.76) * 2, x, y);
    n += Math.sin(surco(x, y) / 3.1) * 0.16; // la grava rastrillada en círculos alrededor de cada plataforma
    return tonoDe(GRAVA, n, x, y);
  });
  // Montes lejanos y una pagoda de cinco tejados detrás del muro.
  h.poligono([[0, 36], [60, 18], [130, 30], [200, 12], [290, 28], [360, 16], [480, 30], [480, 40], [0, 40]], '#7a9ec4');
  h.poligono([[0, 38], [90, 28], [170, 36], [260, 24], [380, 34], [480, 26], [480, 42], [0, 42]], '#6a8cb4');
  const pagoda = (x) => {
    for (let k = 0; k < 5; k++) {
      const y = 40 - k * 9; const w = 30 - k * 4;
      h.rect(x - w / 2 + 4, y - 6, w - 8, 6, k % 2 ? '#c8402e' : '#b03424');
      h.rect(x - w / 2 + 6, y - 5, 2, 4, '#f0d8a0'); h.rect(x + w / 2 - 8, y - 5, 2, 4, '#f0d8a0');
      h.poligono([[x - w / 2 - 4, y - 6], [x + w / 2 + 4, y - 6], [x + w / 2 - 2, y - 10], [x - w / 2 + 2, y - 10]], '#2e3440');
      h.punto(x - w / 2 - 5, y - 7, '#2e3440'); h.punto(x + w / 2 + 4, y - 7, '#2e3440');
      h.rect(x - w / 2 + 2, y - 10, w - 4, 1, '#4a5262');
    }
    h.rect(x - 1, -6, 2, 10, '#c89a3a'); for (let k = 0; k < 4; k++) h.rect(x - 2, k * 2 - 4, 4, 1, '#e0b84a');
  };
  pagoda(398);
  // El muro del jardín: tejado de tejas oscuras, enlucido blanco y zócalo de piedra.
  h.rect(0, 40, ANCHO, 18, '#e8e0d0');
  for (let x = 0; x < ANCHO; x += 40) h.rect(x, 40, 2, 18, '#8a5a3a'); // pilares de madera
  h.rect(0, 46, ANCHO, 1, '#d4cab8');
  h.rect(0, 56, ANCHO, 5, '#8a8478'); for (let x = 0; x < ANCHO; x += 9) h.rect(x, 56, 1, 5, '#6a6458');
  h.rect(0, 36, ANCHO, 5, '#363c48'); h.rect(0, 35, ANCHO, 1, '#4e5666');
  for (let x = 0; x < ANCHO; x += 4) h.rect(x, 37, 1, 4, '#262a34');
  h.rect(0, 41, ANCHO, 1, 'rgba(0,0,0,0.25)');
  // Cerezos en flor asomando por encima del muro.
  for (const [x, y, r] of CEREZOS) {
    h.rect(x - 3, y + 6, 6, 50 - y, '#4a2e22'); h.rect(x - 2, y + 6, 2, 50 - y, '#6a4430');
    h.linea(x, y + 18, x - r * 0.6, y + 4, '#4a2e22', 2); h.linea(x, y + 14, x + r * 0.6, y + 2, '#4a2e22', 2);
    for (let k = 0; k < 16; k++) {
      const a = azar() * Math.PI * 2; const d = azar() * r;
      const cx = x + Math.cos(a) * d; const cy = y + Math.sin(a) * d * 0.55;
      const rr = 5 + azar() * 6;
      h.elipse(cx + 1, cy + 2, rr, rr * 0.7, '#c0567c');
      h.elipse(cx, cy, rr, rr * 0.7, '#ee8eae');
      h.elipse(cx - rr * 0.3, cy - rr * 0.25, rr * 0.55, rr * 0.38, '#fcc4d6');
    }
  }
  // Pétalos ya caídos en la grava y el musgo.
  for (let i = 0; i < 340; i++) {
    const x = azar() * ANCHO; const y = 62 + azar() * 208;
    if (Math.hypot(x - CASA.jugador, (y - SUELO) * 3) < 40 || Math.hypot(x - CASA.rival, (y - SUELO) * 3) < 40) continue;
    h.punto(x, y, azar() < 0.6 ? '#f6a8c2' : '#fcd4e0');
  }
  // Estanque de las carpas con su orilla de piedras y un puente rojo en arco.
  const { x: ex, y: ey, rx, ry } = ESTANQUE_JARDIN;
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const px = ex + Math.cos(a) * (rx + 3); const py = ey + Math.sin(a) * (ry + 3); h.elipse(px, py, 5, 3, '#6a665c'); h.elipse(px - 1, py - 1, 3, 1.5, '#9a968a'); }
  h.elipse(ex, ey, rx, ry, '#1e5468'); h.elipse(ex, ey + 2, rx - 5, ry - 5, '#2a6e84'); h.elipse(ex - 10, ey - 4, rx - 30, ry - 14, '#3a8a9c');
  for (const [lx, ly] of [[ex - 40, ey + 6], [ex + 30, ey - 8], [ex + 48, ey + 9]]) { h.elipse(lx, ly, 6, 2.5, '#3a7a3a'); h.punto(lx + 2, ly - 1, '#f6b8cc'); h.punto(lx + 3, ly - 1, '#ffffff'); } // nenúfares
  const arco = []; for (let i = 0; i <= 20; i++) { const q = i / 20; arco.push([ex - 58 + q * 116, ey - 2 - Math.sin(q * Math.PI) * 20]); }
  h.trazo(arco.map(([x, y]) => [x, y + 4]), '#5a1a14', 5);
  h.trazo(arco, '#c8402e', 4); h.trazo(arco.map(([x, y]) => [x, y - 1]), '#e8603e', 1);
  for (let i = 0; i <= 20; i += 4) { const [x, y] = arco[i]; h.rect(x - 1, y - 9, 2, 9, '#a83224'); h.rect(x - 1, y - 10, 2, 1, '#e8b040'); }
  h.trazo(arco.map(([x, y]) => [x, y - 8]), '#c8402e', 1);
  // Farolillos de piedra.
  for (const [x, y] of FAROLILLOS) {
    h.elipse(x + 3, y + 22, 10, 3, 'rgba(30,30,20,0.3)');
    h.rect(x - 6, y + 16, 12, 4, '#6a665c'); h.rect(x - 2, y + 6, 4, 10, '#8a867a');
    h.rect(x - 7, y + 2, 14, 4, '#7a766a'); h.rect(x - 5, y - 4, 10, 6, '#8a867a'); h.rect(x - 2, y - 3, 4, 4, '#ffe08a');
    h.poligono([[x - 9, y - 4], [x + 9, y - 4], [x + 4, y - 10], [x - 4, y - 10]], '#6a665c'); h.rect(x - 1, y - 13, 2, 3, '#6a665c');
  }
  // Camino de losas que cruza el jardín por delante.
  for (let i = 0; i < 9; i++) { const x = 196 + i * 12 + (i % 2) * 3; const y = 262 - i * 2.2; h.elipse(x, y, 5, 2.5, '#5a564c'); h.elipse(x, y - 1, 4.5, 2, '#9a968a'); }
  // Arbustos podados en los bordes.
  const bola = (x, y, r) => { h.elipse(x + 2, y + 3, r, r * 0.6, 'rgba(20,30,10,0.35)'); h.elipse(x, y, r, r * 0.7, '#2e5226'); h.elipse(x - 2, y - 2, r * 0.75, r * 0.5, '#46703a'); h.elipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2, '#6a9a4e'); };
  for (const [x, y, r] of [[470, 150, 14], [456, 262, 16], [12, 150, 12], [300, 268, 10], [392, 250, 9]]) bola(x, y, r);
  plataformas(h, {
    borde: '#4e4a42', cara: '#9e9a8e', luz: '#c2beb2',
    adorno: (x, y) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; h.punto(x + Math.cos(a) * 30, y + Math.sin(a) * 8, '#5e8a4a'); h.punto(x + Math.cos(a) * 30 + 1, y + Math.sin(a) * 8, '#f6a8c2'); } },
  });
  iluminar(ctx, [
    { x: 240, y: 150, r: 260, ry: 120, color: '#2a2418', fuerza: 0.7 },
    ...FAROLILLOS.map(([x, y]) => ({ x, y: y - 1, r: 22, color: '#5a4010', fuerza: 0.6 })),
    { x: 0, y: 270, r: 130, fuerza: -0.35 }, { x: 480, y: 270, r: 130, fuerza: -0.35 },
  ]);
}

// --- Cañón del desierto ---------------------------------------------------------------------------------
const ARENA_DESIERTO = paleta('#b8703c', '#c67e46', '#d28c52', '#dc9a5e', '#e6a86c', '#eeb87c', '#f4c890');
const CIELO_DESIERTO = paleta('#1e4c94', '#2c62aa', '#4278ba', '#6492c2', '#94aec2', '#c8c4ae', '#ecd6a4');
const MESAS = [[-10, 70, 30, '#a0586a'], [90, 190, 22, '#a0586a'], [250, 330, 34, '#a0586a'], [360, 490, 26, '#a0586a'],
  [30, 120, 40, '#b4502e'], [300, 400, 44, '#b4502e'], [170, 230, 48, '#c0603a']];
const CACTUS = [[40, 150, 1], [446, 128, 1.2], [300, 262, 0.8], [96, 104, 0.7]];
const OASIS = { x: 58, y: 236, rx: 46, ry: 14 };
const SOL_DESIERTO = { x: 410, y: 16 };

function desierto(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 26); const dunas = ruido(azar, 60);
  pintarTerreno(ctx, (x, y) => {
    if (y < 62) return tonoDe(CIELO_DESIERTO, Math.pow(y / 62, 1.2), x, y);
    let n = manchas(x, y) * 0.35 + dunas(x, y) * 0.35 + azar() * 0.12;
    n += Math.sin((x * 0.5 + y * 2.4 + dunas(x, y) * 40) / 5) * 0.09; // ondas que deja el viento
    return tonoDe(ARENA_DESIERTO, n, x, y);
  });
  // El sol con su halo.
  for (const [r, c] of [[24, 'rgba(255,240,200,0.10)'], [16, 'rgba(255,240,200,0.16)'], [10, '#fff3c8'], [7, '#ffffff']]) h.elipse(SOL_DESIERTO.x, SOL_DESIERTO.y, r, r, c);
  // Mesetas: las lejanas, violetas; las cercanas, rojas con sus estratos.
  for (const [x0, x1, alto, color] of MESAS) {
    const base = 64; const cima = base - alto; const talud = alto * 0.35;
    h.poligono([[x0, base], [x0 + talud, cima], [x1 - talud, cima], [x1, base]], color);
    const claro = color === '#a0586a' ? '#b46a78' : '#d8784a';
    h.rect(x0 + talud, cima, x1 - x0 - talud * 2, 2, claro);
    for (let k = cima + 6; k < base - 2; k += 5) {
      const q = (k - cima) / alto; const a = x0 + talud * (1 - q); const b = x1 - talud * (1 - q);
      for (let x = a + 1; x < b - 1; x++) if (umbral(x, k) < 0.7) h.punto(x, k, k % 2 ? claro : 'rgba(60,20,20,0.25)');
    }
    h.poligono([[x1 - talud, cima], [x1, base], [x1 - talud * 0.6, base]], 'rgba(40,10,20,0.28)'); // la cara en sombra
  }
  h.rect(0, 62, ANCHO, 2, '#c87c48');
  // Grietas de tierra reseca.
  for (let i = 0; i < 7; i++) {
    let x = 180 + azar() * 120; let y = 220 + azar() * 40;
    for (let k = 0; k < 6; k++) { const nx = x + (azar() - 0.5) * 16; const ny = y + (azar() - 0.5) * 8; h.linea(x, y, nx, ny, '#8a4a26'); x = nx; y = ny; }
  }
  // Oasis con juncos.
  const { x: ox, y: oy, rx, ry } = OASIS;
  h.elipse(ox, oy, rx + 6, ry + 4, '#9a8a4a'); h.elipse(ox, oy, rx + 2, ry + 1, '#6a8a3a');
  h.elipse(ox, oy, rx, ry, '#1e7a8a'); h.elipse(ox + 4, oy + 2, rx - 8, ry - 5, '#2a96a2'); h.elipse(ox - 8, oy - 3, rx - 24, ry - 9, '#5ac0c4');
  for (let i = 0; i < 22; i++) { const a = Math.PI * (0.9 + azar() * 1.2); const x = ox + Math.cos(a) * (rx + 2); const y = oy + Math.sin(a) * (ry + 1); h.linea(x, y, x + (azar() - 0.5) * 3, y - 6 - azar() * 6, azar() < 0.5 ? '#4a7a2a' : '#6a9a3a'); }
  // Cactus (saguaro) con brazos.
  const cactus = (x, y, k) => {
    const alto = 30 * k; const ancho = Math.max(4, 6 * k);
    h.elipse(x + 8 * k, y + 2, 12 * k, 3 * k, 'rgba(80,30,10,0.3)');
    h.rect(x - ancho / 2, y - alto, ancho, alto, '#2a5a2a'); h.rect(x - ancho / 2 + 1, y - alto, ancho / 2, alto, '#3e7a36'); h.rect(x - ancho / 2 + 1, y - alto, 1, alto, '#5a9a4a');
    h.elipse(x, y - alto, ancho / 2, ancho / 3, '#3e7a36');
    for (const [lado, alt] of [[-1, 0.55], [1, 0.4]]) {
      const ay = y - alto * alt; const ax = x + lado * (ancho / 2 + 4 * k);
      h.rect(Math.min(x, ax), ay, Math.abs(ax - x), 4 * k, '#2a5a2a');
      h.rect(ax - 2 * k, ay - 12 * k, 4 * k, 12 * k + 4 * k, '#2a5a2a'); h.rect(ax - 2 * k + 1, ay - 12 * k, 2 * k, 12 * k, '#3e7a36');
      h.elipse(ax, ay - 12 * k, 2 * k, 1.5 * k, '#3e7a36');
    }
    for (let i = 0; i < alto; i += 3) h.punto(x - ancho / 2 - 1, y - i, '#f0e0b0'); // espinas
    h.punto(x, y - alto - 2, '#f05a7a'); h.punto(x + 1, y - alto - 2, '#ff8aa0'); // una flor
  };
  for (const [x, y, k] of CACTUS) cactus(x, y, k);
  // Un esqueleto enorme medio enterrado (costillas blanqueadas por el sol).
  for (let i = 0; i < 6; i++) {
    const x = 352 + i * 11; const alto = 22 - Math.abs(i - 2.5) * 4;
    const arco = []; for (let q = 0; q <= 1.001; q += 0.1) arco.push([x + Math.sin(q * Math.PI) * 8, 242 - Math.sin(q * Math.PI * 0.95) * alto]);
    h.trazo(arco.map(([a, b]) => [a + 1, b + 1]), '#8a6a4a', 3); h.trazo(arco, '#efe6d2', 2);
  }
  h.trazo([[346, 244], [420, 240]], '#efe6d2', 3); h.elipse(428, 238, 9, 6, '#efe6d2'); h.elipse(431, 238, 2, 2, '#4a3020');
  // Rocas sueltas.
  for (let i = 0; i < 26; i++) {
    const x = azar() * ANCHO; const y = 70 + azar() * 196;
    if (Math.hypot(x - CASA.jugador, (y - SUELO) * 3) < 44 || Math.hypot(x - CASA.rival, (y - SUELO) * 3) < 44) continue;
    const r = 1.5 + azar() * 3; h.elipse(x + 1, y + 1, r, r * 0.6, '#8a4a26'); h.elipse(x, y, r, r * 0.65, '#a8683e'); h.punto(x - r * 0.4, y - r * 0.3, '#d8946a');
  }
  plataformas(h, {
    borde: '#7a3e1e', cara: '#d08a50', luz: '#eab070',
    adorno: (x, y) => { for (let k = -2; k <= 2; k++) h.rect(x - 22, y - 2 + k * 2, 44, 1, k % 2 ? 'rgba(122,62,30,0.25)' : 'rgba(255,220,160,0.18)'); },
  });
  iluminar(ctx, [
    { x: SOL_DESIERTO.x, y: SOL_DESIERTO.y, r: 220, ry: 160, color: '#3a2a10', fuerza: 0.8 },
    { x: 240, y: 180, r: 240, ry: 100, color: '#2a1a08', fuerza: 0.5 },
    { x: 0, y: 270, r: 140, fuerza: -0.3 },
  ]);
}

// --- Azotea de la ciudad (de noche) ---------------------------------------------------------------------
const CIELO_CIUDAD = paleta('#0a0a22', '#100e30', '#18143e', '#22184a', '#321e58', '#4a2862', '#6a3268');
const AZOTEA = paleta('#262a3a', '#2c3142', '#32384a', '#383f52', '#3f475c');
const NEONES = [{ x: 18, y: 18, w: 26, h: 9, color: '#ff4fa8' }, { x: 300, y: 26, w: 30, h: 8, color: '#4fe6ff' }, { x: 196, y: 30, w: 20, h: 7, color: '#ffd84f' }];
const ANTENA = { x: 368, y: 2 };
const VENTILADORES = [[440, 210], [34, 214]];
const CHARCOS = [[250, 228, 26, 5], [96, 118, 18, 4], [390, 120, 20, 4]];

function ciudad(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 14);
  pintarTerreno(ctx, (x, y) => {
    if (y < 64) return tonoDe(CIELO_CIUDAD, Math.pow(y / 64, 1.4), x, y);
    let n = manchas(x, y) * 0.45 + azar() * 0.2 + 0.25;
    if ((x + Math.floor((y - 64) / 18) * 12) % 24 === 0 || (y - 64) % 18 === 0) n -= 0.35; // juntas de las losas
    return tonoDe(AZOTEA, n, x, y);
  });
  for (let i = 0; i < 60; i++) { const x = azar() * ANCHO; const y = azar() * 34; h.punto(x, y, azar() < 0.8 ? '#8a8ab8' : '#ffffff'); }
  h.elipse(64, 14, 7, 7, '#f4eed8'); h.elipse(62, 13, 2, 2, '#d8d0b8'); h.elipse(66, 16, 1.5, 1.5, '#d8d0b8');
  // Los rascacielos con sus ventanas encendidas.
  const torres = [];
  for (let x = -6; x < ANCHO;) { const w = 18 + Math.floor(azar() * 26); torres.push([x, w, 18 + Math.floor(azar() * 38)]); x += w + Math.floor(azar() * 3); }
  torres.push([ANTENA.x - 12, 24, 58]);
  for (const [x, w, alto] of torres) {
    const cima = 64 - alto; const tono = azar() < 0.5 ? '#151b38' : '#1b2244';
    h.rect(x, cima, w, alto, tono); h.rect(x, cima, 1, alto, '#2a3462'); h.rect(x, cima, w, 1, '#2e3868');
    for (let wy = cima + 4; wy < 60; wy += 4) for (let wx = x + 3; wx < x + w - 2; wx += 4) {
      const v = azar();
      h.rect(wx, wy, 2, 2, v < 0.3 ? '#ffd86a' : v < 0.42 ? '#8ae4ff' : v < 0.5 ? '#ffb070' : '#0e1330');
    }
  }
  h.rect(ANTENA.x - 1, ANTENA.y, 2, 8, '#4a5068'); h.rect(ANTENA.x - 4, ANTENA.y + 4, 8, 1, '#4a5068');
  for (const { x, y, w, h: alto, color } of NEONES) { h.rect(x - 1, y - 1, w + 2, alto + 2, '#0a0a18'); h.rect(x, y, w, alto, color); h.rect(x + 2, y + 2, w - 4, alto - 4, '#0a0a18'); for (let k = x + 4; k < x + w - 4; k += 4) h.rect(k, y + 3, 2, alto - 6, color); }
  // El pretil del fondo y el depósito de agua.
  h.rect(0, 62, ANCHO, 7, '#454c66'); h.rect(0, 62, ANCHO, 1, '#6a7494'); h.rect(0, 69, ANCHO, 2, 'rgba(0,0,0,0.35)');
  const deposito = (x) => {
    for (const px of [x - 12, x - 4, x + 4, x + 12]) h.rect(px, 66, 2, 24, '#2a2e3e');
    h.linea(x - 12, 88, x + 12, 70, '#2a2e3e'); h.linea(x - 12, 70, x + 12, 88, '#2a2e3e');
    h.rect(x - 16, 40, 32, 26, '#6a4a38'); for (let k = x - 14; k < x + 16; k += 5) h.rect(k, 40, 1, 26, '#4a3226');
    h.rect(x - 16, 48, 32, 2, '#3a3a48'); h.rect(x - 16, 58, 32, 2, '#3a3a48');
    h.poligono([[x - 18, 40], [x + 18, 40], [x, 30]], '#4a3a40'); h.rect(x - 16, 40, 3, 26, '#8a6650');
  };
  deposito(116);
  // Máquinas del aire acondicionado con su rejilla, tubos y antenas.
  for (const [x, y] of VENTILADORES) {
    h.rect(x - 16, y - 14, 32, 22, '#1e2232'); h.rect(x - 15, y - 13, 30, 20, '#5a6278'); h.rect(x - 15, y - 13, 30, 2, '#7a84a0');
    h.elipse(x, y - 3, 8, 8, '#2a2e3e'); h.elipse(x, y - 3, 7, 7, '#3a4054');
  }
  h.rect(0, 150, 26, 4, '#3a4054'); h.rect(0, 150, 26, 1, '#6a7494'); h.rect(454, 160, 26, 4, '#3a4054');
  // El helipuerto pintado en el centro (pintura gastada).
  for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2; if (i % 6 < 4 && umbral(i, 0) < 0.8) h.punto(240 + Math.cos(a) * 40, 182 + Math.sin(a) * 13, '#c8a83a'); }
  for (const [x, y, w, alto] of [[230, 176, 3, 13], [247, 176, 3, 13], [233, 181, 14, 3]]) for (let yy = y; yy < y + alto; yy++) for (let xx = x; xx < x + w; xx++) if (umbral(xx, yy) < 0.75) h.punto(xx, yy, '#c8a83a');
  // Charcos que reflejan los neones.
  for (const [x, y, rx, ry] of CHARCOS) { h.elipse(x, y, rx, ry, '#1a1c2e'); h.elipse(x - 3, y - 1, rx * 0.6, ry * 0.4, '#3a2a5a'); h.rect(x - rx * 0.4, y, rx * 0.5, 1, '#ff4fa8'); h.rect(x, y + 1, rx * 0.3, 1, '#4fe6ff'); }
  // Barandilla de delante.
  h.rect(0, 258, ANCHO, 2, '#6a7494'); for (let x = 4; x < ANCHO; x += 20) h.rect(x, 258, 2, 12, '#4a5068'); h.rect(0, 266, ANCHO, 1, '#4a5068');
  plataformas(h, {
    borde: '#141826', cara: '#48506a', luz: '#6a7696',
    adorno: (x, y) => { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; h.punto(x + Math.cos(a) * 31, y + Math.sin(a) * 8.6, i % 2 ? '#4fe6ff' : '#2a8aa8'); } },
  });
  iluminar(ctx, [
    ...NEONES.map(n => ({ x: n.x + n.w / 2, y: n.y + n.h / 2, r: 46, ry: 30, color: n.color === '#ff4fa8' ? '#40102a' : n.color === '#4fe6ff' ? '#0a3040' : '#3a3008', fuerza: 0.9 })),
    { x: 240, y: 190, r: 230, ry: 90, color: '#141a34', fuerza: 0.8 },
    { x: 0, y: 270, r: 150, fuerza: -0.45 }, { x: 480, y: 270, r: 150, fuerza: -0.45 },
  ]);
}

// --- Pilar celeste (por encima de las nubes) ---------------------------------------------------------------
const CIELO_ALTO = paleta('#2e6cc8', '#3a7ad2', '#4a8adc', '#5c9ae4', '#72acea', '#8cbef0', '#a8d0f4');
const PIEDRA_CELESTE = paleta('#56665c', '#627268', '#6e7e72', '#7a8a7c', '#869686', '#92a290');
/** El suelo del pilar: un octógono de losas antiguas. */
const PILAR = [[70, 74], [410, 74], [460, 118], [460, 214], [404, 252], [76, 252], [20, 214], [20, 118]];
const dentroDe = (x, y, poli) => {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]; const [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

function nube(h, x, y, w, azar) {
  for (let k = 0; k < Math.max(3, w / 10); k++) {
    const cx = x + (azar() - 0.5) * w; const cy = y + (azar() - 0.5) * w * 0.12; const r = w * (0.16 + azar() * 0.14);
    h.elipse(cx, cy + r * 0.3, r, r * 0.55, '#b8cce4');
  }
  for (let k = 0; k < Math.max(3, w / 10); k++) {
    const cx = x + (azar() - 0.5) * w * 0.9; const cy = y - 2 + (azar() - 0.5) * w * 0.1; const r = w * (0.14 + azar() * 0.12);
    h.elipse(cx, cy, r, r * 0.6, '#eef4fb'); h.elipse(cx - r * 0.2, cy - r * 0.2, r * 0.6, r * 0.35, '#ffffff');
  }
}

function cielo(ctx, azar) {
  const h = herramientas(ctx);
  const manchas = ruido(azar, 16);
  pintarTerreno(ctx, (x, y) => {
    if (dentroDe(x, y, PILAR)) {
      let n = manchas(x, y) * 0.45 + azar() * 0.2 + 0.25;
      if ((y - 74) % 16 === 0 || (x + ((Math.floor((y - 74) / 16) % 2) * 14)) % 28 === 0) n -= 0.4; // juntas de las losas
      return tonoDe(PIEDRA_CELESTE, n, x, y);
    }
    return tonoDe(CIELO_ALTO, Math.min(1, y / 230), x, y);
  });
  // Islas flotantes y otros pilares que asoman a lo lejos.
  for (const [x, y, w] of [[60, 26, 26], [250, 14, 18], [430, 32, 30]]) {
    h.poligono([[x - w, y], [x + w, y], [x + w * 0.4, y + w * 0.9], [x - w * 0.2, y + w * 1.2]], '#6a7aa0');
    h.rect(x - w, y - 3, w * 2, 3, '#7aa07a'); h.rect(x - w + 2, y - 4, w * 2 - 4, 1, '#9ac08a');
  }
  for (const [x, y, w] of [[20, 58, 70], [180, 56, 60], [330, 62, 80], [470, 60, 50]]) nube(h, x, y, w, azar);
  // El espesor del pilar por delante (la cara de piedra que cae hacia las nubes).
  h.poligono([[20, 214], [76, 252], [404, 252], [460, 214], [460, 230], [404, 270], [76, 270], [20, 230]], '#3e4a44');
  const cara = x => (x < 76 ? 214 + (x - 20) * (38 / 56) : x > 404 ? 252 - (x - 404) * (38 / 56) : 252); // borde de arriba de la cara
  for (let x = 20; x < 460; x++) { h.punto(x, cara(x) + 8, '#323e38'); h.punto(x, cara(x) + 1, '#56645a'); }
  for (let x = 24; x < 458; x += 14) { h.rect(x, cara(x) + 1, 1, 7, '#323e38'); h.rect(x + 7, cara(x + 7) + 9, 1, 7, '#323e38'); }
  h.trazo(PILAR.slice(3).concat([PILAR[0]]).slice(0, 4), '#a8b8a4', 1);
  // Musgo, grietas y un sol tallado en el centro.
  for (let i = 0; i < 60; i++) {
    const x = 30 + azar() * 420; const y = 80 + azar() * 168;
    if (!dentroDe(x, y, PILAR) || Math.hypot(x - CASA.jugador, (y - SUELO) * 3) < 42 || Math.hypot(x - CASA.rival, (y - SUELO) * 3) < 42) continue;
    if (azar() < 0.5) h.elipse(x, y, 3 + azar() * 4, 1.5 + azar() * 2, azar() < 0.5 ? '#5a8a4a' : '#6e9e56');
    else { let a = x; let b = y; for (let k = 0; k < 4; k++) { const na = a + (azar() - 0.5) * 10; const nb = b + (azar() - 0.5) * 5; h.linea(a, b, na, nb, '#46524a'); a = na; b = nb; } }
  }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; h.linea(240 + Math.cos(a) * 9, 182 + Math.sin(a) * 3, 240 + Math.cos(a) * 18, 182 + Math.sin(a) * 6, '#a6b6a2'); }
  h.elipse(240, 182, 8, 3, '#a6b6a2'); h.elipse(240, 182, 5, 1.8, '#c8d6c2');
  // Columnas rotas en las esquinas de atrás y muñones delante.
  const columna = (x, base, alto, rota) => {
    h.elipse(x + 4, base + 2, 12, 3, 'rgba(20,30,40,0.3)');
    h.rect(x - 9, base - 4, 18, 5, '#5a6a60'); h.rect(x - 9, base - 4, 18, 1, '#9aaa96');
    h.rect(x - 7, base - alto, 14, alto - 4, '#7e8e80');
    for (let k = x - 5; k < x + 6; k += 3) h.rect(k, base - alto, 1, alto - 4, '#66766a');
    h.rect(x - 7, base - alto, 3, alto - 4, '#a2b29e');
    if (rota) h.poligono([[x - 7, base - alto], [x + 7, base - alto], [x + 7, base - alto - 6], [x + 2, base - alto - 2], [x - 3, base - alto - 8], [x - 7, base - alto - 3]], '#7e8e80');
    else { h.rect(x - 10, base - alto - 5, 20, 5, '#8e9e8e'); h.rect(x - 10, base - alto - 5, 20, 1, '#b2c2ae'); }
  };
  columna(74, 96, 52, false); columna(406, 96, 40, true); columna(40, 206, 16, true); columna(440, 206, 22, true);
  // Nubes por delante, en las esquinas de abajo.
  for (const [x, y, w] of [[0, 268, 70], [480, 266, 80]]) nube(h, x, y, w, azar);
  plataformas(h, {
    borde: '#3e4a44', cara: '#8a9a8a', luz: '#b2c2ae',
    adorno: (x, y) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; h.rect(x + Math.cos(a) * 24 - 1, y + Math.sin(a) * 6.5, 3, 1, '#c8e8ff'); } },
  });
  iluminar(ctx, [
    { x: 120, y: 0, r: 300, ry: 200, color: '#2a2a1a', fuerza: 0.7 },
    { x: 240, y: 182, r: 30, ry: 10, color: '#203848', fuerza: 0.6 },
  ]);
}

const DIBUJOS = { bosque, volcan, playa, cueva, nieve, ruinas, jardin, desierto, ciudad, cielo, estadio };

/** Los pinceles de píxel y el ruido, para otros dibujos en pixel art (el mapa del modo aventura). */
export const pixel = { herramientas, ruido, generador, paleta, tonoDe, umbral, aRgb };

/**
 * El fondo de un escenario (lienzo de 480×270). Si la clave no existe (una guardada de antes), el primero.
 * `colores`: los dos de la región (solo el estadio los usa: público, pancartas y luces).
 */
export function dibujarFondo(escenario, { colores } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  (DIBUJOS[escenario] || bosque)(ctx, generador(20261118), colores ? { colores } : {});
  return lienzo;
}

// --- Lo que se mueve en cada escenario ------------------------------------------------------------------
/**
 * Ambiente animado de un escenario. Devuelve { suelo(p, t), aire(p, t) }: dibujan detrás o delante de los
 * Pokémon con los pinceles de la arena `p` ({ ctx, S, X, Y, cuadro, brillo, aro, trazo, particula, llama,
 * chispa4, reducido, entre }). Con movimiento reducido no suelta partículas.
 */
export function crearAmbiente(escenario, { colores } = {}) {
  const azar = Math.random;
  switch (escenario in DIBUJOS ? escenario : 'bosque') {
    case 'estadio': {
      const [ca, cb] = colores || ['#c8d2e6', '#8fa8d8'];
      return {
        suelo(p, t) {
          const q = (t / 2600) % 1; // una luz que recorre el anillo
          for (let i = 0; i < 14; i++) {
            const a = (q - i * 0.006) * Math.PI * 2;
            p.cuadro(ANILLO.x + Math.cos(a) * (ANILLO.rx - 6), ANILLO.y + Math.sin(a) * (ANILLO.ry - 3), 1.6, i % 2 ? ca : '#ffffff');
          }
          for (let i = 0; i < 9; i++) { // las nueve estrellas del emblema laten por turnos
            const brilla = Math.sin(t / 500 - i * 0.7);
            if (brilla > 0.6) { const a = -Math.PI / 2 + (i / 9) * Math.PI * 2; p.brillo(EMBLEMA.x + Math.cos(a) * (EMBLEMA.rx - 1.5), EMBLEMA.y + Math.sin(a) * (EMBLEMA.ry - 0.5), 5, ca, (brilla - 0.6) * 1.6); }
          }
          // Dos focos que barren el campo con los colores de la región.
          p.brillo(240 + Math.sin(t / 2300) * 150, 178 + Math.sin(t / 1700) * 40, 46, ca, 0.16);
          p.brillo(240 + Math.sin(t / 2900 + 2) * 160, 178 + Math.cos(t / 2100) * 42, 40, cb, 0.14);
          for (let x = 4; x < ANCHO; x += 30) { // paneles de luz de la barrera
            const fase = ((t / 70 - x / 6) % 40 + 40) % 40;
            if (fase < 22) p.cuadro(x + fase, 66.5, 2, fase % 4 < 2 ? ca : cb);
          }
        },
        aire(p, t) {
          // Haces de los focos hacia el campo.
          p.ctx.globalCompositeOperation = 'lighter';
          for (const [i, [fx, fy]] of FOCOS_ESTADIO.entries()) {
            const vaiven = Math.sin(t / 3000 + i * 2) * 30;
            p.ctx.globalAlpha = 0.05; p.ctx.fillStyle = '#fff6dc';
            p.ctx.beginPath(); p.ctx.moveTo(p.X(fx - 8), p.Y(fy + 8)); p.ctx.lineTo(p.X(fx + 8), p.Y(fy + 8));
            p.ctx.lineTo(p.X(240 + vaiven + (i ? 40 : -40)), p.Y(230)); p.ctx.lineTo(p.X(240 + vaiven + (i ? -60 : 60)), p.Y(230)); p.ctx.closePath(); p.ctx.fill();
          }
          // La ola: una franja de luz que recorre las gradas.
          const ola = ((t / 18) % (ANCHO + 120)) - 60;
          p.ctx.globalAlpha = 0.07; p.ctx.fillStyle = '#ffffff';
          p.ctx.fillRect(p.X(ola - 25), p.Y(12), 50 * p.S, 48 * p.S);
          p.ctx.globalCompositeOperation = 'source-over'; p.ctx.globalAlpha = 1;
          if (!p.reducido && azar() < 0.35) { // flashes de las cámaras en las gradas
            const x = azar() * ANCHO; const y = 14 + azar() * 46;
            p.particula({ x, y, vida: 160, colores: ['#ffffff', '#fff6dc'], tam: 1.2, forma: 'estrella', brillo: 4 });
          }
        },
      };
    }
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
    case 'jardin': {
      const carpas = Array.from({ length: 4 }, (_, i) => ({ fase: i * 1.6, v: 0.35 + i * 0.09, color: i % 2 ? '#ff8a3a' : '#f4f0e8', mancha: i % 2 ? '#f4f0e8' : '#e8402a', sentido: i % 2 ? 1 : -1 }));
      return {
        suelo(p, t) {
          const { x: ex, y: ey, rx, ry } = ESTANQUE_JARDIN;
          for (const c of carpas) { // carpas que nadan en círculos bajo el puente
            const a = (t / 1000) * c.v * c.sentido + c.fase;
            const x = ex + Math.cos(a) * (rx - 24); const y = ey + 3 + Math.sin(a) * (ry - 12);
            const dx = -Math.sin(a) * c.sentido; const dy = Math.cos(a) * 0.35 * c.sentido;
            for (let k = 0; k < 4; k++) p.cuadro(x - dx * k * 2, y - dy * k * 2, 1.8 - k * 0.3, k === 1 ? c.mancha : c.color);
          }
          const q = (t / 2600) % 1; // un anillo que se abre en el agua
          p.ctx.globalAlpha = 0.5 * (1 - q); p.ctx.strokeStyle = '#bfe8f0'; p.ctx.lineWidth = Math.max(1, p.S * 0.6);
          p.ctx.beginPath(); p.ctx.ellipse(p.X(ex + 22), p.Y(ey - 2), (3 + q * 14) * p.S, (1 + q * 4) * p.S, 0, 0, Math.PI * 2); p.ctx.stroke(); p.ctx.globalAlpha = 1;
          for (const [x, y] of FAROLILLOS) p.brillo(x, y - 1, 12 + Math.sin(t / 260 + x) * 1.5, '#ffd27a', 0.35);
        },
        aire(p) {
          if (!p.reducido && azar() < 0.22) { // pétalos de cerezo al viento
            p.particula({ x: p.entre(-40, ANCHO), y: -4, vx: p.entre(10, 30), vy: p.entre(10, 22), vida: 14000, colores: [azar() < 0.5 ? '#f6a8c2' : '#fcd4e0'], tam: 1.6, forma: 'roca', vgiro: p.entre(-4, 4) });
          }
        },
      };
    }
    case 'desierto': {
      return {
        suelo(p, t) {
          p.ctx.globalAlpha = 0.09; p.ctx.fillStyle = '#fff0d0'; // la calima tiembla sobre el horizonte
          for (let k = 0; k < 4; k++) p.ctx.fillRect(p.X(0), p.Y(63 + k * 3 + Math.sin(t / 380 + k * 1.7) * 1.2), ANCHO * p.S, Math.max(1, p.S * 0.7));
          p.ctx.globalAlpha = 1;
          for (let i = 0; i < 4; i++) { const brilla = Math.sin(t / 420 + i * 1.9); if (brilla > 0.75) p.chispa4(OASIS.x - 24 + i * 15, OASIS.y - 3 + (i % 2) * 5, 2, '#ffffff', (brilla - 0.75) * 4); }
          const ciclo = 15000; const f = (t % ciclo) / ciclo; // un matojo rodante cruza de vez en cuando
          if (f < 0.4 && !p.reducido) {
            const x = -20 + (f / 0.4) * (ANCHO + 40); const y = 236 - Math.abs(Math.sin(f * 46)) * 7; const giro = t / 110;
            for (let k = 0; k < 10; k++) { const a = giro + k * 0.63; p.cuadro(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 1.6, k % 2 ? '#7a5a30' : '#b08a4a'); }
            p.cuadro(x, y, 3, '#8a6a3a');
          }
        },
        aire(p, t) {
          p.brillo(SOL_DESIERTO.x, SOL_DESIERTO.y, 34, '#fff0b0', 0.2 + Math.sin(t / 900) * 0.05);
          if (!p.reducido && azar() < 0.45) p.particula({ x: -4, y: p.entre(66, ALTO), vx: p.entre(90, 170), vy: p.entre(-6, 6), vida: 5000, colores: ['#f6dcb0', '#e8bc84'], tam: 1, alfa: 0.55 }); // arena al viento
        },
      };
    }
    case 'ciudad': {
      const ventanas = Array.from({ length: 12 }, () => ({ x: Math.floor(azar() * 118) * 4 + 3, y: 48 + Math.floor(azar() * 3) * 4, fase: azar() * 10, v: 0.5 + azar() }));
      return {
        suelo(p, t) {
          for (const [x, y] of VENTILADORES) { // aspas que giran
            for (let k = 0; k < 3; k++) { const a = t / 80 + k * 2.094; p.trazo([[x, y - 3], [x + Math.cos(a) * 6, y - 3 + Math.sin(a) * 6]], 1.6, '#8a94b0'); }
          }
          const q = (t / 1300) % 1; // luces que corren por el anillo de cada plataforma
          for (const cx of [CASA.jugador, CASA.rival]) for (let k = 0; k < 5; k++) { const a = (q - k * 0.025) * Math.PI * 2; p.cuadro(cx + Math.cos(a) * 31, SUELO + 2 + Math.sin(a) * 8.6, 1.4, k ? '#7af0ff' : '#ffffff'); }
          for (const [i, [x, y, rx]] of CHARCOS.entries()) p.brillo(x, y, rx * 0.8, i % 2 ? '#4fe6ff' : '#ff4fa8', 0.08 + Math.sin(t / 600 + i) * 0.04);
        },
        aire(p, t) {
          for (const n of NEONES) { // los neones zumban y a veces parpadean
            const apagado = Math.sin(t / 53 + n.x * 7) > 0.97;
            if (!apagado) p.brillo(n.x + n.w / 2, n.y + n.h / 2, n.w * 0.8, n.color, 0.2 + Math.sin(t / 700 + n.x) * 0.04);
          }
          if (Math.floor(t / 650) % 2) { p.brillo(ANTENA.x, ANTENA.y, 6, '#ff3030', 0.9); p.cuadro(ANTENA.x, ANTENA.y, 1.2, '#ff8a8a'); }
          for (const v of ventanas) if (Math.sin((t / 1600) * v.v + v.fase) > 0.75) p.cuadro(v.x + 1, v.y + 1, 2, '#ffe9a0');
          const f = (t % 26000) / 26000; const ax = -10 + f * (ANCHO + 20); const ay = 12 + f * 5; // un avión cruza el cielo
          p.cuadro(ax, ay, 1, '#ffffff'); if (Math.floor(t / 400) % 2) p.cuadro(ax - 3, ay, 1, '#ff5050');
        },
      };
    }
    case 'cielo': {
      const formas = [];
      const pintarNube = w => {
        const lienzo = document.createElement('canvas'); lienzo.width = Math.ceil(w * 2 + 10); lienzo.height = Math.ceil(w * 0.8);
        nube(herramientas(lienzo.getContext('2d')), w + 5, w * 0.45, w, azar);
        return lienzo;
      };
      for (const [y, w, v] of [[24, 34, 5], [40, 46, 3.5], [252, 60, 7], [264, 44, 9]]) formas.push({ x: azar() * ANCHO, y, w, v, lienzo: pintarNube(w) });
      const rafagas = Array.from({ length: 6 }, () => ({ y: 70 + azar() * 190, fase: azar(), v: 0.6 + azar() * 0.6 }));
      return {
        suelo(p, t) {
          p.brillo(240, 182, 18, '#d8f4ff', 0.16 + Math.sin(t / 800) * 0.08); // el sol tallado brilla
        },
        aire(p, t) {
          for (const n of formas) { // nubes que pasan por delante y por detrás
            const x = ((n.x + (t / 1000) * n.v) % (ANCHO + n.w * 2.4)) - n.w * 1.2;
            p.ctx.globalAlpha = n.y > 200 ? 0.92 : 0.75;
            p.ctx.drawImage(n.lienzo, p.X(x - n.w - 5), p.Y(n.y - n.w * 0.45), n.lienzo.width * p.S, n.lienzo.height * p.S);
            p.ctx.globalAlpha = 1;
          }
          if (p.reducido) return;
          p.ctx.fillStyle = '#ffffff';
          for (const r of rafagas) { // ráfagas de viento
            const q = ((t / 1000) * r.v + r.fase) % 1.6;
            if (q > 1) continue;
            p.ctx.globalAlpha = Math.sin(q * Math.PI) * 0.35;
            p.ctx.fillRect(p.X(-40 + q * (ANCHO + 80)), p.Y(r.y), 26 * p.S, Math.max(1, p.S * 0.5));
          }
          p.ctx.globalAlpha = 1;
          const f = (t % 18000) / 18000; // una bandada cruza el cielo
          if (f < 0.5) for (let k = 0; k < 5; k++) {
            const x = ANCHO + 20 - (f / 0.5) * (ANCHO + 60) + Math.abs(k - 2) * 7; const y = 26 + Math.abs(k - 2) * 4 + (k % 2) * 2;
            const ala = Math.floor(t / 160 + k) % 2;
            p.cuadro(x, y, 1, '#2a3a5a'); p.cuadro(x - 1.5, y - ala, 1, '#2a3a5a'); p.cuadro(x + 1.5, y - ala, 1, '#2a3a5a');
          }
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
