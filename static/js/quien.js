// «¿Quién es ese Pokémon?» — el teatro de las sombras (css/quien.css).
// Una sombra a contraluz (la ilustración oficial con filter: brightness(0)) y un nombre por adivinar:
//   · modos (MODOS_QUIEN en datos.js): Clásico y Contrarreloj con cuatro nombres; Experto, escribiéndolo
//     (vale en español o en inglés y perdona una letra en los nombres largos);
//   · región: solo salen especies de esa generación (y no se repiten hasta que han salido todas);
//   · pistas (PISTAS_QUIEN) que se eligen como cartas selladas: tipo (tiñe la luz del escenario), región,
//     categoría (o su color, si PokéAPI aún no la tiene en español) y grito. Cada una resta COSTE_PISTA (la
//     inicial se quitó: con ella era demasiado fácil);
//   · al responder, la sombra se revela en color sobre el hábitat de su tipo, suena su grito y el panel enseña
//     su registro (categoría y descripción de PokéAPI), los puntos desglosados y «Siguiente».
// Guarda en este navegador la mejor racha (pokedex.quien.mejor-racha, que también lee el Inicio), las especies
// adivinadas alguna vez (pokedex.quien.adivinados: «Tu colección») y el último modo y región (pokedex.quien.ajustes).
// Cada pregunta nueva descarta lo que siga cargando de la anterior (version), como en ficha.js.

import { obtenerRecurso } from './api.js';
import {
  COLOR_POR_DEFECTO, COLORES_ESPECIE, GENERACIONES, MODOS_QUIEN, NOMBRES_ESPANOL, PISTAS_QUIEN, rarezaDe, TIPOS, TOTAL_ESPECIES,
} from './datos.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import { crearHabitat } from './habitats.js';
import { alternar, efectosActivos, grito, prepararSonido } from './sonido.js';
import {
  alAzar, barajar, crear, crearIcono, nombreTitulo, normalizar, numeroPokedex, urlGrito, urlIlustracion, urlSprite,
} from './utilidades.js';

const CLAVE_MEJOR = 'pokedex.quien.mejor-racha';
const CLAVE_COLECCION = 'pokedex.quien.adivinados';
const CLAVE_AJUSTES = 'pokedex.quien.ajustes';
const PUNTOS_ACIERTO = 10;
const EXTRA_EXPERTO = 5;
const MAXIMO_RACHA = 5;      // cada acierto seguido suma +1 más que el anterior, hasta +5
const COSTE_PISTA = 3;
const MINIMO_PUNTOS = 2;     // un acierto siempre suma algo, aunque se pidan todas las pistas
const HUECOS_RASTRO = 10;    // tus últimas respuestas, bajo el escenario
const CHISPAS = 14;
const ESPERA_CARGA_MS = 150; // si la imagen ya estaba precargada, «cargando» ni se llega a ver
const ICONO_SONIDO = 'M11 5 6 9H2v6h4l5 4z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14';
const ICONO_SILENCIO = 'M11 5 6 9H2v6h4l5 4z M16 9l6 6 M22 9l-6 6';

const seccion = document.querySelector('#quien');
const escenario = document.querySelector('#quien-escenario');
const panel = document.querySelector('#quien-panel');
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const cifras = {
  puntos: document.querySelector('#quien-puntos'),
  racha: document.querySelector('#quien-racha'),
  mejor: document.querySelector('#quien-mejor'),
  aciertos: document.querySelector('#quien-aciertos'),
  coleccion: document.querySelector('#quien-adivinados'),
  barra: document.querySelector('#quien-coleccion-barra'),
};
// Piezas fijas del escenario y piezas del panel de la pregunta en curso (el panel se rehace en cada una).
const nodos = {
  habitat: document.querySelector('#quien-habitat'),
  silueta: document.querySelector('#quien-silueta'),
  cuenta: document.querySelector('#quien-cuenta'),
  chispas: document.querySelector('#quien-chispas'),
  selloRacha: document.querySelector('#quien-sello-racha'),
  botonSonido: document.querySelector('#quien-sonido'),
  placa: document.querySelector('#quien-placa'),
  rastro: document.querySelector('#quien-rastro'),
  modos: [],    // [{ clave, boton }]
  regiones: [], // [{ numero, desde, hasta, boton, contador }]
};

const ajustesGuardados = leer(CLAVE_AJUSTES, {}) || {};
const partida = {
  modo: MODOS_QUIEN[ajustesGuardados.modo] ? ajustesGuardados.modo : 'clasico',
  region: GENERACIONES.some(g => g.numero === ajustesGuardados.region) ? ajustesGuardados.region : null,
  puntos: 0, racha: 0, aciertos: 0, preguntas: 0, mejor: Number(leer(CLAVE_MEJOR, 0)) || 0,
  usados: new Set(), // ya salieron en esta partida
  siguiente: null,   // la próxima, con su imagen ya descargada
  rastro: [],        // [{ id, nombre, acierto }] de las últimas respuestas
  recordAvisado: false,
};
const coleccion = new Set([].concat(leer(CLAVE_COLECCION, []) || []).filter(Number.isInteger));
const registros = new Map(); // id → promesa de { categoria, descripcion, color } (null si no se pudo leer)
let pregunta = null;  // { especie, nombre, opciones, abiertas, restante, respondida, datos }
let version = 0;
let cargando = false;
let reloj = null;
let limpieza = null;

