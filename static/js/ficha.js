// Ficha de un Pokémon: ventana modal con ilustración, datos, estadísticas,
// evolución y efectividad de tipos. Toda la ficha toma los colores de sus tipos
// (--tipo-a y --tipo-b en #ficha) y, si es legendario o singular, su estilo especial
// (#ficha[data-rareza]). Ver css/ficha.css.
// Es estática: en escritorio cabe entera en la ventana (encajarFicha) y no se desplaza.
//
// Orden de carga:
//   1. /api/pokemon/<consulta>           → hábitat, cabecera, perfil, estadísticas y radar
//   2. /api/ability/<nombre> (en paralelo) → traducción de cada habilidad
//   3. /api/pokemon-species + /api/type   → especie, descripción y efectividad
//   4. /api/evolution-chain/<id>          → árbol evolutivo (cómo evoluciona cada una: datos-evoluciones.js)
// La ficha se arma FUERA de la página y se enseña de una vez cuando está casi todo (como mucho ESPERA_MAXIMA):
// así no crece ni salta mientras llegan los datos. Al abrirla, si eso tarda menos de ESPERA_APERTURA (lo normal),
// la ventana se abre ya completa; si tarda más, se ve una carga sencilla (mostrarCarga). Lo que llegue aún más
// tarde ocupa el sitio de su panel de espera (.panel-reserva) con un fundido.
//
// Cambiar de Pokémon con la ficha abierta (pulsar una evolución o una forma) NO la vacía: es un fundido suave.
// Lo de antes se apaga un poco (.cambiando) y lo nuevo aparece desde ese mismo punto (data-entrada="cambio").
// Antes se quedaba un instante en «Buscando…» (se encogía y perdía sus colores) y volvía de golpe: parpadeaba.

import { obtenerPokemon, obtenerRecurso } from './api.js';
import { COLOR_POR_DEFECTO, GENERACIONES, LEGENDARIOS, NOMBRES_ESTADISTICAS, rarezaDe, TIPOS } from './datos.js';
import { COMO_EVOLUCIONA } from './datos-evoluciones.js';
import { calcularMultiplicadores } from './efectividad.js';
import { cargarEspecies, tiposDe } from './especies.js';
import { crearHabitat } from './habitats.js';
import { agregarAlEquipo, equipoLleno, estaEnEquipo } from './mi-equipo.js';
import {
  crear, crearIcono, crearImagen, formaConNombre, idDesdeUrl, nombreForma, nombreLegible, nombreTitulo, numeroPokedex, urlIlustracion, urlSprite,
} from './utilidades.js';

const ficha = document.querySelector('#ficha');
const resultado = document.querySelector('#resultado');
const botonCerrar = document.querySelector('#cerrar-ficha');
const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;

// Cada búsqueda recibe un número. Si el usuario abre otra ficha o la cierra antes de que
// termine la anterior, las respuestas que lleguen tarde se descartan.
let versionBusqueda = 0;
// Al abrir la ficha se congela la página; al cerrarla se vuelve al mismo sitio.
let desplazamientoAnterior = 0;
let elementoAnterior = null;
// true si la ventana enseña un Pokémon (no la carga ni un aviso): pulsar otro lo cambia sin vaciarla.
let hayFicha = false;
let temporizadorCarga = 0; // Enseña la carga si la ficha tarda en estar lista.

// Tiempos (ms).
const ESPERA_APERTURA = 400; // Si la ficha está lista antes, se abre ya completa, sin pantalla de carga.
const ESPERA_MAXIMA = 1500;  // Lo que se espera a la especie, la evolución, la efectividad y la ilustración.
const SALIDA_MINIMA = 160;   // Lo que tarda en apagarse lo de antes (ficha.css: .cambiando): lo nuevo sale de ahí.
const espera = ms => new Promise(listo => setTimeout(listo, Math.max(0, ms)));
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');

// La ficha es estática: en escritorio cabe entera en la ventana. Si la ventana es más baja que la
// ficha, se reduce (zoom con --escala) en vez de desplazarse. En móvil no cabría legible y se desplaza.
const MARGEN_VENTANA = 32;  // El mismo hueco que deja «max-height: calc(100% - 32px)» en ficha.css.
const ESCALA_MINIMA = 0.7;  // Por debajo, el texto sería demasiado pequeño: ahí sí se desplaza.
const pantallaMovil = matchMedia('(max-width:700px)');
// En cada ficha la escala solo puede BAJAR. Con zoom el texto puede repartirse distinto (una línea más o menos):
// a 0,971 Necrozma medía 881 px y pedía 0,980; a 0,980 medía 889 y pedía 0,971… y la ficha parpadeaba sin parar.
// Se vuelve a permitir subir al abrir otra ficha o al cambiar el tamaño de la ventana.
let escalaTope = 1;

