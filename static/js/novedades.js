// Inicio, «Ahora también puedes combatir»: presenta el Duelo Pokémon (lo nuevo, tu equipo, tu récord y las
// seis arenas) con un combate de muestra EN VIVO: dos Pokémon se atacan con sus movimientos reales
// (combate.js) en la arena pixelada (arena-pixel.js), y en cada ronda cambian la pareja y el escenario.
//
// La muestra no descarga nada hasta que la sección aparece en pantalla, y solo se mueve mientras se ve
// (IntersectionObserver + vista Inicio + pestaña visible): si no, el bucle de dibujo se pausa. Con
// movimiento reducido se queda quieta (la primera pareja en la primera arena).

import { ESCENARIOS, rarezaDe, TIPOS } from './datos.js';
import { crearArenaPixel, dibujarVistaPrevia } from './arena-pixel.js';
import { calcularDanio, crearLuchador, otroLado } from './combate.js';
import { elegirEscenario } from './duelo.js';
import { detallesDe, miLista } from './mi-equipo.js';
import { leerRecord } from './simulacro.js';
import { alAzar, crear, crearIcono, nombreTitulo, urlSprite } from './utilidades.js';

const seccion = document.querySelector('#novedades');
const inicio = document.querySelector('#inicio'); // la vista entera: es la que se oculta al cambiar de vista
const lienzo = document.querySelector('#novedades-lienzo');
const rotulo = document.querySelector('#novedades-rotulo');
const nombreArena = document.querySelector('#novedades-arena-nombre');
const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');

// Parejas de la muestra: duelos que se reconocen (del anime y de los juegos).
const PAREJAS = [[658, 6], [25, 448], [94, 149], [445, 248], [3, 9], [887, 282], [130, 26], [257, 260], [384, 382], [700, 609]];
const ICONOS = {
  movimientos: 'M13 2 4 14h7l-1 8 9-12h-7z',
  evolucion: 'M12 3v18 M5 10l7-7 7 7 M5 17l7-7 7 7',
  rivales: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M2 20c0-3 3-5 6-5s6 2 6 5 M17 11a2.5 2.5 0 1 0 0-5 M16 15c3 0 6 2 6 5',
  modos: 'M4 4h7v7H4z M13 13h7v7h-7z M13 4h7v7h-7z M4 13h7v7H4z',
};
// Las seis arenas no van en la lista: se ven debajo, y pulsar una abre el Duelo con ella.
const NOVEDADES = [
  ['movimientos', '4 movimientos reales', 'Los que aprende en los juegos: 479 distintos, cada uno con su animación.'],
  ['evolucion', 'Evoluciona en plena batalla', 'Llena la barra de energía y evoluciona sin perder el turno… o megaevoluciona.'],
  ['rivales', 'Rivales que piensan', 'Entrenadores con nombre que hablan y buscan la ventaja de tipo.'],
  ['modos', 'Dos formas de jugar', 'Equipo contra equipo, o uno contra uno con tu luchador favorito.'],
];

let arena = null;
let enPantalla = false;
let visible = false;
let empezada = false;
const esperando = [];
const pausa = ms => new Promise(listo => setTimeout(listo, ms));
/** Se cumple cuando la muestra vuelve a verse (o ya, si se ve). */
const hastaVisible = () => (visible ? Promise.resolve() : new Promise(listo => esperando.push(listo)));

