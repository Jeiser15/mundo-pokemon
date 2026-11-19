// Duelo Pokémon (#duelo), paso 2: el cinturón, el buscador para añadir Pokémon y el análisis por tipos
// (defensa, ataque, estadísticas y consejos). Trabaja con la lista del modo elegido (duelo.js llama a
// usarLista): 'equipo' (seis huecos) o 'luchador' (uno solo, para «Uno contra uno»). Las listas se
// guardan en mi-equipo.js; los pasos los maneja duelo.js y el combate, simulacro.js.

import { COLOR_POR_DEFECTO, NOMBRES_ESTADISTICAS, rarezaDe, TIPOS } from './datos.js';
import { multiplicadorContra } from './combate.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import { crearHabitat } from './habitats.js';
import { agregarAlEquipo, detallesDe, miLista, quitarDelEquipo, reemplazarEquipo, tamanoLista } from './mi-equipo.js';
import { barajar, crear, crearIcono, crearImagen, nombreLegible, nombreTitulo, normalizar, numeroPokedex, urlSprite } from './utilidades.js';

const cinturon = document.querySelector('#equipo-cinturon');
const buscador = document.querySelector('#equipo-buscar');
const resultados = document.querySelector('#equipo-resultados');
const aviso = document.querySelector('#equipo-aviso');
const analisis = document.querySelector('#equipo-analisis');
const botonAzar = document.querySelector('#equipo-azar');
const cifras = {
  miembros: document.querySelector('#equipo-miembros'),
  poder: document.querySelector('#equipo-poder'),
  cobertura: document.querySelector('#equipo-cobertura'),
};

const CLAVES_TIPO = Object.keys(TIPOS);
const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;
const nombreTipo = tipo => TIPOS[tipo]?.nombre || tipo;
const media = lista => lista.reduce((suma, n) => suma + n, 0) / lista.length;

let versionPintado = 0; // el equipo puede cambiar mientras llegan los datos: solo vale el último pintado
let lista = 'equipo';   // 'equipo' o 'luchador' (lo decide el modo de combate)
const esLuchador = () => tamanoLista(lista) === 1;

export function iniciarEquipo() {
  document.addEventListener('equipo-cambiado', pintar);
  buscador.addEventListener('input', mostrarResultados);
  buscador.addEventListener('focus', mostrarResultados);
  buscador.addEventListener('keydown', evento => {
    if (evento.key === 'Enter') { evento.preventDefault(); resultados.querySelector('button')?.click(); }
    if (evento.key === 'Escape') cerrarResultados();
  });
  document.addEventListener('click', evento => {
    if (!evento.target.closest('.equipo-busqueda, .equipo-resultados')) cerrarResultados();
  });
  botonAzar.addEventListener('click', completarAlAzar);
  document.querySelector('#equipo-vaciar').addEventListener('click', () => {
    if (!miLista(lista).length) return;
    reemplazarEquipo([], lista);
    avisar(esLuchador() ? 'Ya no tienes luchador.' : 'Equipo vaciado.');
  });
  pintar();
}

/** Cambia la lista con la que se trabaja: 'equipo' (hasta 6) o 'luchador' (uno). La llama duelo.js. */
export function usarLista(nueva) {
  if (nueva === lista) return;
  lista = nueva;
  buscador.value = '';
  cerrarResultados();
  avisar('');
  pintar();
}

function avisar(texto) {
  aviso.textContent = texto;
}

// --- Buscador ---------------------------------------------------------------------------------

async function mostrarResultados() {
  const texto = normalizar(buscador.value);
  if (!texto) return cerrarResultados();
  let especies;
  try { especies = await cargarEspecies(); } catch { return avisar('No se pudo cargar la lista de Pokémon.'); }
  if (normalizar(buscador.value) !== texto) return; // el texto cambió mientras cargaba
  const encontrados = (/^\d+$/.test(texto)
    ? especies.filter(e => String(e.id).startsWith(String(Number(texto))))
    : especies.filter(e => normalizar(e.nombre).includes(texto))).slice(0, 8);
  resultados.replaceChildren(...(encontrados.length
    ? encontrados.map(crearResultado)
    : [crear('p', { clase: 'equipo-sin-resultados', texto: 'Ningún Pokémon coincide con tu búsqueda.' })]));
  resultados.hidden = false;
}

