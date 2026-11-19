// Vista «Categorías»: la rueda de los tipos y la tabla de efectividad.
//
// Los 18 tipos forman un círculo de medallones, cada uno siempre en su sitio. El tipo ELEGIDO vuela al centro
// (un portal con su hábitat animado, js/habitats.js, su símbolo y su nombre) y en el círculo queda su hueco;
// el que estaba en el centro vuelve volando a su sitio. Del centro salen radios:
//   - lima hacia los tipos contra los que es fuerte (sus ataques les hacen ×2);
//   - rojos desde los tipos que lo vencen (le hacen ×2 a él);
//   una chispa recorre cada radio del que ataca al que recibe. Al pasar por un medallón, su title lo explica.
// Además, el perfil de al lado cuenta su lema (PERFILES_TIPOS), cómo le va al atacar y al defenderse, sus
// Pokémon más conocidos (animados) y cuántas especies tiene, con un botón para verlas en la Pokédex; la luz del
// fondo continuo (js/mundo.js) toma su color, y la tabla 18×18 resalta su fila y su columna.
// Se elige pulsando un medallón, un tipo del perfil o de la tabla, o con las flechas del teclado en la rueda.

import { PERFILES_TIPOS, TIPOS } from './datos.js';
import { multiplicador } from './efectividad.js';
import { crearHabitat } from './habitats.js';
import { mostrarTipo } from './catalogo.js';
import { cargarEspecies } from './especies.js';
import { buscarPokemon } from './ficha.js';
import { ponerLuz } from './mundo.js';
import { alAzar, crear, crearIcono, urlAnimado, urlSprite } from './utilidades.js';

const CLAVES = Object.keys(TIPOS);
const RADIO = 42;            // dónde van los medallones, en % del lado de la rueda (el SVG mide 100×100)
const RADIO_PORTAL = 21.5;   // el portal mide el 40 % (inset 30 % en categorias.css): los radios salen de su borde…
const HUECO_MEDALLON = 5.4;  // …y acaban antes de tocar el medallón (y su anillo)
const FUNDIDO_MS = 600;      // debe coincidir con la transición de .rueda-habitat en categorias.css
const VUELO_MS = 700;        // lo que tarda un medallón en ir al centro o volver a su sitio
const SIMBOLO_MULTIPLICADOR = { 2: '2', 0.5: '½', 0: '0' };
const CLASE_MULTIPLICADOR = { 2: 'x2', 0.5: 'x05', 0: 'x0' };
const SVG = 'http://www.w3.org/2000/svg';

const seccion = document.querySelector('#categorias');
const rueda = document.querySelector('#rueda-tipos');
const perfil = document.querySelector('#tipo-perfil');
const tabla = document.querySelector('#tabla-tipos');
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
let elegido = null;
let especiesPorTipo = null; // { fire: 81, … } cuando llega la lista de especies
let medallones = {};
let lineas, portal, simbolo, nombreCentro;

/** Posición de cada tipo en la rueda (0–100): el primero arriba y después en el sentido de las agujas del reloj. */
const posicion = indice => {
  const angulo = (indice / CLAVES.length) * 2 * Math.PI - Math.PI / 2;
  return { x: 50 + RADIO * Math.cos(angulo), y: 50 + RADIO * Math.sin(angulo) };
};

/** Con quién se relaciona un tipo: al atacar (cuánto daño hacen sus ataques) y al defenderse (cuánto recibe). */
function relacionesDe(clave) {
  const filtrar = (valor, deAtaque) => CLAVES.filter(otro => (deAtaque ? multiplicador(clave, otro) : multiplicador(otro, clave)) === valor);
  return {
    ataque: { 2: filtrar(2, true), 0.5: filtrar(0.5, true), 0: filtrar(0, true) },
    defensa: { 2: filtrar(2, false), 0.5: filtrar(0.5, false), 0: filtrar(0, false) },
  };
}

// --- La rueda --------------------------------------------------------------------------------------

