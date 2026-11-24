// Simulacro de combate: reglas propias y estrategia del rival. Lógica pura (sin DOM): la interfaz
// está en simulacro.js. Todas las funciones con azar aceptan `azar` (por defecto Math.random) para
// poder probarlas con una semilla fija.
//
// REGLAS (inspiradas en los juegos, simplificadas)
// Cada Pokémon lucha con sus estadísticas base: PV = Salud × 2,2 + 90; Ataque y Defensa para los
// movimientos físicos; Ataque especial y Defensa especial para los especiales; Velocidad para el orden.
// MOVIMIENTOS: cada Pokémon lleva 4 de los que aprende de verdad (PokéAPI; datos en datos-movimientos.js),
// elegidos por movimientosDe(): el mejor de cada tipo suyo, los que mejor cubren los tipos que esos no
// golpean bien y, si tiene alguno, uno rápido (con prioridad, como Ataque Rápido).
// Cada turno los dos bandos eligen a la vez una acción:
//   · Un movimiento → daño = 75 × Ataque ÷ Defensa (los de su clase) × potencia ÷ 90 × multiplicador de tipo
//     (×4, ×2, ×1, ×½, ×¼ o ×0) × clima × azar (0,85–1); × ⅔ si el movimiento no es de uno de sus tipos.
//     1 de cada 16 golpes es certero (×1,5). Puede fallar (precisión) y tener efectos: provocar un estado,
//     retroceso (se hace daño), drenar (se cura), recarga (pierde el turno siguiente), carga (pierde el
//     anterior; Vuelo, Excavar, Buceo y Golpe Fantasma además lo esconden: no se le puede alcanzar),
//     amedrentar (si golpea antes, el rival no actúa ese turno) o subir y bajar estadísticas.
//   · Concentrarse → este turno recibe la mitad de daño y su próximo golpe hace ×1,7.
//   · Cambiar → sale otro del equipo antes de los ataques (así que el que entra recibe el golpe).
// Orden: primero los cambios y la concentración; luego los ataques, el de más prioridad antes y, si empatan,
// el más rápido (empate: al azar).
// Clima (CLIMAS en datos.js, uno por combate): potencia o debilita los movimientos de algunos tipos.
// Estados (ESTADOS): los provocan los movimientos que los tienen (Rayo paraliza el 10 % de las veces,
// Escaldar quema el 30 %…), salvo a los Pokémon de un tipo inmune.
// Etapas: las estadísticas suben o bajan por etapas, de −6 a +6 (+1 = ×1,5; +2 = ×2; −1 = ×⅔; −2 = ×½…),
// y vuelven a 0 al retirarse.
// Energía de evolución: atacar, recibir golpes y concentrarse llenan una barra (0–100). Con la barra llena,
// un Pokémon que pueda evolucionar (siguiente fase de su cadena o, si ya es la última, megaevolución)
// evoluciona ANTES de actuar, sin gastar el turno: toma las estadísticas, tipos y movimientos de su
// evolución, conserva la parte de vida que tenía y recupera un 15 %. La barra vuelve a 0 (puede volver a
// evolucionar si aún le queda otra fase).
// Niveles (solo en el modo aventura; en el Duelo nadie lleva nivel): cada nivel de ventaja multiplica por
// FACTOR_NIVEL el daño que haces (y lo divide el que recibes). Con el mismo nivel, no cambia nada.
// Gana quien deja K.O. a todo el equipo contrario.

import { CLIMAS, ESTADOS, MOVIMIENTOS_RESERVA, NIVELES_SIMULACRO, rarezaDe, TIPOS } from './datos.js';
import { MOVIMIENTOS_DATOS } from './datos-movimientos.js';
import { multiplicador } from './efectividad.js';
import { barajar } from './utilidades.js';

const BASE_DANIO = 58;
const POTENCIA_REFERENCIA = 90; // un movimiento de su tipo con 90 de potencia es el golpe «normal»
const SIN_STAB = 2 / 3;         // si el movimiento no es de uno de sus tipos (los suyos pegan ×1,5 más)
export const BONO_CONCENTRAR = 1.7;
const PROB_CERTERO = 1 / 16;
const VARIACION_MEDIA = 0.925; // media de 0,85–1
const DANIO_ESTADO = { quemado: 1 / 16, envenenado: 1 / 10 }; // parte de la vida que pierde al final del turno
export const ENERGIA_LLENA = 100;
const ENERGIA = { golpea: 34, recibe: 20, concentra: 34 };
const CURA_EVOLUCION = 0.15;
export const FACTOR_NIVEL = 1.03;
export const MAX_MOVIMIENTOS = 4;
const LADOS = ['jugador', 'rival'];
const ATAQUE_DE = { fisico: 'attack', especial: 'special-attack' };
const DEFENSA_DE = { fisico: 'defense', especial: 'special-defense' };
const ESTADISTICAS = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];
const ESCONDEN = ['aire', 'tierra', 'agua', 'sombra']; // movimientos de carga que lo esconden un turno

/**
 * Cómo juega el rival en cada nivel.
 * - acierto:   probabilidad de elegir la jugada pensada (si no, ataca con algo al azar).
 * - cambios:   cuántas veces puede cambiar de Pokémon por combate.
 * - concentra: probabilidad de concentrarse cuando le conviene.
 * - evoluciona: probabilidad de evolucionar en cuanto puede.
 * - preseleccion: peso de la ventaja de tipos al elegir su equipo.
 * - tiposDuelo:   lo mismo en el uno contra uno: más bajo, porque tu luchador ya está elegido y no puedes
 *                 responder a un rival que te gane por tipo (negativo: el rival suele estar en desventaja).
 */
