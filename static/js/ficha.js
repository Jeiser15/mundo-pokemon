// Ficha de un Pokémon: ventana modal con ilustración, datos, estadísticas,
// evolución y efectividad de tipos. Toda la ficha toma los colores de sus tipos
// (--tipo-a y --tipo-b en #ficha) y, si es legendario o singular, su estilo especial
// (#ficha[data-rareza]). Ver css/ficha.css.
// Es estática: en escritorio cabe entera en la ventana (encajarFicha) y no se desplaza.
//
// Orden de carga:
//   1. /api/pokemon/<consulta>           → hábitat, cabecera, perfil, estadísticas y radar (se muestran ya)
//   2. /api/ability/<nombre> (en paralelo) → traducción de cada habilidad
//   3. /api/pokemon-species + /api/type   → especie, descripción y efectividad
//   4. /api/evolution-chain/<id>          → árbol evolutivo

import { obtenerPokemon, obtenerRecurso } from './api.js';
import { COLOR_POR_DEFECTO, GENERACIONES, NOMBRES_ESTADISTICAS, rarezaDe, TIPOS } from './datos.js';
import { calcularMultiplicadores } from './efectividad.js';
import { crearHabitat } from './habitats.js';
import { agregarAlEquipo, equipoLleno, estaEnEquipo } from './mi-equipo.js';
import { crear, crearIcono, crearImagen, idDesdeUrl, nombreLegible, numeroPokedex, urlIlustracion } from './utilidades.js';

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

// La ficha es estática: en escritorio cabe entera en la ventana. Si la ventana es más baja que la
// ficha, se reduce (zoom con --escala) en vez de desplazarse. En móvil no cabría legible y se desplaza.
const MARGEN_VENTANA = 32;  // El mismo hueco que deja «max-height: calc(100% - 32px)» en ficha.css.
const ESCALA_MINIMA = 0.7;  // Por debajo, el texto sería demasiado pequeño: ahí sí se desplaza.
const pantallaMovil = matchMedia('(max-width:700px)');

export function iniciarFicha() {
  // Se reencaja cuando cambia el contenido (llegan la evolución o la efectividad) o la ventana.
  new ResizeObserver(encajarFicha).observe(resultado);
  window.addEventListener('resize', encajarFicha);
  botonCerrar.addEventListener('click', () => ficha.close());
  ficha.addEventListener('close', () => {
    // El aviso de cierre llega en una tarea aparte: si mientras tanto se abrió otra ficha,
    // no hay que cancelarla ni descongelar la página.
    if (ficha.open) return;
    versionBusqueda++; // Descarta lo que aún estuviera cargando.
    document.body.classList.remove('ficha-abierta');
    document.body.style.top = '';
    window.scrollTo({ top: desplazamientoAnterior, behavior: 'instant' });
    if (elementoAnterior?.isConnected) elementoAnterior.focus({ preventScroll: true });
  });
}

/** Abre la ficha y la rellena. `consulta` es un nombre en inglés o un número. */
export async function buscarPokemon(consulta) {
  const version = ++versionBusqueda;
  const vigente = () => version === versionBusqueda;

  aplicarTema([], null); // Colores neutros mientras busca.
  mostrarAviso('Buscando en PokéAPI...');
  resultado.setAttribute('aria-busy', 'true'); // Avisa a los lectores de pantalla de que está cargando.
  abrirVentana();
  ficha.scrollTop = 0;

  try {
    const pokemon = await obtenerPokemon(consulta.trim().toLowerCase());
    if (!vigente()) return;

    // Las formas (Mega, Alola…) tienen número propio: la rareza y la región son las de su especie.
    const idEspecie = Number(idDesdeUrl(pokemon.species.url));
    const tipos = pokemon.types.map(t => t.type.name);
    const rareza = rarezaDe(idEspecie);
    aplicarTema(tipos, rareza);

    const { columnas, chipsHabilidades } = crearColumnas(pokemon);
    resultado.replaceChildren(crearBarra(rareza, pokemon), crearCabecera(pokemon, tipos, idEspecie, rareza), columnas);
    traducirHabilidades(pokemon.abilities, chipsHabilidades, vigente);
    await completarDatosExtra(pokemon, columnas, vigente);
  } catch (error) {
    if (vigente()) mostrarAviso(error.message || 'No se pudo completar la búsqueda.');
  } finally {
    if (vigente()) resultado.setAttribute('aria-busy', 'false');
  }
}

// --- Ventana y tema ----------------------------------------------------------------

