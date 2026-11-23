// Sonido del combate, con Web Audio y sin archivos propios:
//   · gritos de los Pokémon: los .ogg de PokéAPI (detallesDe → grito), guardados en caché;
//   · efectos sintetizados al momento (golpes, un sonido por tipo de ataque, Poké Ball, evolución, estados…);
//   · música de batalla ORIGINAL (no copia ninguna de los juegos) generada nota a nota: una progresión en
//     La menor que se acelera cuando el combate se pone tenso; y una fanfarria al terminar.
// Los navegadores solo dejan sonar después de un clic: simulacro.js llama a prepararSonido() al pulsar
// «Iniciar combate». Los dos interruptores (efectos y música) se recuerdan en este navegador.

const CLAVE = 'pokedex.sonido';
const VOLUMEN = { efectos: 0.55, musica: 0.15 };
const ajustes = leer();
const gritos = new Map();
let ctx = null;
let buses = {};
let salida = null; // compresor final: el grito pedido a propósito va aquí aunque los efectos estén apagados
let ruidoBlanco = null;
let musica = null;

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE)) || {};
    return { efectos: guardado.efectos !== false, musica: guardado.musica !== false };
  } catch { return { efectos: true, musica: true }; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* sin almacenamiento */ }
}

/** Crea el sistema de sonido (o lo reanuda). Hay que llamarla desde un clic. */
export function prepararSonido() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return;
  if (!ctx) {
    ctx = new Contexto();
    salida = ctx.createDynamicsCompressor(); // evita que se sature cuando suenan muchas cosas a la vez
    salida.connect(ctx.destination);
    for (const bus of ['efectos', 'musica']) {
      buses[bus] = ctx.createGain();
      buses[bus].gain.value = ajustes[bus] ? VOLUMEN[bus] : 0;
      buses[bus].connect(salida);
    }
    ruidoBlanco = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const datos = ruidoBlanco.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const efectosActivos = () => ajustes.efectos;
export const musicaActiva = () => ajustes.musica;
/** Enciende o apaga los efectos y los gritos ('efectos') o la música ('musica'). Devuelve el valor nuevo. */
export function alternar(bus) {
  ajustes[bus] = !ajustes[bus];
  guardar();
  if (ctx) buses[bus].gain.setTargetAtTime(ajustes[bus] ? VOLUMEN[bus] : 0, ctx.currentTime, 0.05);
  return ajustes[bus];
}

// --- Piezas del sintetizador -------------------------------------------------------------------
const entre = (a, b) => a + Math.random() * (b - a);
const midi = n => 440 * 2 ** ((n - 69) / 12);

/** Una nota: oscilador con envolvente. `hasta`: desliza la frecuencia; `vibrato`: [profundidad, velocidad]. */
function nota(frecuencia, duracion, { tipo = 'square', volumen = 0.3, hasta = null, retraso = 0, en = null, bus = 'efectos', vibrato = null, tremolo = 0 } = {}) {
  const t = en ?? ctx.currentTime + retraso;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, t);
  if (hasta) osc.frequency.exponentialRampToValueAtTime(Math.max(20, hasta), t + duracion);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  osc.connect(g).connect(buses[bus]);
  const extras = [];
  if (vibrato) { // oscilador lento que mueve la frecuencia
    const lfo = ctx.createOscillator(); const prof = ctx.createGain();
    lfo.frequency.value = vibrato[1]; prof.gain.value = vibrato[0];
    lfo.connect(prof).connect(osc.frequency); extras.push(lfo);
  }
  if (tremolo) { // zumbido: el volumen sube y baja muy deprisa
    const lfo = ctx.createOscillator(); const prof = ctx.createGain();
    lfo.frequency.value = tremolo; prof.gain.value = volumen * 0.8;
    lfo.connect(prof).connect(g.gain); extras.push(lfo);
  }
  for (const o of [osc, ...extras]) { o.start(t); o.stop(t + duracion + 0.02); }
}

/** Ruido filtrado (soplidos, chisporroteos, golpes, olas…). */
function ruido(duracion, { filtro = 'lowpass', frecuencia = 1000, hasta = null, q = 1, volumen = 0.3, retraso = 0, en = null, bus = 'efectos' } = {}) {
  const t = en ?? ctx.currentTime + retraso;
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruidoBlanco;
  fuente.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.Q.value = q;
  f.frequency.setValueAtTime(frecuencia, t);
  if (hasta) f.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  fuente.connect(f).connect(g).connect(buses[bus]);
  fuente.start(t, Math.random() * 0.5);
  fuente.stop(t + duracion + 0.02);
}

