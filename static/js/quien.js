// «¿Quién es ese Pokémon?»: adivina el Pokémon por su silueta.
// Modos (MODOS_QUIEN en datos.js), filtro por región, pistas que restan puntos, racha y mejor racha
// (guardada en este navegador). La silueta es la ilustración oficial con filter: brightness(0); al
// responder se revela en color sobre el hábitat animado de su tipo.

import { COLOR_POR_DEFECTO, GENERACIONES, MODOS_QUIEN, rarezaDe, TIPOS } from './datos.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import { crearHabitat } from './habitats.js';
import { alAzar, barajar, crear, crearIcono, nombreLegible, normalizar, numeroPokedex, urlIlustracion } from './utilidades.js';

const seccion = document.querySelector('#quien');
const juego = document.querySelector('#quien-juego');
const selectorModos = document.querySelector('#quien-modos');
const selectorRegiones = document.querySelector('#quien-regiones');
const cifras = {
  puntos: document.querySelector('#quien-puntos'),
  racha: document.querySelector('#quien-racha'),
  mejor: document.querySelector('#quien-mejor'),
  aciertos: document.querySelector('#quien-aciertos'),
};
const CLAVE_MEJOR = 'pokedex.quien.mejor-racha';
const PUNTOS_ACIERTO = 10;
const EXTRA_EXPERTO = 5;
const COSTE_PISTA = 4;

const partida = { modo: 'clasico', region: null, puntos: 0, racha: 0, aciertos: 0, preguntas: 0, mejor: leerMejor(), usados: new Set(), siguiente: null };
let pregunta = null; // { especie, opciones, pistas, restante, respondida }
let version = 0;     // cada pregunta nueva descarta lo que siga cargando de la anterior
let reloj = null;
let nodos = {};

const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;
const regionDe = id => GENERACIONES.find(g => id >= g.desde && id <= g.hasta);
/** Para comparar lo escrito: «Mr. Mime» y «mr-mime» → «mrmime». */
const limpio = texto => normalizar(texto).replace(/[^a-z0-9]/g, '');

function leerMejor() {
  try { return Number(localStorage.getItem(CLAVE_MEJOR)) || 0; } catch { return 0; }
}
function guardarMejor() {
  try { localStorage.setItem(CLAVE_MEJOR, String(partida.mejor)); } catch { /* sin almacenamiento */ }
}

export function iniciarQuien() {
  pintarSelectores();
  pintarCifras();
  document.addEventListener('keydown', teclas);
  // La primera pregunta se prepara al abrir la vista: así no descarga imágenes si nunca se visita.
  const alMostrarse = () => { if (!seccion.hidden && !pregunta) nuevaPregunta(); };
  new MutationObserver(alMostrarse).observe(seccion, { attributes: true, attributeFilter: ['hidden'] });
  alMostrarse();
}

// --- Controles y marcador ---------------------------------------------------------------------

function pintarSelectores() {
  const chip = (texto, activo, alPulsar, detalle) => crear('button', {
    type: 'button', clase: 'quien-chip', atributos: { 'aria-pressed': String(activo) }, alPulsar,
  }, crear('strong', { texto }), ...(detalle ? [crear('small', { texto: detalle })] : []));
  selectorModos.replaceChildren(...Object.entries(MODOS_QUIEN).map(([clave, modo]) =>
    chip(modo.nombre, clave === partida.modo, () => cambiar({ modo: clave }), modo.descripcion)));
  selectorRegiones.replaceChildren(
    chip('Todas', !partida.region, () => cambiar({ region: null })),
    ...GENERACIONES.map(g => chip(g.region, partida.region === g.numero, () => cambiar({ region: g.numero }))),
    crear('button', { type: 'button', clase: 'quien-reiniciar', texto: 'Reiniciar marcador', alPulsar: reiniciar }));
}

function cambiar(ajustes) {
  Object.assign(partida, ajustes);
  partida.siguiente = null;
  pintarSelectores();
  nuevaPregunta();
}

function reiniciar() {
  Object.assign(partida, { puntos: 0, racha: 0, aciertos: 0, preguntas: 0 });
  partida.usados.clear();
  pintarCifras();
  nuevaPregunta();
}

