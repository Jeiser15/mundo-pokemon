// Héroe del Inicio. Sigue la HORA LOCAL, como el ciclo de día y noche de los juegos (MOMENTOS_DEL_DIA en
// datos.js): madrugada, mañana, tarde, atardecer y noche tienen su título, su relato, su cielo (--cielo: la luz
// del fondo y la palabra en cursiva) y sus Pokémon en el altar (Lycanroc cambia de forma, Espeon de día…).
// El reloj muestra la hora y cinco botones para ver cómo es el mundo en otro momento; el que toca ahora lleva
// un punto. Si nadie ha elegido otro, al cambiar de franja horaria el Inicio cambia solo.
//
// El destacado rota cada INTERVALO_MS (también con las miniaturas o pasando por un nombre del relato) y se
// detiene con el cursor o el foco encima, si la pestaña no se ve, fuera de «Inicio» o con movimiento reducido.
// Su tipo tiñe el altar (--tipo-hero) y la luz de arriba del fondo (ponerLuz, mundo.js).

import { COLOR_POR_DEFECTO, MOMENTOS_DEL_DIA, momentoDeHora, SUGERENCIAS, TIPOS } from './datos.js';
import { buscarDesdePortada } from './catalogo.js';
import { buscarPokemon } from './ficha.js';
import { ponerLuz } from './mundo.js';
import { crear, crearIcono, numeroPokedex, urlIlustracion, urlSprite } from './utilidades.js';

const INTERVALO_MS = 5000;        // Debe coincidir con --intervalo-hero en portada.css
const DURACION_FUNDIDO_MS = 300;  // Debe coincidir con la transición de .cambiando en portada.css
const PASO_MS = 100;
const RELOJ_MS = 15000;           // cada cuánto se repasa la hora