function cerrarResultados() {
  resultados.hidden = true;
}

function crearResultado(especie) {
  return crear('button', { type: 'button', clase: 'equipo-resultado', alPulsar: () => anadir(especie) },
    crearImagen(urlSprite(especie.id)),
    crear('span', { clase: 'equipo-resultado-texto' },
      crear('small', { texto: 'N.º ' + numeroPokedex(especie.id) }),
      crear('strong', { texto: nombreLegible(especie.nombre) })),
    crear('span', { clase: 'equipo-resultado-tipos' }, ...especie.tipos.map(tipo =>
      crear('i', { title: nombreTipo(tipo), estilos: { '--color-tipo': colorDe(tipo) } }, crearIcono(TIPOS[tipo]?.icono || '')))),
    crear('span', { clase: 'equipo-resultado-mas', texto: '＋', atributos: { 'aria-hidden': 'true' } }),
  );
}

function anadir(especie) {
  const nombre = nombreTitulo(especie.nombre);
  const resultado = agregarAlEquipo({ id: especie.id, nombre: especie.nombre }, lista);
  avisar({
    agregado: esLuchador() ? `${nombre} será tu luchador.` : `${nombre} se une a tu equipo.`,
    cambiado: `${nombre} es tu nuevo luchador.`,
    repetido: esLuchador() ? `${nombre} ya es tu luchador.` : `${nombre} ya está en tu equipo.`,
    lleno: `Tu equipo ya tiene ${tamanoLista(lista)} Pokémon. Quita uno para hacer sitio.`,
  }[resultado]);
  if (resultado === 'agregado' || resultado === 'cambiado') {
    buscador.value = '';
    cerrarResultados();
    buscador.focus();
  }
}

/**
 * Rellena los huecos libres con Pokémon al azar, prefiriendo los que ya son fuertes (no bebés).
 * Con el luchador (un solo hueco) elige UNO, y si ya había uno lo cambia por otro.
 */
async function completarAlAzar() {
  const unico = esLuchador();
  const listaActual = lista;
  const actual = miLista(lista);
  const libres = unico ? 1 : tamanoLista(lista) - actual.length;
  if (!libres) return avisar('Tu equipo ya está completo.');
  botonAzar.disabled = true;
  avisar(unico ? 'Buscando un luchador…' : 'Buscando compañeros…');
  try {
    const especies = await cargarEspecies();
    const propios = new Set(actual.map(p => p.id));
    const candidatos = barajar(especies.filter(e => !propios.has(e.id) && !rarezaDe(e.id))).slice(0, libres * 3);
    const detalles = (await Promise.allSettled(candidatos.map(e => detallesDe(e.id))))
      .flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
    // Primero los que suman 420 o más (ya evolucionados); si faltan, los demás.
    const elegidos = [...detalles.filter(d => d.poder >= 420), ...detalles.filter(d => d.poder < 420)].slice(0, libres);
    if (!elegidos.length) throw new Error();
    if (listaActual !== lista) return; // cambiaste de modo mientras se buscaba
    const nuevos = elegidos.map(d => ({ id: d.id, nombre: d.nombre }));
    reemplazarEquipo(unico ? nuevos : [...actual, ...nuevos], lista);
    avisar(unico
      ? `${nombreTitulo(elegidos[0].nombre)} será tu luchador.`
      : `${elegidos.length === 1 ? 'Se une' : 'Se unen'} ${elegidos.map(d => nombreTitulo(d.nombre)).join(', ')}.`);
  } catch {
    avisar('No se pudo completar el equipo. Comprueba que el servidor está abierto.');
  } finally {
    botonAzar.disabled = !esLuchador() && miLista(lista).length >= tamanoLista(lista);
  }
}

// --- Cinturón y análisis -----------------------------------------------------------------------