function pintarCifras() {
  cifras.puntos.textContent = partida.puntos;
  cifras.racha.textContent = partida.racha;
  cifras.mejor.textContent = partida.mejor;
  cifras.aciertos.textContent = `${partida.aciertos}/${partida.preguntas}`;
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

async function nuevaPregunta() {
  const vigente = ++version;
  pararReloj();
  pregunta = null;
  juego.replaceChildren(crear('div', { clase: 'quien-tablero cargando' },
    crear('div', { clase: 'quien-escenario' }, crear('span', { clase: 'quien-rayos', atributos: { 'aria-hidden': 'true' } })),
    crear('div', { clase: 'quien-panel' }, crear('p', { clase: 'quien-espera', texto: 'Buscando un Pokémon misterioso…' }))));
  let especies;
  try { especies = await cargarEspecies(); } catch {
    if (vigente === version) juego.replaceChildren(crear('p', { clase: 'quien-error', texto: 'No se pudo cargar la lista de Pokémon. Comprueba que el servidor está abierto.' }));
    return;
  }
  if (vigente !== version) return;
  const gen = GENERACIONES.find(g => g.numero === partida.region);
  const grupo = especies.filter(e => !gen || (e.id >= gen.desde && e.id <= gen.hasta));
  if (grupo.every(e => partida.usados.has(e.id))) grupo.forEach(e => partida.usados.delete(e.id)); // ya salieron todos

  // Hasta 4 intentos por si alguna ilustración no se puede descargar.
  for (let intento = 0; intento < 4; intento++) {
    const libres = grupo.filter(e => !partida.usados.has(e.id));
    const especie = libres.find(e => e.id === partida.siguiente) || alAzar(libres);
    if (!especie) break;
    partida.usados.add(especie.id);
    const lista = await precargar(urlIlustracion(especie.id));
    if (vigente !== version) return;
    if (lista) {
      mostrarPregunta(especie, grupo);
      // Deja preparada la imagen de la siguiente para que aparezca al instante.
      const proxima = alAzar(grupo.filter(e => !partida.usados.has(e.id)));
      partida.siguiente = proxima?.id ?? null;
      if (proxima) precargar(urlIlustracion(proxima.id));
      return;
    }
  }
  juego.replaceChildren(crear('p', { clase: 'quien-error', texto: 'No se pudieron descargar las imágenes. Comprueba tu conexión a internet.' }));
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
  pregunta = { especie, pistas: 0, restante: modo.tiempo, respondida: false, opciones: modo.opciones ? crearOpciones(especie, grupo, modo.opciones) : [] };

  nodos = {};
  nodos.habitat = crear('div', { clase: 'quien-habitat', atributos: { 'aria-hidden': 'true' } });
  nodos.silueta = crear('img', { clase: 'quien-silueta', src: urlIlustracion(especie.id), alt: 'Silueta de un Pokémon misterioso', draggable: false });
  nodos.escenario = crear('div', { clase: 'quien-escenario' },
    crear('span', { clase: 'quien-rayos', atributos: { 'aria-hidden': 'true' } }),
    nodos.habitat,
    crear('span', { clase: 'quien-interrogantes', atributos: { 'aria-hidden': 'true' } }, crear('i', { texto: '?' }), crear('i', { texto: '?' }), crear('i', { texto: '?' })),
    nodos.silueta,
    crear('span', { clase: 'quien-numero', texto: `Pregunta ${partida.preguntas + 1}` }));

  nodos.respuestas = crear('div', { clase: 'quien-respuestas' });
  if (modo.opciones) {
    nodos.botones = pregunta.opciones.map((opcion, i) => crear('button', {
      type: 'button', clase: 'quien-opcion',
      alPulsar: () => responder(opcion.id === especie.id, opcion),
    }, crear('kbd', { texto: String(i + 1) }), crear('span', { texto: nombreLegible(opcion.nombre) })));
    nodos.respuestas.append(...nodos.botones);
  } else {
    const campo = crear('input', { type: 'text', clase: 'quien-campo', placeholder: 'Escribe su nombre…', autocomplete: 'off', spellcheck: false, atributos: { 'aria-label': 'Nombre del Pokémon' } });
    nodos.campo = campo;
    nodos.respuestas.append(crear('form', { clase: 'quien-formulario' },
      campo,
      crear('button', { type: 'submit', clase: 'quien-responder', texto: 'Responder' }),
      crear('button', { type: 'button', clase: 'quien-rendirse', texto: 'Me rindo', alPulsar: () => responder(false, null, 'rendido') })));
    nodos.respuestas.querySelector('form').addEventListener('submit', evento => {
      evento.preventDefault();
      if (!campo.value.trim()) return campo.focus();
      responder(nombreCoincide(campo.value, especie.nombre), { escrito: campo.value.trim() });
    });
  }

  nodos.listaPistas = crear('ul', { clase: 'quien-lista-pistas' });
  nodos.botonPista = crear('button', { type: 'button', clase: 'quien-pista', alPulsar: darPista });
  nodos.pistas = crear('div', { clase: 'quien-pistas' }, nodos.botonPista, nodos.listaPistas);
  nodos.resultado = crear('div', { clase: 'quien-resultado', atributos: { 'aria-live': 'polite' } });
  nodos.reloj = crear('div', { clase: 'quien-reloj', hidden: !modo.tiempo, atributos: { 'aria-hidden': 'true' } }, crear('i'), nodos.segundos = crear('span', { texto: modo.tiempo + ' s' }));

  juego.replaceChildren(crear('div', { clase: 'quien-tablero' },
    nodos.escenario,
    crear('div', { clase: 'quien-panel' },
      nodos.reloj,
      crear('span', { clase: 'quien-etiqueta', texto: `${modo.nombre}${partida.region ? ' · ' + regionDe(especie.id).region : ''}` }),
      crear('h3', { texto: '¿Quién es ese Pokémon?' }),
      nodos.respuestas,
      nodos.pistas,
      nodos.resultado)));
  pintarBotonPista();
  arrancarReloj();
  if (nodos.campo && !seccion.hidden) nodos.campo.focus({ preventScroll: true });
}

/** Acepta mayúsculas, tildes, espacios y signos distintos, y una letra de error en nombres largos. */
function nombreCoincide(escrito, nombre) {
  const a = limpio(escrito);
  const b = limpio(nombre);
  return a === b || (b.length >= 6 && distancia(a, b) <= 1);
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

// --- Pistas y tiempo ------------------------------------------------------------------------------

function pistasDe(especie) {
  const gen = regionDe(especie.id);
  const decena = Math.floor((especie.id - 1) / 20) * 20 + 1;
  return [
    `Es de tipo ${especie.tipos.map(t => TIPOS[t]?.nombre || t).join(' y ')}.`,
    partida.region
      ? `Su número en la Pokédex está entre el ${decena} y el ${decena + 19}.`
      : `Es de la región de ${gen.region} (generación ${gen.numero}).`,
    `Su nombre empieza por «${especie.nombre[0].toUpperCase()}» y tiene ${limpio(especie.nombre).length} letras.`,
  ];
}

function darPista() {
  if (!pregunta || pregunta.respondida) return;
  const pistas = pistasDe(pregunta.especie);
  if (pregunta.pistas >= pistas.length) return;
  nodos.listaPistas.append(crear('li', { texto: pistas[pregunta.pistas] }));
  pregunta.pistas++;
  pintarBotonPista();
}

function pintarBotonPista() {
  const quedan = pistasDe(pregunta.especie).length - pregunta.pistas;
  nodos.botonPista.disabled = !quedan;
  nodos.botonPista.textContent = quedan ? `Pedir pista (−${COSTE_PISTA} puntos) · quedan ${quedan}` : 'No quedan pistas';
}

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
    nodos.reloj.style.setProperty('--restante', (pregunta.restante / tiempo).toFixed(3));
    nodos.reloj.dataset.urgente = String(pregunta.restante <= 3);
    nodos.segundos.textContent = Math.ceil(pregunta.restante) + ' s';
    if (pregunta.restante === 0) responder(false, null, 'tiempo');
  }, 100);
}