const arpegio = (notas, paso, opciones) => notas.forEach((n, i) => nota(midi(n), opciones.duracion ?? 0.16, { ...opciones, retraso: (opciones.retraso || 0) + i * paso }));

// --- Efectos --------------------------------------------------------------------------------------
const EFECTOS = {
  golpe: () => { ruido(0.14, { frecuencia: 1600, hasta: 300, volumen: 0.5 }); nota(150, 0.12, { tipo: 'sine', hasta: 50, volumen: 0.6 }); },
  golpeFuerte: () => { EFECTOS.golpe(); ruido(0.3, { frecuencia: 900, hasta: 120, volumen: 0.45 }); nota(90, 0.28, { tipo: 'sine', hasta: 35, volumen: 0.7 }); },
  eficaz: () => { nota(988, 0.07, { volumen: 0.16 }); nota(1319, 0.13, { volumen: 0.16, retraso: 0.07 }); },
  pocoEficaz: () => nota(260, 0.22, { tipo: 'triangle', hasta: 170, volumen: 0.25 }),
  nulo: () => nota(200, 0.16, { tipo: 'triangle', volumen: 0.22 }),
  critico: () => { nota(1760, 0.05, { volumen: 0.13 }); nota(2349, 0.09, { volumen: 0.13, retraso: 0.05 }); },
  // Un sonido por tipo, al lanzar el movimiento.
  fire: () => { ruido(0.75, { filtro: 'bandpass', frecuencia: 500, hasta: 2200, q: 0.8, volumen: 0.55 }); ruido(0.55, { frecuencia: 420, volumen: 0.3, retraso: 0.1 }); },
  water: () => { ruido(0.65, { frecuencia: 2600, hasta: 600, volumen: 0.45 }); for (let i = 0; i < 5; i++) nota(entre(400, 900), 0.07, { tipo: 'sine', hasta: entre(900, 1500), volumen: 0.14, retraso: 0.1 + i * 0.07 }); },
  electric: () => { for (let i = 0; i < 9; i++) nota(entre(150, 1400), 0.05, { tipo: 'sawtooth', hasta: entre(80, 2000), volumen: 0.12, retraso: i * 0.045 }); ruido(0.45, { filtro: 'highpass', frecuencia: 3000, volumen: 0.2 }); },
  grass: () => { for (let i = 0; i < 6; i++) ruido(0.09, { filtro: 'bandpass', frecuencia: 3500, hasta: 1400, q: 2, volumen: 0.32, retraso: i * 0.07 }); },
  ice: () => { for (let i = 0; i < 8; i++) nota(entre(1800, 3600), 0.13, { tipo: 'triangle', volumen: 0.09, retraso: i * 0.05 }); ruido(0.5, { filtro: 'highpass', frecuencia: 4000, volumen: 0.14 }); },
  fighting: () => { for (let i = 0; i < 3; i++) ruido(0.08, { frecuencia: 2200, hasta: 400, volumen: 0.42, retraso: i * 0.11 }); },
  poison: () => { for (let i = 0; i < 6; i++) nota(entre(200, 500), 0.08, { tipo: 'sine', hasta: entre(500, 900), volumen: 0.17, retraso: i * 0.08 }); },
  ground: () => { ruido(1.1, { frecuencia: 260, hasta: 60, volumen: 0.75 }); nota(55, 0.95, { tipo: 'sine', hasta: 30, volumen: 0.5 }); },
  flying: () => ruido(0.5, { filtro: 'bandpass', frecuencia: 400, hasta: 3000, q: 1.2, volumen: 0.48 }),
  psychic: () => nota(520, 0.8, { tipo: 'sine', volumen: 0.2, vibrato: [40, 7] }),
  bug: () => nota(110, 0.55, { tipo: 'square', volumen: 0.12, tremolo: 34 }),
  rock: () => { for (let i = 0; i < 3; i++) ruido(0.14, { frecuencia: 500, hasta: 90, volumen: 0.55, retraso: 0.25 + i * 0.12 }); },
  ghost: () => nota(330, 0.85, { tipo: 'sine', hasta: 150, volumen: 0.22, vibrato: [18, 5] }),
  dragon: () => { nota(110, 0.65, { tipo: 'sawtooth', hasta: 70, volumen: 0.22 }); ruido(0.65, { frecuencia: 700, volumen: 0.35 }); },
  dark: () => { nota(90, 0.55, { tipo: 'square', hasta: 60, volumen: 0.18 }); ruido(0.55, { frecuencia: 380, volumen: 0.32 }); },
  steel: () => { nota(1250, 0.65, { tipo: 'triangle', volumen: 0.2 }); nota(1873, 0.55, { tipo: 'sine', volumen: 0.11 }); },
  fairy: () => arpegio([84, 88, 91, 96], 0.06, { tipo: 'sine', volumen: 0.15, duracion: 0.2 }),
  normal: () => ruido(0.32, { filtro: 'bandpass', frecuencia: 800, hasta: 2200, volumen: 0.36 }),
  // Poké Ball, cambios, K.O.…
  lanzarBall: () => nota(500, 0.2, { tipo: 'square', hasta: 1100, volumen: 0.1 }),
  rebote: () => nota(300, 0.06, { tipo: 'square', hasta: 200, volumen: 0.09 }),
  abrirBall: () => { ruido(0.3, { filtro: 'highpass', frecuencia: 2500, volumen: 0.3 }); nota(1400, 0.4, { tipo: 'sine', hasta: 2800, volumen: 0.16 }); },
  retirar: () => nota(1300, 0.38, { tipo: 'sine', hasta: 250, volumen: 0.18 }),
  ko: () => nota(440, 0.75, { tipo: 'square', hasta: 70, volumen: 0.16 }),
  concentrar: () => arpegio([72, 76, 79], 0.07, { tipo: 'triangle', volumen: 0.17, duracion: 0.15 }),
  energiaLlena: () => arpegio([79, 84, 88, 91], 0.06, { tipo: 'square', volumen: 0.08, duracion: 0.17 }),
  evolucion: () => { // escala que sube y se acelera, como la de las evoluciones
    let t = 0;
    for (let i = 0; i < 22; i++) {
      nota(midi(60 + [0, 2, 4, 5, 7, 9, 11][i % 7] + 12 * Math.floor(i / 7)), 0.13, { tipo: 'triangle', volumen: 0.13, retraso: t });
      t += 0.16 - i * 0.005;
    }
  },
  evolucionFin: () => { [72, 76, 79, 84].forEach(n => nota(midi(n), 1.1, { tipo: 'triangle', volumen: 0.12 })); ruido(0.5, { filtro: 'highpass', frecuencia: 3000, volumen: 0.2 }); },
  quemado: () => ruido(0.45, { filtro: 'bandpass', frecuencia: 1200, hasta: 3000, volumen: 0.25 }),
  envenenado: () => EFECTOS.poison(),
  paralizado: () => { for (let i = 0; i < 4; i++) nota(entre(300, 1600), 0.05, { tipo: 'sawtooth', volumen: 0.12, retraso: i * 0.05 }); },
  congelado: () => EFECTOS.ice(),
  dormido: () => arpegio([76, 72, 69], 0.2, { tipo: 'sine', volumen: 0.14, duracion: 0.28 }),
  despierta: () => arpegio([69, 72, 76], 0.08, { tipo: 'sine', volumen: 0.14, duracion: 0.15 }),
  subeEtapa: () => arpegio([72, 79, 84], 0.05, { tipo: 'square', volumen: 0.08, duracion: 0.12 }),
  bajaEtapa: () => arpegio([84, 79, 72], 0.06, { tipo: 'square', volumen: 0.08, duracion: 0.14 }),
  curar: () => arpegio([76, 81, 85, 88], 0.06, { tipo: 'sine', volumen: 0.13, duracion: 0.2 }),
  falla: () => ruido(0.28, { filtro: 'bandpass', frecuencia: 1400, hasta: 380, q: 1.5, volumen: 0.3 }),
  transicion: () => { ruido(0.8, { filtro: 'bandpass', frecuencia: 300, hasta: 4000, q: 0.7, volumen: 0.35 }); nota(220, 0.8, { tipo: 'sawtooth', hasta: 880, volumen: 0.07 }); },
};