export function iniciarFicha() {
  // Se reencaja cuando cambia el contenido (llegan la evolución o la efectividad) o la ventana.
  new ResizeObserver(encajarFicha).observe(resultado);
  window.addEventListener('resize', () => { escalaTope = 1; encajarFicha(); });
  botonCerrar.addEventListener('click', () => ficha.close());
  ficha.addEventListener('close', () => {
    // El aviso de cierre llega en una tarea aparte: si mientras tanto se abrió otra ficha,
    // no hay que cancelarla ni descongelar la página.
    if (ficha.open) return;
    versionBusqueda++; // Descarta lo que aún estuviera cargando.
    resultado.classList.remove('cambiando');
    document.body.classList.remove('ficha-abierta');
    document.body.style.top = '';
    window.scrollTo({ top: desplazamientoAnterior, behavior: 'instant' });
    if (elementoAnterior?.isConnected) elementoAnterior.focus({ preventScroll: true });
    if (history.state?.ficha) history.back(); // Cerrada con ✕ o Esc: se quita su paso del historial.
  });
  // «Atrás» (el del navegador o el del celular en la app de Android) cierra la ficha en vez de cambiar de vista por
  // detrás o, recién abierta la app, salir de ella: al abrirla se añade un paso al historial (abrirVentana).
  window.addEventListener('popstate', () => { if (ficha.open && !history.state?.ficha) ficha.close(); });
}

/** Abre la ficha y la rellena. `consulta` es un nombre en inglés o un número. */
export async function buscarPokemon(consulta) {
  const version = ++versionBusqueda;
  const vigente = () => version === versionBusqueda;
  const cambio = ficha.open && hayFicha;
  const inicio = performance.now();

  clearTimeout(temporizadorCarga);
  resultado.setAttribute('aria-busy', 'true'); // Avisa a los lectores de pantalla de que está cargando.
  cargarEspecies().catch(() => {}); // Los tipos de cada carta de la evolución (llega antes que la cadena).
  if (cambio) resultado.classList.add('cambiando');
  else if (ficha.open) mostrarCarga(); // Abierta con un aviso o con la carga: se queda en la carga.
  else {
    // Cerrada: se abre cuando la ficha esté lista o, si tarda, con la carga.
    temporizadorCarga = setTimeout(() => {
      if (!vigente()) return;
      aplicarTema([], null); // Colores neutros mientras busca.
      mostrarCarga();
      abrirVentana();
      ficha.scrollTop = 0;
    }, ESPERA_APERTURA);
  }

  try {
    const pokemon = await obtenerPokemon(consulta.trim().toLowerCase());
    if (!vigente()) return;

    // Las formas (Mega, Alola…) tienen número propio: la rareza y la región son las de su especie.
    const idEspecie = Number(idDesdeUrl(pokemon.species.url));
    const tipos = pokemon.types.map(t => t.type.name);
    const rareza = rarezaDe(idEspecie);
    const cabecera = crearCabecera(pokemon, tipos, idEspecie, rareza);
    const { columnas, chipsHabilidades } = crearColumnas(pokemon);
    const extras = completarDatosExtra(pokemon, cabecera, columnas, vigente);
    const listo = Promise.allSettled([
      extras,
      traducirHabilidades(pokemon.abilities, chipsHabilidades, vigente),
      cabecera.querySelector('.habitat-pokemon')?.decode(),
    ]);
    await Promise.race([listo, espera(ESPERA_MAXIMA - (performance.now() - inicio))]);
    if (cambio) await espera(SALIDA_MINIMA - (performance.now() - inicio));
    if (!vigente()) return;

    clearTimeout(temporizadorCarga);
    mostrarFicha([crearBarra(rareza, pokemon), cabecera, columnas], tipos, rareza, cambio);
    await extras;
  } catch (error) {
    if (!vigente()) return;
    clearTimeout(temporizadorCarga);
    const texto = error.message || 'No se pudo completar la búsqueda.';
    if (cambio) avisarCambioFallido(texto);
    else {
      aplicarTema([], null);
      mostrarAviso(texto);
      abrirVentana();
    }
  } finally {
    if (vigente()) resultado.setAttribute('aria-busy', 'false');
  }
}

// --- Ventana, tema y transiciones ---------------------------------------------------

function abrirVentana() {
  if (ficha.open) return;
  if (!document.body.classList.contains('ficha-abierta')) { // Si sigue congelada, conserva la posición de antes.
    desplazamientoAnterior = window.scrollY;
    elementoAnterior = document.activeElement;
    document.body.style.top = '-' + desplazamientoAnterior + 'px';
    document.body.classList.add('ficha-abierta');
  }
  ficha.showModal();
  if (!history.state?.ficha) history.pushState({ ficha: true }, ''); // «Atrás» la cerrará (iniciarFicha)
  botonCerrar.focus({ preventScroll: true });
}

/** Colores de sus tipos en toda la ficha (incluido el botón de cerrar) y estilo de su rareza. */
function aplicarTema(tipos, rareza) {
  if (tipos.length) {
    ficha.style.setProperty('--tipo-a', colorDe(tipos[0]));
    ficha.style.setProperty('--tipo-b', colorDe(tipos[1] || tipos[0]));
  } else {
    ficha.style.removeProperty('--tipo-a');
    ficha.style.removeProperty('--tipo-b');
  }
  if (rareza) ficha.dataset.rareza = rareza;
  else delete ficha.dataset.rareza;
}

/**
 * Pone en la ventana la ficha ya armada. Cerrada, la abre (entra con su propia animación). Abierta, lo nuevo aparece
 * con un fundido: desde lo apagado si había otro Pokémon (data-entrada="cambio"), desde cero tras la carga ("carga").
 */
