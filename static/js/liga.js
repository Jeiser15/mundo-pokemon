// Modo aventura: la copa de cada región, con el formato de una liga de campeones. Lógica pura (sin DOM,
// como combate.js): la interfaz está en aventura.js. Lo que lleva azar sale de la SEMILLA de la temporada,
// así que una temporada guardada se puede rehacer igual (y probar).
//
// FORMATO (el mismo en las nueve regiones)
//   · 16 entrenadores: tú, Kael (tu rival), el campeón vigente y 13 más de la región (los del anime, con su tipo).
//   · Sorteo con 4 bombos (por fuerza): el campeón y los tres más fuertes en el 1; Kael en el 2; tú, en el 4
//     (eres el recién llegado). Kael siempre cae en tu grupo y el campeón, en la otra mitad del cuadro.
//   · Fase de grupos: 4 grupos de 4, todos contra todos a un combate (3 jornadas: primero el del bombo 3,
//     luego Kael y por último el cabeza de serie). Victoria = 3 puntos. El marcador son los K.O.: quien gana
//     deja K.O. a los 6 del rival («6–2»). Desempates: diferencia de K.O., K.O. hechos y el enfrentamiento
//     directo. Pasan los dos primeros de cada grupo.
//   · Cuartos (1.º de un grupo contra el 2.º de su vecino), semifinal y final, a partido único. Los grupos A y
//     B forman una mitad del cuadro; C y D, la otra.
//   · Los combates entre otros entrenadores se simulan con su fuerza. El campeón vigente gana los suyos: si
//     llegas a la final, te espera él.
// DIFICULTAD: sube en cada ronda y en cada región (dificultad()): el poder de las especies del rival frente al
// de tu equipo, su ventaja de nivel, su estrategia (ESTRATEGIA de combate.js) y si tienes ayudas de tipos. En
// Paldea, la semifinal trae una leyenda y la final, seis.
// TU EQUIPO: 5 al azar y 1 inicial que eliges entre 3, todos de la región (cada uno con un 1 % de ser legendario
// o singular). Queda sellado hasta ganar la región: si te eliminan, vuelves a jugar la copa con el mismo equipo y
// un nivel más por cada intento (hasta +3).

import { multiplicadorContra } from './combate.js';
import {
  ASES_FINAL, ASPECTO_ENTRENADOR, ENTRENADOR_ANIME, GENERACIONES, LEYENDAS_FINAL, NOMBRES_AVENTURA, rarezaDe,
  REGIONES_AVENTURA, RIVAL_AVENTURA, TIPOS,
} from './datos.js';
import { barajar } from './utilidades.js';

export const GRUPOS = ['A', 'B', 'C', 'D'];
export const TAMANO_EQUIPO = 6;
export const PROB_LEGENDARIO = 0.01;
export const MAX_BONO_INTENTOS = 3;
export const RONDA_CUARTOS = 3;
export const RONDA_FINAL = 5;
export const RONDAS = [
  { nombre: 'Jornada 1', corto: 'J1', fase: 'grupos' },
  { nombre: 'Jornada 2', corto: 'J2', fase: 'grupos' },
  { nombre: 'Jornada 3', corto: 'J3', fase: 'grupos' },
  { nombre: 'Cuartos de final', corto: 'Cuartos', fase: 'cuartos' },
  { nombre: 'Semifinal', corto: 'Semifinal', fase: 'semis' },
  { nombre: 'La final', corto: 'Final', fase: 'final' },
];

// --- Dificultad --------------------------------------------------------------------------------------

const NOMBRE_ESTRATEGIA = { n: 'novato', r: 'retador', m: 'maestro' };