export const ESTRATEGIA = {
  novato: { acierto: 0.6, cambios: 0, concentra: 0, evoluciona: 0.5, preseleccion: 0, tiposDuelo: -0.6 },
  retador: { acierto: 0.9, cambios: 3, concentra: 0.6, evoluciona: 0.95, preseleccion: 1.2, tiposDuelo: 0 },
  maestro: { acierto: 1, cambios: 5, concentra: 0.9, evoluciona: 1, preseleccion: 1.8, tiposDuelo: 0.1 },
};

// --- Movimientos -------------------------------------------------------------------------------

/**
 * El movimiento `clave` (su nombre en PokéAPI, p. ej. 'thunderbolt') listo para el combate, o null si
 * no es de daño o no se usa en estas reglas:
 * { clave, nombre, tipo, poder, precision (null = no falla), categoria: 'fisico' | 'especial', prioridad,
 *   …efectos (ver datos-movimientos.js) }
 */
export function crearAtaque(clave) {
  const fila = MOVIMIENTOS_DATOS[clave];
  if (!fila) return null;
  const [nombre, tipo, poder, precision, clase, prioridad, efectos] = fila;
  return { clave, nombre, tipo, poder, precision, categoria: clase === 'f' ? 'fisico' : 'especial', prioridad, ...efectos };
}

// Enfado y compañía: en los juegos lo dejan descontrolado y confuso. Aquí no, pero se eligen menos para que
// no los lleve medio Pokédex.
const DESCONTROL = new Set(['outrage', 'thrash', 'petal-dance', 'raging-fury']);

/** Lo que vale un movimiento para este Pokémon (para elegir sus 4): potencia útil según sus estadísticas. */
function valorMovimiento(m, { stats, tipos }, porNivel) {
  const afinidad = (stats[ATAQUE_DE[m.categoria]] / Math.max(stats.attack, stats['special-attack'])) ** 2;
  const propio = tipos.includes(m.tipo) ? 1 : SIN_STAB;
  const pierdeTurno = m.recarga || m.carga ? 0.55 : 1;
  const seDebilita = m.aQuien === 'propio' && Object.values(m.cambios).some(n => n < 0) ? 0.8 : 1;
  const leDuele = m.costeVida ? 0.6 : m.retroceso ? 0.88 : 1;
  return m.poder * afinidad * propio * ((m.precision ?? 100) / 100) * pierdeTurno * seDebilita * leDuele
    * (m.segunVida ? 0.8 : 1) * (m.drena ? 1.1 : 1) * (DESCONTROL.has(m.clave) ? 0.75 : 1)
    * (porNivel ? 1.25 : 1); // prefiere los que aprende por nivel: los «suyos», como en el anime
}

const TODOS_LOS_TIPOS = Object.keys(TIPOS);
/** Cuántos tipos golpea ×2 este movimiento que no golpee ya ×2 ninguno de los elegidos. */
const tiposNuevos = (m, elegidos) => TODOS_LOS_TIPOS.filter(t =>
  multiplicador(m.tipo, t) >= 2 && !elegidos.some(e => multiplicador(e.tipo, t) >= 2)).length;

/** Movimientos de reserva para quien no aprende casi ninguno de daño (Ditto, Wobbuffet…). */
const reservaDe = ({ stats, tipos }) => {
  const clase = stats.attack > stats['special-attack'] ? 'fisico' : 'especial';
  return [...tipos.map(tipo => MOVIMIENTOS_RESERVA[tipo]?.[clase]), 'tackle'].filter(Boolean);
};

const movimientosGuardados = new Map();
/**
 * Los 4 movimientos de un Pokémon (sus detalles, con `aprende`: [[clave, porNivel], …]; mi-equipo.js):
 *   1. el mejor de cada uno de sus tipos;
 *   2. los que más tipos nuevos golpean ×2 (penaliza repetir tipo);
 *   3. uno con prioridad si lo tiene (Ataque Rápido, Acua Jet, Sombra Vil…), que vale la pena aunque pegue poco.
 * Si aprende menos de 2, completa con los de reserva de su tipo y Placaje.
 */
export function movimientosDe(detalles) {
  const clave = detalles.id ?? detalles.nombre;
  if (clave != null && movimientosGuardados.has(clave)) return movimientosGuardados.get(clave);
  const candidatos = [];
  const vistos = new Set();
  for (const [nombre, porNivel] of detalles.aprende || []) {
    const m = !vistos.has(nombre) && crearAtaque(nombre);
    if (!m) continue;
    vistos.add(nombre);
    candidatos.push({ m, valor: valorMovimiento(m, detalles, porNivel) });
  }
  candidatos.sort((a, b) => b.valor - a.valor);
  const mejor = candidatos[0]?.valor || 0;
  const elegidos = [];
  const tomar = c => { if (!c) return; elegidos.push(c.m); candidatos.splice(candidatos.indexOf(c), 1); };
  for (const tipo of detalles.tipos) tomar(candidatos.find(c => c.m.tipo === tipo));
  const rapido = candidatos.find(c => c.m.prioridad > 0 && c.valor >= mejor * 0.18);
  while (elegidos.length < MAX_MOVIMIENTOS - (rapido ? 1 : 0)) {
    let opcion = null;
    let puntos = -1;
    for (const c of candidatos) {
      if (c === rapido) continue;
      const repetido = elegidos.some(e => e.tipo === c.m.tipo);
      const p = c.valor * (1 + 0.25 * tiposNuevos(c.m, elegidos)) * (repetido ? 0.45 : 1);
      if (p > puntos) { puntos = p; opcion = c; }
    }
    if (!opcion) break;
    tomar(opcion);
  }
  tomar(rapido);
  if (elegidos.length < 2) {
    for (const nombre of reservaDe(detalles)) {
      if (elegidos.length >= MAX_MOVIMIENTOS) break;
      if (!elegidos.some(e => e.clave === nombre)) { const m = crearAtaque(nombre); if (m) elegidos.push(m); }
    }
  }
  if (clave != null) movimientosGuardados.set(clave, elegidos);
  return elegidos;
}