function pararReloj() {
  clearInterval(reloj);
  reloj = null;
}

// --- Respuesta y revelación --------------------------------------------------------------------------

/**
 * @param {boolean} acierto
 * @param {object|null} eleccion  la opción pulsada ({ id, nombre }) o { escrito } en modo Experto
 * @param {string} [motivo]       'tiempo' o 'rendido' cuando no hubo respuesta
 */
function responder(acierto, eleccion, motivo = '') {
  if (!pregunta || pregunta.respondida) return;
  pregunta.respondida = true;
  pararReloj();
  const modo = MODOS_QUIEN[partida.modo];
  let ganados = 0;
  partida.preguntas++;
  if (acierto) {
    ganados = Math.max(2, PUNTOS_ACIERTO
      + (modo.tiempo ? Math.ceil(pregunta.restante) : 0)
      + (modo.opciones ? 0 : EXTRA_EXPERTO)
      - pregunta.pistas * COSTE_PISTA);
    partida.puntos += ganados;
    partida.aciertos++;
    partida.racha++;
    if (partida.racha > partida.mejor) { partida.mejor = partida.racha; guardarMejor(); }
  } else {
    partida.racha = 0;
  }
  pintarCifras();
  revelar(acierto, ganados, eleccion, motivo);
}

function revelar(acierto, ganados, eleccion, motivo) {
  const { especie } = pregunta;
  const nombre = nombreLegible(especie.nombre);
  const gen = regionDe(especie.id);
  nodos.habitat.replaceChildren(crearHabitat({ tipo: especie.tipos[0], rareza: rarezaDe(especie.id), semilla: especie.id % 97 }));
  nodos.escenario.classList.add('revelado', acierto ? 'acierto' : 'fallo');
  nodos.silueta.alt = 'Ilustración de ' + nombre;
  nodos.pistas.hidden = true;
  nodos.botones?.forEach((boton, i) => {
    boton.disabled = true;
    const opcion = pregunta.opciones[i];
    if (opcion.id === especie.id) boton.dataset.resultado = 'correcta';
    else if (opcion === eleccion) boton.dataset.resultado = 'elegida';
  });
  if (nodos.campo) nodos.campo.disabled = true;
  nodos.respuestas.querySelectorAll('.quien-formulario button').forEach(boton => { boton.disabled = true; });

  const veredicto = acierto
    ? `¡Correcto! +${ganados} puntos${partida.racha >= 3 ? ` · ✦ racha de ${partida.racha}` : ''}`
    : motivo === 'tiempo' ? '¡Se acabó el tiempo!' : motivo === 'rendido' ? 'Era…' : eleccion?.escrito ? `Escribiste «${eleccion.escrito}». Era…` : '¡Casi! Era…';
  const siguiente = crear('button', { type: 'button', clase: 'quien-siguiente', alPulsar: nuevaPregunta }, 'Siguiente ', crear('span', { texto: '→', atributos: { 'aria-hidden': 'true' } }));
  nodos.resultado.dataset.acierto = String(acierto);
  nodos.resultado.replaceChildren(
    crear('strong', { clase: 'quien-veredicto', texto: veredicto }),
    crear('span', { clase: 'quien-nombre', texto: nombre }),
    crear('small', { texto: `N.º ${numeroPokedex(especie.id)} · ${gen.region} (generación ${gen.numero})` }),
    crear('span', { clase: 'quien-tipos' }, ...especie.tipos.map(tipo =>
      crear('span', { estilos: { '--color-tipo': colorDe(tipo) } }, crearIcono(TIPOS[tipo]?.icono || ''), TIPOS[tipo]?.nombre || tipo))),
    crear('div', { clase: 'quien-botones' },
      crear('button', { type: 'button', clase: 'quien-ver-ficha', texto: 'Ver ficha ↗', alPulsar: () => buscarPokemon(String(especie.id)) }),
      siguiente),
    crear('small', { clase: 'quien-atajo', texto: 'Atajo: Intro o → para la siguiente' }));
  siguiente.focus({ preventScroll: true });
}

function teclas(evento) {
  if (seccion.hidden || !pregunta || evento.ctrlKey || evento.metaKey || evento.altKey) return;
  const dentroDe = selector => evento.target instanceof Element && evento.target.closest(selector);
  if (dentroDe('input, textarea, select') || document.querySelector('#ficha')?.open) return;
  if (!pregunta.respondida && /^[1-4]$/.test(evento.key)) {
    nodos.botones?.[Number(evento.key) - 1]?.click();
  } else if (pregunta.respondida && (evento.key === 'ArrowRight' || (evento.key === 'Enter' && !dentroDe('button')))) {
    evento.preventDefault();
    nuevaPregunta();
  }
}