export function iniciarPortada() {
  const inicio = document.querySelector('#inicio');
  const hero = document.querySelector('.hero');
  const escena = document.querySelector('#hero-escena');
  const imagen = document.querySelector('#hero-pokemon');
  const tarjeta = document.querySelector('#hero-tarjeta');
  const marca = document.querySelector('#hero-marca');
  const titulo = document.querySelector('#hero-titulo');
  const relato = document.querySelector('#hero-relato');
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  let momento = null;      // el momento que se ve
  let elegido = false;     // true si la persona eligió otro con el reloj: entonces la hora no lo cambia
  let protagonistas = [];
  let miniaturas = [];
  let actual = -1, transcurrido = 0, ultimoCambio = 0, encima = false;

  // --- El reloj y los cinco momentos ---
  const momentoAhora = () => momentoDeHora(new Date().getHours());
  const botonesMomento = MOMENTOS_DEL_DIA.map(m => crear('button', {
    type: 'button', clase: 'hero-momento-boton', atributos: { 'aria-pressed': 'false' }, alPulsar: () => elegirMomento(m),
  }, crearIcono(m.icono)));
  document.querySelector('#hero-momentos').append(...botonesMomento);

  function marcarBotones() {
    const ahora = momentoAhora();
    botonesMomento.forEach((boton, i) => {
      const m = MOMENTOS_DEL_DIA[i];
      boton.setAttribute('aria-pressed', String(m === momento));
      boton.classList.toggle('es-ahora', m === ahora);
      boton.title = m === ahora ? `${m.nombre} (ahora)` : `Ver el mundo ${m.cuando}`;
      boton.setAttribute('aria-label', boton.title);
    });
    document.querySelector('#hero-momento').textContent = momento === ahora ? momento.nombre : `Así es ${momento.cuando}`;
  }

  function elegirMomento(m) {
    elegido = m !== momentoAhora();
    ponerMomento(m);
  }

  function ponerMomento(m) {
    if (m === momento) { marcarBotones(); return; }
    const primero = !momento;
    momento = m;
    hero.dataset.momento = m.clave;
    hero.style.setProperty('--cielo', m.cielo);
    marcarBotones();
    // Título y relato con un fundido (la primera vez, directamente: el CSS los muestra al poner data-momento).
    const escribir = () => {
      titulo.replaceChildren(m.titulo[0] + ' ', crear('em', { texto: m.titulo[1] }));
      pintarRelato(m);
    };
    if (primero) escribir();
    else {
      titulo.classList.add('cambiando');
      relato.classList.add('cambiando');
      setTimeout(() => {
        if (momento !== m) return; // ya se eligió otro
        escribir();
        titulo.classList.remove('cambiando');
        relato.classList.remove('cambiando');
      }, DURACION_FUNDIDO_MS);
    }
    // Los Pokémon de este momento, con sus miniaturas.
    protagonistas = m.protagonistas;
    miniaturas = protagonistas.map(([id, nombre], indice) => crear('button', {
      type: 'button', clase: 'hero-miniatura', atributos: { 'aria-label': 'Mostrar a ' + nombre, 'aria-pressed': 'false' }, alPulsar: () => mostrar(indice),
    }, crear('img', { src: urlSprite(id), alt: '' })));
    document.querySelector('#hero-miniaturas').replaceChildren(...miniaturas);
    actual = -1;
    mostrar(0, primero);
  }

  /** El relato con los tres primeros protagonistas como botones: al pasar por encima suben al altar; al pulsar, su ficha. */
  function pintarRelato(m) {
    const partes = m.relato.split(/\{(\d)\}/); // los impares son los números de {0}, {1}, {2}
    relato.replaceChildren(...partes.map((parte, i) => (i % 2 ? nombrado(m, Number(parte)) : parte)));
  }

  function nombrado(m, indice) {
    const [id, nombre, tipos] = m.protagonistas[indice];
    const boton = crear('button', {
      type: 'button', clase: 'hero-nombrado', texto: nombre, title: `Ver la ficha de ${nombre}`,
      estilos: { '--color-tipo': TIPOS[tipos[0]]?.color || COLOR_POR_DEFECTO }, alPulsar: () => buscarPokemon(String(id)),
    });
    const subir = () => { if (momento === m) mostrar(indice); };
    boton.addEventListener('pointerenter', subir);
    boton.addEventListener('focus', subir);
    return boton;
  }

  // --- El destacado ---
  function pintarTarjeta([id, nombre, tipos, { numero = id, forma = '' } = {}]) {
    imagen.alt = 'Ilustración de ' + nombre;
    marca.textContent = numeroPokedex(numero);
    document.querySelector('#hero-numero').textContent = `N.º ${numeroPokedex(numero)}${forma ? ' · ' + forma : ''}`;
    document.querySelector('#hero-nombre').textContent = nombre;
    document.querySelector('#hero-tipos').replaceChildren(...tipos.map(tipo => crear('span', {
      texto: TIPOS[tipo]?.nombre || tipo,
      estilos: { '--color-etiqueta': TIPOS[tipo]?.color || COLOR_POR_DEFECTO },
    })));
    const color = TIPOS[tipos[0]]?.color || COLOR_POR_DEFECTO;
    hero.style.setProperty('--tipo-hero', color);
    ponerLuz(hero, color, momento.cielo); // arriba, su tipo; abajo, el cielo de este momento
  }

  /** Cambia el destacado. Descarga antes la ilustración para que el cambio no deje un hueco. */
  function mostrar(indice, inmediato = false) {
    if (indice === actual) return;
    const cambio = ++ultimoCambio;
    actual = indice;
    transcurrido = 0;
    miniaturas.forEach((boton, i) => boton.setAttribute('aria-pressed', String(i === indice)));
    const protagonista = protagonistas[indice];
    if (inmediato) {
      imagen.src = urlIlustracion(protagonista[0]);
      pintarTarjeta(protagonista);
      return;
    }
    const precarga = new Image();
    precarga.onload = () => {
      if (cambio !== ultimoCambio) return; // Ya se pidió otro mientras cargaba.
      for (const el of [imagen, tarjeta, marca]) el.classList.add('cambiando');
      setTimeout(() => {
        if (cambio !== ultimoCambio) return;
        imagen.src = precarga.src;
        pintarTarjeta(protagonista);
        for (const el of [imagen, tarjeta, marca]) el.classList.remove('cambiando');
      }, DURACION_FUNDIDO_MS);
    };
    precarga.src = urlIlustracion(protagonista[0]);
  }

  const enPausa = () => encima || document.hidden || inicio.hidden || movimientoReducido.matches;
  for (const zona of [escena, relato]) {
    zona.addEventListener('pointerenter', () => { encima = true; });
    zona.addEventListener('pointerleave', () => { encima = false; });
    zona.addEventListener('focusin', () => { encima = true; });
    zona.addEventListener('focusout', () => { encima = false; });
  }
  setInterval(() => {
    const pausa = enPausa();
    hero.classList.toggle('en-pausa', pausa);
    if (pausa) return;
    transcurrido += PASO_MS;
    if (transcurrido >= INTERVALO_MS) mostrar((actual + 1) % protagonistas.length);
  }, PASO_MS);

  document.querySelector('#hero-ver-ficha').addEventListener('click', () => buscarPokemon(String(protagonistas[actual][0])));

  // --- La hora: el reloj y, si nadie eligió otro momento, el momento que toca ---
  const hora = document.querySelector('#hero-hora');
  function tic() {
    const ahora = new Date();
    hora.textContent = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const m = momentoDeHora(ahora.getHours());
    if (!elegido && m !== momento) ponerMomento(m);
    else marcarBotones(); // por si cambió la franja mientras se ve otro momento
  }
  tic();
  setInterval(tic, RELOJ_MS);

  // --- Buscador y sugerencias ---
  document.querySelector('#busqueda-inicio').addEventListener('submit', evento => {
    evento.preventDefault();
    const valor = document.querySelector('#pokemon-inicio').value.trim();
    if (valor) buscarDesdePortada(valor); // Nombre exacto o número → ficha; si no, Pokédex filtrada.
  });
  document.querySelector('#hero-sugerencias').append(...SUGERENCIAS.map(([id, nombre]) =>
    crear('button', { type: 'button', alPulsar: () => buscarPokemon(String(id)) }, crear('img', { src: urlSprite(id), alt: '' }), nombre)));

  // --- Cinta con los 18 tipos (dos copias seguidas para que el bucle no se note) ---
  const tipos = () => Object.values(TIPOS).map(tipo => crear('span', { texto: tipo.nombre, estilos: { '--color-tipo': tipo.color } }));
  document.querySelector('#hero-cinta').append(...tipos(), ...tipos());
}