const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;
const regionDe = id => GENERACIONES.find(g => id >= g.desde && id <= g.hasta);
/** Nombre oficial en español: «Mr. Mime», «Código Cero», «Pikachu». */
const nombreDe = especie => nombreTitulo(especie.nombre);
/** Para comparar lo escrito: «Mr. Mime» y «mr-mime» → «mrmime». */
const limpio = texto => normalizar(texto).replace(/[^a-z0-9]/g, '');
const adivinadosEntre = (desde, hasta) => { let n = 0; for (const id of coleccion) if (id >= desde && id <= hasta) n++; return n; };

function leer(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}

/** Quita y vuelve a poner una clase para que su animación empiece otra vez. */
function reiniciarAnimacion(elemento, clase) {
  elemento.classList.remove(clase);
  void elemento.offsetWidth;
  elemento.classList.add(clase);
}

export function iniciarQuien() {
  crearAjustes();
  crearChispas();
  pintarSonido();
  pintarCifras();
  pintarRastro();
  pintarSelloRacha();
  nodos.botonSonido.addEventListener('click', () => {
    prepararSonido(); // dentro del clic: así el navegador deja sonar
    alternar('efectos');
    pintarSonido();
    pintarSellos();
  });
  document.querySelector('#quien-reiniciar').addEventListener('click', reiniciar);
  document.querySelector('#quien-volver').addEventListener('click', irAlEscenario);
  document.addEventListener('keydown', teclas);
  // La primera pregunta se prepara al abrir la vista: así no descarga imágenes si nunca se visita.
  const alMostrarse = () => { if (!seccion.hidden && !pregunta && !cargando) nuevaPregunta(); };
  new MutationObserver(alMostrarse).observe(seccion, { attributes: true, attributeFilter: ['hidden'] });
  alMostrarse();
}

// --- Ajustes, marcador y rastro ------------------------------------------------------------------

function crearAjustes() {
  nodos.modos = Object.entries(MODOS_QUIEN).map(([clave, modo]) => ({
    clave,
    boton: crear('button', { type: 'button', clase: 'quien-modo', alPulsar: () => cambiar({ modo: clave }) },
      crear('span', { clase: 'quien-modo-marcador', texto: modo.marcador, atributos: { 'aria-hidden': 'true' } }),
      crear('strong', { texto: modo.nombre }),
      crear('small', { texto: modo.descripcion }),
      crear('em', { texto: modo.premio })),
  }));
  document.querySelector('#quien-modos').replaceChildren(...nodos.modos.map(m => m.boton));

  const regiones = [{ numero: null, region: 'Todas', etiqueta: '✦', desde: 1, hasta: TOTAL_ESPECIES },
    ...GENERACIONES.map(g => ({ ...g, etiqueta: g.numero }))];
  nodos.regiones = regiones.map(({ numero, region, etiqueta, desde, hasta }) => {
    const contador = crear('small');
    const boton = crear('button', { type: 'button', clase: 'quien-region', alPulsar: () => cambiar({ region: numero }) },
      crear('b', { texto: etiqueta, atributos: { 'aria-hidden': 'true' } }),
      crear('strong', { texto: region }),
      contador,
      crear('i', { atributos: { 'aria-hidden': 'true' } }));
    return { numero, region, desde, hasta, boton, contador };
  });
  document.querySelector('#quien-regiones').replaceChildren(...nodos.regiones.map(r => r.boton));
  pintarAjustes();
}

/** Marca el modo y la región elegidos y pone al día lo adivinado en cada región. */
function pintarAjustes() {
  for (const { clave, boton } of nodos.modos) boton.setAttribute('aria-pressed', String(clave === partida.modo));
  for (const { numero, region, desde, hasta, boton, contador } of nodos.regiones) {
    const total = hasta - desde + 1;
    const hechos = adivinadosEntre(desde, hasta);
    boton.setAttribute('aria-pressed', String(numero === partida.region));
    boton.setAttribute('aria-label', `${region === 'Todas' ? 'Todas las regiones' : region}: ${hechos} de ${total} adivinados`);
    boton.style.setProperty('--progreso', (hechos / total).toFixed(3));
    contador.textContent = `${hechos}/${total}`;
  }
}

function cambiar(ajustes) {
  if (Object.entries(ajustes).every(([clave, valor]) => partida[clave] === valor)) return;
  Object.assign(partida, ajustes);
  partida.siguiente = null; // la precargada puede no valer para la región nueva
  guardar(CLAVE_AJUSTES, { modo: partida.modo, region: partida.region });
  pintarAjustes();
  nuevaPregunta();
}