function abrirVentana() {
  if (ficha.open) return;
  if (!document.body.classList.contains('ficha-abierta')) { // Si sigue congelada, conserva la posición de antes.
    desplazamientoAnterior = window.scrollY;
    elementoAnterior = document.activeElement;
    document.body.style.top = '-' + desplazamientoAnterior + 'px';
    document.body.classList.add('ficha-abierta');
  }
  ficha.showModal();
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
 * Ajusta --escala para que la ficha entera quepa en la ventana sin desplazarse.
 * offsetHeight da el alto «natural» (sin zoom ni la animación de entrada), así que basta dividir.
 */
function encajarFicha() {
  if (!ficha.open) return;
  const actual = Number(ficha.style.getPropertyValue('--escala')) || 1;
  let escala = 1;
  if (!pantallaMovil.matches && resultado.offsetHeight) {
    const disponible = window.innerHeight - MARGEN_VENTANA - 2; // 2 px de holgura por redondeos
    escala = Math.max(ESCALA_MINIMA, Math.min(1, disponible / resultado.offsetHeight));
  }
  if (Math.abs(escala - actual) < 0.005) return; // Sin cambios apreciables: evita reajustes en bucle.
  if (escala === 1) ficha.style.removeProperty('--escala');
  else ficha.style.setProperty('--escala', escala.toFixed(3));
}

function mostrarAviso(texto) {
  resultado.replaceChildren(crear('p', { clase: 'ficha-aviso', texto }));
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
        ...(url ? [crear('img', { clase: 'habitat-pokemon', src: url, alt: 'Ilustración oficial de ' + nombreLegible(pokemon.name) })] : []),
        crear('span', { clase: 'stage-caption', texto: 'ILUSTRACIÓN OFICIAL  /  POKÉAPI' }),
      ],
    }),
  );
}