/** Suena un efecto (si están activados). */
export function efecto(nombre) {
  if (!ctx || !ajustes.efectos || !EFECTOS[nombre]) return;
  try { EFECTOS[nombre](); } catch { /* un efecto que falla no debe parar el combate */ }
}

/** Empieza a descargar y preparar los gritos (para que suenen sin esperar). */
export function precargarGritos(urls) {
  if (!ctx) return;
  for (const url of urls) {
    if (!url || gritos.has(url)) continue;
    gritos.set(url, fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null));
  }
}

/**
 * El grito de un Pokémon. `tono` < 1 lo hace más grave (al quedar K.O.). `pedido`: lo pidió la persona con un botón
 * («Escuchar su grito», la pista del grito): suena aunque los efectos estén apagados (antes no hacía nada y la pista
 * de ¿Quién es? costaba 3 puntos sin sonar). Los automáticos (combate, revelación) respetan el interruptor.
 */
export async function grito(url, { tono = 1, volumen = 0.55, pedido = false } = {}) {
  if (!ctx || !url || (!ajustes.efectos && !pedido)) return;
  precargarGritos([url]);
  const buffer = await gritos.get(url);
  if (!buffer) return;
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  fuente.playbackRate.value = tono;
  const g = ctx.createGain();
  g.gain.value = pedido ? volumen * VOLUMEN.efectos : volumen; // el mismo volumen que por el bus de efectos
  fuente.connect(g).connect(pedido ? salida : buses.efectos);
  fuente.start();
}