async function pintar() {
  const version = ++versionPintado;
  const equipo = miLista(lista);
  const tamano = tamanoLista(lista);
  cifras.miembros.textContent = `${equipo.length}/${tamano}`;
  botonAzar.textContent = !esLuchador() ? 'Completar al azar' : equipo.length ? 'Otro al azar' : 'Elegir al azar';
  botonAzar.disabled = !esLuchador() && equipo.length >= tamano;
  const resultados = await Promise.allSettled(equipo.map(p => detallesDe(p.id)));
  if (version !== versionPintado) return;
  const detalles = resultados.map(r => (r.status === 'fulfilled' ? r.value : null));
  cinturon.dataset.lista = lista;
  cinturon.replaceChildren(...Array.from({ length: tamano }, (_, i) =>
    (equipo[i] ? crearRanura(equipo[i], detalles[i], i) : crearHuecoLibre(i))));
  pintarAnalisis(detalles.filter(Boolean));
}

function crearHuecoLibre(indice) {
  return crear('button', { type: 'button', clase: 'ranura ranura-vacia', estilos: { '--i': indice }, alPulsar: () => buscador.focus() },
    crear('span', { clase: 'ranura-ball', atributos: { 'aria-hidden': 'true' } }),
    crear('strong', { texto: esLuchador() ? 'Sin luchador' : 'Hueco libre' }),
    crear('small', { texto: esLuchador() ? 'Búscalo abajo o elige uno al azar' : 'Busca un Pokémon para añadirlo' }));
}

/** Rol según su estadística más destacada. */
function rolDe(stats) {
  const fuerza = Math.max(stats.attack, stats['special-attack']);
  const aguante = (stats.hp + stats.defense + stats['special-defense']) / 3;
  if (stats.speed >= fuerza && stats.speed >= aguante) return 'Veloz';
  if (fuerza >= aguante * 1.1) return stats.attack >= stats['special-attack'] ? 'Atacante físico' : 'Atacante especial';
  return 'Defensor';
}

function crearRanura(miembro, detalle, indice) {
  const nombre = nombreTitulo(miembro.nombre);
  const quitar = crear('button', {
    type: 'button', clase: 'ranura-quitar', texto: '✕',
    atributos: { 'aria-label': `Quitar a ${nombre}`, title: 'Quitar' },
    alPulsar: () => { quitarDelEquipo(miembro.id, lista); avisar(esLuchador() ? `${nombre} ya no es tu luchador.` : `${nombre} sale del equipo.`); },
  });
  if (!detalle) {
    return crear('article', { clase: 'ranura ranura-error', estilos: { '--i': indice } },
      crear('strong', { texto: nombre }), crear('small', { texto: 'No se pudieron cargar sus datos.' }), quitar);
  }
  const [principal, secundario] = detalle.tipos;
  return crear('article', {
    clase: 'ranura',
    estilos: { '--tipo-a': colorDe(principal), '--tipo-b': colorDe(secundario || principal), '--i': indice },
  },
    crear('button', {
      type: 'button', clase: 'ranura-abrir',
      atributos: { 'aria-label': `${nombre}: ver su ficha` },
      alPulsar: () => buscarPokemon(String(detalle.id)),
    },
      crearHabitat({
        tipo: principal,
        rareza: rarezaDe(detalle.especie),
        semilla: indice * 11 + 3,
        clase: 'ranura-escena',
        primerPlano: [crear('img', { clase: 'ranura-pokemon', src: detalle.imagen, alt: '' })],
      }),
      crear('span', { clase: 'ranura-info' },
        crear('small', { texto: `N.º ${numeroPokedex(detalle.especie)} · ${rolDe(detalle.stats)}` }),
        crear('strong', { texto: nombre }),
        crear('span', { clase: 'ranura-tipos' }, ...detalle.tipos.map(tipo =>
          crear('span', { texto: nombreTipo(tipo), estilos: { '--color-tipo': colorDe(tipo) } })))),
    ),
    quitar,
  );
}