function crearRueda() {
  lineas = document.createElementNS(SVG, 'svg');
  lineas.setAttribute('class', 'rueda-lineas');
  lineas.setAttribute('viewBox', '0 0 100 100');
  lineas.setAttribute('aria-hidden', 'true');
  simbolo = crear('span', { clase: 'rueda-simbolo' });
  nombreCentro = crear('span', { clase: 'rueda-nombre' });
  portal = crear('div', { clase: 'rueda-portal', atributos: { 'aria-hidden': 'true' } }, simbolo, nombreCentro);

  medallones = Object.fromEntries(CLAVES.map((clave, indice) => {
    const { x, y } = posicion(indice);
    const tipo = TIPOS[clave];
    return [clave, crear('button', {
      type: 'button', clase: 'rueda-tipo',
      atributos: { 'data-tipo': clave, 'aria-pressed': 'false' },
      // --ux/--uy: hacia dónde queda «fuera» (el nombre se pone por fuera, donde no lo cruza ningún radio).
      estilos: { '--x': x.toFixed(2), '--y': y.toFixed(2), '--ux': ((x - 50) / RADIO).toFixed(3), '--uy': ((y - 50) / RADIO).toFixed(3), '--color-tipo': tipo.color },
      alPulsar: () => elegir(clave),
    }, crear('span', { clase: 'rueda-medallon' }, crearIcono(tipo.icono)), crear('small', { texto: tipo.nombre }))];
  }));

  rueda.append(crear('span', { clase: 'rueda-orbita', atributos: { 'aria-hidden': 'true' } }), lineas, portal, ...Object.values(medallones));

  // Flechas: el tipo siguiente o el anterior de la rueda (y el foco va con él).
  rueda.addEventListener('keydown', evento => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evento.key];
    if (!paso) return;
    evento.preventDefault();
    const siguiente = CLAVES[(CLAVES.indexOf(elegido) + paso + CLAVES.length) % CLAVES.length];
    elegir(siguiente);
    medallones[siguiente].focus();
  });
}

/** Un radio entre el centro y un tipo del círculo, del que ataca al que recibe (con su chispa). */
function linea(otro, clase, orden) {
  const { x, y } = posicion(CLAVES.indexOf(otro));
  const ux = (x - 50) / RADIO, uy = (y - 50) / RADIO; // dirección del centro hacia ese tipo
  const punto = r => `${(50 + ux * r).toFixed(2)} ${(50 + uy * r).toFixed(2)}`;
  const [desde, hasta] = clase === 'fuerte' ? [RADIO_PORTAL, RADIO - HUECO_MEDALLON] : [RADIO - HUECO_MEDALLON, RADIO_PORTAL];
  const d = `M${punto(desde)} L${punto(hasta)}`;
  const camino = document.createElementNS(SVG, 'path');
  camino.setAttribute('d', d);
  camino.setAttribute('pathLength', '1');
  camino.setAttribute('class', 'rueda-linea ' + clase);
  camino.style.setProperty('--n', orden);
  const grupo = document.createElementNS(SVG, 'g');
  grupo.append(camino);
  if (!movimientoReducido.matches) {
    const luz = document.createElementNS(SVG, 'circle');
    luz.setAttribute('r', '0.9');
    luz.setAttribute('class', 'rueda-chispa ' + clase);
    const viaje = document.createElementNS(SVG, 'animateMotion');
    viaje.setAttribute('dur', '1.8s');
    viaje.setAttribute('begin', `${0.8 + orden * 0.15}s`);
    viaje.setAttribute('repeatCount', 'indefinite');
    viaje.setAttribute('path', d);
    luz.append(viaje);
    grupo.append(luz);
  }
  return grupo;
}