function reiniciar() {
  Object.assign(partida, { puntos: 0, racha: 0, aciertos: 0, preguntas: 0, rastro: [], recordAvisado: false });
  partida.usados.clear();
  pintarCifras();
  pintarRastro();
  pintarSelloRacha();
  nuevaPregunta();
  irAlEscenario();
}

function irAlEscenario() {
  seccion.scrollIntoView({ behavior: movimientoReducido.matches ? 'auto' : 'smooth', block: 'start' });
}
function irAAjustes() {
  document.querySelector('#quien-ajustes').scrollIntoView({ behavior: movimientoReducido.matches ? 'auto' : 'smooth', block: 'start' });
}

function pintarCifras() {
  cifras.puntos.textContent = partida.puntos;
  cifras.racha.textContent = partida.racha;
  cifras.mejor.textContent = partida.mejor;
  cifras.aciertos.textContent = `${partida.aciertos}/${partida.preguntas}`;
  cifras.coleccion.textContent = coleccion.size;
  cifras.barra.style.setProperty('--progreso', Math.min(1, coleccion.size / TOTAL_ESPECIES).toFixed(4));
}

/** Diez huecos: los ocupados llevan el sprite (verde si acertaste, rojo si no) y abren su ficha. */
function pintarRastro(conNovedad = false) {
  nodos.rastro.replaceChildren(...Array.from({ length: HUECOS_RASTRO }, (_, i) => {
    const respuesta = partida.rastro[i];
    if (!respuesta) return crear('li', { clase: 'vacio' });
    const { id, nombre, acierto } = respuesta;
    const imagen = crear('img', { src: urlSprite(id), alt: '', loading: 'lazy', draggable: false });
    imagen.addEventListener('error', () => { imagen.src = urlIlustracion(id); }, { once: true });
    const texto = `${nombre}: ${acierto ? 'acertado' : 'fallado'}. Ver su ficha`;
    return crear('li', { clase: (acierto ? 'acierto' : 'fallo') + (conNovedad && i === partida.rastro.length - 1 ? ' nuevo' : '') },
      crear('button', { type: 'button', title: texto, atributos: { 'aria-label': texto }, alPulsar: () => buscarPokemon(String(id)) }, imagen));
  }));
}

function pintarSelloRacha() {
  const { racha } = partida;
  nodos.selloRacha.hidden = racha < 2;
  nodos.selloRacha.textContent = `✦ ${racha} seguidas`;
  nodos.selloRacha.dataset.hito = String(racha > 0 && racha % 5 === 0);
}

function pintarSonido() {
  const activo = efectosActivos();
  nodos.botonSonido.replaceChildren(crearIcono(activo ? ICONO_SONIDO : ICONO_SILENCIO));
  nodos.botonSonido.setAttribute('aria-pressed', String(activo));
  nodos.botonSonido.setAttribute('aria-label', 'Gritos de los Pokémon');
  nodos.botonSonido.title = activo ? 'Silenciar los gritos' : 'Activar los gritos';
}

/** Las chispas del acierto: salen del centro en todas direcciones (reparto fijo). */
function crearChispas() {
  nodos.chispas.replaceChildren(...Array.from({ length: CHISPAS }, (_, i) => crear('i', {
    estilos: { '--a': `${Math.round((360 / CHISPAS) * i + (i % 2) * 8)}deg`, '--d': (0.36 + (i % 3) * 0.045).toFixed(3), '--i': i },
  })));
}

// --- Preguntas ------------------------------------------------------------------------------------

function precargar(src) {
  return new Promise(listo => {
    const imagen = new Image();
    imagen.onload = () => listo(true);
    imagen.onerror = () => listo(false);
    imagen.src = src;
  });
}

/** Categoría, descripción y color de la especie (PokéAPI, en español). Se pide una vez por especie. */
function registroDe(id) {
  if (!registros.has(id)) {
    registros.set(id, obtenerRecurso('pokemon-species', id).then(especie => {
      const enEspanol = lista => [...(lista || [])].reverse().find(x => x.language.name === 'es'); // la más reciente
      return {
        categoria: enEspanol(especie.genera)?.genus || null,
        descripcion: enEspanol(especie.flavor_text_entries)?.flavor_text.replace(/\s+/g, ' ').trim() || null,
        color: especie.color?.name || null,
      };
    }).catch(() => { registros.delete(id); return null; }));
  }
  return registros.get(id);
}