/** Los movimientos que puede usar un luchador (sus 4). */
export const ataquesDe = luchador => luchador.movimientos;

// --- Luchadores y daño -------------------------------------------------------------------

const etapasVacias = () => Object.fromEntries(ESTADISTICAS.map(e => [e, 0]));
/** Multiplicador de una etapa: +1 = ×1,5; +2 = ×2; −1 = ×⅔; −2 = ×½… */
export const factorEtapa = n => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
const estadistica = (luchador, nombre) => luchador.stats[nombre] * factorEtapa(luchador.etapas?.[nombre] || 0);

/** PV máximos y movimientos a partir de los detalles. */
const valoresDe = (detalles, vida) => ({
  pvMax: Math.round((detalles.stats.hp * 2.2 + 90) * vida),
  movimientos: movimientosDe(detalles),
});

/**
 * Convierte los detalles de un Pokémon (mi-equipo.js → detallesDe) en un luchador con su vida.
 * `vida` multiplica sus PV (en el duelo es 2: así dura más y cuenta más la estrategia).
 * `detalles.evoluciones` (evoluciones.js): las formas en las que puede evolucionar, cada una con las suyas.
 */
export function crearLuchador(detalles, vida = 1, clima = null, nivel = null) {
  const valores = valoresDe(detalles, vida);
  return {
    ...detalles,
    ...valores,
    pv: valores.pvMax,
    vida,
    clima,             // el clima del combate (lo usa el cálculo del daño)
    nivel,             // solo en la aventura (null en el Duelo): ver factorNivel
    evoluciones: detalles.evoluciones || [],
    mega: /-mega|-primal/.test(detalles.nombre),
    energia: 0,        // de 0 a ENERGIA_LLENA
    estado: null,      // { tipo: 'quemado' | 'envenenado' | 'paralizado' | 'congelado' | 'dormido', turnos? }
    etapas: etapasVacias(),
    cargado: false,    // se concentró: su próximo golpe hace ×1,7
    protegido: false,  // se concentra este turno: recibe la mitad
    recargando: false, // usó Hiperrayo (o similar): el turno siguiente no puede actuar
    pendiente: null,   // movimiento de carga que soltará el turno siguiente (Rayo Solar, Vuelo…)
    oculto: null,      // 'aire' | 'tierra' | 'agua' | 'sombra' mientras está escondido: no se le alcanza
    amedrentado: false,
    danioHecho: 0,
    kos: 0,
    evoluciono: 0,     // cuántas veces evolucionó en este combate
  };
}

/** Multiplicador de un ataque contra un Pokémon de uno o dos tipos (los factores se multiplican). */
export const multiplicadorContra = (tipoAtaque, tiposDefensa) =>
  tipoAtaque ? tiposDefensa.reduce((total, tipo) => total * multiplicador(tipoAtaque, tipo), 1) : 1;

/** Cuánto potencia (o debilita) el clima un movimiento: 1 si no le afecta. */
export const factorClima = (clima, tipoAtaque) => (tipoAtaque && CLIMAS[clima]?.potencia?.[tipoAtaque]) || 1;

/** ¿El movimiento es de uno de sus tipos? (pega ×1,5 más que uno de otro tipo). */
export const esPropio = (luchador, ataque) => luchador.tipos.includes(ataque.tipo);

/** Lo que pesan los niveles en el daño (1 si alguno no tiene nivel o si son iguales). */
export const factorNivel = (atacante, defensor) =>
  (atacante.nivel && defensor.nivel ? FACTOR_NIVEL ** (atacante.nivel - defensor.nivel) : 1);

function danioBase(atacante, defensor, ataque) {
  const mult = multiplicadorContra(ataque.tipo, defensor.tipos);
  const fuerza = estadistica(atacante, ATAQUE_DE[ataque.categoria]);
  const aguante = estadistica(defensor, DEFENSA_DE[ataque.categoria]);
  const potencia = (ataque.poder / POTENCIA_REFERENCIA) * (esPropio(atacante, ataque) ? 1 : SIN_STAB)
    * (ataque.segunVida ? Math.max(0.1, atacante.pv / atacante.pvMax) : 1);
  const valor = BASE_DANIO * (fuerza / aguante) * potencia * mult
    * factorClima(atacante.clima, ataque.tipo) * factorNivel(atacante, defensor)
    * (atacante.estado?.tipo === 'quemado' && ataque.categoria === 'fisico' ? 0.75 : 1)
    * (atacante.cargado ? BONO_CONCENTRAR : 1) * (defensor.protegido ? 0.5 : 1);
  return { mult, valor };
}

/** Daño medio de un golpe que acierta (sin azar ni golpe certero). */
export function danioMedio(atacante, defensor, ataque) {
  const { mult, valor } = danioBase(atacante, defensor, ataque);
  return mult === 0 ? 0 : valor * VARIACION_MEDIA;
}