function pintarRueda(clave, relaciones) {
  const nombre = TIPOS[clave].nombre;
  for (const [otro, boton] of Object.entries(medallones)) {
    const suyo = TIPOS[otro].nombre;
    const fuerte = otro !== clave && relaciones.ataque[2].includes(otro);
    const debil = otro !== clave && relaciones.defensa[2].includes(otro);
    boton.setAttribute('aria-pressed', String(otro === clave));
    boton.tabIndex = otro === clave ? 0 : -1; // una sola parada de tabulador: las flechas recorren la rueda
    boton.dataset.relacion = fuerte && debil ? 'ambas' : fuerte ? 'fuerte' : debil ? 'debil' : '';
    // Lo que se lee al pasar el ratón (y lo que oye un lector de pantalla).
    const explicacion = fuerte && debil ? `${nombre} le hace ×2 y ${suyo} también a ${nombre}`
      : fuerte ? `${nombre} le hace ×2` : debil ? `le hace ×2 a ${nombre}` : `ni fuerte ni débil ante ${nombre}`;
    boton.title = otro === clave ? `${suyo}: está en el centro` : `${suyo}: ${explicacion}. Pulsa para llevarlo al centro`;
    boton.setAttribute('aria-label', boton.title);
  }
  const fuertes = relaciones.ataque[2].filter(otro => otro !== clave);
  const debiles = relaciones.defensa[2].filter(otro => otro !== clave);
  lineas.replaceChildren(
    ...fuertes.map((otro, i) => linea(otro, 'fuerte', i)),
    ...debiles.map((otro, i) => linea(otro, 'debil', fuertes.length + i)),
  );
  document.querySelector('#leyenda-fuerte').textContent = `${nombre} es fuerte contra`;
  document.querySelector('#leyenda-debil').textContent = `${nombre} es débil ante`;
}

/** El hábitat del tipo en el portal, con un fundido sobre el anterior. */
function pintarPortal(clave) {
  const nuevo = crearHabitat({ tipo: clave, semilla: CLAVES.indexOf(clave), clase: 'rueda-habitat' });
  const anteriores = [...portal.querySelectorAll('.rueda-habitat')];
  portal.prepend(nuevo);
  requestAnimationFrame(() => requestAnimationFrame(() => nuevo.classList.add('visible')));
  anteriores.forEach(viejo => { viejo.classList.remove('visible'); setTimeout(() => viejo.remove(), FUNDIDO_MS); });
}

/** El símbolo y el nombre del tipo en el centro del portal. */
function pintarCentro(clave) {
  simbolo.style.setProperty('--color-tipo', TIPOS[clave].color);
  simbolo.replaceChildren(crearIcono(TIPOS[clave].icono));
  nombreCentro.textContent = TIPOS[clave].nombre;
  portal.classList.remove('esperando');
}

/**
 * Un medallón que vuela de una caja a otra (del círculo al centro o al revés). Es una copia que se mueve por
 * encima de todo y desaparece al llegar; las cajas se miden ANTES de cambiar nada.
 */