async function nuevaPregunta() {
  const vigente = ++version;
  cargando = true;
  pararReloj();
  pregunta = null;
  const aviso = setTimeout(() => { if (vigente === version) mostrarCarga(); }, ESPERA_CARGA_MS);
  const listo = () => { clearTimeout(aviso); cargando = false; };

  let especies;
  try { especies = await cargarEspecies(); } catch {
    if (vigente === version) { listo(); mostrarError('No se pudo cargar la lista de Pokémon. Comprueba tu conexión e inténtalo de nuevo.'); }
    return;
  }
  if (vigente !== version) return;
  const gen = GENERACIONES.find(g => g.numero === partida.region);
  const grupo = especies.filter(e => !gen || (e.id >= gen.desde && e.id <= gen.hasta));
  if (grupo.every(e => partida.usados.has(e.id))) grupo.forEach(e => partida.usados.delete(e.id)); // ya salieron todas

  // Hasta 4 intentos por si alguna ilustración no se puede descargar.
  for (let intento = 0; intento < 4; intento++) {
    const libres = grupo.filter(e => !partida.usados.has(e.id));
    const especie = libres.find(e => e.id === partida.siguiente) || alAzar(libres);
    if (!especie) break;
    partida.usados.add(especie.id);
    const descargada = await precargar(urlIlustracion(especie.id));
    if (vigente !== version) return;
    if (descargada) {
      listo();
      mostrarPregunta(especie, grupo);
      // Deja preparadas la imagen y el registro de la siguiente para que aparezca al instante.
      const proxima = alAzar(grupo.filter(e => !partida.usados.has(e.id)));
      partida.siguiente = proxima?.id ?? null;
      if (proxima) { precargar(urlIlustracion(proxima.id)); registroDe(proxima.id); }
      return;
    }
  }
  listo();
  mostrarError('No se pudieron descargar las imágenes. Comprueba tu conexión a internet.');
}

function mostrarCarga() {
  escenario.dataset.estado = 'cargando';
  delete escenario.dataset.resultado;
  nodos.cuenta.dataset.activa = 'false';
  panel.setAttribute('aria-busy', 'true');
  panel.replaceChildren(crear('p', { clase: 'quien-espera' },
    crear('span', { clase: 'quien-espera-anillo', atributos: { 'aria-hidden': 'true' } }), 'Preparando la siguiente sombra…'));
}

function mostrarError(mensaje) {
  escenario.dataset.estado = 'error';
  delete escenario.dataset.resultado;
  nodos.cuenta.dataset.activa = 'false';
  panel.setAttribute('aria-busy', 'false');
  panel.replaceChildren(crear('div', { clase: 'quien-error', atributos: { role: 'alert' } },
    crear('p', { texto: mensaje }),
    crear('button', { type: 'button', clase: 'quien-siguiente', texto: 'Reintentar', alPulsar: nuevaPregunta })));
}

/** Tres opciones falsas: hasta dos que comparten tipo con la buena (más difícil) y el resto al azar. */
function crearOpciones(especie, grupo, cuantas) {
  const otras = grupo.filter(e => e.id !== especie.id);
  const parecidas = barajar(otras.filter(e => e.tipos.some(t => especie.tipos.includes(t)))).slice(0, 2);
  const falsas = [...new Map([...parecidas, ...barajar(otras)].map(e => [e.id, e])).values()].slice(0, cuantas - 1);
  return barajar([especie, ...falsas]);
}

function mostrarPregunta(especie, grupo) {
  const modo = MODOS_QUIEN[partida.modo];
  const actual = {
    especie, nombre: nombreDe(especie), abiertas: new Set(), restante: modo.tiempo, respondida: false,
    datos: undefined, // undefined: aún llega; null: no se pudo leer
    opciones: modo.opciones ? crearOpciones(especie, grupo, modo.opciones) : [],
  };
  pregunta = actual;
  registroDe(especie.id).then(datos => {
    actual.datos = datos;
    if (pregunta === actual) pintarSellos();
  });
  prepararEscenario(especie, modo);
  pintarPanel(modo);
  arrancarReloj();
  if (nodos.campo && !seccion.hidden) nodos.campo.focus({ preventScroll: true });
}

function prepararEscenario(especie, modo) {
  escenario.dataset.estado = 'pregunta';
  delete escenario.dataset.resultado;
  seccion.style.removeProperty('--quien-luz'); // la luz vuelve a ser violeta
  // Una imagen nueva en cada pregunta: así la sombra aparece con su animación y nunca se ve en color.
  const silueta = crear('img', { clase: 'quien-silueta', src: urlIlustracion(especie.id), alt: 'Silueta de un Pokémon misterioso', draggable: false });
  nodos.silueta.replaceWith(silueta);
  nodos.silueta = silueta;
  // El hábitat anterior se funde con la luz y después se quita (sus partículas no deben seguir animándose).
  clearTimeout(limpieza);
  limpieza = setTimeout(() => { if (escenario.dataset.estado !== 'revelado') nodos.habitat.replaceChildren(); }, 900);
  nodos.cuenta.dataset.activa = String(Boolean(modo.tiempo));
  nodos.cuenta.dataset.urgente = 'false';
  nodos.cuenta.style.setProperty('--restante', '1');
  pintarPlaca(null);
}