/** Daño que cabe esperar por turno: cuenta la precisión y el turno que pierden la recarga y la carga. */
export const danioEsperado = (atacante, defensor, ataque) =>
  danioMedio(atacante, defensor, ataque) * ((ataque.precision ?? 100) / 100) * (ataque.recarga || ataque.carga ? 0.55 : 1);

/** Daño de un golpe real: { danio, mult, certero }. */
export function calcularDanio(atacante, defensor, ataque, azar = Math.random) {
  const { mult, valor } = danioBase(atacante, defensor, ataque);
  if (mult === 0) return { danio: 0, mult, certero: false };
  const certero = azar() < PROB_CERTERO;
  const danio = Math.max(1, Math.round(valor * (0.85 + azar() * 0.15) * (certero ? 1.5 : 1)));
  return { danio, mult, certero };
}

/** El ataque que más daño haría por turno: { ataque, esperado }. */
export function mejorAtaque(atacante, defensor) {
  return ataquesDe(atacante)
    .map(ataque => ({ ataque, esperado: danioEsperado(atacante, defensor, ataque) }))
    .reduce((mejor, opcion) => (opcion.esperado > mejor.esperado ? opcion : mejor));
}

/** Velocidad con la que se ordena el turno (cuentan sus etapas; la parálisis la reduce a la mitad). */
const velocidadDe = luchador => estadistica(luchador, 'speed') * (luchador.estado?.tipo === 'paralizado' ? 0.5 : 1);

/**
 * Qué tal le va a `a` contra `b`: la parte de la vida de `b` que quita por golpe menos la que recibe.
 * Positivo = ventaja. La velocidad suma un poco porque golpear primero importa.
 */
export function ventaja(a, b) {
  const golpeA = mejorAtaque(a, b).esperado / Math.max(1, b.pv);
  const golpeB = mejorAtaque(b, a).esperado / Math.max(1, a.pv);
  return golpeA - golpeB + (velocidadDe(a) > velocidadDe(b) ? 0.1 : velocidadDe(a) < velocidadDe(b) ? -0.1 : 0);
}

/** ¿Alguno de los tipos `tiposA` golpea ×2 o más a un Pokémon de tipos `tiposB`? */
const golpeaFuerte = (tiposA, tiposB) => tiposA.some(tipo => multiplicadorContra(tipo, tiposB) >= 2);

// --- Evolución ---------------------------------------------------------------------------------

/** ¿Puede evolucionar ya? (barra llena, alguna forma a la que evolucionar y sin un movimiento a medias). */
export const puedeEvolucionar = luchador =>
  Boolean(luchador && luchador.pv > 0 && luchador.energia >= ENERGIA_LLENA && luchador.evoluciones?.length
    && !luchador.recargando && !luchador.pendiente);

/** Convierte al luchador en `forma`: sus datos, valores y movimientos nuevos, la misma parte de vida + un 15 %. */
function transformar(luchador, forma) {
  const parte = luchador.pv / luchador.pvMax;
  const { evoluciones = [], mega = false, ...datos } = forma;
  Object.assign(luchador, datos, valoresDe(forma, luchador.vida));
  luchador.evoluciones = evoluciones;
  luchador.mega = luchador.mega || mega;
  luchador.pv = Math.min(luchador.pvMax, Math.round(luchador.pvMax * (parte + CURA_EVOLUCION)));
  luchador.energia = 0;
  luchador.evoluciono++;
}

/** Copia del luchador ya evolucionado (para planear sin tocar el original). */
function copiaEvolucionada(luchador, forma) {
  const copia = { ...luchador };
  transformar(copia, forma);
  return copia;
}

/** Cuál de sus evoluciones le conviene más contra `rival` (para Eevee y otros con varias). */
export function mejorEvolucion(luchador, rival) {
  if (!rival || luchador.evoluciones.length < 2) return 0;
  const puntos = luchador.evoluciones.map(forma => ventaja(copiaEvolucionada(luchador, forma), rival));
  return puntos.indexOf(Math.max(...puntos));
}

/**
 * Evoluciona al Pokémon de `lado` en su forma número `indice`. Devuelve el suceso
 * { tipo: 'evoluciona', lado, luchador, de, a, mega, aprende } o null si no puede.
 * `aprende`: nombres de los movimientos que tiene ahora y antes no.
 */
export function evolucionar(estado, lado, indice = 0) {
  const luchador = activo(estado, lado);
  const forma = luchador?.evoluciones[indice];
  if (!puedeEvolucionar(luchador) || !forma) return null;
  const de = luchador.nombre;
  const antes = new Set(luchador.movimientos.map(m => m.clave));
  transformar(luchador, forma);
  const aprende = luchador.movimientos.filter(m => !antes.has(m.clave)).map(m => m.nombre);
  return { tipo: 'evoluciona', lado, luchador, de, a: luchador.nombre, mega: Boolean(forma.mega), aprende };
}

/** Suma energía; avisa (suceso 'energiaLlena') cuando la barra se llena y ya puede evolucionar. */
function ganarEnergia(luchador, cantidad, lado, sucesos) {
  if (!luchador.evoluciones?.length || luchador.pv <= 0) return;
  const antes = luchador.energia;
  luchador.energia = Math.min(ENERGIA_LLENA, antes + cantidad);
  if (antes < ENERGIA_LLENA && luchador.energia >= ENERGIA_LLENA) sucesos.push({ tipo: 'energiaLlena', lado, luchador });
}

// --- Estados alterados y etapas ------------------------------------------------------------