// --- Música de batalla (original) -------------------------------------------------------------------
// 4 compases de 16 semicorcheas: Lam – Fa – Sol – Mi7. Bajo (triángulo), arpegio (cuadrada suave),
// melodía, bombo, caja y charles (ruido). Con tensión va más deprisa y el charles dobla.
const ACORDES = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
const MELODIA = [
  76, null, 74, 72, null, 71, 72, null, 74, null, 76, null, 79, null, 77, 76,
  77, null, 76, 74, null, 72, 74, null, 76, null, 77, null, 74, null, 72, 69,
  71, null, 72, 74, null, 76, 74, null, 72, null, 71, null, 67, null, 71, 74,
  76, null, 75, 76, null, 80, 83, null, 80, null, 76, null, 74, null, 71, null,
];
const semicorchea = () => 60 / (musica?.tension ? 170 : 150) / 4;

function tocarPaso(paso, t) {
  const p = paso % 16;
  const acorde = ACORDES[Math.floor(paso / 16)];
  const s = semicorchea();
  if (p === 0 || p === 8 || (musica.tension && p === 14)) nota(150, 0.16, { tipo: 'sine', hasta: 40, volumen: 0.9, en: t, bus: 'musica' });
  if (p === 4 || p === 12) ruido(0.12, { filtro: 'highpass', frecuencia: 1400, volumen: 0.35, en: t, bus: 'musica' });
  if (musica.tension || p % 2 === 0) ruido(0.035, { filtro: 'highpass', frecuencia: 7000, volumen: 0.14, en: t, bus: 'musica' });
  if (p % 2 === 0) nota(midi(acorde[0] - 12 + (p % 4 === 2 ? 12 : 0)), s * 1.8, { tipo: 'triangle', volumen: 0.55, en: t, bus: 'musica' });
  nota(midi(acorde[p % 3] + 12), s * 0.9, { tipo: 'square', volumen: 0.05, en: t, bus: 'musica' });
  const m = MELODIA[paso];
  if (m) nota(midi(m + (musica.tension ? 12 : 0)), s * 1.7, { tipo: 'square', volumen: 0.08, en: t, bus: 'musica' });
}

function programar() {
  while (musica && musica.siguiente < ctx.currentTime + 0.12) {
    tocarPaso(musica.paso, musica.siguiente);
    musica.siguiente += semicorchea();
    musica.paso = (musica.paso + 1) % MELODIA.length;
  }
}

export function empezarMusica() {
  if (!ctx || musica) return;
  musica = { siguiente: ctx.currentTime + 0.15, paso: 0, tension: false, reloj: setInterval(programar, 25) };
}
/** Más deprisa y una octava más aguda: último Pokémon o vida baja. */
export function tensionMusica(activa) { if (musica) musica.tension = activa; }
export function detenerMusica() {
  if (!musica) return;
  clearInterval(musica.reloj);
  musica = null;
}

/** Fanfarria final (original): sube en Do mayor al ganar; baja en La menor al perder. */
export function fanfarria(victoria) {
  detenerMusica();
  if (!ctx) return;
  const t = ctx.currentTime + 0.1;
  const notas = victoria ? [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]] : [[69, 0], [67, 0.3], [65, 0.6], [64, 0.9]];
  for (const [n, d] of notas) nota(midi(n), victoria ? 0.3 : 0.5, { tipo: 'square', volumen: 0.16, en: t + d, bus: 'musica' });
  const final = victoria ? [60, 64, 67, 72] : [57, 60, 64];
  for (const n of final) nota(midi(n), 1.4, { tipo: 'triangle', volumen: 0.3, en: t + (victoria ? 0.96 : 1.2), bus: 'musica' });
}