/** Bajo el escenario: «Pokémon misterioso» o, ya revelado, su número, región, nombre y tipos. */
function pintarPlaca(especie) {
  if (!especie) {
    nodos.placa.replaceChildren(crear('small', { texto: 'N.º ???' }), crear('strong', { clase: 'quien-placa-misterio', texto: 'Pokémon misterioso' }));
    return;
  }
  const rareza = rarezaDe(especie.id);
  nodos.placa.replaceChildren(
    crear('small', { texto: [`N.º ${numeroPokedex(especie.id)}`, regionDe(especie.id)?.region,
      rareza && (rareza === 'legendario' ? '✦ Legendario' : '✧ Singular')].filter(Boolean).join(' · ') }),
    crear('strong', { texto: nombreDe(especie) }),
    crear('span', { clase: 'quien-tipos' }, ...especie.tipos.map(chipTipo)));
}

function chipTipo(tipo) {
  return crear('span', { clase: 'quien-tipo', estilos: { '--color-tipo': colorDe(tipo) } },
    crearIcono(TIPOS[tipo]?.icono || ''), TIPOS[tipo]?.nombre || tipo);
}

function pintarPanel(modo) {
  const region = GENERACIONES.find(g => g.numero === partida.region)?.region || 'Todas las regiones';
  nodos.segundos = crear('b', { texto: modo.tiempo });
  nodos.reloj = crear('span', { clase: 'quien-reloj', hidden: !modo.tiempo, atributos: { 'aria-hidden': 'true' } }, nodos.segundos, ' s');
  nodos.titulo = crear('h3', { clase: 'quien-pregunta' }, modo.titulo[0], crear('em', { texto: modo.titulo[1] }));
  nodos.respuestas = crearRespuestas(modo);
  nodos.zona = crear('div', { clase: 'quien-zona', atributos: { 'aria-live': 'polite' } }, crearPistas());
  panel.setAttribute('aria-busy', 'false');
  panel.replaceChildren(
    crear('div', { clase: 'quien-panel-cabecera' },
      crear('span', { clase: 'quien-etiqueta', texto: `Pregunta ${partida.preguntas + 1} · ${modo.nombre} · ${region}` }),
      nodos.reloj,
      crear('button', { type: 'button', clase: 'quien-cambiar', alPulsar: irAAjustes }, 'Cambiar modo o región ', crear('span', { texto: '↓', atributos: { 'aria-hidden': 'true' } }))),
    nodos.titulo,
    nodos.respuestas,
    nodos.zona);
  pintarSellos();
}

function crearRespuestas(modo) {
  const especie = pregunta.especie;
  if (modo.opciones) {
    nodos.campo = null;
    nodos.botones = pregunta.opciones.map((opcion, i) => crear('button', {
      type: 'button', clase: 'quien-opcion', estilos: { '--i': i },
      alPulsar: () => responder(opcion.id === especie.id, opcion),
    }, crear('kbd', { texto: String(i + 1) }), crear('span', { texto: nombreDe(opcion) })));
    return crear('div', { clase: 'quien-respuestas', atributos: { role: 'group', 'aria-label': 'Posibles respuestas' } }, ...nodos.botones);
  }
  nodos.botones = null;
  const campo = crear('input', {
    type: 'text', clase: 'quien-campo', placeholder: 'Su nombre…', autocomplete: 'off', spellcheck: false,
    atributos: { 'aria-label': 'Nombre del Pokémon', autocapitalize: 'off', enterkeyhint: 'done' },
  });
  nodos.campo = campo;
  const formulario = crear('form', { clase: 'quien-formulario' },
    campo,
    crear('button', { type: 'submit', clase: 'quien-responder', texto: 'Responder' }),
    crear('button', { type: 'button', clase: 'quien-rendirse', texto: 'Me rindo', alPulsar: () => responder(false, null, 'rendido') }));
  formulario.addEventListener('submit', evento => {
    evento.preventDefault();
    if (!campo.value.trim()) { campo.focus(); return; }
    responder(nombreCoincide(campo.value, especie), { escrito: campo.value.trim() });
  });
  return crear('div', { clase: 'quien-respuestas' }, formulario,
    crear('p', { clase: 'quien-ayuda', texto: 'Vale su nombre en español o en inglés, sin preocuparte por tildes, mayúsculas ni guiones. En los nombres de seis letras o más se perdona una equivocada.' }));
}

/** Vale su clave de PokéAPI (el nombre en inglés) o su nombre en español; con 6 letras o más, perdona una. */
function nombreCoincide(escrito, especie) {
  const a = limpio(escrito);
  return [especie.nombre, NOMBRES_ESPANOL[especie.nombre]].filter(Boolean).some(nombre => {
    const b = limpio(nombre);
    return a === b || (b.length >= 6 && distancia(a, b) <= 1);
  });
}

/** Distancia de edición (Levenshtein): cuántas letras hay que cambiar, quitar o poner. */
function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j++) {
      nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    fila = nueva;
  }
  return fila[b.length];
}

// --- Pistas -----------------------------------------------------------------------------------------