/**
 * La curva de dificultad (r = región 0–8, k = ronda 0–5). Medida con miles de temporadas simuladas (ver CLAUDE.md):
 *   estrategias: cómo juega el rival en cada región (filas: Kanto … Paldea) y ronda (J1, J2, J3, cuartos,
 *           semifinal, final): n = novato, r = retador, m = maestro (ESTRATEGIA en combate.js);
 *   poder:  el de las especies del rival frente al de tu equipo = poderBase + poderRegion·r + poderRonda·k (+ poderFinal);
 *   nivel:  los niveles que te saca si llegas a esa ronda ganándolo todo = nivelBase + nivelRegion·r + nivelRonda·k
 *           (+ nivelFinal), redondeado; con derrotas te saca más (tú subes uno por victoria);
 *   contra: cuánto elige su equipo para ganarte por tipos = contraBase + contraRegion·r (0 si juega de novato);
 *   ventajaLeyendas: los niveles de la campeona de Paldea frente a los tuyos (negativo: con seis leyendas, ya
 *           es un infierno; a tu mismo nivel no se ganaba casi nunca).
 * Un combate de 6 contra 6 amplifica cualquier ventaja pequeña: por eso los pasos son finos.
 */
export const CURVA = {
  estrategias: ['nnnnrr', 'nnrrrr', 'nrrrrr', 'rrrrrr', 'rrrrrm', 'rrrrrm', 'rrrrrm', 'rrrrrm', 'rrrrrm'],
  poderBase: 0.8, poderRegion: 0.01, poderRonda: 0.015, poderFinal: 0,
  nivelBase: -3, nivelRegion: 0.35, nivelRonda: 0.5, nivelFinal: 0,
  contraBase: 0.2, contraRegion: 0.04,
  ventajaLeyendas: -3,
};

/**
 * Cómo es el rival de la ronda `ronda` (0–5) en la región `region` (0–8):
 * { estrategia, factor (poder de sus especies frente al de tu equipo), contra (peso de la ventaja de tipos al
 *   elegir su equipo), nivel, ayudas (si los botones dicen la eficacia ×2, ×½…), leyendas (cuántas lleva) }.
 */
export function dificultad(region, ronda) {
  const final = ronda === RONDA_FINAL;
  const c = CURVA;
  const estrategia = NOMBRE_ESTRATEGIA[c.estrategias[region][ronda]];
  const leyendas = region === 8 ? (final ? 6 : ronda === 4 ? 1 : 0) : 0;
  const ventaja = leyendas === 6 ? c.ventajaLeyendas
    : Math.round(c.nivelBase + c.nivelRegion * region + c.nivelRonda * ronda + (final ? c.nivelFinal : 0));
  return {
    estrategia,
    factor: c.poderBase + c.poderRegion * region + c.poderRonda * ronda + (final ? c.poderFinal : 0),
    contra: estrategia === 'novato' ? 0 : c.contraBase + c.contraRegion * region,
    nivel: Math.min(100, REGIONES_AVENTURA[region].nivel + ronda + ventaja),
    ayudas: region < 5,
    leyendas,
  };
}

/** Tu nivel ahora: el de la región, +1 por cada victoria de esta temporada y +1 por intento fallido (hasta +3). */
export const nivelJugador = temporada => Math.min(100, REGIONES_AVENTURA[temporada.region].nivel
  + temporada.victorias + Math.min(MAX_BONO_INTENTOS, temporada.intento - 1));

// --- Azar con semilla -------------------------------------------------------------------------------