/** Tras un golpe: quizá le provoca el estado de ese movimiento (salvo que su tipo lo impida). */
function intentarEstado(defensor, ataque, lado, sucesos, azar) {
  const clave = ataque.estado;
  if (!clave || !ESTADOS[clave] || defensor.estado || defensor.pv <= 0) return;
  if (defensor.tipos.some(tipo => ESTADOS[clave].inmunes.includes(tipo))) return;
  if (azar() * 100 >= ataque.probEstado) return;
  defensor.estado = clave === 'dormido' ? { tipo: clave, turnos: 1 + Math.floor(azar() * 3) } : { tipo: clave };
  sucesos.push({ tipo: 'estado', lado, luchador: defensor, estado: clave });
}

/** ¿Puede actuar este turno? Dormido, congelado o (a veces) paralizado: no. Puede despertar o descongelarse. */
function puedeActuar(luchador, lado, sucesos, azar) {
  const e = luchador.estado;
  if (!e) return true;
  if (e.tipo === 'dormido') {
    if (e.turnos > 0) { e.turnos--; sucesos.push({ tipo: 'noActua', lado, luchador, estado: 'dormido' }); return false; }
    luchador.estado = null;
    sucesos.push({ tipo: 'despierta', lado, luchador });
    return true;
  }
  if (e.tipo === 'congelado') {
    if (azar() < 0.25) { luchador.estado = null; sucesos.push({ tipo: 'descongela', lado, luchador }); return true; }
    sucesos.push({ tipo: 'noActua', lado, luchador, estado: 'congelado' });
    return false;
  }
  if (e.tipo === 'paralizado' && azar() < 0.25) { sucesos.push({ tipo: 'noActua', lado, luchador, estado: 'paralizado' }); return false; }
  return true;
}

/** Sube o baja sus etapas (de −6 a +6) y lo cuenta con un suceso 'etapas' { cambios: { attack: +1, … } }. */
function cambiarEtapas(luchador, cambios, lado, sucesos) {
  const hechos = {};
  for (const [nombre, n] of Object.entries(cambios)) {
    const antes = luchador.etapas[nombre];
    const despues = Math.max(-6, Math.min(6, antes + n));
    if (despues !== antes) { luchador.etapas[nombre] = despues; hechos[nombre] = despues - antes; }
  }
  if (Object.keys(hechos).length) sucesos.push({ tipo: 'etapas', lado, luchador, cambios: hechos });
}

// --- Estado del combate --------------------------------------------------------------------

/**
 * Estado inicial. Los equipos son listas de detalles; nadie está en el campo todavía (activo = -1).
 * `vida`: multiplicador de PV de todos (MODOS_BATALLA.duelo.vida en el duelo). `clima`: clave de CLIMAS o null.
 * `niveles`: { jugador, rival } en el modo aventura (el nivel de cada equipo); sin él, nadie lleva nivel.
 */
export function crearCombate(detallesJugador, detallesRival, nivel, { vida = 1, clima = null, niveles = null } = {}) {
  return {
    nivel,
    clima,
    turno: 1,
    cambiosRival: 0,
    ultimoCambioRival: -9,
    jugador: { equipo: detallesJugador.map(d => crearLuchador(d, vida, clima, niveles?.jugador ?? null)), activo: -1 },
    rival: { equipo: detallesRival.map(d => crearLuchador(d, vida, clima, niveles?.rival ?? null)), activo: -1 },
  };
}

export const otroLado = lado => (lado === 'jugador' ? 'rival' : 'jugador');
export const activo = (estado, lado) => estado[lado].equipo[estado[lado].activo];
/** Índices de los que aún pueden luchar y no están en el campo. */
export const disponibles = (estado, lado) =>
  estado[lado].equipo.flatMap((luchador, i) => (luchador.pv > 0 && i !== estado[lado].activo ? [i] : []));
export const enPie = (estado, lado) => estado[lado].equipo.filter(luchador => luchador.pv > 0).length;

/** 'jugador', 'rival' o null si el combate sigue. */
export function ganador(estado) {
  if (!enPie(estado, 'rival')) return 'jugador';
  if (!enPie(estado, 'jugador')) return 'rival';
  return null;
}

/**
 * Lo que un Pokémon tiene que hacer este turno sin poder elegir, o null: recargar (tras Hiperrayo…) o
 * soltar el movimiento que cargó el turno anterior (Rayo Solar, Vuelo, Excavar…).
 */
export function accionObligada(luchador) {
  if (!luchador || luchador.pv <= 0) return null;
  if (luchador.recargando) return { tipo: 'recargar' };
  if (luchador.pendiente) return { tipo: 'atacar', ataque: luchador.pendiente, segundoTurno: true };
  return null;
}