/** Cuatro cartas selladas: se abren al pulsarlas y enseñan la pista en su cara. */
function crearPistas() {
  nodos.sellos = {};
  const sellos = PISTAS_QUIEN.map(pista => {
    const boton = crear('button', { type: 'button', clase: 'quien-sello', atributos: { 'data-pista': pista.clave }, alPulsar: () => abrirPista(pista.clave) },
      crear('small', { texto: pista.nombre }),
      crear('span', { clase: 'quien-sello-cara' }, crearIcono(pista.icono)),
      crear('em', { texto: `−${COSTE_PISTA}` }));
    nodos.sellos[pista.clave] = boton;
    return boton;
  });
  nodos.costePistas = crear('small', { texto: `Cada una resta ${COSTE_PISTA} puntos` });
  return crear('div', { clase: 'quien-pistas' },
    crear('div', { clase: 'quien-pistas-cabecera' }, crear('h4', { texto: '¿Te atascas? Abre una pista' }), nodos.costePistas),
    crear('div', { clase: 'quien-sellos' }, ...sellos));
}

/** Si una pista se puede abrir ahora y cómo se llama (la categoría pasa a «Color» si no está en español). */
function estadoPista(clave) {
  const { datos } = pregunta;
  if (clave === 'categoria') {
    if (datos === undefined) return { nombre: 'Categoría', disponible: false, motivo: 'Leyendo su registro…' };
    if (datos === null) return { nombre: 'Categoría', disponible: false, motivo: 'No se pudo leer su registro' };
    if (!datos.categoria) return { nombre: 'Color', disponible: Boolean(datos.color), motivo: 'Sin datos de su color' };
  }
  if (clave === 'grito' && !efectosActivos()) return { nombre: 'Grito', disponible: false, motivo: 'El sonido está apagado: actívalo en el escenario' };
  return { nombre: PISTAS_QUIEN.find(p => p.clave === clave).nombre, disponible: true };
}

function pintarSellos() {
  if (!pregunta || pregunta.respondida || !nodos.sellos) return;
  for (const [clave, boton] of Object.entries(nodos.sellos)) {
    if (pregunta.abiertas.has(clave)) continue;
    const { nombre, disponible, motivo } = estadoPista(clave);
    const texto = disponible ? `Pista: ${nombre.toLowerCase()} (−${COSTE_PISTA} puntos)` : `${nombre}: ${motivo}`;
    boton.querySelector('small').textContent = nombre;
    boton.setAttribute('aria-disabled', String(!disponible));
    boton.setAttribute('aria-label', texto);
    boton.title = texto;
  }
}

function abrirPista(clave) {
  if (!pregunta || pregunta.respondida) return;
  const boton = nodos.sellos[clave];
  if (pregunta.abiertas.has(clave)) { // el grito se puede volver a oír sin pagar otra vez
    if (clave === 'grito') sonarGrito(boton);
    return;
  }
  if (boton.getAttribute('aria-disabled') === 'true') return;
  const contenido = contenidoPista(clave);
  if (!contenido) return;
  pregunta.abiertas.add(clave);
  const cara = boton.querySelector('.quien-sello-cara');
  cara.replaceChildren(...contenido);
  boton.dataset.abierta = 'true';
  boton.querySelector('em').textContent = clave === 'grito' ? '▸ otra vez' : `−${COSTE_PISTA}`;
  boton.setAttribute('aria-disabled', String(clave !== 'grito'));
  const texto = [...cara.querySelectorAll('b, small, .quien-tipo')].map(nodo => nodo.textContent).join(' ');
  const etiqueta = `${boton.querySelector('small').textContent}: ${texto}${clave === 'grito' ? '. Pulsa para oírlo otra vez' : ''}`;
  boton.setAttribute('aria-label', etiqueta);
  boton.title = clave === 'grito' ? 'Oírlo otra vez' : '';
  if (clave === 'tipo') seccion.style.setProperty('--quien-luz', colorDe(pregunta.especie.tipos[0]));
  if (clave === 'grito') sonarGrito(boton);
  const usadas = pregunta.abiertas.size;
  nodos.costePistas.textContent = `${usadas} abierta${usadas === 1 ? '' : 's'} · −${usadas * COSTE_PISTA} puntos si aciertas`;
}

function contenidoPista(clave) {
  const { especie, datos } = pregunta;
  const gen = regionDe(especie.id);
  switch (clave) {
    case 'tipo':
      return [crear('span', { clase: 'quien-tipos' }, ...especie.tipos.map(chipTipo))];
    case 'region': {
      if (!partida.region) return [crear('b', { texto: gen.region }), crear('small', { texto: `Generación ${gen.numero}` })];
      // Con una región elegida, decirla no ayuda: se da la veintena de su número.
      const desde = Math.max(gen.desde, Math.floor((especie.id - 1) / 20) * 20 + 1);
      const hasta = Math.min(gen.hasta, desde + 19);
      return [crear('small', { texto: 'N.º del' }), crear('b', { texto: `${desde} al ${hasta}` })];
    }
    case 'categoria':
      if (datos?.categoria) return [crear('small', { texto: 'Pokémon' }), crear('b', { texto: datos.categoria.replace(/^Pokémon\s+/i, '') })];
      if (datos?.color) return [crear('small', { texto: 'De color' }), crear('b', { texto: COLORES_ESPECIE[datos.color] || datos.color })];
      return null;
    case 'grito':
      return [crear('span', { clase: 'quien-ondas', atributos: { 'aria-hidden': 'true' } }, crear('i'), crear('i'), crear('i'), crear('i'), crear('i')),
        crear('small', { texto: 'Escúchalo' })];
    default:
      return null;
  }
}

