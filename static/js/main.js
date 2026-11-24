// Punto de entrada: arranca cada parte de la página.
// Cada módulo se ocupa de una vista o pieza; ver CLAUDE.md para el mapa completo.

import { iniciarAventura } from './aventura.js';
import { iniciarCatalogo } from './catalogo.js';
import { iniciarCategorias } from './categorias.js';
import { iniciarDuelo } from './duelo.js';
import { iniciarEquipo } from './equipo.js';
import { iniciarFicha } from './ficha.js';
import { iniciarGuia } from './guia.js';
import { iniciarLegendarios } from './legendarios.js';
import { iniciarMundo } from './mundo.js';
import { iniciarNovedades } from './novedades.js';
import { iniciarPortada } from './portada.js';
import { iniciarQuien } from './quien.js';
import { iniciarSimulacro } from './simulacro.js';
import { iniciarVistas } from './vistas.js';
import { iniciarEstadoSnapshot } from './snapshot.js';

iniciarMundo();       // Inicio: el fondo continuo cuya luz cambia según la parte que se ve
iniciarPortada();     // Héroe del Inicio: buscador, destacado que rota y cinta de tipos
iniciarGuia();        // Inicio: caminos (tipos, Pokédex, ¿Quién es?), Pokémon del día y regiones
iniciarVistas();      // Navegación por #hash entre vistas
iniciarFicha();       // Ventana con la ficha de cada Pokémon
iniciarLegendarios(); // Cartas de los 71 legendarios
iniciarCatalogo();    // Pokédex: buscador, filtros por región y tipo
iniciarCategorias();  // 18 cartas animadas y tabla de efectividad
iniciarEquipo();      // Duelo Pokémon, paso 2: cinturón de 6, buscador y análisis por tipos
iniciarSimulacro();   // Combate en ventana emergente (pixel art, pantalla completa opcional)
iniciarDuelo();       // Duelo Pokémon: configura → elige tus Pokémon → ¡a combatir!
iniciarQuien();       // Juego «¿Quién es ese Pokémon?»
iniciarNovedades();   // Inicio: el Duelo en vivo, tu equipo y las 10 arenas
iniciarAventura();    // Modo aventura: nueve copas (liga.js), tu entrenador y la tarjeta del Inicio
iniciarEstadoSnapshot(); // Progreso de la copia persistente.
