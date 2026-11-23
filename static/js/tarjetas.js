// Tarjeta de Pokémon del archivo de la Pokédex (catalogo.js). Toma los colores de sus tipos: brillo, círculo,
// icono y etiquetas (ver css/pokedex.css). Legendarios y singulares llevan además su propio estilo
// (.es-legendario / .es-singular) y un sello. Las ya escaneadas llevan .visto, y la que está en el escáner,
// aria-pressed="true".

import { COLOR_POR_DEFECTO, rarezaDe, TIPOS } from './datos.js';
import { buscarPokemon } from './ficha.js';
import { crear, crearIcono, crearImagen, nombreTitulo, numeroPokedex, urlIlustracion } from './utilidades.js';

const colorDe = tipo => TIPOS[tipo]?.color || COLOR_POR_DEFECTO;

/**
 * @param {object} p
 * @param {number|string} p.id      Número de la Pokédex (para la imagen y el N.º).
 * @param {string} p.nombre         Clave de PokéAPI ('mr-mime'): se muestra su nombre oficial en español.
 * @param {string[]} [p.tipos]      Claves de tipo (['grass', 'poison']). Sin tipos, la tarjeta sale verde.
 * @param {string} [p.consulta]     Qué buscar al pulsar; por defecto, el número.
 * @param {number} [p.orden]        Posición dentro de la tanda: escalona la animación de entrada.
 * @param {Function} [p.alPulsar]   Qué hacer al pulsarla; por defecto, abrir su ficha.
 * @param {boolean} [p.visto]       Si ya se escaneó alguna vez (lleva una marca).
 * @param {boolean} [p.enPantalla]  Si es la que está en el escáner.
 */
export function crearTarjetaPokemon({ id, nombre, tipos = [], consulta = String(id), orden = 0, alPulsar = null, visto = false, enPantalla = false }) {
  const [principal, secundario] = tipos;
  const nombreVisible = nombreTitulo(nombre); // «Mr. Mime», «Código Cero»…
  const nombresTipos = tipos.map(tipo => TIPOS[tipo]?.nombre || tipo);
  const rareza = rarezaDe(id);
  const sello = { legendario: '✦ Legendario', singular: '✧ Singular' }[rareza];
  return crear('button', {
    type: 'button',
    clase: 'pokemon-card' + (rareza ? ' es-' + rareza : '') + (visto ? ' visto' : ''),
    atributos: {
      'data-id': id, 'aria-pressed': String(enPantalla),
      'aria-label': `${nombreVisible}, número ${id}${sello ? ', Pokémon ' + rareza : ''}${tipos.length ? ', tipo ' + nombresTipos.join(' y ') : ''}. ${alPulsar ? 'Escanear' : 'Ver ficha'}.`,
    },
    estilos: { '--tipo-a': colorDe(principal), '--tipo-b': colorDe(secundario || principal), '--i': orden },
    alPulsar: alPulsar || (() => buscarPokemon(consulta)),
  },
    crear('span', { clase: 'tarjeta-cabecera' },
      principal && TIPOS[principal]
        ? crear('span', { clase: 'tarjeta-icono', title: TIPOS[principal].nombre }, crearIcono(TIPOS[principal].icono))
        : crear('span'),
      crear('small', { texto: 'N.º ' + numeroPokedex(id) }, crear('i', { clase: 'tarjeta-visto', title: 'Ya lo has escaneado', atributos: { 'aria-hidden': 'true' } }))),
    crear('span', { clase: 'pokemon-image' }, crearImagen(urlIlustracion(id))),
    ...(sello ? [crear('span', { clase: 'tarjeta-sello', texto: sello })] : []),
    crear('strong', { texto: nombreVisible }),
    crear('span', { clase: 'tarjeta-tipos' }, ...tipos.map((tipo, i) => crear('span', { texto: nombresTipos[i], estilos: { '--color-tipo': colorDe(tipo) } }))),
  );
}