export function iniciarNovedades() {
  pintarNovedades();
  pintarArenas();
  pintarEquipo();
  document.addEventListener('equipo-cambiado', pintarEquipo);
  document.addEventListener('batalla-terminada', pintarEquipo);
  new IntersectionObserver(([entrada]) => { enPantalla = entrada.isIntersecting; actualizarVisibilidad(); }, { threshold: 0.15 }).observe(lienzo);
  new MutationObserver(actualizarVisibilidad).observe(inicio, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', actualizarVisibilidad);
}

function actualizarVisibilidad() {
  const ahora = enPantalla && !inicio.hidden && !document.hidden;
  if (ahora === visible) return;
  visible = ahora;
  arena?.pausar(!visible);
  if (!visible) return;
  esperando.splice(0).forEach(listo => listo());
  if (!empezada) { empezada = true; muestra(); }
}

// --- La muestra en vivo -------------------------------------------------------------------------

/** Lo que necesita la arena para dibujar a un Pokémon. */
const modelo = d => ({ clave: d.id, animados: d.animados, sprite: d.sprite, imagen: d.imagen, altura: d.altura, rareza: rarezaDe(d.especie) });

async function muestra() {
  const escenarios = Object.keys(ESCENARIOS);
  for (let ronda = 0; ; ronda++) {
    await hastaVisible();
    const escenario = escenarios[ronda % escenarios.length];
    const [a, b] = PAREJAS[ronda % PAREJAS.length];
    try {
      const [da, db] = await Promise.all([detallesDe(a), detallesDe(b)]);
      await hastaVisible();
      arena?.detener();
      arena = crearArenaPixel(lienzo, { escenario });
      seccion.dataset.escenario = escenario;
      nombreArena.textContent = ESCENARIOS[escenario].nombre;
      anunciar(`${nombreTitulo(da.nombre)} contra ${nombreTitulo(db.nombre)}`);
      arena.transicion();
      const quieta = movimientoReducido.matches;
      await arena.poner('jugador', modelo(da), { entrada: !quieta });
      await arena.poner('rival', modelo(db), { entrada: !quieta });
      if (quieta) return; // con movimiento reducido, una sola escena quieta
      await pausa(700);
      const luchadores = { jugador: crearLuchador(da, 2), rival: crearLuchador(db, 2) };
      for (let turno = 0; turno < 4; turno++) {
        await hastaVisible();
        const lado = turno % 2 ? 'rival' : 'jugador';
        const yo = luchadores[lado];
        const el = luchadores[otroLado(lado)];
        const ataque = alAzar(yo.movimientos);
        anunciar(`${nombreTitulo(yo.nombre)} usa ${ataque.nombre}`, TIPOS[ataque.tipo]?.color);
        arena.rotulo(lado, ataque.nombre, TIPOS[ataque.tipo]?.color);
        if (ataque.carga) await arena.preparar(lado, ataque.carga, ataque.tipo);
        await arena.atacar(lado, ataque);
        arena.golpear(otroLado(lado), { ...calcularDanio(yo, el, ataque), ataque });
        await pausa(1500);
      }
      await pausa(600);
    } catch {
      await pausa(4000); // sin conexión: lo vuelve a intentar con la siguiente pareja
    }
  }
}

/** El texto bajo la arena: quién lucha o qué movimiento usa (con el color de su tipo). */
function anunciar(texto, color = null) {
  rotulo.replaceChildren(crear('i', { estilos: { '--color-tipo': color || '#ff8f4d' }, atributos: { 'aria-hidden': 'true' } }), texto);
}

// --- El resto de la sección ---------------------------------------------------------------------

function pintarNovedades() {
  seccion.querySelector('#novedades-lista').replaceChildren(...NOVEDADES.map(([icono, titulo, texto]) =>
    crear('li', {}, crear('span', { clase: 'novedad-icono' }, crearIcono(ICONOS[icono])), crear('div', {}, crear('strong', { texto: titulo }), crear('p', { texto })))));
}

/** Las seis arenas: al pulsar una, abre el Duelo con ella elegida. */
function pintarArenas() {
  seccion.querySelector('#novedades-arenas').replaceChildren(...Object.entries(ESCENARIOS).map(([clave, datos]) => {
    const vista = dibujarVistaPrevia(clave);
    vista.className = 'novedades-arena-vista';
    vista.setAttribute('aria-hidden', 'true');
    return crear('button', { type: 'button', clase: 'novedades-arena', title: datos.descripcion, alPulsar: () => { elegirEscenario(clave); location.hash = '#duelo'; } },
      vista, crear('span', { texto: datos.nombre }));
  }));
}

/** Tu equipo (sprites) y tu récord total en el Duelo. */
function pintarEquipo() {
  const equipo = miLista('equipo');
  const huecos = seccion.querySelector('#novedades-equipo');
  huecos.replaceChildren(...Array.from({ length: 6 }, (_, i) => (equipo[i]
    ? crear('img', { src: urlSprite(equipo[i].id), alt: nombreTitulo(equipo[i].nombre), loading: 'lazy' })
    : crear('span', { clase: 'novedades-hueco', atributos: { 'aria-hidden': 'true' } }))));
  const record = leerRecord();
  let victorias = 0; let derrotas = 0;
  for (const modo of Object.values(record)) for (const { v = 0, d = 0 } of Object.values(modo)) { victorias += v; derrotas += d; }
  seccion.querySelector('#novedades-record').textContent = victorias + derrotas
    ? `${victorias} ${victorias === 1 ? 'victoria' : 'victorias'} · ${derrotas} ${derrotas === 1 ? 'derrota' : 'derrotas'}`
    : equipo.length ? `${equipo.length} de 6 listos para combatir` : 'Añádelos desde su ficha';
}