/**
 * Resuelve un turno con las dos acciones elegidas y devuelve la lista de sucesos, en orden, para que
 * la interfaz los anime. Acciones: { tipo: 'atacar', ataque } | { tipo: 'concentrar' } | { tipo: 'cambiar', indice }
 * (si alguno tiene una acción obligada, se usa esa). La del rival puede llevar `evoluciona: indice`
 * (evoluciona antes de actuar; el jugador lo hace antes de elegir, con evolucionar()).
 * Sucesos: { tipo: 'cambio', lado, sale, entra } | { tipo: 'concentra', lado, luchador }
 *        | { tipo: 'prepara', lado, luchador, ataque }  (primer turno de un movimiento de carga)
 *        | { tipo: 'ataque', lado, atacante, defensor, ataque, danio, mult, certero, protegido, clima, falla }
 *          (falla: null, 'falla' si no acierta u 'oculto' si el rival está escondido)
 *        | { tipo: 'ko', lado, luchador }   (lado = el bando del que cae)
 *        | { tipo: 'drena', lado, luchador, cura } | { tipo: 'retroceso', lado, luchador, danio, motivo: 'retroceso' | 'coste' }
 *        | { tipo: 'etapas', lado, luchador, cambios }
 *        | { tipo: 'evoluciona', lado, luchador, de, a, mega, aprende } | { tipo: 'energiaLlena', lado, luchador }
 *        | { tipo: 'estado', lado, luchador, estado }
 *        | { tipo: 'noActua', lado, luchador, estado }  (estado: 'dormido', 'congelado', 'paralizado', 'recarga' o 'amedrentado')
 *        | { tipo: 'despierta' | 'descongela', lado, luchador } | { tipo: 'danioEstado', lado, luchador, estado, danio }
 */
export function resolverTurno(estado, accionJugador, accionRival, azar = Math.random) {
  const sucesos = [];
  const obligadaRival = accionObligada(activo(estado, 'rival'));
  const acciones = {
    jugador: accionObligada(activo(estado, 'jugador')) || accionJugador,
    rival: obligadaRival || accionRival,
  };

  // 0. El rival evoluciona antes de actuar, si lo decidió.
  if (!obligadaRival && accionRival.evoluciona != null) {
    const suceso = evolucionar(estado, 'rival', accionRival.evoluciona);
    if (suceso) sucesos.push(suceso);
  }

  // 1. Primero los cambios, la concentración y la recarga (el jugador antes que el rival).
  for (const lado of LADOS) {
    const accion = acciones[lado];
    const luchador = activo(estado, lado);
    if (accion.tipo === 'cambiar') {
      Object.assign(luchador, { cargado: false, etapas: etapasVacias() }); // al retirarse pierde la concentración y las etapas
      estado[lado].activo = accion.indice;
      if (lado === 'rival') { estado.cambiosRival++; estado.ultimoCambioRival = estado.turno; }
      sucesos.push({ tipo: 'cambio', lado, sale: luchador, entra: activo(estado, lado) });
    } else if (accion.tipo === 'concentrar') {
      if (!puedeActuar(luchador, lado, sucesos, azar)) continue;
      luchador.protegido = true;
      luchador.cargado = true;
      sucesos.push({ tipo: 'concentra', lado, luchador });
      ganarEnergia(luchador, ENERGIA.concentra, lado, sucesos);
    } else if (accion.tipo === 'recargar') {
      luchador.recargando = false;
      sucesos.push({ tipo: 'noActua', lado, luchador, estado: 'recarga' });
    }
  }

  // 2. Los ataques: primero la prioridad más alta; si empatan, el más rápido.
  const atacan = LADOS.filter(lado => acciones[lado].tipo === 'atacar');
  const desempate = azar() < 0.5 ? 1 : -1;
  atacan.sort((a, b) => ((acciones[b].ataque.prioridad || 0) - (acciones[a].ataque.prioridad || 0))
    || (velocidadDe(activo(estado, b)) - velocidadDe(activo(estado, a))) || desempate);
  const actuaron = new Set();
  for (const lado of atacan) {
    actuaron.add(lado);
    const otro = otroLado(lado);
    const atacante = activo(estado, lado);
    const defensor = activo(estado, otro);
    const { ataque, segundoTurno } = acciones[lado];
    if (atacante.pv <= 0 || defensor.pv <= 0) continue; // cayó antes de poder actuar
    if (atacante.amedrentado) {
      Object.assign(atacante, { amedrentado: false, pendiente: null, oculto: null });
      sucesos.push({ tipo: 'noActua', lado, luchador: atacante, estado: 'amedrentado' });
      continue;
    }
    if (!puedeActuar(atacante, lado, sucesos, azar)) { Object.assign(atacante, { pendiente: null, oculto: null }); continue; }

    // Primer turno de un movimiento de carga (con sol, Rayo Solar no necesita cargar).
    if (ataque.carga && !segundoTurno && !(ataque.carga === 'sol' && atacante.clima === 'sol')) {
      atacante.pendiente = ataque;
      atacante.oculto = ESCONDEN.includes(ataque.carga) ? ataque.carga : null;
      sucesos.push({ tipo: 'prepara', lado, luchador: atacante, ataque });
      continue;
    }
    Object.assign(atacante, { pendiente: null, oculto: null });

    const falla = defensor.oculto ? 'oculto' : ataque.precision != null && azar() * 100 >= ataque.precision ? 'falla' : null;
    const resultado = falla ? { danio: 0, mult: multiplicadorContra(ataque.tipo, defensor.tipos), certero: false } : calcularDanio(atacante, defensor, ataque, azar);
    const protegido = defensor.protegido;
    atacante.cargado = false;
    defensor.pv = Math.max(0, defensor.pv - resultado.danio);
    atacante.danioHecho += resultado.danio;
    const clima = factorClima(atacante.clima, ataque.tipo);
    sucesos.push({ tipo: 'ataque', lado, atacante, defensor, ataque, protegido, clima, falla, ...resultado });
    if (!falla && ataque.recarga) atacante.recargando = true;
    if (resultado.danio > 0) {
      ganarEnergia(atacante, ENERGIA.golpea, lado, sucesos);
      ganarEnergia(defensor, ENERGIA.recibe, otro, sucesos);
      if (ataque.drena && atacante.pv < atacante.pvMax) {
        const cura = Math.min(atacante.pvMax - atacante.pv, Math.max(1, Math.round((resultado.danio * ataque.drena) / 100)));
        atacante.pv += cura;
        sucesos.push({ tipo: 'drena', lado, luchador: atacante, cura });
      }
    }
    if (defensor.pv === 0) {
      atacante.kos++;
      sucesos.push({ tipo: 'ko', lado: otro, luchador: defensor });
    } else if (resultado.danio > 0) {
      if (defensor.estado?.tipo === 'congelado' && ataque.tipo === 'fire') {
        defensor.estado = null; // el fuego lo descongela
        sucesos.push({ tipo: 'descongela', lado: otro, luchador: defensor });
      } else {
        intentarEstado(defensor, ataque, otro, sucesos, azar);
      }
      if (ataque.aQuien === 'rival' && azar() * 100 < ataque.probCambio) cambiarEtapas(defensor, ataque.cambios, otro, sucesos);
      // Amedrentar: solo si golpea antes de que el rival ataque este turno.
      if (ataque.amedrentar && !actuaron.has(otro) && acciones[otro].tipo === 'atacar' && azar() * 100 < ataque.amedrentar) defensor.amedrentado = true;
    }
    if (ataque.aQuien === 'propio' && resultado.danio > 0 && azar() * 100 < ataque.probCambio) cambiarEtapas(atacante, ataque.cambios, lado, sucesos);
    // Lo que le cuesta a él: retroceso (parte del daño hecho) o la mitad de su vida (Metaláser…).
    const coste = ataque.costeVida && !falla ? Math.round((atacante.pvMax * ataque.costeVida) / 100)
      : ataque.retroceso && resultado.danio > 0 ? Math.max(1, Math.round((resultado.danio * ataque.retroceso) / 100)) : 0;
    if (coste && atacante.pv > 0) {
      const danio = Math.min(atacante.pv, coste);
      atacante.pv -= danio;
      sucesos.push({ tipo: 'retroceso', lado, luchador: atacante, danio, motivo: ataque.costeVida ? 'coste' : 'retroceso' });
      if (atacante.pv === 0) sucesos.push({ tipo: 'ko', lado, luchador: atacante });
    }
  }

  // 3. Fin del turno: quemaduras y veneno; la protección y el miedo solo duran este turno.
  for (const lado of LADOS) {
    const luchador = activo(estado, lado);
    const parte = DANIO_ESTADO[luchador?.estado?.tipo];
    if (!luchador || luchador.pv <= 0 || !parte) continue;
    const danio = Math.min(luchador.pv, Math.max(1, Math.round(luchador.pvMax * parte)));
    luchador.pv -= danio;
    sucesos.push({ tipo: 'danioEstado', lado, luchador, estado: luchador.estado.tipo, danio });
    if (luchador.pv === 0) sucesos.push({ tipo: 'ko', lado, luchador });
  }
  for (const lado of LADOS) estado[lado].equipo.forEach(luchador => { luchador.protegido = false; luchador.amedrentado = false; });
  estado.turno++;
  return sucesos;
}