function volar(clave, desde, hasta, alLlegar) {
  const base = rueda.getBoundingClientRect();
  const tipo = TIPOS[clave];
  const copia = crear('span', { clase: 'rueda-viajero', estilos: { '--color-tipo': tipo.color }, atributos: { 'aria-hidden': 'true' } }, crearIcono(tipo.icono));
  rueda.append(copia);
  // La copia mide 100 px: se coloca con su centro sobre el de la caja y se escala a su tamaño.
  const marco = caja => `translate(${(caja.left - base.left + caja.width / 2 - 50).toFixed(1)}px, ${(caja.top - base.top + caja.height / 2 - 50).toFixed(1)}px) scale(${(caja.width / 100).toFixed(3)})`;
  copia.animate([{ transform: marco(desde) }, { transform: marco(hasta) }], { duration: VUELO_MS, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' })
    .finished.then(() => { copia.remove(); alLlegar(); });
}

// --- El perfil -------------------------------------------------------------------------------------

/** Círculo pequeño con el color e icono de un tipo; si se puede pulsar, elige ese tipo. */
function crearMiniTipo(clave, pulsable = false) {
  const tipo = TIPOS[clave];
  const opciones = { clase: 'mini-tipo', title: tipo.nombre, estilos: { '--color-tipo': tipo.color } };
  return pulsable
    ? crear('button', { ...opciones, type: 'button', atributos: { 'aria-label': `Ver el tipo ${tipo.nombre}` }, alPulsar: () => elegir(clave) }, crearIcono(tipo.icono))
    : crear('span', opciones, crearIcono(tipo.icono));
}

/** Una fila del perfil. «tono» dice si es bueno o malo para este tipo (×2 al atacar es bueno; al defenderse, malo). */
function filaRelacion(valor, texto, tipos, tono) {
  return crear('div', { clase: 'perfil-fila' },
    crear('dt', {}, crear('b', { clase: 'perfil-' + tono, texto: '×' + SIMBOLO_MULTIPLICADOR[valor] }), texto),
    crear('dd', {}, ...(tipos.length ? tipos.map(t => crearMiniTipo(t, true)) : [crear('em', { texto: 'Ninguno' })])));
}

function grupoRelaciones(titulo, filas) {
  return crear('section', { clase: 'perfil-grupo' }, crear('h4', { texto: titulo }),
    crear('dl', {}, ...filas.filter(([valor, , tipos]) => valor !== 0 || tipos.length).map(fila => filaRelacion(...fila))));
}

function textoBoton(clave) {
  const nombre = TIPOS[clave].nombre;
  return especiesPorTipo ? `Ver los ${especiesPorTipo[clave]} Pokémon de tipo ${nombre}` : `Ver los Pokémon de tipo ${nombre}`;
}

function pintarPerfil(clave, relaciones) {
  const tipo = TIPOS[clave];
  const { lema, representantes } = PERFILES_TIPOS[clave];
  const { ataque, defensa } = relaciones;
  perfil.style.setProperty('--color-tipo', tipo.color);
  perfil.replaceChildren(
    crear('div', { clase: 'perfil-cabecera' },
      crear('span', { clase: 'perfil-numero', texto: `Tipo ${String(CLAVES.indexOf(clave) + 1).padStart(2, '0')} de 18` }),
      crear('h3', { texto: tipo.nombre }),
      crear('p', { clase: 'perfil-lema', texto: lema })),
    crear('div', { clase: 'perfil-relaciones' },
      grupoRelaciones('Al atacar', [[2, 'Muy eficaz contra', ataque[2], 'bueno'], [0.5, 'Poco eficaz contra', ataque[0.5], 'malo'], [0, 'No afecta a', ataque[0], 'malo']]),
      grupoRelaciones('Al defenderse', [[2, 'Débil ante', defensa[2], 'malo'], [0.5, 'Resiste', defensa[0.5], 'bueno'], [0, 'Inmune a', defensa[0], 'bueno']])),
    crear('div', { clase: 'perfil-pokemon' },
      crear('h4', { texto: 'Pokémon conocidos' }),
      crear('div', { clase: 'perfil-pokemon-lista' }, ...representantes.map(([id, nombre]) => {
        const imagen = crear('img', { src: urlAnimado(id), alt: '', loading: 'lazy' });
        imagen.addEventListener('error', () => { imagen.src = urlSprite(id); }, { once: true });
        return crear('button', { type: 'button', clase: 'perfil-pokemon-boton', title: `Ver la ficha de ${nombre}`, alPulsar: () => buscarPokemon(String(id)) },
          crear('span', { clase: 'perfil-pokemon-foto' }, imagen), crear('span', { texto: nombre }));
      }))),
    crear('button', { type: 'button', clase: 'perfil-ver', alPulsar: () => mostrarTipo(clave) },
      crear('span', { clase: 'perfil-ver-texto', texto: textoBoton(clave) }), crear('span', { texto: '→', atributos: { 'aria-hidden': 'true' } })),
  );
}

// --- Elegir un tipo --------------------------------------------------------------------------------

function elegir(clave) {
  if (clave === elegido || !TIPOS[clave]) return;
  const anterior = elegido;
  elegido = clave;
  const relaciones = relacionesDe(clave);
  const color = TIPOS[clave].color;
  // Los medallones vuelan entre el círculo y el centro: se miden antes de cambiar nada.
  const vuela = anterior && !movimientoReducido.matches;
  const cajaNueva = medallones[clave].getBoundingClientRect();
  const cajaVieja = anterior && medallones[anterior].getBoundingClientRect();
  const cajaCentro = simbolo.getBoundingClientRect();

  seccion.style.setProperty('--tipo-elegido', color);
  ponerLuz(seccion, color, color);
  pintarRueda(clave, relaciones);
  pintarPortal(clave);
  marcarTabla(clave);
  if (vuela) {
    portal.classList.add('esperando'); // el símbolo y el nombre se ocultan hasta que llega el nuevo
    const boton = medallones[anterior];
    boton.classList.add('volviendo');   // su medallón no se ve hasta que la copia llega a su sitio
    volar(anterior, cajaCentro, cajaVieja, () => boton.classList.remove('volviendo'));
    volar(clave, cajaNueva, cajaCentro, () => { if (elegido === clave) pintarCentro(clave); });
  } else pintarCentro(clave);

  if (!anterior) { pintarPerfil(clave, relaciones); return; }
  perfil.classList.add('cambiando');
  setTimeout(() => {
    if (elegido !== clave) return; // ya se eligió otro
    pintarPerfil(clave, relaciones);
    perfil.classList.remove('cambiando');
  }, 220);
}

// --- La tabla 18×18 --------------------------------------------------------------------------------

function crearTablaTipos() {
  const cabecera = crear('tr', {},
    crear('th', { clase: 'tabla-esquina', atributos: { scope: 'col' } }, crear('span', { texto: 'Ataque ↓' }), crear('span', { texto: 'Defensa →' })),
    ...CLAVES.map(clave => crear('th', { atributos: { scope: 'col', title: 'Defensa: ' + TIPOS[clave].nombre } },
      crearMiniTipo(clave, true), crear('span', { clase: 'solo-lectores', texto: TIPOS[clave].nombre }))),
  );
  const filas = CLAVES.map(ataque => crear('tr', { atributos: { 'data-tipo': ataque } },
    crear('th', { atributos: { scope: 'row' } },
      crear('button', { type: 'button', clase: 'tabla-tipo', estilos: { '--color-tipo': TIPOS[ataque].color }, alPulsar: () => elegir(ataque) },
        crearMiniTipo(ataque), TIPOS[ataque].nombre)),
    ...CLAVES.map(defensa => {
      const valor = multiplicador(ataque, defensa);
      return crear('td', {
        clase: CLASE_MULTIPLICADOR[valor] || '',
        texto: SIMBOLO_MULTIPLICADOR[valor] || '',
        title: `${TIPOS[ataque].nombre} contra ${TIPOS[defensa].nombre}: ×${valor === 0.5 ? '½' : valor}`,
      });
    }),
  ));
  tabla.append(
    crear('caption', { clase: 'solo-lectores', texto: 'Multiplicador de daño de cada tipo de ataque (filas) contra cada tipo de defensa (columnas).' }),
    crear('thead', {}, cabecera),
    crear('tbody', {}, ...filas),
  );

  // Resaltar la columna bajo el cursor (la fila la resalta el CSS).
  let columna = -1;
  const marcar = indice => {
    if (indice === columna) return;
    for (const fila of tabla.rows) {
      fila.cells[columna]?.classList.remove('columna-activa');
      if (indice > 0) fila.cells[indice]?.classList.add('columna-activa');
    }
    columna = indice;
  };
  tabla.addEventListener('pointerover', evento => marcar(evento.target.closest('td, th')?.cellIndex ?? -1));
  tabla.addEventListener('pointerleave', () => marcar(-1));
}

/** La fila (sus ataques) y la columna (lo que recibe) del tipo elegido. */
function marcarTabla(clave) {
  const indice = CLAVES.indexOf(clave) + 1; // la columna 0 es la de los nombres
  for (const fila of tabla.rows) {
    fila.classList.toggle('fila-elegida', fila.dataset.tipo === clave);
    [...fila.cells].forEach((celda, i) => celda.classList.toggle('columna-elegida', i === indice));
  }
}

export function iniciarCategorias() {
  crearRueda();
  crearTablaTipos();
  elegir(alAzar(CLAVES)); // cada visita empieza por un tipo distinto
  cargarEspecies().then(lista => {
    especiesPorTipo = Object.fromEntries(CLAVES.map(clave => [clave, lista.filter(e => e.tipos.includes(clave)).length]));
    const texto = perfil.querySelector('.perfil-ver-texto');
    if (texto && elegido) texto.textContent = textoBoton(elegido);
  }).catch(() => { /* sin la lista, el botón no dice cuántos son */ });
}