function pintarAnalisis(equipo) {
  if (!equipo.length) {
    cifras.poder.textContent = '—';
    cifras.cobertura.textContent = '—';
    analisis.replaceChildren(crear('p', { clase: 'equipo-sin-analisis', texto: esLuchador()
      ? 'Elige a tu luchador y aquí verás sus debilidades, a qué tipos golpea fuerte y sus estadísticas.'
      : 'Añade Pokémon y aquí verás sus debilidades, a qué tipos golpea fuerte tu equipo y sus estadísticas.' }));
    return;
  }
  // Para cada tipo de ataque: el multiplicador que recibe cada miembro.
  const defensa = CLAVES_TIPO.map(tipo => {
    const mults = equipo.map(p => multiplicadorContra(tipo, p.tipos));
    return { tipo, mults, debiles: mults.filter(m => m > 1).length, resisten: mults.filter(m => m < 1).length };
  });
  // Tipos a los que algún miembro golpea ×2 con uno de sus tipos (los ataques del simulacro).
  const cubiertos = CLAVES_TIPO.filter(objetivo => equipo.some(p => p.tipos.some(t => multiplicadorContra(t, [objetivo]) >= 2)));
  cifras.poder.textContent = Math.round(media(equipo.map(p => p.poder)));
  cifras.cobertura.textContent = `${cubiertos.length}/18`;
  analisis.replaceChildren(
    panelDefensa(defensa, equipo),
    panelAtaque(cubiertos, equipo),
    panelEstadisticas(equipo),
    panelConsejos(defensa, cubiertos, equipo),
  );
}

const panel = (clase, etiqueta, titulo, ...hijos) => crear('section', { clase: 'analisis-panel ' + clase },
  crear('span', { clase: 'analisis-etiqueta', texto: etiqueta }), crear('h3', { texto: titulo }), ...hijos);

const SIMBOLO = { 4: '×4', 2: '×2', 1: '×1', 0.5: '×½', 0.25: '×¼', 0: '×0' };
const claseMult = m => (m === 0 ? 'inmune' : m > 1 ? 'debil' : m < 1 ? 'resiste' : 'neutro');

/** 18 casillas (tipo de ataque): un punto por miembro, rojo si le hace daño de más y verde si lo resiste. */
function panelDefensa(defensa, equipo) {
  const casillas = defensa.map(({ tipo, mults, debiles, resisten }) => {
    const estado = debiles >= 3 || (debiles >= 2 && resisten === 0) ? 'peligro' : resisten >= 2 && debiles <= 1 ? 'solido' : '';
    return crear('div', { clase: 'defensa-tipo ' + estado, estilos: { '--color-tipo': colorDe(tipo) } },
      crear('span', { clase: 'defensa-icono', title: nombreTipo(tipo) }, crearIcono(TIPOS[tipo].icono)),
      crear('strong', { texto: nombreTipo(tipo) }),
      crear('span', { clase: 'defensa-puntos' }, ...mults.map((m, i) => crear('i', {
        clase: claseMult(m),
        title: `${nombreLegible(equipo[i].nombre)}: ${SIMBOLO[m] ?? '×' + m}`,
      }))),
      crear('small', { texto: `${debiles} débil${debiles === 1 ? '' : 'es'} · ${resisten} resiste${resisten === 1 ? '' : 'n'}` }),
    );
  });
  return panel('analisis-defensa', '01 / Defensa', 'Cómo te afecta cada tipo',
    crear('p', { clase: 'analisis-leyenda' },
      crear('i', { clase: 'debil' }), 'recibe ×2 o más ',
      crear('i', { clase: 'resiste' }), 'resiste ',
      crear('i', { clase: 'inmune' }), 'inmune ',
      crear('i', { clase: 'neutro' }), 'normal'),
    crear('div', { clase: 'defensa-rejilla' }, ...casillas));
}

/** 18 tipos defensores: encendidos los que tu equipo golpea ×2 con alguno de sus tipos. */
function panelAtaque(cubiertos, equipo) {
  const casillas = CLAVES_TIPO.map(tipo => {
    const quienes = equipo.filter(p => p.tipos.some(t => multiplicadorContra(t, [tipo]) >= 2)).map(p => nombreLegible(p.nombre));
    return crear('span', {
      clase: 'ataque-tipo' + (quienes.length ? ' cubierto' : ''),
      estilos: { '--color-tipo': colorDe(tipo) },
      title: quienes.length ? `Le golpean fuerte: ${quienes.join(', ')}` : 'Ningún tipo de tu equipo le hace ×2',
    }, crearIcono(TIPOS[tipo].icono), nombreTipo(tipo));
  });
  return panel('analisis-ataque', '02 / Ataque', `Golpeas fuerte a ${cubiertos.length} de 18 tipos`,
    crear('p', { clase: 'analisis-nota', texto: 'En el simulacro cada Pokémon ataca con sus propios tipos: estos son los que tu equipo golpea ×2.' }),
    crear('div', { clase: 'ataque-rejilla' }, ...casillas));
}