/** Números al azar repetibles (mulberry32): la misma semilla da siempre la misma secuencia. */
export function azarDe(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const nuevaSemilla = () => Math.floor(Math.random() * 2 ** 31);
const alAzar = (lista, azar) => lista[Math.floor(azar() * lista.length)];

// --- Participantes --------------------------------------------------------------------------------

/** Un aspecto al azar para un entrenador, en estilo anime (entrenador.js lo dibuja); con pelo largo si es chica. */
export function aspectoAlAzar(azar = Math.random, genero = 'm') {
  const { colores, pieles, pelos } = ASPECTO_ENTRENADOR;
  const { gorras, camisetas, pantalones, bolsas } = ENTRENADOR_ANIME;
  const claves = objeto => Object.keys(objeto);
  return {
    gorra: alAzar(claves(gorras), azar),
    colorGorra: alAzar(colores, azar)[1],
    chaqueta: alAzar(claves(camisetas), azar),
    colorChaqueta: alAzar(colores, azar)[1],
    piel: alAzar(pieles, azar),
    pelo: alAzar(pelos, azar)[1],
    peinado: genero === 'f' ? alAzar(['largo'], azar) : alAzar(['corto', 'pinchos', 'corto'], azar),
    pantalon: alAzar(claves(pantalones), azar),
    colorPantalon: alAzar(colores, azar)[1],
    bolsa: alAzar(claves(bolsas), azar),
  };
}

/** El Pokémon estrella de Kael en cada región: un inicial de la región (fase media en Kanto y Johto). */
export function asDeKael(region, semilla) {
  const base = GENERACIONES[region].iniciales[semilla % 3];
  return base + (region < 2 ? 1 : 2);
}

/** Nombre → sprite de los juegos de los participantes y los campeones de las nueve copas. */
const SPRITE_DE = Object.fromEntries([
  ...NOMBRES_AVENTURA.flat().map(([nombre, , , sprite]) => [nombre, sprite]),
  ...REGIONES_AVENTURA.map(r => [r.campeon.nombre, r.campeon.aspecto.sprite]),
]);

/**
 * El aspecto con el que se dibuja a un participante: si es un personaje de los juegos, con su sprite (también en
 * las temporadas guardadas antes de que los tuvieran). Kael, con su aspecto de ahora (estilo anime, como el tuyo).
 */
export function aspectoDeParticipante(p) {
  if (p?.rol === 'rival') return RIVAL_AVENTURA.aspecto; // Kael, siempre con su aspecto de ahora
  const sprite = SPRITE_DE[p?.nombre];
  return sprite && p.aspecto?.sprite !== sprite ? { ...p.aspecto, sprite } : p?.aspecto;
}

/** «el Campeón Lance», «Misty», «Kael». */
export const nombreCompleto = p => (p.articulo ? `${p.articulo} ${p.titulo}` : p.titulo);

/**
 * Una temporada nueva de la copa de `region`. Con `equipo` (ids), el equipo ya está sellado (otro intento
 * en la misma región) y se empieza por el sorteo de grupos; si no, por el sorteo de tu equipo.
 * Se guarda tal cual en localStorage (aventura.js): solo datos, sin funciones.
 */
export function crearTemporada(region, { semilla = nuevaSemilla(), intento = 1, equipo = null } = {}) {
  const azar = azarDe(semilla);
  const datos = REGIONES_AVENTURA[region];
  const nombres = barajar(NOMBRES_AVENTURA[region], azar).slice(0, 13);
  const tipos = barajar(Object.keys(TIPOS), azar);
  const fuerzas = nombres.map(() => 0.2 + azar() * 0.6).sort((a, b) => b - a);
  const BOMBOS = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4];
  const otros = nombres.map(([nombre, genero, favorito, sprite], i) => {
    const tipo = favorito in TIPOS ? favorito : tipos[i];
    return {
      clave: 'e' + i, rol: null, nombre, articulo: '', titulo: nombre, apodo: `especialista en tipo ${TIPOS[tipo].nombre}`,
      tipo, bombo: BOMBOS[i], fuerza: fuerzas[i], aspecto: { ...aspectoAlAzar(azar, genero), sprite }, equipo: null,
    };
  });
  const c = datos.campeon;
  const femenino = c.genero === 'f';
  return {
    version: 1,
    region,
    semilla,
    intento,
    fase: equipo ? 'sorteo' : 'equipo', // equipo → sorteo → grupos → cuartos → semis → final → campeon | eliminado
    sorteo: null,            // { sorteados: [5 ids], opciones: [3 ids] } (sortearEquipo)
    equipo,                  // [6 ids] cuando está sellado
    participantes: [
      { clave: 'tu', rol: 'jugador', bombo: 4, fuerza: 0.5 },
      { clave: 'campeon', rol: 'campeon', nombre: c.nombre, articulo: femenino ? 'la' : 'el', titulo: `${femenino ? 'Campeona' : 'Campeón'} ${c.nombre}`,
        apodo: c.apodo, tipo: null, bombo: 1, fuerza: 1, aspecto: c.aspecto, equipo: null },
      { clave: 'kael', rol: 'rival', nombre: RIVAL_AVENTURA.nombre, articulo: '', titulo: RIVAL_AVENTURA.nombre, apodo: 'tu rival',
        tipo: null, bombo: 2, fuerza: Math.min(0.85, 0.62 + region * 0.025), aspecto: RIVAL_AVENTURA.aspecto, equipo: null },
      ...otros,
    ],
    grupos: null,            // 4 listas de 4 claves, por bombo (el 1.º es el cabeza de serie)
    ordenSorteo: null,       // [{ bombo, clave, grupo }] en el orden en que salen las bolas
    partidos: [],            // { id, ronda, grupo?, llave?, local, visitante, resultado: { ganador, local, visitante } | null }
    ronda: 0,                // 0–2 jornadas, 3 cuartos, 4 semifinal, 5 final
    victorias: 0,
    derrotas: 0,
    eliminadoEn: null,       // ronda en la que te eliminaron
  };
}