function mostrarFicha(contenido, tipos, rareza, cambio) {
  const abierta = ficha.open;
  const teniaFoco = resultado.contains(document.activeElement);
  const altoAntes = ficha.getBoundingClientRect().height;
  aplicarTema(tipos, rareza);
  escalaTope = 1;
  hayFicha = true;
  resultado.classList.remove('cambiando');
  if (abierta) resultado.dataset.entrada = cambio ? 'cambio' : 'carga';
  else delete resultado.dataset.entrada;
  resultado.replaceChildren(...contenido);
  if (!abierta) {
    abrirVentana();
    ficha.scrollTop = 0;
    return;
  }
  // La ventana va centrada: si la ficha nueva mide distinto (Blastoise tiene «Otras formas» y Wartortle no), saltaría
  // unos píxeles. En vez de eso, sale de donde estaba y se desliza a su sitio. Se encaja antes (zoom) para medirla
  // ya con su tamaño final.
  encajarFicha();
  const desfase = (altoAntes - ficha.getBoundingClientRect().height) / 2;
  if (Math.abs(desfase) > 1 && !movimientoReducido.matches) {
    ficha.animate([{ translate: `0 ${-desfase}px` }, { translate: '0 0' }], { duration: 400, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  if (!cambio) return;
  ficha.scrollTo({ top: 0, behavior: movimientoReducido.matches ? 'instant' : 'smooth' }); // En el móvil se desplaza.
  // La carta pulsada ya no existe: el foco pasa a la nueva «Estás aquí» (si no, se perdería por la página).
  if (teniaFoco) (resultado.querySelector('.evolution-card.actual') || botonCerrar).focus({ preventScroll: true });
}

/**
 * Si la ficha tarda en estar lista (conexión lenta): la barra y, en medio, un anillo que gira con «Buscando en
 * PokéAPI…». Casi del alto de la ficha, para que no crezca de golpe al llegar. Con datos rápidos no se llega a ver.
 */
function mostrarCarga() {
  hayFicha = false;
  resultado.classList.remove('cambiando');
  delete resultado.dataset.entrada;
  resultado.replaceChildren(
    crear('div', { clase: 'device-bar' },
      crear('span', { clase: 'device-lights', atributos: { 'aria-hidden': 'true' } }),
      crear('span', { clase: 'device-titulo', texto: 'POKÉDEX  /  ARCHIVO DE ESPECIES' })),
    crear('div', { clase: 'ficha-cargando', atributos: { role: 'status' } },
      crear('span', { clase: 'ficha-cargando-anillo', atributos: { 'aria-hidden': 'true' } }),
      crear('p', { texto: 'Buscando en PokéAPI…' })),
  );
}

/**
 * Ajusta --escala para que la ficha entera quepa en la ventana sin desplazarse.
 * offsetHeight da el alto «natural» (sin zoom ni la animación de entrada), así que basta dividir.
 */
function encajarFicha() {
  if (!ficha.open) return;
  const actual = Number(ficha.style.getPropertyValue('--escala')) || 1;
  let escala = 1;
  if (!pantallaMovil.matches && resultado.offsetHeight) {
    const disponible = window.innerHeight - MARGEN_VENTANA - 4; // 4 px de holgura por redondeos del zoom
    // Hacia abajo: redondear hacia arriba dejaba la ficha 2 px más alta que la ventana (se desplazaba).
    escala = Math.max(ESCALA_MINIMA, Math.min(escalaTope, Math.floor(disponible / resultado.offsetHeight * 1000) / 1000));
  }
  escalaTope = escala;
  // Si cabe, la ventana no se desplaza ni por medio píxel de redondeo; solo en móvil o con la escala mínima.
  ficha.classList.toggle('cabe', !pantallaMovil.matches && escala * resultado.offsetHeight <= window.innerHeight - MARGEN_VENTANA);
  if (Math.abs(escala - actual) < 0.005) return; // Sin cambios apreciables: evita reajustes en bucle.
  if (escala === 1) ficha.style.removeProperty('--escala');
  else ficha.style.setProperty('--escala', escala.toFixed(3));
}

function mostrarAviso(texto) {
  hayFicha = false;
  resultado.classList.remove('cambiando');
  delete resultado.dataset.entrada;
  resultado.replaceChildren(crear('p', { clase: 'ficha-aviso', texto }));
}

/** Si falla el cambio a otro Pokémon, se queda el de antes y un aviso bajo la barra lo explica. */
function avisarCambioFallido(texto) {
  resultado.classList.remove('cambiando');
  resultado.querySelector('.ficha-error')?.remove();
  resultado.querySelector('.device-bar')?.after(crear('p', { clase: 'ficha-error', atributos: { role: 'alert' }, texto }));
}

// --- Parte superior: barra, escenario e identidad -----------------------------

function crearBarra(rareza, pokemon) {
  const titulo = { legendario: '✦  ARCHIVO LEGENDARIO', singular: '✧  ARCHIVO SINGULAR' }[rareza] || 'POKÉDEX  /  ARCHIVO DE ESPECIES';
  return crear('div', { clase: 'device-bar' },
    crear('span', { clase: 'device-lights', atributos: { 'aria-hidden': 'true' } }),
    crear('span', { clase: 'device-titulo', texto: titulo }),
    crearBotonEquipo(pokemon),
    crear('span', { clase: 'device-status', texto: '● EN LÍNEA' }),
  );
}

/** «Añadir a mi equipo» (mi-equipo.js). Va en la barra para no quitarle alto a la ficha. */
function crearBotonEquipo(pokemon) {
  const icono = crear('b', { atributos: { 'aria-hidden': 'true' } });
  const texto = crear('span');
  const boton = crear('button', { type: 'button', clase: 'ficha-equipo' }, icono, texto);
  const pintar = () => {
    const dentro = estaEnEquipo(pokemon.id);
    const lleno = !dentro && equipoLleno();
    icono.textContent = dentro ? '✓' : '+';
    texto.textContent = dentro ? 'En tu equipo' : lleno ? 'Equipo completo' : 'Añadir a mi equipo';
    boton.disabled = dentro || lleno;
    boton.title = lleno ? 'Tu equipo ya tiene 6: quita uno en «Mi equipo»' : '';
  };
  boton.addEventListener('click', () => {
    agregarAlEquipo({ id: pokemon.id, nombre: pokemon.name });
    pintar();
  });
  pintar();
  return boton;
}

function crearCabecera(pokemon, tipos, idEspecie, rareza) {
  return crear('div', { clase: 'detail-head' },
    crearEscenario(pokemon, tipos[0], rareza),
    crearIdentidad(pokemon, tipos, idEspecie, rareza),
  );
}

/** Ilustración sobre el hábitat animado de su tipo principal; legendarios y singulares, sobre su santuario. */
function crearEscenario(pokemon, tipoPrincipal, rareza) {
  const url = pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default;
  return crear('div', { clase: 'pokemon-stage' },
    crearHabitat({
      tipo: tipoPrincipal,
      rareza,
      semilla: pokemon.id % 97,
      fondo: [crear('span', { clase: 'stage-number', texto: numeroPokedex(pokemon.id), atributos: { 'aria-hidden': 'true' } })],
      primerPlano: [
        ...(url ? [crear('img', { clase: 'habitat-pokemon', src: url, alt: 'Ilustración oficial de ' + nombreTitulo(pokemon.name) })] : []),
        crear('span', { clase: 'stage-caption', texto: 'ILUSTRACIÓN OFICIAL  /  POKÉAPI' }),
      ],
    }),
  );
}

/**
 * Nombre, sello, especie (llega después), tipos, región, forma y descripción (llega después).
 * El título es el de la ESPECIE en español: la forma por defecto de algunas lleva apellido en PokéAPI
 * ('giratina-altered'); la forma va aparte, en su etiqueta («Forma Modificada», «Mega-Charizard X»).
 */
function crearIdentidad(pokemon, tipos, idEspecie, rareza) {
  const gen = GENERACIONES.find(g => idEspecie >= g.desde && idEspecie <= g.hasta);
  const forma = nombreForma(pokemon.name);
  const etiquetasTipo = tipos.map(tipo => crear('span', { clase: 'badge', estilos: { '--color-etiqueta': colorDe(tipo) } },
    ...(TIPOS[tipo] ? [crearIcono(TIPOS[tipo].icono)] : []), TIPOS[tipo]?.nombre || tipo));
  const sello = { legendario: '✦ Pokémon legendario', singular: '✧ Pokémon singular' }[rareza];
  return crear('div', { clase: 'pokemon-identity' },
    // El sello de legendario o singular va en la misma línea que el registro: debajo sumaba ~25 px y esas fichas
    // ya no cabían en una pantalla de 900 px.
    crear('div', { clase: 'identity-cabecera' },
      crear('span', { clase: 'eyebrow', texto: 'REGISTRO DE POKÉMON  /  #' + numeroPokedex(pokemon.id) }),
      ...(sello ? [crear('span', { clase: 'ficha-sello', texto: sello })] : [])),
    crear('h3', { texto: nombreTitulo(pokemon.species.name) }),
    crear('p', { clase: 'identity-caption', texto: 'Consultando su especie…' }),
    crear('div', { clase: 'identity-tipos' }, ...etiquetasTipo),
    crear('div', { clase: 'identity-etiquetas' },
      ...(gen ? [crear('span', { clase: 'identity-region', texto: `Generación ${gen.numero} · ${gen.region}` })] : []),
      ...(forma ? [crear('span', { clase: 'identity-region identity-forma', texto: forma })] : [])),
    crear('p', { clase: 'identity-descripcion' }),
  );
}

// --- Columnas: perfil (medidas y habilidades) y estadísticas -------------------

function crearColumnas(pokemon) {
  const medidas = crear('div', { clase: 'measure-grid' },
    ...[['↕', 'ALTURA', `${pokemon.height / 10} m`], ['◈', 'PESO', `${pokemon.weight / 10} kg`]].map(([icono, etiqueta, valor]) =>
      crear('div', { clase: 'measure' },
        crear('span', { clase: 'measure-icon', texto: icono }),
        crear('div', {}, crear('small', { texto: etiqueta }), crear('strong', { texto: valor })),
      )),
  );

  // Las habilidades se escriben ya en inglés y se traducen cuando llega la respuesta (casi siempre antes de
  // que se vea la ficha: buscarPokemon la espera).
  const chipsHabilidades = pokemon.abilities.map(a => crear('span', {
    clase: 'ability-chip' + (a.is_hidden ? ' oculta' : ''),
    texto: nombreLegible(a.ability.name) + ' · buscando traducción' + (a.is_hidden ? ' · oculta' : ''),
  }));
  const habilidades = crear('div', { clase: 'ability-box' }, crear('small', { texto: 'HABILIDADES' }), ...chipsHabilidades);
  if (!chipsHabilidades.length) habilidades.append(crear('p', { texto: 'No hay habilidades disponibles para esta forma.' }));

  const estadisticas = crear('ul', { clase: 'stats' },
    ...pokemon.stats.map(s => crear('li', {},
      crear('span', { texto: NOMBRES_ESTADISTICAS[s.stat.name] || s.stat.name }),
      // 255 es el valor base más alto posible.
      crear('span', { clase: 'stat-track' }, crear('span', { estilos: { width: Math.min(100, s.base_stat / 255 * 100) + '%' } })),
      crear('strong', { texto: s.base_stat }),
    )),
  );
  const total = crear('div', { clase: 'stat-total' },
    crear('span', { texto: 'TOTAL DE ESTADÍSTICAS' }),
    crear('strong', { texto: pokemon.stats.reduce((suma, s) => suma + s.base_stat, 0) }),
  );

  // Rejilla de paneles. La evolución y la efectividad llegan después (completarDatosExtra): mientras tanto, su hueco
  // lo ocupa un panel de espera con su título y «Cargando…» (.panel-reserva). Casi siempre se sustituye antes de verse
  // la ficha; con una conexión lenta se ve un momento, y la ficha no crece de golpe al llegar.
  const reserva = (clase, titulo) => crear('section', { clase: `data-panel ${clase} panel-reserva` },
    crear('h4', { texto: titulo }), crear('p', { texto: 'Cargando…' }));
  const columnas = crear('div', { clase: 'detail-columns' },
    crear('section', { clase: 'data-panel panel-perfil' }, crear('h4', { texto: 'Perfil del Pokémon' }), medidas, habilidades),
    crear('section', { clase: 'data-panel panel-estadisticas' }, crear('h4', { texto: 'Estadísticas base' }),
      crear('div', { clase: 'stats-cuerpo' }, crearRadar(pokemon.stats), crear('div', {}, estadisticas, total))),
    reserva('evolution-panel', 'Cadena evolutiva'),
    reserva('panel-efectividad', 'Efectividad en combate'),
  );
  return { columnas, chipsHabilidades };
}

/** Hexágono de estadísticas: cuanto más se estira hacia un lado, más destaca en eso. */
function crearRadar(stats) {
  const SVG = 'http://www.w3.org/2000/svg';
  const EJES = [['hp', 'PS'], ['attack', 'Ataque'], ['defense', 'Defensa'], ['speed', 'Velocidad'], ['special-defense', 'Def. esp.'], ['special-attack', 'At. esp.']];
  const CENTRO = 110, RADIO = 72, TOPE = 180; // Un valor de 180 o más llega al borde.
  const valor = Object.fromEntries(stats.map(s => [s.stat.name, s.base_stat]));
  const punto = (i, r) => {
    const angulo = (Math.PI / 3) * i - Math.PI / 2; // Empieza arriba y gira en el sentido del reloj.
    return [CENTRO + r * Math.cos(angulo), CENTRO + r * Math.sin(angulo)].map(n => n.toFixed(1));
  };
  const elemento = (etiqueta, atributos) => {
    const el = document.createElementNS(SVG, etiqueta);
    for (const [nombre, v] of Object.entries(atributos)) el.setAttribute(nombre, v);
    return el;
  };
  const svg = elemento('svg', {
    viewBox: '0 0 220 220', class: 'radar', role: 'img',
    'aria-label': 'Gráfico de estadísticas: ' + EJES.map(([clave, nombre]) => `${nombre} ${valor[clave] ?? 0}`).join(', '),
  });
  for (const nivel of [1 / 3, 2 / 3, 1]) svg.append(elemento('polygon', { class: 'radar-rejilla', points: EJES.map((_, i) => punto(i, RADIO * nivel).join(',')).join(' ') }));
  EJES.forEach((_, i) => {
    const [x, y] = punto(i, RADIO);
    svg.append(elemento('line', { class: 'radar-eje', x1: CENTRO, y1: CENTRO, x2: x, y2: y }));
  });
  svg.append(elemento('polygon', { class: 'radar-valor', points: EJES.map(([clave], i) => punto(i, RADIO * Math.min(1, (valor[clave] || 0) / TOPE)).join(',')).join(' ') }));
  EJES.forEach(([, nombre], i) => {
    const [x, y] = punto(i, RADIO + 20);
    const texto = elemento('text', { x, y, class: 'radar-etiqueta', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    texto.textContent = nombre;
    svg.append(texto);
  });
  return svg;
}

/** Traduce cada habilidad (en paralelo). Devuelve una promesa que se cumple cuando han llegado todas. */
function traducirHabilidades(habilidades, chips, vigente) {
  return Promise.all(habilidades.map(async (a, indice) => {
    let nombre = nombreLegible(a.ability.name), sinTraduccion = true;
    try {
      const datos = await obtenerRecurso('ability', a.ability.name);
      const traduccion = datos.names.find(n => n.language.name === 'es');
      if (traduccion) { nombre = traduccion.name; sinTraduccion = false; }
    } catch { /* Si falla, se queda el nombre en inglés. */ }
    if (!vigente()) return;
    chips[indice].textContent = nombre + (sinTraduccion ? ' · sin traducción' : '') + (a.is_hidden ? ' · oculta' : '');
  }));
}

// --- Especie, evolución y efectividad -----------------------------------------------

async function completarDatosExtra(pokemon, cabecera, columnas, vigente) {
  // Cada panel ocupa el sitio de su panel de espera (crearColumnas). Si la ficha ya se ve, entra con un fundido.
  const poner = panel => {
    const hueco = [...columnas.querySelectorAll('.panel-reserva')].find(r => panel.classList.contains(r.classList[1]));
    if (resultado.contains(columnas)) panel.classList.add('llega-tarde');
    if (hueco) hueco.replaceWith(panel);
    else columnas.append(panel);
  };
  // Panel con solo un aviso; `clase` lo coloca en el hueco de la evolución o de la efectividad.
  const agregarTexto = (titulo, contenido, clase) => poner(
    crear('section', { clase: 'data-panel ' + clase }, crear('h4', { texto: titulo }), crear('p', { texto: contenido })),
  );
  const especieTexto = cabecera.querySelector('.identity-caption');
  const descripcion = cabecera.querySelector('.identity-descripcion');

  const [especieRes, ...tiposRes] = await Promise.allSettled([
    obtenerRecurso('pokemon-species', pokemon.species.name),
    ...pokemon.types.map(t => obtenerRecurso('type', t.type.name)),
  ]);
  if (!vigente()) return;

  if (especieRes.status === 'fulfilled') {
    const especie = especieRes.value;
    const enIdioma = (lista, idioma) => lista.find(x => x.language.name === idioma);
    // Las especies de la 899 a la 1025 no tienen la categoría en español en PokéAPI: la de las leyendas está
    // traducida a mano en LEGENDARIOS; las demás no la muestran (antes salía en inglés, «Paradox Pokémon»).
    const categoria = enIdioma(especie.genera, 'es')?.genus || LEGENDARIOS.find(l => l.id === especie.id)?.especie;
    especieTexto.textContent = categoria || '';
    especieTexto.hidden = !categoria;
    descripcion.textContent = enIdioma(especie.flavor_text_entries, 'es')?.flavor_text.replace(/\s+/g, ' ') || 'Aún no hay descripción en español para esta especie.';

    if (especie.evolution_chain) {
      try {
        const cadena = await obtenerRecurso('evolution-chain', idDesdeUrl(especie.evolution_chain.url));
        if (!vigente()) return;
        poner(crearPanelEvolucion(cadena.chain, pokemon, especie.varieties || []));
      } catch {
        if (vigente()) agregarTexto('Cadena evolutiva', 'No se pudo cargar la cadena evolutiva.', 'evolution-panel');
      }
    } else agregarTexto('Cadena evolutiva', 'No hay datos de evolución disponibles.', 'evolution-panel');
  } else {
    especieTexto.textContent = 'Especie no disponible';
    descripcion.textContent = 'No se pudo cargar la descripción. Comprueba tu conexión.';
    agregarTexto('Cadena evolutiva', 'No se pudieron cargar los datos de la especie.', 'evolution-panel');
  }
  if (!vigente()) return;

  if (tiposRes.every(r => r.status === 'fulfilled')) {
    const multiplicadores = calcularMultiplicadores(tiposRes.map(r => r.value.damage_relations), Object.keys(TIPOS));
    poner(crear('section', { clase: 'data-panel panel-efectividad' },
      crear('h4', { texto: 'Efectividad en combate' }),
      crearGrupoEfectividad('Debilidades', multiplicadores, v => v > 1, 'weakness', (a, b) => b - a),
      crearGrupoEfectividad('Resistencias', multiplicadores, v => v > 0 && v < 1, 'resistance', (a, b) => a - b),
      crearGrupoEfectividad('Inmunidades', multiplicadores, v => v === 0, 'immunity', () => 0),
      crear('p', { clase: 'detail-note', texto: 'Efectividad defensiva según sus tipos actuales; no incluye habilidades, objetos ni condiciones especiales de combate.' }),
    ));
  } else agregarTexto('Efectividad en combate', 'No se pudieron cargar los datos de tipos.', 'panel-efectividad');
}

// Otras formas que caben en UNA fila junto al árbol (con «+N más»), según sus fases (1, 2 o 3): más partían la
// fila y la ficha crecía.
const FORMAS_QUE_CABEN = [4, 3, 2];

/** Imagen de una forma: su ilustración; si no tiene, el sprite; si tampoco, nada. */
function imagenDeForma(id) {
  const imagen = crear('img', { src: urlIlustracion(id), alt: '', loading: 'lazy' });
  imagen.addEventListener('error', () => {
    if (imagen.src === urlSprite(id)) imagen.hidden = true;
    else imagen.src = urlSprite(id);
  });
  return imagen;
}

/** Colores de los tipos de una carta de la evolución (--carta-a, --carta-b): si llegan después, se funden. */
function pintarCarta(carta, tipos) {
  if (!tipos.length) return;
  carta.style.setProperty('--carta-a', colorDe(tipos[0]));
  carta.style.setProperty('--carta-b', colorDe(tipos[1] || tipos[0]));
}

/**
 * Cómo se llega a `clave` desde `padre` (datos-evoluciones.js): «Nv. 16», «Piedra Agua», «Intercambio · con…».
 * La primera parte va resaltada y cada una de las demás en su línea (bajo la flecha) o seguidas (dentro de una carta).
 * Si solo evoluciona desde una forma regional (Obstagoon desde el Linoone de Galar), lo dice al final.
 */
function crearCondicion(clave, padre) {
  const dato = COMO_EVOLUCIONA[clave];
  if (!dato) return null;
  const [texto, region] = Array.isArray(dato) ? dato : [dato, null];
  const [principal, ...resto] = texto.split(' · ');
  const aclaracion = region ? ` (solo desde ${nombreTitulo(padre)} de ${region})` : '';
  return crear('span', { clase: 'evolution-condicion', title: `${nombreTitulo(clave)}: ${texto}${aclaracion}` },
    crear('b', { texto: principal }),
    ...resto.map(parte => crear('span', { texto: parte })),
    ...(region ? [crear('em', { texto: 'Forma de ' + region })] : []));
}

/**
 * Árbol evolutivo. Cada especie es una carta con los colores de SUS tipos; entre una y la siguiente, la flecha dice
 * cómo evoluciona. Si son varias posibles (Eevee), van juntas en un grupo y cada carta lo dice dentro. La que estás
 * viendo queda marcada («Estás aquí») y, si es una forma (Blastoise Gigamax), la carta la enseña a ella: antes salía
 * la normal, repetida en «Otras formas». A su lado, sus OTRAS FORMAS (species.varieties) si el árbol deja sitio.
 * Si no evoluciona, el panel lo dice. Pulsar una carta cambia la ficha a ese Pokémon (con un fundido).
 */
function crearPanelEvolucion(raiz, pokemon, variedades) {
  const especieActual = pokemon.species.name;
  const idEspecie = idDesdeUrl(pokemon.species.url);
  // ¿Una forma (Mega, Gigamax, de Alola…)? La forma por defecto de algunas especies lleva apellido ('giratina-altered')
  // pero tiene el número de la especie: esa no cuenta.
  const enForma = pokemon.id !== Number(idEspecie);
  const etiqueta = v => nombreForma(v.pokemon.name) || nombreTitulo(v.pokemon.name);
  const elegir = consulta => () => buscarPokemon(consulta);

  // `padre`: la especie anterior, para decir dentro de la carta cómo se llega a ella (solo en un grupo).
  const crearCarta = (nodo, padre) => {
    const id = Number(idDesdeUrl(nodo.species.url));
    const esActual = nodo.species.name === especieActual;
    const muestraForma = esActual && enForma;
    const contenido = [
      muestraForma ? imagenDeForma(pokemon.id) : crearImagen(urlIlustracion(id)),
      crear('small', { texto: '#' + numeroPokedex(id) }),
      crear('strong', { texto: muestraForma ? nombreForma(pokemon.name) || nombreTitulo(pokemon.name) : nombreTitulo(nodo.species.name) }),
      ...(padre ? [crearCondicion(nodo.species.name, padre)].filter(Boolean) : []),
    ];
    // La actual no lleva a ninguna parte (ya estás en ella): no es un botón, pero recibe el foco tras un cambio.
    const carta = esActual
      ? crear('div', { clase: 'evolution-card actual', tabIndex: -1, atributos: { 'aria-current': 'true' } }, ...contenido)
      : crear('button', { type: 'button', clase: 'evolution-card', alPulsar: elegir(nodo.species.name) }, ...contenido);
    if (esActual) pintarCarta(carta, pokemon.types.map(t => t.type.name));
    else {
      carta.dataset.especie = id;
      pintarCarta(carta, tiposDe(id));
    }
    return carta;
  };
  const crearRama = (nodo, padre = null) => {
    const rama = crear('div', { clase: 'evolution-branch' }, crearCarta(nodo, padre));
    if (nodo.evolves_to.length) rama.append(crearHijos(nodo));
    return rama;
  };
  // Una evolución: flecha con su condición. Varias posibles van juntas en un grupo («una de estas»), TODAS EN UNA
  // FILA: así el árbol crece a lo ancho y la ficha cabe sin encogerse. Si alguna sigue evolucionando (Wurmple,
  // Applin), va su rama entera; con más de cuatro (Eevee y sus ocho), las cartas son más pequeñas (.compacto).
  const crearHijos = nodo => {
    const hijos = nodo.evolves_to;
    const enGrupo = hijos.length > 1;
    const condicion = enGrupo ? null : crearCondicion(hijos[0].species.name, nodo.species.name);
    return crear('div', { clase: 'evolution-children' },
      crear('span', { clase: 'evolution-paso' + (condicion ? '' : ' sin-condicion') },
        ...(condicion ? [condicion] : []),
        crear('i', { clase: 'evolution-flecha', atributos: { 'aria-hidden': 'true' } })),
      crear('div', {
        clase: 'evolution-hijos' + (enGrupo ? ' en-grupo' : '') + (hijos.length > 4 ? ' compacto' : ''),
        estilos: enGrupo ? { '--columnas': hijos.length } : {},
      }, ...hijos.map(hijo => crearRama(hijo, enGrupo ? nodo.species.name : null))));
  };

  // Las formas «Dominante» (totem) son iguales que la normal, solo más grandes: no se cuentan. Y una por
  // nombre: Minior tiene siete «Forma Meteorito» (una por color) y Tatsugiri, tres «Mega-Tatsugiri».
  // Solo las que tienen nombre oficial en español (formaConNombre): las otras (las formas de Koraidon y Miraidon,
  // los disfraces de Pikachu) salían en inglés y, varias, sin imagen en PokéAPI.
  const otras = [...new Map(variedades
    .filter(v => v.pokemon.name !== pokemon.name && !v.pokemon.name.includes('-totem') && formaConNombre(v.pokemon.name)
      && etiqueta(v) !== nombreForma(pokemon.name))
    .map(v => [etiqueta(v), v])).values()];
  const fases = nodo => 1 + Math.max(0, ...nodo.evolves_to.map(fases));
  const ramifica = nodo => nodo.evolves_to.length > 1 || nodo.evolves_to.some(ramifica);
  const visibles = otras.slice(0, ramifica(raiz) ? 0 : FORMAS_QUE_CABEN[fases(raiz) - 1] ?? 0);
  const sinEvolucion = !raiz.evolves_to.length;
  const crearForma = v => {
    const carta = crear('button', { type: 'button', clase: 'evolution-card forma', alPulsar: elegir(v.pokemon.name) },
      imagenDeForma(idDesdeUrl(v.pokemon.url)),
      crear('small', { texto: '#' + numeroPokedex(idEspecie) }),
      crear('strong', { texto: etiqueta(v) }));
    // Mientras tanto, los de su especie; después, los suyos (Mega-Charizard X es Fuego y Dragón).
    pintarCarta(carta, tiposDe(idEspecie));
    obtenerPokemon(v.pokemon.name).then(forma => pintarCarta(carta, forma.types.map(t => t.type.name))).catch(() => {});
    return carta;
  };
  const formas = visibles.length ? crear('div', { clase: 'evolution-formas' },
    crear('small', { texto: otras.length === 1 ? 'Otra forma' : 'Otras formas' }),
    crear('div', { clase: 'evolution-formas-lista' },
      ...visibles.map(crearForma),
      ...(otras.length > visibles.length ? [crear('span', { clase: 'evolution-mas', texto: `+${otras.length - visibles.length} más` })] : []))) : null;
  const ayuda = sinEvolucion
    ? (visibles.length ? 'No evoluciona, pero tiene otras formas: pulsa una para ver su ficha.' : 'No evoluciona: esta es su única forma.')
    : (visibles.length ? 'Pulsa una especie o una forma para ver su ficha.' : 'Pulsa una especie para ver su ficha; las ramas son evoluciones posibles.');

  const panel = crear('section', { clase: 'data-panel evolution-panel' },
    crear('div', { clase: 'panel-cabecera' },
      crear('h4', { texto: 'Cadena evolutiva' }),
      crear('p', { texto: ayuda }),
    ),
    crear('div', { clase: 'evolution-cuerpo' },
      crear('div', { clase: 'evolution-tree' }, crearRama(raiz)),
      ...(sinEvolucion && !formas ? [crear('p', { clase: 'evolution-nota', texto: 'No evoluciona: es una especie de una sola fase.' })] : []),
      ...(formas ? [formas] : [])),
  );
  // Si la lista de especies (con sus tipos) aún no había llegado, las cartas se tiñen en cuanto llega.
  if (!tiposDe(idEspecie).length) {
    cargarEspecies().then(() => {
      for (const carta of panel.querySelectorAll('[data-especie]')) pintarCarta(carta, tiposDe(carta.dataset.especie));
    }).catch(() => {});
  }
  return panel;
}

const SIMBOLO = { 4: '×4', 2: '×2', 0.5: '×½', 0.25: '×¼', 0: '×0' };

/** Un grupo del panel de efectividad: cada tipo con su icono y color; el multiplicador va en una pastilla (×4 y ×¼ resaltados). */
function crearGrupoEfectividad(titulo, multiplicadores, filtro, clase, orden) {
  const valores = Object.entries(multiplicadores).filter(([, valor]) => filtro(valor)).sort(([, a], [, b]) => orden(a, b));
  const chips = valores.length
    ? valores.map(([tipo, valor]) => crear('span', { clase: 'type-chip', estilos: { '--color-tipo': colorDe(tipo) } },
      crear('span', { clase: 'type-chip-icono' }, crearIcono(TIPOS[tipo].icono)),
      crear('span', { texto: TIPOS[tipo].nombre }),
      crear('b', { clase: valor === 4 || valor === 0.25 ? 'extremo' : '', texto: SIMBOLO[valor] ?? '×' + valor })))
    : [crear('p', { texto: 'Ninguna' })];
  return crear('div', { clase: 'efectividad-grupo ' + clase },
    crear('h5', { texto: titulo }),
    crear('div', { clase: 'type-chips' }, ...chips),
  );
}