function panelEstadisticas(equipo) {
  const filas = Object.entries(NOMBRES_ESTADISTICAS).map(([clave, nombre]) => {
    const valor = Math.round(media(equipo.map(p => p.stats[clave])));
    return crear('li', {},
      crear('span', { texto: nombre }),
      crear('span', { clase: 'estadistica-barra' }, crear('i', { estilos: { '--valor': Math.min(1, valor / 160).toFixed(3) } })),
      crear('strong', { texto: valor }));
  });
  const roles = equipo.reduce((cuenta, p) => { const rol = rolDe(p.stats); cuenta[rol] = (cuenta[rol] || 0) + 1; return cuenta; }, {});
  return panel('analisis-estadisticas', '03 / Estadísticas', 'Media del equipo',
    crear('ul', { clase: 'estadisticas-equipo' }, ...filas),
    crear('div', { clase: 'equipo-roles' }, ...Object.entries(roles).map(([rol, n]) => crear('span', { texto: `${n} × ${rol}` }))));
}

/** Hasta cinco consejos según el análisis. */
function panelConsejos(defensa, cubiertos, equipo) {
  const consejos = [];
  const agregar = (tono, texto) => consejos.push(crear('li', { clase: tono }, texto));
  const libres = tamanoLista(lista) - equipo.length;
  if (libres) agregar('aviso', `Te ${libres === 1 ? 'queda 1 hueco libre' : `quedan ${libres} huecos libres`}: un equipo completo aguanta más en el simulacro.`);

  const peor = [...defensa].sort((a, b) => (b.debiles - b.resisten) - (a.debiles - a.resisten))[0];
  if (peor.debiles >= 2 && peor.debiles > peor.resisten) {
    agregar('peligro', `Cuidado con ${nombreTipo(peor.tipo)}: ${peor.debiles} de tus Pokémon son débiles y ${peor.resisten ? `solo ${peor.resisten} lo resiste${peor.resisten === 1 ? '' : 'n'}` : 'ninguno lo resiste'}.`);
  } else {
    agregar('bien', 'Ningún tipo pone en apuros a medio equipo a la vez: buena defensa.');
  }

  const faltan = CLAVES_TIPO.filter(t => !cubiertos.includes(t));
  if (faltan.length) agregar(faltan.length > 6 ? 'aviso' : 'nota', `Nadie golpea fuerte a ${faltan.slice(0, 4).map(nombreTipo).join(', ')}${faltan.length > 4 ? ` y ${faltan.length - 4} más` : ''}.`);
  else agregar('bien', '¡Golpeas fuerte a los 18 tipos!');

  const repetidos = Object.entries(equipo.flatMap(p => p.tipos).reduce((c, t) => ({ ...c, [t]: (c[t] || 0) + 1 }), {})).find(([, n]) => n >= 3);
  if (repetidos) agregar('aviso', `Tienes ${repetidos[1]} Pokémon de tipo ${nombreTipo(repetidos[0])}: comparten debilidades.`);

  const velocidad = Math.round(media(equipo.map(p => p.stats.speed)));
  if (velocidad < 70) agregar('nota', `Equipo lento (velocidad media ${velocidad}): el rival atacará primero a menudo. Concentrarse ayuda a aguantar.`);
  else if (velocidad > 95) agregar('bien', `Equipo rápido (velocidad media ${velocidad}): atacarás primero casi siempre.`);

  const leyendas = equipo.filter(p => rarezaDe(p.especie)).length;
  if (leyendas >= 2) agregar('nota', `Llevas ${leyendas} leyendas: en el simulacro el rival se ajusta al poder de tu equipo, así que también será más fuerte.`);

  return panel('analisis-consejos', '04 / Consejos', 'Lo que dice el análisis', crear('ul', { clase: 'consejos' }, ...consejos.slice(0, 5)));
}