export const participante = (temporada, clave) => temporada.participantes.find(p => p.clave === clave);

// --- Tu equipo ------------------------------------------------------------------------------------

/**
 * El sorteo de tu equipo: 5 al azar y 3 opciones para la inicial, sin repetir y todos de la región.
 * Cada uno tiene PROB_LEGENDARIO de ser legendario o singular. especies: [{ id, nombre, tipos }] (especies.js).
 */
export function sortearEquipo(region, especies, azar = Math.random) {
  const { desde, hasta } = GENERACIONES[region];
  const propias = especies.filter(e => e.id >= desde && e.id <= hasta);
  const comunes = propias.filter(e => !rarezaDe(e.id)).map(e => e.id);
  const leyendas = propias.filter(e => rarezaDe(e.id)).map(e => e.id);
  const usados = new Set();
  const uno = () => {
    const quedanLeyendas = leyendas.filter(id => !usados.has(id));
    const lista = azar() < PROB_LEGENDARIO && quedanLeyendas.length ? quedanLeyendas : comunes.filter(id => !usados.has(id));
    const id = alAzar(lista, azar);
    usados.add(id);
    return id;
  };
  const sorteados = Array.from({ length: TAMANO_EQUIPO - 1 }, uno);
  return { sorteados, opciones: Array.from({ length: 3 }, uno) };
}

/** El poder con el que se miden los rivales: la media de tu equipo sin contar los legendarios (esa suerte es tuya). */
export function poderReferencia(detalles) {
  const comunes = detalles.filter(d => !rarezaDe(d.especie ?? d.id));
  const lista = comunes.length ? comunes : detalles;
  return (lista.reduce((suma, d) => suma + d.poder, 0) / lista.length) * (comunes.length ? 1 : 0.85);
}

// --- Equipos de los rivales -------------------------------------------------------------------------

/**
 * Primer paso del equipo de un rival, sin descargar nada: los que lleva sí o sí (`fijos`: el as del campeón o
 * de Kael, las leyendas de Paldea) y `candidatos` (ids de especies de la región, con preferencia por el tipo de su
 * oficio) para completarlo con completarEquipoRival() cuando ya se conozcan sus estadísticas.
 */