// --- Estrategia del rival --------------------------------------------------------------------

/** La acción del rival este turno, según su nivel (con `evoluciona` si decide evolucionar antes). */
export function decidirRival(estado, azar = Math.random) {
  const estrategia = ESTRATEGIA[estado.nivel];
  const real = activo(estado, 'rival');
  const el = activo(estado, 'jugador');
  const obligada = accionObligada(real);
  if (obligada) return obligada;
  // Evolucionar no gasta el turno: si puede, casi siempre lo hace (y planea con su forma nueva).
  let evoluciona = null;
  let yo = real;
  if (puedeEvolucionar(real) && azar() < estrategia.evoluciona) {
    evoluciona = mejorEvolucion(real, el);
    yo = copiaEvolucionada(real, real.evoluciones[evoluciona]);
  }
  const con = accion => (evoluciona == null ? accion : { ...accion, evoluciona });
  const opciones = ataquesDe(yo)
    .map(ataque => ({ ataque, esperado: danioEsperado(yo, el, ataque), medio: danioMedio(yo, el, ataque) }))
    .sort((a, b) => b.esperado - a.esperado);
  const atacar = opcion => con({ tipo: 'atacar', ataque: opcion.ataque });

  // A veces se equivoca (en Novato, a menudo).
  if (azar() > estrategia.acierto) return atacar(opciones[Math.floor(azar() * opciones.length)]);

  // Si tu Pokémon está escondido (Vuelo, Excavar…) o tiene que recargar, aprovecha para concentrarse.
  if ((el.oculto || el.recargando) && !yo.cargado && azar() < estrategia.concentra) return con({ tipo: 'concentrar' });

  // Puede rematar: no lo duda (con el que acierte más y, si puede, el que actúe antes).
  const rematan = opciones.filter(o => o.medio >= el.pv && !o.ataque.carga);
  if (rematan.length) {
    rematan.sort((a, b) => ((b.ataque.prioridad || 0) - (a.ataque.prioridad || 0)) || ((b.ataque.precision ?? 101) - (a.ataque.precision ?? 101)));
    return atacar(rematan[0]);
  }
  const mejor = opciones[0];

  // Lo más probable es que el jugador use su mejor ataque contra el que está en el campo.
  const golpeProbable = mejorAtaque(el, yo);

  // ¿Cambiar? Si está en clara desventaja y un compañero aguantaría ese golpe y lo haría mucho mejor.
  const puedeCambiar = evoluciona == null && estado.cambiosRival < estrategia.cambios && estado.turno - estado.ultimoCambioRival > 1;
  if (puedeCambiar) {
    const actual = ventaja(yo, el);
    const relevo = disponibles(estado, 'rival')
      .map(indice => {
        const compa = estado.rival.equipo[indice];
        const recibe = danioEsperado(el, compa, golpeProbable.ataque) / compa.pv; // el golpe que le tocaría al entrar
        return { indice, puntos: ventaja(compa, el) - recibe * 0.6, recibe };
      })
      .sort((a, b) => b.puntos - a.puntos)[0];
    if (relevo && actual < -0.25 && relevo.recibe < 0.55 && relevo.puntos > actual + 0.5) {
      return { tipo: 'cambiar', indice: relevo.indice };
    }
  }

  // ¿Concentrarse? Solo si está a salvo y el golpe cargado casi seguro lo deja K.O. después.
  const aSalvo = golpeProbable.esperado < yo.pv * 0.3;
  if (!yo.cargado && aSalvo && mejor.medio * BONO_CONCENTRAR >= el.pv * 0.9 && azar() < estrategia.concentra) {
    return con({ tipo: 'concentrar' });
  }
  return atacar(mejor);
}