/** Nombre, sello, especie (llega después), tipos, región y descripción (llega después). */
function crearIdentidad(pokemon, tipos, idEspecie, rareza) {
  const gen = GENERACIONES.find(g => idEspecie >= g.desde && idEspecie <= g.hasta);
  const etiquetasTipo = tipos.map(tipo => crear('span', { clase: 'badge', estilos: { '--color-etiqueta': colorDe(tipo) } },
    ...(TIPOS[tipo] ? [crearIcono(TIPOS[tipo].icono)] : []), TIPOS[tipo]?.nombre || tipo));
  const sello = { legendario: '✦ Pokémon legendario', singular: '✧ Pokémon singular' }[rareza];
  return crear('div', { clase: 'pokemon-identity' },
    crear('span', { clase: 'eyebrow', texto: 'REGISTRO DE POKÉMON  /  #' + numeroPokedex(pokemon.id) }),
    ...(sello ? [crear('span', { clase: 'ficha-sello', texto: sello })] : []),
    crear('h3', { texto: nombreLegible(pokemon.name) }),
    crear('p', { clase: 'identity-caption', texto: 'Consultando su especie…' }),
    crear('div', { clase: 'identity-tipos' }, ...etiquetasTipo),
    ...(gen ? [crear('span', { clase: 'identity-region', texto: `Generación ${gen.numero} · ${gen.region}` })] : []),
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

  // Las habilidades se muestran ya en inglés y se traducen cuando llega la respuesta.
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

  // Rejilla de paneles: la evolución y la efectividad se añaden aquí cuando llegan (completarDatosExtra).
  const columnas = crear('div', { clase: 'detail-columns' },
    crear('section', { clase: 'data-panel panel-perfil' }, crear('h4', { texto: 'Perfil del Pokémon' }), medidas, habilidades),
    crear('section', { clase: 'data-panel panel-estadisticas' }, crear('h4', { texto: 'Estadísticas base' }),
      crear('div', { clase: 'stats-cuerpo' }, crearRadar(pokemon.stats), crear('div', {}, estadisticas, total))),
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

function traducirHabilidades(habilidades, chips, vigente) {
  habilidades.forEach(async (a, indice) => {
    let nombre = nombreLegible(a.ability.name), sinTraduccion = true;
    try {
      const datos = await obtenerRecurso('ability', a.ability.name);
      const traduccion = datos.names.find(n => n.language.name === 'es');
      if (traduccion) { nombre = traduccion.name; sinTraduccion = false; }
    } catch { /* Si falla, se queda el nombre en inglés. */ }
    if (!vigente()) return;
    chips[indice].textContent = nombre + (sinTraduccion ? ' · sin traducción' : '') + (a.is_hidden ? ' · oculta' : '');
  });
}

// --- Especie, evolución y efectividad -----------------------------------------------

async function completarDatosExtra(pokemon, columnas, vigente) {
  // Panel con solo un aviso; `clase` lo coloca en el hueco de la evolución o de la efectividad.
  const agregarTexto = (titulo, contenido, clase) => columnas.append(
    crear('section', { clase: 'data-panel ' + clase }, crear('h4', { texto: titulo }), crear('p', { texto: contenido })),
  );
  const especieTexto = resultado.querySelector('.identity-caption');
  const descripcion = resultado.querySelector('.identity-descripcion');

  const [especieRes, ...tiposRes] = await Promise.allSettled([
    obtenerRecurso('pokemon-species', pokemon.species.name),
    ...pokemon.types.map(t => obtenerRecurso('type', t.type.name)),
  ]);
  if (!vigente()) return;

  if (especieRes.status === 'fulfilled') {
    const especie = especieRes.value;
    const enIdioma = (lista, idioma) => lista.find(x => x.language.name === idioma);
    // Algunas especies recientes solo tienen la categoría en inglés en PokéAPI.
    especieTexto.textContent = enIdioma(especie.genera, 'es')?.genus || enIdioma(especie.genera, 'en')?.genus || 'Pokémon';
    descripcion.textContent = enIdioma(especie.flavor_text_entries, 'es')?.flavor_text.replace(/\s+/g, ' ') || 'Aún no hay descripción en español para esta especie.';

    if (especie.evolution_chain) {
      try {
        const cadena = await obtenerRecurso('evolution-chain', idDesdeUrl(especie.evolution_chain.url));
        if (!vigente()) return;
        columnas.append(crearPanelEvolucion(cadena.chain, pokemon.species.name));
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
    columnas.append(crear('section', { clase: 'data-panel panel-efectividad' },
      crear('h4', { texto: 'Efectividad en combate' }),
      crearGrupoEfectividad('Debilidades', multiplicadores, v => v > 1, 'weakness', (a, b) => b - a),
      crearGrupoEfectividad('Resistencias', multiplicadores, v => v > 0 && v < 1, 'resistance', (a, b) => a - b),
      crearGrupoEfectividad('Inmunidades', multiplicadores, v => v === 0, 'immunity', () => 0),
      crear('p', { clase: 'detail-note', texto: 'Efectividad defensiva según sus tipos actuales; no incluye habilidades, objetos ni condiciones especiales de combate.' }),
    ));
  } else agregarTexto('Efectividad en combate', 'No se pudieron cargar los datos de tipos.', 'panel-efectividad');
}

/** Árbol evolutivo: cada especie es un botón; la que estás viendo queda marcada. */
function crearPanelEvolucion(raiz, especieActual) {
  const crearRama = nodo => {
    const id = idDesdeUrl(nodo.species.url);
    const esActual = nodo.species.name === especieActual;
    const rama = crear('div', { clase: 'evolution-branch' },
      crear('button', {
        type: 'button',
        clase: 'evolution-card' + (esActual ? ' actual' : ''),
        atributos: esActual ? { 'aria-current': 'true' } : {},
        alPulsar: () => buscarPokemon(nodo.species.name),
      },
        crearImagen(urlIlustracion(id)),
        crear('small', { texto: '#' + numeroPokedex(id) }),
        crear('strong', { texto: nombreLegible(nodo.species.name) }),
      ),
    );
    if (nodo.evolves_to.length) rama.append(crearHijos(nodo.evolves_to));
    return rama;
  };
  // Varias evoluciones finales (Eevee, Gloom, Kirlia…) van juntas en un grupo, en filas de hasta 4:
  // así el árbol crece a lo ancho y la ficha cabe en la pantalla. Si alguna sigue evolucionando
  // (Wurmple), van una debajo de otra para que se vea cada rama.
  const crearHijos = hijos => {
    const enGrupo = hijos.length > 1 && hijos.every(h => !h.evolves_to.length);
    return crear('div', {
      clase: 'evolution-children' + (enGrupo ? ' en-grupo' : ''),
      estilos: enGrupo ? { '--columnas': hijos.length <= 4 ? hijos.length : Math.ceil(hijos.length / 2) } : {},
    }, ...hijos.map(crearRama));
  };
  return crear('section', { clase: 'data-panel evolution-panel' },
    crear('div', { clase: 'panel-cabecera' },
      crear('h4', { texto: 'Cadena evolutiva' }),
      crear('p', { texto: 'Pulsa una especie para ver su ficha; las ramas son evoluciones posibles.' }),
    ),
    crear('div', { clase: 'evolution-tree' }, crearRama(raiz)),
  );
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