export function planEquipoRival(temporada, rival, ronda, especies, azar = Math.random) {
  const { region } = temporada;
  const datos = REGIONES_AVENTURA[region];
  if (rival.rol === 'campeon' && datos.campeon.leyendas) {
    // Koraidon o Miraidon y cinco leyendas de tipos distintos.
    const elegidas = [alAzar(ASES_FINAL, azar)];
    const tiposDe = id => especies.find(e => e.id === id)?.tipos || [];
    for (const id of barajar(LEYENDAS_FINAL, azar)) {
      if (elegidas.length >= TAMANO_EQUIPO) break;
      if (!elegidas.some(otra => tiposDe(otra)[0] && tiposDe(otra)[0] === tiposDe(id)[0])) elegidas.push(id);
    }
    return { fijos: elegidas, candidatos: [] };
  }
  const { desde, hasta } = GENERACIONES[region];
  const fijos = [];
  if (rival.rol === 'campeon' && datos.campeon.as) fijos.push(datos.campeon.as);
  if (rival.rol === 'rival') fijos.push(asDeKael(region, temporada.semilla));
  if (dificultad(region, ronda).leyendas && rival.rol !== 'campeon') {
    fijos.push(alAzar(especies.filter(e => e.id >= desde && e.id <= hasta && rarezaDe(e.id) === 'legendario' && !ASES_FINAL.includes(e.id)).map(e => e.id), azar));
  }
  const usados = new Set([...fijos, ...(temporada.equipo || [])]);
  const propias = especies.filter(e => e.id >= desde && e.id <= hasta && !rarezaDe(e.id) && !usados.has(e.id));
  const delTipo = rival.tipo ? propias.filter(e => e.tipos.includes(rival.tipo)) : [];
  const resto = propias.filter(e => !delTipo.includes(e));
  return { fijos, candidatos: [...barajar(delTipo, azar).slice(0, 10), ...barajar(resto, azar).slice(0, 22)].map(e => e.id) };
}

const golpeaFuerte = (tiposA, tiposB) => tiposA.some(tipo => multiplicadorContra(tipo, tiposB) >= 2);
/** A cuántos de `equipo` golpea fuerte menos cuántos le golpean fuerte a él. */
const balanceTipos = (tipos, equipo) =>
  equipo.reduce((suma, p) => suma + (golpeaFuerte(tipos, p.tipos) ? 1 : 0) - (golpeaFuerte(p.tipos, tipos) ? 1 : 0), 0);

/**
 * Completa el equipo del rival hasta 6 con los candidatos ya descargados (detalles con poder y tipos): poder
 * parecido al objetivo, algo de su tipo, ventaja de tipos (con el `peso` de dificultad().contra) y variedad.
 * Devuelve ids. `contra`: los detalles de tu equipo.
 */
export function completarEquipoRival(fijos, candidatos, { objetivo, tipo = null, contra = [], peso = 0 }, azar = Math.random) {
  const elegidos = [...fijos];
  const tiposElegidos = [];
  const quedan = candidatos.filter(c => !fijos.includes(c.id));
  while (elegidos.length < TAMANO_EQUIPO && quedan.length) {
    const puntuados = quedan.map(c => ({
      c,
      puntos: -Math.abs(c.poder - objetivo) / 25
        + (tipo && c.tipos.includes(tipo) ? 1.6 : 0)
        + (contra.length ? (peso * balanceTipos(c.tipos, contra) * 3) / contra.length : 0)
        - 1.5 * tiposElegidos.filter(t => c.tipos.includes(t)).length
        + azar(),
    }));
    const { c: mejor } = puntuados.reduce((a, b) => (b.puntos > a.puntos ? b : a));
    elegidos.push(mejor.id);
    tiposElegidos.push(...mejor.tipos);
    quedan.splice(quedan.indexOf(mejor), 1);
  }
  return elegidos;
}

/** El objetivo de poder del rival de esa ronda (frente a tu equipo). */
export const objetivoRival = (temporada, ronda, referencia) =>
  Math.min(680, Math.max(180, referencia * dificultad(temporada.region, ronda).factor));

// --- Sorteo y calendario ----------------------------------------------------------------------------

// Jornadas dentro de un grupo ordenado por bombo (0 = bombo 1 … 3 = bombo 4, tú): primero contra el del
// bombo 3, luego contra el del 2 (Kael) y por último contra el cabeza de serie.
const JORNADAS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