/** A quién saca un bando tras un K.O. (o al empezar, si contra = null). Devuelve un índice o -1. */
export function elegirRelevo(estado, lado, azar = Math.random) {
  const libres = disponibles(estado, lado);
  if (!libres.length) return -1;
  const contra = activo(estado, otroLado(lado));
  if (estado.nivel === 'novato' || !contra) return libres[Math.floor(azar() * libres.length)];
  const puntos = indice => ventaja(estado[lado].equipo[indice], contra);
  return libres.reduce((mejor, indice) => (puntos(indice) > puntos(mejor) ? indice : mejor));
}

/** Con quién empieza el rival: el que mejor se lleva, de media, con todo el equipo del jugador. */
export function elegirInicialRival(estado, azar = Math.random) {
  const indices = estado.rival.equipo.map((_, i) => i);
  if (estado.nivel === 'novato') return indices[Math.floor(azar() * indices.length)];
  const media = i => estado.jugador.equipo.reduce((suma, j) => suma + ventaja(estado.rival.equipo[i], j), 0);
  const orden = indices.sort((a, b) => media(b) - media(a));
  return estado.nivel === 'maestro' ? orden[0] : orden[Math.floor(azar() * Math.min(2, orden.length))];
}

// --- Equipo del rival ---------------------------------------------------------------------------

/**
 * Primer filtro, solo con los tipos (sin descargar nada): de la lista de especies elige `cuantos`
 * candidatos al azar; en Retador y Maestro, con preferencia por los que tienen ventaja de tipo.
 * `especies`: [{ id, nombre, tipos }] (especies.js). `equipo`: detalles del jugador (en el duelo, su luchador).
 */
export function preseleccionarCandidatos(especies, equipo, nivel, { cuantos = 32, duelo = false } = {}, azar = Math.random) {
  const { leyendas } = NIVELES_SIMULACRO[nivel];
  const peso = duelo ? ESTRATEGIA[nivel].tiposDuelo : ESTRATEGIA[nivel].preseleccion;
  const propias = new Set(equipo.map(p => p.especie));
  return barajar(especies.filter(e => !propias.has(e.id) && (leyendas || !rarezaDe(e.id))), azar)
    .slice(0, cuantos * 5)
    .map(e => ({ e, puntos: peso * balanceTipos(e.tipos, equipo) + azar() * 3 }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, cuantos)
    .map(({ e }) => e);
}

/** A cuántos del equipo golpea fuerte menos cuántos le golpean fuerte a él. */
const balanceTipos = (tipos, equipo) =>
  equipo.reduce((suma, p) => suma + (golpeaFuerte(tipos, p.tipos) ? 1 : 0) - (golpeaFuerte(p.tipos, tipos) ? 1 : 0), 0);

/**
 * Elige el equipo rival entre los candidatos ya descargados (con estadísticas): poder parecido al
 * objetivo del nivel, ventaja de tipos (Retador y Maestro) y variedad (penaliza repetir tipos).
 */
export function elegirEquipoRival(candidatos, equipo, nivel, cantidad, { duelo = false } = {}, azar = Math.random) {
  // En el uno contra uno, `equipo` es solo tu luchador: el rival se ajusta a él con factorDuelo y tiposDuelo.
  const { factorPoder, factorDuelo } = NIVELES_SIMULACRO[nivel];
  const peso = duelo ? ESTRATEGIA[nivel].tiposDuelo : ESTRATEGIA[nivel].preseleccion;
  const mediaPoder = equipo.reduce((suma, p) => suma + p.poder, 0) / equipo.length;
  const objetivo = Math.min(680, Math.max(200, mediaPoder * (duelo ? factorDuelo : factorPoder)));
  const elegidos = [];
  const quedan = [...candidatos];
  while (elegidos.length < cantidad && quedan.length) {
    const puntuados = quedan.map(c => ({
      c,
      puntos: -Math.abs(c.poder - objetivo) / 25
        + (peso * balanceTipos(c.tipos, equipo) * 3) / equipo.length
        - 1.5 * elegidos.filter(e => e.tipos.some(tipo => c.tipos.includes(tipo))).length
        + azar(),
    }));
    const { c: mejor } = puntuados.reduce((a, b) => (b.puntos > a.puntos ? b : a));
    elegidos.push(mejor);
    quedan.splice(quedan.indexOf(mejor), 1);
  }
  return elegidos;
}