function sonarGrito(boton) {
  prepararSonido(); // dentro del clic
  grito(urlGrito(pregunta.especie.id), { volumen: 0.6 });
  reiniciarAnimacion(boton, 'sonando');
}

// --- Tiempo -------------------------------------------------------------------------------------------

function arrancarReloj() {
  const { tiempo } = MODOS_QUIEN[partida.modo];
  if (!tiempo) return;
  let anterior = performance.now();
  reloj = setInterval(() => {
    const ahora = performance.now();
    const paso = (ahora - anterior) / 1000;
    anterior = ahora;
    // En pausa si cambias de vista, de pestaña o abres una ficha.
    if (seccion.hidden || document.hidden || document.querySelector('#ficha')?.open || !pregunta || pregunta.respondida) return;
    pregunta.restante = Math.max(0, pregunta.restante - paso);
    const urgente = String(pregunta.restante <= 3);
    nodos.cuenta.style.setProperty('--restante', (pregunta.restante / tiempo).toFixed(3));
    nodos.cuenta.dataset.urgente = urgente;
    nodos.reloj.dataset.urgente = urgente;
    nodos.segundos.textContent = Math.ceil(pregunta.restante);
    if (pregunta.restante === 0) responder(false, null, 'tiempo');
  }, 100);
}

function pararReloj() {
  clearInterval(reloj);
  reloj = null;
}

// --- Respuesta y revelación ----------------------------------------------------------------------------

/**
 * @param {boolean} acierto
 * @param {object|null} eleccion  la opción pulsada ({ id, nombre }) o { escrito } en modo Experto
 * @param {string} [motivo]       'tiempo' o 'rendido' cuando no hubo respuesta
 */
function responder(acierto, eleccion, motivo = '') {
  if (!pregunta || pregunta.respondida) return;
  pregunta.respondida = true;
  pararReloj();
  if (motivo !== 'tiempo') prepararSonido(); // viene de un clic o una tecla: el grito podrá sonar
  const modo = MODOS_QUIEN[partida.modo];
  const { especie, nombre } = pregunta;
  const resultado = { acierto, eleccion, motivo, ganados: 0, desglose: [], record: false };
  partida.preguntas++;
  if (acierto) {
    const tiempo = modo.tiempo ? Math.ceil(pregunta.restante) : 0;
    const experto = modo.opciones ? 0 : EXTRA_EXPERTO;
    const racha = Math.min(partida.racha, MAXIMO_RACHA);
    const pistas = pregunta.abiertas.size * COSTE_PISTA;
    const bruto = PUNTOS_ACIERTO + tiempo + experto + racha - pistas;
    resultado.ganados = Math.max(MINIMO_PUNTOS, bruto);
    resultado.desglose = [
      `${PUNTOS_ACIERTO} por acertar`,
      tiempo && `+${tiempo} de tiempo`,
      experto && `+${experto} de experto`,
      racha && `+${racha} de racha`,
      pistas && `−${pistas} de pistas`,
      bruto < MINIMO_PUNTOS && `mínimo ${MINIMO_PUNTOS}`,
    ].filter(Boolean);
    partida.puntos += resultado.ganados;
    partida.aciertos++;
    partida.racha++;
    if (partida.racha > partida.mejor) {
      partida.mejor = partida.racha;
      guardar(CLAVE_MEJOR, partida.mejor);
      // Se celebra una vez por racha: al superar la mejor (no en cada acierto que la sigue alargando).
      if (!partida.recordAvisado && partida.mejor > 1) resultado.record = partida.recordAvisado = true;
    }
    coleccion.add(especie.id);
    guardar(CLAVE_COLECCION, [...coleccion]);
  } else {
    partida.racha = 0;
    partida.recordAvisado = false;
  }
  partida.rastro = [...partida.rastro, { id: especie.id, nombre, acierto }].slice(-HUECOS_RASTRO);
  pintarCifras();
  pintarRastro(true);
  pintarSelloRacha();
  pintarAjustes();
  revelar(resultado);
}