/** Sorteo de los grupos con sus reglas (Kael contigo; el campeón, en la otra mitad) y el calendario. */
export function sortearGrupos(temporada) {
  const azar = azarDe(temporada.semilla + 101);
  const porBombo = b => temporada.participantes.filter(p => p.bombo === b).map(p => p.clave);
  const tuGrupo = Math.floor(azar() * 4);
  const grupoCampeon = alAzar(tuGrupo < 2 ? [2, 3] : [0, 1], azar);
  const grupos = [[], [], [], []];
  const orden = [];
  for (let bombo = 1; bombo <= 4; bombo++) {
    const fijos = bombo === 1 ? { campeon: grupoCampeon } : bombo === 2 ? { kael: tuGrupo } : bombo === 4 ? { tu: tuGrupo } : {};
    const libres = barajar([0, 1, 2, 3].filter(g => !Object.values(fijos).includes(g)), azar);
    const sueltos = barajar(porBombo(bombo).filter(clave => !(clave in fijos)), azar);
    const destino = { ...fijos };
    sueltos.forEach((clave, i) => { destino[clave] = libres[i]; });
    for (const clave of barajar(porBombo(bombo), azar)) { // el orden en que salen las bolas
      grupos[destino[clave]][bombo - 1] = clave;
      orden.push({ bombo, clave, grupo: destino[clave] });
    }
  }
  temporada.grupos = grupos;
  temporada.ordenSorteo = orden;
  temporada.partidos = grupos.flatMap((grupo, g) => JORNADAS.flatMap((pares, ronda) => pares.map(([a, b]) => ({
    id: `g${g}-${ronda}-${a}${b}`, ronda, grupo: g, local: grupo[a], visitante: grupo[b], resultado: null,
  }))));
  temporada.ronda = 0;
  temporada.fase = 'grupos';
}

/** Tu partido de la ronda en curso (o null). */
export const partidoDelJugador = temporada => temporada.partidos.find(p =>
  p.ronda === temporada.ronda && !p.resultado && (p.local === 'tu' || p.visitante === 'tu')) || null;

/** El rival de un partido tuyo. */
export const rivalDe = (temporada, partido) => participante(temporada, partido.local === 'tu' ? partido.visitante : partido.local);

/** En qué grupo estás (0–3). */
export const grupoDelJugador = temporada => temporada.grupos?.findIndex(grupo => grupo.includes('tu')) ?? -1;

// --- Resultados -----------------------------------------------------------------------------------

/** Un combate entre dos entrenadores que no eres tú: gana el más fuerte casi siempre; el campeón, siempre. */
function simular(temporada, partido, azar) {
  const a = participante(temporada, partido.local);
  const b = participante(temporada, partido.visitante);
  const probA = a.rol === 'campeon' ? 1 : b.rol === 'campeon' ? 0 : 1 / (1 + Math.exp(-(a.fuerza - b.fuerza) * 6));
  const ganaA = azar() < probA;
  const igualado = 1 - Math.abs(Math.max(0.05, Math.min(0.95, probA)) - 0.5) * 2; // 1 = muy igualado
  const kosPerdedor = Math.min(TAMANO_EQUIPO - 1, Math.floor(azar() * (1.5 + igualado * 4.5)));
  partido.resultado = {
    ganador: ganaA ? a.clave : b.clave,
    local: ganaA ? TAMANO_EQUIPO : kosPerdedor,
    visitante: ganaA ? kosPerdedor : TAMANO_EQUIPO,
  };
}

/**
 * Apunta el resultado de tu combate de la ronda en curso y cierra la ronda (se simulan los demás).
 * kosHechos: Pokémon del rival que dejaste K.O.; kosRecibidos: los tuyos que cayeron.
 */
export function registrarCombate(temporada, { victoria, kosHechos, kosRecibidos }) {
  const partido = partidoDelJugador(temporada);
  if (!partido) return;
  const local = partido.local === 'tu';
  partido.resultado = {
    ganador: victoria ? 'tu' : local ? partido.visitante : partido.local,
    local: local ? kosHechos : kosRecibidos,
    visitante: local ? kosRecibidos : kosHechos,
  };
  if (victoria) temporada.victorias++;
  else temporada.derrotas++;
  cerrarRonda(temporada);
}