function revelar({ acierto, eleccion, motivo, ganados, desglose, record }) {
  const actual = pregunta;
  const { especie, nombre } = actual;

  // Escenario: la luz se apaga, aparece su hábitat y la sombra toma color.
  clearTimeout(limpieza);
  nodos.habitat.replaceChildren(crearHabitat({ tipo: especie.tipos[0], rareza: rarezaDe(especie.id), semilla: especie.id % 97 }));
  seccion.style.setProperty('--quien-luz', colorDe(especie.tipos[0]));
  escenario.dataset.estado = 'revelado';
  escenario.dataset.resultado = acierto ? 'acierto' : 'fallo';
  nodos.silueta.alt = 'Ilustración de ' + nombre;
  nodos.cuenta.dataset.activa = 'false';
  if (acierto) reiniciarAnimacion(nodos.chispas, 'estallido');
  pintarPlaca(especie);
  grito(urlGrito(especie.id), { volumen: 0.45 });

  // Panel: la pregunta se convierte en la respuesta.
  nodos.titulo.dataset.resultado = acierto ? 'acierto' : 'fallo';
  nodos.titulo.replaceChildren(...(acierto
    ? ['¡Es ', crear('em', { texto: nombre + '!' })]
    : [motivo === 'tiempo' ? '¡Tiempo! Era ' : 'Era ', crear('em', { texto: nombre + '.' })]));
  nodos.botones?.forEach((boton, i) => {
    boton.disabled = true;
    const opcion = actual.opciones[i];
    if (opcion.id === especie.id) { boton.dataset.resultado = 'correcta'; boton.querySelector('kbd').textContent = '✓'; }
    else if (opcion === eleccion) { boton.dataset.resultado = 'elegida'; boton.querySelector('kbd').textContent = '✕'; }
  });
  if (nodos.campo) {
    nodos.campo.disabled = true;
    nodos.campo.dataset.resultado = acierto ? 'acierto' : 'fallo';
    nodos.respuestas.querySelectorAll('button').forEach(boton => { boton.disabled = true; });
  }

  const veredicto = acierto ? `¡Correcto! +${ganados} puntos`
    : motivo === 'tiempo' ? 'Se acabó el tiempo.'
    : motivo === 'rendido' ? 'Esta vez te rendiste.'
    : eleccion?.escrito ? `Escribiste «${eleccion.escrito}».`
    : `No era ${nombreDe(eleccion)}.`;
  nodos.registro = crear('p', { clase: 'quien-registro' });
  const siguiente = crear('button', { type: 'button', clase: 'quien-siguiente', alPulsar: nuevaPregunta },
    'Siguiente ', crear('span', { texto: '→', atributos: { 'aria-hidden': 'true' } }));
  nodos.zona.replaceChildren(crear('div', { clase: 'quien-revelacion' },
    crear('p', { clase: 'quien-veredicto', atributos: { 'data-acierto': String(acierto) } },
      crear('span', { clase: 'quien-veredicto-marca', texto: acierto ? '✓' : '✕', atributos: { 'aria-hidden': 'true' } }),
      veredicto,
      ...(record ? [crear('span', { clase: 'quien-record', texto: `✦ Nuevo récord: ${partida.mejor} seguidas` })] : [])),
    ...(desglose.length ? [crear('ul', { clase: 'quien-desglose', atributos: { 'aria-label': 'Cómo se calculan los puntos' } },
      ...desglose.map(texto => crear('li', { clase: texto.startsWith('−') ? 'resta' : '', texto })))] : []),
    nodos.registro,
    crear('div', { clase: 'quien-botones' },
      crear('button', { type: 'button', clase: 'quien-ver-ficha', alPulsar: () => buscarPokemon(String(especie.id)) },
        'Ver ficha ', crear('span', { texto: '↗', atributos: { 'aria-hidden': 'true' } })),
      siguiente,
      crear('small', { clase: 'quien-atajo', texto: 'Intro o → para seguir' }))));
  pintarRegistro(actual);
  siguiente.focus({ preventScroll: true });
}

/** Su categoría y su descripción de la Pokédex (si aún no habían llegado, se esperan). */
async function pintarRegistro(actual) {
  const nodo = nodos.registro;
  let datos = actual.datos;
  if (datos === undefined) {
    nodo.textContent = 'Leyendo su registro…';
    datos = await registroDe(actual.especie.id);
    if (pregunta !== actual) return;
  }
  const partes = [];
  if (datos?.categoria) partes.push(crear('b', { texto: datos.categoria }));
  if (datos?.descripcion) partes.push(datos.descripcion);
  nodo.replaceChildren(...partes.flatMap((parte, i) => (i ? [' · ', parte] : [parte])));
  nodo.hidden = !partes.length;
}

function teclas(evento) {
  if (seccion.hidden || !pregunta || evento.ctrlKey || evento.metaKey || evento.altKey) return;
  const dentroDe = selector => evento.target instanceof Element && evento.target.closest(selector);
  if (dentroDe('input, textarea, select') || document.querySelector('#ficha')?.open) return;
  if (!pregunta.respondida && /^[1-4]$/.test(evento.key)) {
    nodos.botones?.[Number(evento.key) - 1]?.click();
  } else if (pregunta.respondida && (evento.key === 'ArrowRight' || (evento.key === 'Enter' && !dentroDe('button, a')))) {
    evento.preventDefault();
    nuevaPregunta();
  }
}