/** Simula los combates que quedan de la ronda y prepara la siguiente (o termina la temporada). */
export function cerrarRonda(temporada) {
  const r = temporada.ronda;
  const azar = azarDe(temporada.semilla + 1000 * (r + 1) + temporada.intento);
  for (const partido of temporada.partidos) if (partido.ronda === r && !partido.resultado) simular(temporada, partido, azar);
  if (r < 2) { temporada.ronda++; return; }
  if (r === 2) {
    const [A, B, C, D] = temporada.grupos.map((_, g) => clasificacion(temporada, g).map(fila => fila.clave));
    temporada.partidos.push(cruce(3, 0, A[0], B[1]), cruce(3, 1, B[0], A[1]), cruce(3, 2, C[0], D[1]), cruce(3, 3, D[0], C[1]));
  } else {
    const ganadores = temporada.partidos.filter(p => p.ronda === r).sort((a, b) => a.llave - b.llave).map(p => p.resultado.ganador);
    if (r === RONDA_FINAL) {
      temporada.fase = ganadores[0] === 'tu' ? 'campeon' : temporada.fase;
      if (ganadores[0] !== 'tu') eliminar(temporada, r);
      return;
    }
    for (let i = 0; i < ganadores.length; i += 2) temporada.partidos.push(cruce(r + 1, i / 2, ganadores[i], ganadores[i + 1]));
  }
  const sigues = temporada.partidos.some(p => p.ronda === r + 1 && (p.local === 'tu' || p.visitante === 'tu'));
  if (!sigues && temporada.fase !== 'eliminado') eliminar(temporada, r);
  temporada.ronda = r + 1;
  if (temporada.fase !== 'eliminado') temporada.fase = RONDAS[r + 1].fase;
  else cerrarRonda(temporada); // sin ti, la copa se juega hasta el final (para saber quién la gana)
}

function eliminar(temporada, ronda) {
  temporada.fase = 'eliminado';
  temporada.eliminadoEn ??= ronda;
}

const cruce = (ronda, llave, local, visitante) => ({ id: `k${ronda}-${llave}`, ronda, llave, local, visitante, resultado: null });

/** Quién ganó la copa (clave) o null si aún no ha terminado. */
export const ganadorCopa = temporada => temporada.partidos.find(p => p.ronda === RONDA_FINAL)?.resultado?.ganador ?? null;

/**
 * Clasificación de un grupo: [{ clave, pj, g, p, kf (K.O. hechos), kc (K.O. recibidos), pts }], ordenada por
 * puntos, diferencia de K.O., K.O. hechos y enfrentamiento directo (y, si aún empatan, por fuerza).
 */
export function clasificacion(temporada, g) {
  const filas = temporada.grupos[g].map(clave => ({ clave, pj: 0, g: 0, p: 0, kf: 0, kc: 0, pts: 0 }));
  const fila = clave => filas.find(f => f.clave === clave);
  const delGrupo = temporada.partidos.filter(p => p.grupo === g && p.resultado);
  for (const { local, visitante, resultado } of delGrupo) {
    const l = fila(local); const v = fila(visitante);
    l.pj++; v.pj++;
    l.kf += resultado.local; l.kc += resultado.visitante;
    v.kf += resultado.visitante; v.kc += resultado.local;
    const gana = fila(resultado.ganador);
    gana.g++; gana.pts += 3;
    (gana === l ? v : l).p++;
  }
  const directo = (a, b) => {
    const p = delGrupo.find(x => [x.local, x.visitante].includes(a.clave) && [x.local, x.visitante].includes(b.clave));
    return p ? (p.resultado.ganador === a.clave ? -1 : 1) : 0;
  };
  const fuerza = f => participante(temporada, f.clave).fuerza;
  return filas.sort((a, b) => b.pts - a.pts || (b.kf - b.kc) - (a.kf - a.kc) || b.kf - a.kf || directo(a, b) || fuerza(b) - fuerza(a));
}
