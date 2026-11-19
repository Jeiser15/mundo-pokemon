# Mundo Pokémon — contexto del proyecto

Aplicación web de aprendizaje (interfaz en español) para explorar Pokémon con datos de [PokéAPI](https://pokeapi.co/).
La web se llama **«Mundo Pokémon»** (antes «Pokédex»). «Pokédex» sigue siendo el nombre de la vista del catálogo y de
las claves `pokedex.*` de localStorage (no cambiarlas: se perderían el equipo, el récord y la racha guardados).
Sin dependencias: Python estándar en el servidor y HTML/CSS/JS sin frameworks ni build en el navegador.

### Snapshot local (actualización)

`servidor/snapshot.py` descarga en segundo plano los recursos de PokéAPI usados por la aplicación
(Pokémon y formas, especies, tipos, habilidades y cadenas evolutivas) y publica una copia SQLite
en `datos/pokeapi.sqlite3` solo al completarla. Se renueva cada 24 horas mientras el servidor está
abierto; tras un error mantiene la copia anterior y reintenta más tarde. La primera descarga puede
tardar bastante. `/api/snapshot` y `static/js/snapshot.js` muestran su progreso. Las imágenes no
forman parte de la copia. `python -m unittest discover -s tests -v` ejecuta las pruebas del snapshot.

## Ejecutar

```bash
python app.py                # http://127.0.0.1:8000
python app.py --puerto 8080  # si el 8000 está ocupado
```

Necesita internet para actualizar PokéAPI y cargar sprites de GitHub. Las pruebas del snapshot no necesitan internet.

## Arquitectura

```
app.py                  Punto de entrada: arranca el servidor (argparse --puerto)
servidor/
  config.py             Puerto, rutas de carpetas, recursos permitidos, tamaño de caché, tipos MIME
  pokeapi.py            Cliente de PokéAPI con caché LRU en memoria (por bytes), errores tipados y
                        obtener_pokedex() (lista compacta de especies con tipos)
  rutas.py              Manejador HTTP: /, /static/*, /api/pokedex, /api/<recurso>/<nombre>
herramientas/
  generar_movimientos.py  Genera static/js/datos-movimientos.js desde PokéAPI (solo si salen movimientos nuevos)
index.html              Toda la página: 6 vistas (el Inicio es un <div id="inicio"> con 5 partes; las demás, <section>)
                        + 2 ventanas (<dialog>): la ficha y la batalla. <body data-vista="inicio"> de entrada
static/
  css/                  Una hoja por parte de la página (orden de carga en index.html)
    base.css            Variables, reinicio, botones, cabecera, pie, keyframes compartidos y «MUNDO»: el fondo
                        continuo (.mundo-fondo), cabecera y pie transparentes y piezas comunes (.mundo, .mundo-sello,
                        .mundo-cabecera) de las vistas con <body data-mundo> (Inicio y Categorías)
    portada.css         Vista Inicio («Mundo Pokémon»): héroe con reloj y altar, cinta de tipos, caminos,
                        Pokémon del día y regiones
    habitats.css        Hábitats animados de cada tipo (.habitat[data-tipo]) y santuario de leyendas: el portal de
                        la rueda de Categorías y el fondo de la ficha. Medidas en --u (1/150 de la altura)
    categorias.css      «La rueda de los tipos»: círculo de medallones, radios, centro con el hábitat, vuelo, perfil y
                        tabla de efectividad 18×18 plegada (oscura)
    legendarios.css     Vista Legendarios: «santuario» oscuro y dorado, altar, cartas de reliquia
    pokedex.css         Vista Pokédex («el escáner», azul eléctrico oscuro con cabecera y pie a juego): escáner
                        holográfico, panel de filtros y tarjetas oscuras (colores por tipo; legendarios y singulares)
    ficha.css           Ficha: toma los colores de sus tipos (--tipo-a/--tipo-b en #ficha) y, si es legendario
                        o singular, toda la ficha en negro y oro (#ficha[data-rareza], sección al final de la hoja);
                        radar SVG de estadísticas. Paneles en rejilla de 3 columnas (perfil, estadísticas,
                        efectividad; evolución debajo) para que la ficha sea estática (ver «Detalles»)
    duelo.css           Vista Duelo Pokémon («la arena»): mismo lenguaje que Legendarios (oscuro, serifa, líneas
                        finas, vidrio) en verde bosque y brasa; brasas que suben, maqueta 3D de la arena (el
                        escenario inclinado con tus Pokémon de pie), récord, pasos I·II·III y paneles de vidrio
    equipo.css          Duelo Pokémon, paso 2 (oscuro): cinturón de 6 huecos (o uno grande:
                        [data-lista="luchador"]), buscador y análisis (plegado en <details>). Usa los colores de .duelo
    simulacro.css       Ventana del combate en estilo pixel: marcadores, lienzo, mando (movimientos del color de
                        su tipo) y registro; .en-pantalla-completa (solo la arena, con marcadores y mando encima)
    quien.css           Vista ¿Quién es ese Pokémon?: silueta, respuestas, pistas y revelación
    novedades.css       Inicio, «Ahora también puedes combatir» (acentos brasa, sin fondo propio): muestra en vivo,
                        lo nuevo, tu equipo con tu récord y las 6 arenas
  js/                   Módulos ES (<script type="module">), uno por responsabilidad
    main.js             Arranca todo en orden
    datos.js            TIPOS (nombre, color, escenario, icono, efecto de su ataque), TABLA_TIPOS,
                        MOMENTOS_DEL_DIA (+ momentoDeHora), SUGERENCIAS, GENERACIONES y LEGENDARIOS (objetos con
                        tipos, poder, especie y grupo; datos sacados de PokéAPI), NIVELES_SIMULACRO, MODOS_BATALLA,
                        MOVIMIENTOS_RESERVA (para quien casi no aprende ataques), PALETAS_ATAQUE, ESCENARIOS (con sus
                        climas), CLIMAS, ESTADOS, ENTRENADORES, FRASES_RIVAL, EVOLUCIONES_REGIONALES
                        y MODOS_QUIEN
    datos-movimientos.js GENERADO (no editar): MOVIMIENTOS_DATOS, los 479 movimientos de daño de PokéAPI con
                        nombre en español, tipo, potencia, precisión, clase, prioridad y efectos
    mundo.js            Inicio: la luz del fondo continuo. Cada parte lleva data-luz="#a #b"; la que cruza el centro
                        de la pantalla (IntersectionObserver) pasa sus colores a --luz-a/--luz-b. ponerLuz() los cambia
    portada.js          Héroe: sigue la hora local (momentos del día: título, relato con nombres pulsables, cielo y
                        Pokémon del altar; el reloj deja ver otro momento), buscador (nombre exacto o número →
                        ficha; si no → Pokédex filtrada), sugerencias, destacado que rota (miniaturas) y cinta
    guia.js             Inicio: caminos (18 tipos → Pokédex filtrada, estante animado, silueta de ¿Quién es?),
                        Pokémon del día (cambia cada día; su tipo tiñe la luz) y las 9 regiones
    novedades.js        Inicio, Duelo en vivo: combate de muestra EN VIVO (arena-pixel + combate), lo nuevo, tu
                        equipo y las 6 arenas (pulsar una abre el Duelo con ella: elegirEscenario de duelo.js)
    catalogo.js         Pokédex, el archivo (la única vista de búsqueda): buscador, filtros por región y tipo, orden
                        y tandas de 24 que se cargan solas al bajar (o con «Ver más»). Pulsar una tarjeta la ESCANEA
                        (escaner.js). Exporta mostrarGeneracion(), mostrarTipo() y buscarDesdePortada() para que
                        otras vistas la abran ya filtrada (y escanea el primero). Sin resultados ofrece «Buscar en
                        PokéAPI» (para formas como charizard-mega-x, que no están en la lista de especies)
    escaner.js          Pokédex, el escáner: escanear(id) lee el registro (ilustración que se materializa, nombre,
                        categoría, tipos, medidas, descripción letra a letra, estadísticas, grito); ‹ › siguen la
                        lista del archivo (vecino) y «Al azar»; lleva la cuenta de vistos (pokedex.vistos)
    especies.js         Descarga /api/pokedex una vez y la comparte (cargarEspecies, tiposDe)
    api.js              fetch al servidor local; lanza Error con el mensaje del servidor
    utilidades.js       crear() para construir DOM, crearIcono() (iconos de tipo), crearImagen(), urlIlustracion(),
                        urlSprite(), urlAnimado() (GIF de Showdown)...
    vistas.js           Navegación por #hash (inicio, categorias, legendarios, catalogo, duelo, quien;
                        alias: #explorar → catalogo, #equipo y #batalla → duelo). Pone <body data-vista> y, en
                        las vistas de VISTAS_DEL_MUNDO (inicio, categorias), <body data-mundo>
    habitats.js         crearHabitat({ tipo, rareza, semilla }): la escena animada (12 partículas con reparto fijo)
    ficha.js            buscarPokemon(): abre y rellena la ficha (tema por tipo y rareza, especie, radar,
                        evolución con «Estás aquí», efectividad con iconos)
    efectividad.js      Lógica pura: calcularMultiplicadores() (ficha, datos de PokéAPI) y
                        multiplicador() / fuerteContra() / debilAnte() (TABLA_TIPOS)
    categorias.js       La rueda de los tipos (elegir(): vuelo al centro, radios, portal, perfil, luz) y la tabla 18×18
    legendarios.js      Leyenda destacada (‹ ›, una distinta cada día), filtros por generación y cartas
                        de 10 en 10 («Ver más»)
    efectos.js          activarInclinacion(): inclinación 3D al pasar el ratón (cartas de Legendarios)
    tarjetas.js         crearTarjetaPokemon({ id, nombre, tipos, alPulsar, visto, enPantalla }): tarjeta con los
                        colores de sus tipos; legendarios y singulares salen como cartas especiales
    mi-equipo.js        Dos listas en localStorage: 'equipo' (máx. 6; también la usa la ficha) y 'luchador'
                        (uno, para «Uno contra uno»; añadir otro lo sustituye) + evento «equipo-cambiado»
                        ({ lista }); detallesDe(id) (tipos, stats, poder, altura, imagen, sprite fijo, animados
                        (GIF), grito (.ogg) y aprende: sus movimientos; caché por visita). Lo usan equipo, duelo,
                        simulacro y ficha
    evoluciones.js      prepararEvoluciones(detalles): el árbol de formas en las que puede evolucionar en combate
                        (siguiente fase de su cadena; si es la última, megaevolución o forma primigenia;
                        las megas no traen movimientos en PokéAPI y heredan los de su forma normal)
    sonido.js           Web Audio: gritos (.ogg de PokéAPI), efectos sintetizados por tipo, música de batalla
                        original generada nota a nota y fanfarria; interruptores guardados (pokedex.sonido)
    duelo.js            Duelo Pokémon: la maqueta de la arena (pintarMaqueta), el récord total (pintarCifras), los
                        tres pasos (configura → elige tus Pokémon o tu luchador → ¡a combatir!), la configuración
                        (modo, dificultad, escenario; se recuerda), la lista del modo (usarLista) y el resumen
                        que llama a empezarCombate()
    equipo.js           Duelo Pokémon, paso 2: trabaja con la lista que le indica duelo.js (usarLista): cinturón,
                        buscador, «Completar al azar» (con el luchador: «Elegir/Otro al azar», uno solo) y análisis (defensa por tipo,
                        tipos que golpea ×2, estadísticas medias, consejos)
    combate.js          Batalla: REGLAS y estrategia del rival (lógica pura, sin DOM; azar inyectable).
                        movimientosDe() elige 4 movimientos reales para cada Pokémon; crearAtaque(clave).
                        Precisión, prioridad, efectos, etapas, clima, estados, energía y evolución.
                        resolverTurno() devuelve sucesos que simulacro.js anima
    simulacro.js        El combate: empezarCombate({ modo, nivel, escenario, pantallaCompleta }) abre la ventana
                        (#batalla-ventana); presentación (rival con nombre, clima), preparación (en el uno contra
                        uno empieza solo), turnos animados, evolución, relevos, final, récord (leerRecord),
                        bocadillos de diálogo, sonido y pantalla completa (sobre #simulacro)
    escenarios.js       Las 6 arenas en pixel art (bosque, volcan, playa, cueva, nieve, ruinas): dibujarFondo()
                        (una vez, con semilla) y crearAmbiente() (lo que se mueve). Constantes del mundo
                        (ANCHO, ALTO, SUELO, CASA)
    arena-pixel.js      Arena en pixel art vista desde arriba (mundo 480×270, lienzo a resolución real): el
                        escenario de escenarios.js (dibujarVistaPrevia para las tarjetas), sprites
                        animados (GIF: ImageDecoder o el lector propio leerGif), cámara, partículas, una
                        animación para cada movimiento (familias + ANIMACIONES, ver «Animaciones»), el rótulo
                        con el nombre del movimiento, Poké Ball, evolución (silueta que alterna), clima,
                        estados, transición y confeti.
                        crearModelo() (sin caché, dice de qué archivo salió) lo usan también las pruebas
    fuente-pixel.js     Fuente de píxeles 5×7 para los números de daño y los letreros del lienzo
    quien.js            ¿Quién es ese Pokémon?: modos, regiones, pistas, contrarreloj, racha (mejor racha guardada)
  img/
    icono.svg
archivo/                Versión original y paisajes que no se usan. No se sirve; se puede borrar.
```

### API del servidor local

| Ruta | Devuelve |
|---|---|
| `GET /api/pokemon/<nombre-o-número>` | JSON de PokéAPI tal cual |
| `GET /api/{type,pokemon-species,evolution-chain,ability}/<id>` | ídem |
| `GET /api/pokedex` | `[{id, nombre, tipos}]` de las 1025 especies (~54 KB). Se arma con 19 consultas a PokéAPI la primera vez y luego sale de memoria |

Errores: siempre JSON `{"error": "<mensaje en español>"}` con 400/404/502. El frontend muestra ese mensaje.
Para exponer otro recurso de PokéAPI (p. ej. `move`), añádelo a `RECURSOS_PERMITIDOS` en `servidor/config.py`.

## Convenciones

- **Todo en español**: nombres de variables, funciones, archivos, clases CSS nuevas y textos. Las clases CSS
  antiguas en inglés (`.detail`, `.pokemon-card`...) se mantienen; no renombrarlas sin motivo.
- **Sin dependencias ni build.** Nada de npm, frameworks ni pip. Si algo lo requiere, consultarlo antes.
- **DOM con `crear(etiqueta, opciones, ...hijos)`** (utilidades.js) en vez de `innerHTML`: evita inyección de HTML
  con datos de la API.
- **Respuestas que llegan tarde**: `ficha.js` (`versionBusqueda`), `escaner.js` (`versionEscaneo`) y `legendarios.js`
  (`versionDestacada`) numeran cada
  petición y descartan las que ya no son la última. Mantener ese patrón en cualquier carga asíncrona nueva.
- **CSS**: cada componente vive en una sola hoja; las variantes móviles van al final de esa hoja
  (`@media (max-width:700px)`, a veces 800/900px) y cada hoja desactiva sus animaciones en
  `prefers-reduced-motion`. Evitar `!important` (solo queda en `[hidden]` y en reduced-motion).
  Valores por elemento calculados en JS se pasan como variables CSS (`--n`, `--y`, `--i`, `--color-tipo`...),
  no como estilos sueltos.
- **Datos fijos** (tipos, colores, listas) solo en `datos.js`.
- **localStorage** solo para cosas de este navegador, siempre con try/catch: `pokedex.equipo`,
  `pokedex.luchador` (el del uno contra uno), `pokedex.sonido` (efectos y música encendidos o no),
  `pokedex.simulacro` (récord `{ equipo: {nivel: {v, d}}, duelo: {…} }`), `pokedex.duelo` (última
  configuración: modo, nivel, escenario, pantalla completa), `pokedex.quien.mejor-racha` y `pokedex.vistos`
  (los Pokémon escaneados en la Pokédex: el contador «Vistos por ti»).

## Cómo hacer cambios habituales

- **Nueva vista**: `<section id="x">` en index.html → añadir `'x'` a `VISTAS` en vistas.js → enlace `href="#x"`
  en el `<nav>` → módulo `static/js/x.js` con `iniciarX()` llamado desde main.js → hoja `static/css/x.css`.
- **Nueva arena del Duelo**: entrada en `ESCENARIOS` (datos.js: nombre, descripción, climas) + función de dibujo en
  `DIBUJOS` y su caso en `crearAmbiente` (escenarios.js). Sale sola en el paso 1 del Duelo y en las Novedades.
- **Cambiar el hábitat animado de un tipo** (portal de Categorías y fondo de la ficha): su bloque
  `.habitat[data-tipo="…"]` en habitats.css; el símbolo usa el `icono` de `TIPOS`.
- **Cambiar el lema o los Pokémon conocidos de un tipo** (Categorías): `PERFILES_TIPOS` en datos.js (los 72
  representantes se comprobaron contra PokéAPI: todos tienen su tipo).

## Detalles que no son obvios

- `servidor/config.py` fija los tipos MIME a mano: en Windows `mimetypes` puede devolver `text/plain` para `.js`
  y el navegador rechazaría los módulos.
- `app.py` desactiva `allow_reuse_address` en Windows: si no, dos servidores podían abrir el mismo puerto sin error.
- Archivos estáticos: `Cache-Control: no-cache` + `Last-Modified` → el navegador revalida (304) y los cambios se
  ven al recargar sin `?v=` en las URLs. Respuestas de `/api/*`: `no-store` (la caché está en el servidor).
- La caché rápida de PokéAPI vive en memoria y se vacía al reiniciar; el snapshot SQLite permanece en disco.
- Los sprites se piden directamente a `raw.githubusercontent.com` (no pasan por el servidor).
- El evento `close` del `<dialog>` llega en una tarea aparte: `ficha.js` lo ignora si la ficha ya se reabrió
  (si no, cancelaría la búsqueda nueva y la ficha se quedaría en «Buscando…»).
- Portada: `--tipo-hero` está registrada con `@property` para que el color del escenario se anime al cambiar
  de destacado. `INTERVALO_MS` (portada.js) y `--intervalo-hero` (portada.css) deben coincidir.
- El Pokémon del día usa `(días desde 1970 × 7919) % 1025 + 1`: igual para todos ese día y sin repetir en 1025 días.
- Cualquier elemento con `data-total-especies` recibe el total real de PokéAPI cuando carga el catálogo.
- Hábitats: todos comparten piezas (escena-fondo, 12 `.particula`, escena-suelo, primer plano) y cada tipo solo
  define su aspecto en un bloque `.habitat[data-tipo="…"]` de habitats.css. Las partículas reciben --x --y --t
  --s --v desde JS (reparto fijo, sin aleatoriedad) para posición, desfase, tamaño y ritmo.
- **La rueda de los tipos** (Categorías, vista «del mundo»): los 18 medallones van en círculo, cada uno SIEMPRE en
  su sitio (--x/--y en %, radio 42 %; no gira: así se aprende dónde está cada tipo). El elegido está en el CENTRO:
  el portal (40 %, con su hábitat —fundido entre el viejo y el nuevo—, su símbolo y su nombre); en el círculo solo
  queda su hueco punteado, que sigue siendo un botón (para el teclado). Al elegir otro, `volar()` mueve una copia
  (`.rueda-viajero`, 100 px escalada con la Web Animations API) del círculo al centro y otra del centro a su sitio;
  las cajas se miden ANTES de cambiar nada, y `.volviendo` / `.esperando` ocultan el medallón y el centro hasta que
  llegan (resiste clics muy seguidos: no quedan copias ni medallones ocultos). Los radios son un SVG de 100×100:
  lima del centro a los tipos contra los que es fuerte y ROJOS de los que lo vencen al centro, con una chispa
  (`animateMotion`) que va del que ataca al que recibe. Los nombres van por FUERA del círculo (--ux/--uy: dirección
  contraria al centro) para que ningún radio los cruce; en el móvil no se ven (el del centro sí). Lima = bueno para
  el tipo del centro y rojo = malo (también en el perfil: ×2 al atacar es lima y ×2 al defenderse, rojo, y en la
  tabla el ½). Cada medallón explica su relación en su `title` («Agua: le hace ×2 a Fuego»). Se elige con un clic
  (medallón, tipo del perfil o fila/columna de la tabla) o con las flechas (un solo `tabIndex=0`). Cada visita
  empieza por un tipo al azar. El botón del perfil abre la Pokédex filtrada y dice cuántas especies tiene.
- Ancho: `.wrap` llega hasta 1520 px. Las rejillas suben de columnas en vez de estirar tarjetas (archivo de la
  Pokédex 4, al lado del escáner; legendarios 5) y bajan con @media.
- **Pokédex, «el escáner»** (#catalogo): azul eléctrico sobre azul noche, con su propia paleta como Legendarios y el
  Duelo (cabecera y pie con `body[data-vista="catalogo"]`). A la izquierda, el escáner (sticky, cabe en ~860 px de
  alto: la pantalla mide `clamp(220px, 33vh, 310px)`); a la derecha, el archivo. La sección usa `overflow-x:clip`
  y NO `hidden`: con hidden, el escáner dejaría de quedarse fijo. Al escanear: `.escaneando` (lente rápida, luces,
  barrido en bucle) mientras llegan el Pokémon, la especie (en caché) y la ilustración; luego `.materializando`
  (la ilustración aparece de arriba abajo tras la línea de barrido). La descripción es la más reciente en español;
  se escribe letra a letra (el texto entero va en un `.solo-lectores`). El grito usa `grito()` de sonido.js (suena
  solo si los efectos están activados en el Duelo). Cada visita empieza por una especie al azar (o por la primera
  de la lista si se llega con un filtro). Las tandas se cargan solas con un IntersectionObserver sobre «Ver más»
  (se vuelve a observar tras cada tanda para pantallas altas). En ≤1100 px el escáner pasa arriba a lo ancho y
  pulsar una tarjeta sube hasta él.
- La ficha es **estática** en escritorio: está compactada para ~830 px de alto y `encajarFicha()` (ficha.js,
  con un `ResizeObserver`) baja `--escala` (`zoom` de `.detail`, mínimo 0,7) si la ventana es más baja.
  Usa `offsetHeight`, que no incluye el zoom ni la animación de entrada. El ancho del `<dialog>` también se
  multiplica por `--escala`: así por dentro mide siempre lo mismo y la escala no oscila. En móvil (≤700 px) no
  cabría legible: ahí se desplaza, sin barra visible. Varias evoluciones finales (Eevee) van en `.en-grupo`.
- **Batalla (simulacro)**: reglas inspiradas en los juegos, simplificadas, descritas al principio de `combate.js`.
  PV = Salud×2,2+90; daño = `BASE_DANIO` (58) × Ataque÷Defensa (físico) o At.Esp÷Def.Esp (especial) × potencia÷90
  × tipo × clima × azar, y ×⅔ si el movimiento no es de su tipo. Acciones: uno de sus 4 movimientos,
  Concentrarse (½ daño y ×1,7 al siguiente) y Cambiar. El rival se elige entre ~32 candidatos (preselección por
  tipos + poder ≈ media de tu equipo × `factorPoder`: 0,9 / 1,0 / 1,08). Medido con miles de combates simulados
  (`balance.mjs`, fuera del proyecto) con los 4 movimientos reales: con un equipo fuerte, Novato ~99 %, Retador
  ~40–75 % y Maestro ~12–30 % según lo bien que se juegue (con equipos medios o de bebés cuesta más). Si
  cambias reglas, `BASE_DANIO` o `ESTRATEGIA`, vuelve a medirlo.
- **Movimientos reales**: `herramientas/generar_movimientos.py` baja de PokéAPI los movimientos de daño (salvo
  los que no encajan en estas reglas: Explosión, Sorpresa, daño fijo…, en `EXCLUIDOS`) y escribe
  `datos-movimientos.js`: `clave → [nombre, tipo, potencia por turno (los de varios golpes ya multiplicados), precisión
  (null = no falla), 'f'/'e', prioridad, efectos?]`. Efectos que entiende el combate: `estado` + `probEstado`,
  `retroceso` / `drena` (% del daño), `costeVida` (Metaláser, Cabeza Sorpresa, Clorofiláser), `recarga` (Hiperrayo…: pierde el
  turno siguiente), `carga` (Rayo Solar, Vuelo, Excavar…: pierde el anterior; 'aire', 'tierra', 'agua' y 'sombra'
  además lo esconden y los ataques del rival fallan), `segunVida` (Estallido), `amedrentar`, `cambios` de etapas
  (`aQuien` 'propio' o 'rival', `probCambio`) y `golpes`. PokéAPI llama «Cañón Resplandor» a Flash Cannon: se
  corrige en `NOMBRES` (Foco Resplandor). `mi-equipo.js` guarda en `aprende` lo que puede aprender cada Pokémon
  (con `porNivel`) y `movimientosDe()` (combate.js) elige 4: el mejor de cada tipo suyo, los que más tipos
  nuevos golpean ×2 y uno rápido si lo tiene; valora potencia × precisión × afinidad con su mejor estadística ×
  (1,25 si lo aprende por nivel: los «suyos», como en el anime) y penaliza recarga, carga, retroceso, los que le
  bajan estadísticas y Enfado y compañía. Revisado con los 1025 (`auditoria-movimientos.mjs`, fuera del
  proyecto): ninguno falla, todos llevan al menos uno de su tipo, salen 276 movimientos distintos y solo 7
  (Ditto, Wobbuffet, Smeargle…) usan los de `MOVIMIENTOS_RESERVA`. Al evolucionar elige de nuevo (el registro
  dice «ahora conoce…»). Las etapas van de −6 a +6 (+1 = ×1,5; −1 = ×⅔) y se borran al retirarse; los
  estados ya no salen por tipo sino del movimiento (ningún movimiento de daño duerme).
- **Acciones obligadas**: tras Hiperrayo o con un movimiento de carga a medias, `accionObligada()` manda: el
  mando solo muestra «Continuar ▸» y el rival no elige (decidirRival la devuelve). El rival aprovecha para
  concentrarse si tú estás escondido o recargando.
- **Uno contra uno**: luchas con tu LUCHADOR (lista 'luchador', uno solo; se elige en el paso 2) y el rival se
  ajusta a él: poder ≈ el suyo × `factorDuelo` (0,88 / 0,97 / 1,05) y preferencia por la ventaja de tipo
  `ESTRATEGIA.tiposDuelo` (−0,6 / 0 / 0,1: en Novato el rival suele estar en desventaja), también en la
  preselección. Todos tienen el doble de vida (`MODOS_BATALLA.duelo.vida`) y el combate empieza solo. Medido
  con 18 luchadores (`balance-luchador.mjs`, fuera del proyecto) con los 4 movimientos reales: Novato ~94 %,
  Retador ~60 %, Maestro ~34 %; dura unos 4–5 turnos. Con un luchador fijo un rival «jefe» era imposible.
- **Batallas con vida** (cada combate es distinto):
  - Rival: «la Montañera Lucía» (nombre al azar + oficio según el tipo más repetido de su equipo + rango por
    dificultad). Habla en bocadillos (`FRASES_RIVAL`): al desafiar, al sacar Pokémon, al perder uno, con el
    último, al evolucionar, al pegar ×2 y al final.
  - Clima: se sortea por escenario (`ESCENARIOS[…].climas`) y dura todo el combate; potencia o debilita tipos
    (`CLIMAS`, factorClima en combate.js) y la arena lo dibuja (lluvia, granizo, arena, niebla, sol).
  - Estados (`ESTADOS`): los provoca el movimiento con su probabilidad real (Rayo 10 %, Escaldar 30 %,
    Moflete Estático 100 %…), salvo a los tipos inmunes. Quemado: −1/16 por turno y golpes físicos ×0,75.
  - Evolución: energía (atacar +34, recibir +20, concentrarse +34; llena = 100). Con la barra llena,
    «¡Evolucionar!» transforma al Pokémon SIN gastar el turno (luego eliges movimiento con su forma nueva):
    misma parte de vida + 15 %, y puede volver a evolucionar si le queda otra fase. El rival evoluciona al
    empezar su turno (`ESTRATEGIA.evoluciona`). Con varias ramas (Eevee) se elige la que más conviene contra
    el rival (`mejorEvolucion`). El árbol se prepara ANTES del combate (`prepararEvoluciones`, combate.js es
    lógica pura). Revisado con los 1025: 539 pueden evolucionar en combate, ninguno falla; las evoluciones
    exclusivas de una región (Runerigus solo desde el Yamask de Galar…) están en `EVOLUCIONES_REGIONALES`
    porque PokéAPI las mete en la misma cadena; las formas sin sprite (Mega-Zygarde) no se usan.
  - Poké Ball al salir (y rayo rojo al volver), grito al salir y al caer (más grave), transición de entrada,
    confeti al ganar.
  - Sonido (sonido.js): los navegadores solo dejan sonar tras un clic, así que `prepararSonido()` se llama
    al empezar `empezar()` (dentro del clic de «Iniciar combate»). La arena avisa con `sonar(nombre)`; los
    sonidos de los ataques los pide simulacro.js. La música es original (Lam–Fa–Sol–Mi7), se acelera con
    `tensionMusica` (último Pokémon o vida baja) y se para al cerrar.
- **Duelo Pokémon** (#duelo): un paso visible a la vez. Paso 1: modo («Equipo contra equipo» o «Uno contra uno»,
  claves 'equipo' y 'duelo'; cada uno con su lista en `MODOS_BATALLA[modo].lista`), dificultad y escenario.
  Paso 2: tu equipo o tu luchador. Paso 3: resumen + interruptor de pantalla completa + «Iniciar combate».
  simulacro.js avisa con el evento `batalla-terminada` para que duelo.js refresque el récord.
- **Pantalla completa**: Chrome NO deja poner un `<dialog>` en pantalla completa («Dialog elements are
  invalid»): se pide sobre `#simulacro` (dentro de la ventana), en el mismo clic (si no, el navegador la niega).
  La clase `.en-pantalla-completa` deja solo la arena con los marcadores, la barra y el mando flotando encima
  (el mando se oculta mientras se anima el turno; el registro, siempre). Si la API falla o no existe (iPhone),
  la clase sola hace que la ventana ocupe la del navegador. Esc sale de la pantalla completa (fullscreenchange
  quita la clase) sin cerrar la ventana. Para probarla en Chrome sin ventana: CDP `Browser.setPermission`
  ({ name: 'fullscreen', allowWithoutGesture: true }); sin eso responde «not granted».
- **Arenas** (`ESCENARIOS` en datos.js, dibujadas en escenarios.js): seis lugares de verdad, no campos con líneas
  (los de antes parecían canchas de fútbol): bosque antiguo (troncos gigantes, arroyo, corro de setas, rayos de
  luz y luciérnagas), cráter volcánico (río y cascada de lava, grietas que brillan, fumarolas y ascuas), costa
  tropical (olas, muelle, barca, palmeras, poza de marea, un cangrejo y la sombra de una gaviota), cueva de
  cristal (cristales que tiñen de color, estalactitas, lago con gotas), cumbre nevada (montañas al anochecer,
  aurora, pinos, estanque helado, faroles, nieve) y ruinas antiguas (muro con arco y estatuas, antorchas, losas
  con arena y un mosaico de runas que late). Vista 3/4: fondo arriba, suelo en medio y una PLATAFORMA por
  Pokémon en `CASA` (como en los juegos). Pintadas píxel a píxel con paletas cortas, tramado Bayer y luces
  (`iluminar`, también en escalones tramados); lo animado va en `crearAmbiente` → `suelo(p, t)` y `aire(p, t)`
  con los pinceles de la arena. Si llega una clave antigua (tierra, pradera…), se usa el bosque. 60 fps con
  clima y los ataques más cargados.
- **GIF animados**: se descargan ENTEROS (`arrayBuffer`) antes de decodificarlos; con un flujo, `frameCount`
  aún no tenía todos los fotogramas y el Pokémon repetía solo los primeros a toda velocidad. Van a la
  velocidad del archivo, como en Showdown (30–40 ms por fotograma; ≤10 ms vale 100 ms, como en los
  navegadores): frenarlos los dejaba a cámara lenta. Se leen todos los fotogramas (hasta 400: Regieleki tiene
  315) y cada uno se recorta a la caja que cubre el dibujo en todos (mucha menos memoria). Sin `ImageDecoder`
  (Firefox, Safari) se usa `leerGif`, un lector propio (LZW, transparencia, disposición, entrelazado):
  comparado con ImageDecoder en 144 GIF, idéntico píxel a píxel, con los mismos fotogramas y duraciones.
  En pantallas pequeñas (menos de 0,75 píxeles de pantalla por píxel del sprite) el sprite se reduce
  suavizado en vez de con píxeles enteros.
- **Revisión de los 1025** (`auditoria.mjs`, fuera del proyecto, con ImageDecoder y con el lector propio):
  1011 usan el GIF de Showdown, 6 el de Blanco/Negro y 8 no tienen GIF en PokéAPI (Iron Treads, Iron Bundle,
  Iron Jugulis, Iron Leaves, Ogerpon, Iron Boulder, Iron Crown, Pecharunt): con el sprite fijo, la arena los
  hace respirar y dar saltitos. Ninguno falla, tiene fotogramas vacíos o fondo opaco. Los muy alargados
  (Kyogre, Wailord, Dondozo, Stunfisk…) se limitan a `ANCHO_MAXIMO` (185 unidades) y `posicionDe` los aparta
  hacia fuera para que entre los dos quede hueco; las embestidas frenan delante del rival (no lo tapan aunque
  sea diminuto).
- **Arena pixelada** (arena-pixel.js): la batalla se abre en una ventana emergente. El mundo mide 480×270
  unidades (el campo y lo que lo rodea según el escenario elegido) y el
  `<canvas>` se dibuja a la resolución REAL de la pantalla (ResizeObserver + devicePixelRatio): el campo se
  agranda sin suavizar y cada sprite usa un número ENTERO de píxeles de pantalla por píxel del sprite si así
  su tamaño cambia menos de un 6 % (si no, el valor exacto: redondear agrandaba a algunos hasta un 25 %), y se
  mueve píxel a píxel de pantalla (así no se ve a saltos). Los Pokémon usan sus GIF animados (Showdown y,
  si no, Blanco/Negro) decodificados con `ImageDecoder`; si no hay (o el navegador no lo tiene), el sprite fijo.
  Tamaño según la altura real: `altoObjetivo` = 44 × metros^0,75 (de 16 a 140 unidades): Pikachu 22, Lucario 50,
  Charizard 65, Garchomp 71, Onix 140. Se mide en el fotograma TÍPICO del GIF (`altoTipico`, la mediana): con la
  caja de todos los fotogramas, los que agitan las alas (Charizard) salían más pequeños que Greninja. Cámara con temblor, zoom hacia el objetivo y «marco de impacto» (líneas
  radiales) en golpes eficaces. Colores en `PALETAS_ATAQUE`. Bajo el atacante, una placa con el nombre del
  movimiento (`rotulo`). Medido: 60 fps de media con los especiales más cargados (con lluvia).
- **Efectos en pixel art**: los ataques, partículas, climas y destellos se dibujan en DOS capas a baja
  resolución (`RESOLUCION_EFECTOS` = 2 píxeles por unidad, del tamaño de los píxeles de los sprites) que se
  amplían sin suavizar: `capaSuelo` (bajo los Pokémon: escenario, fondos, charcos) y `capaAire` (encima).
  `usar('real' | 'suelo' | 'aire')` cambia el pincel (`ctx`), la escala `S` y el temblor; los tamaños de los
  luchadores (`anchoDe`, `altoDe`) usan siempre `Sreal` para que no cambien según la capa. Antes se dibujaban
  a la resolución de la pantalla con líneas finas y brillos suaves, y desentonaban con los sprites.
- **Animaciones** (con el anime como referencia): `animacionDe(ataque)` busca la clave en `ANIMACIONES`
  (las 479 tienen la suya) y, si un movimiento nuevo no está, usa la de su tipo y clase (`POR_TIPO`). Son
  FAMILIAS con opciones, así que un gesto sirve para muchos: `embestida` (todo el cuerpo envuelto en su
  elemento: esfera eléctrica en Placaje Eléctrico, bola de fuego en Envite Ígneo, pájaro azul en Pájaro Osado,
  anillos en Gigaimpacto; `giro`, `golpes`), `rafaga` (prioridad: imágenes fantasma, `fantasma()`), `punos`
  (puño o pie de píxeles con su energía; A Bocajarro es una lluvia de golpes), `fauces` (mandíbulas de
  energía que se cierran: Triturar, Colmillo Ígneo…), `garras`, `filo` (sable de energía: Hoja Aguda, Tajo
  Umbrío), `tajoLejano`, `tijeras` (X brillante), `cola` (vuelta y coletazo: Acua Cola, Cola Férrea), `latigos`,
  `terremoto` (salta, grieta que corre hasta el rival y lo levanta), `avalancha`, `rocaAfilada`, `taladro`,
  `emboscada` (Vuelo, Excavar, Buceo, Golpe Fantasma: `ocultarse` el primer turno y ataca por sorpresa),
  `nube` (Carantoña), `haz` (Hiperrayo, Rayo Solar, Foco Resplandor… con su carga y adornos), `esfera`, `ola`
  (Surf…), `cielo` (Trueno, Llamarada con forma de 大, Cometa Draco, Ventisca, tornados, lluvia de monedas),
  `proyectiles` (agujas, estrellas, huesos, burbujas, hojas…), `absorber`, `humo`, `descarga`, `pulsoDragon`
  (dragón con cuerpo de anillos que muerde) y los especiales de antes (Lanzallamas, Hidrobomba, Rayo, Hoja
  Mágica, Rayo Hielo, Bomba Lodo, Tierra Viva, Tajo Aéreo, Psíquico —ondula la imagen—, Zumbido, Joya de Luz,
  Bola Sombra, Pulso Umbrío, Fuerza Lunar, Esfera Aural). Todas con formas de pixel art con borde oscuro y,
  mientras duran, el fondo cambia (`fondo(ms, tipo)`, colores en `FONDOS`). Colores por estilo en `TONOS`.
  Otras piezas de la arena: `preparar()` (primer turno de carga: se esconde o brilla, `dibujarMarcas` pinta
  el hoyo, las ondas o el brillo), `esquivar()` (fallo), `curar()` (drenar), `etapas()` (flechas que suben o
  bajan), `noActua('recarga' | 'amedrentado')` y `revelar()` (si lo dejan K.O. escondido). Revisadas en
  galerías (`galeria-movimientos.mjs`) y con `humo-animaciones.mjs` (una de cada fila + las de reserva, también
  con movimiento reducido): ninguna da error; 60 fps con las más cargadas.
  `atacar()` se cumple en el instante del impacto. Cerrar la ventana a mitad de combate es abandonarlo. La
  ventana cabe sin desplazarse en escritorio (ancho del lienzo limitado con `calc((100vh - 250px) * 16 / 9)`).
- **Inicio («Mundo Pokémon»)**: un `<div id="inicio">` con 5 partes en este orden: héroe, «Elige tu camino»
  (bento: Legendarios grande, los 18 tipos, Pokédex y ¿Quién es?), Duelo en vivo (#novedades), Pokémon del día y
  regiones. Ninguna tiene fondo propio: todas se ven sobre `.mundo-fondo`, una capa FIJA (fuera de main, primer
  hijo de body, `z-index:-1`) con dos luces radiales, viñeta, grano SVG (evita escalones en el degradado) y esporas
  que suben. Al bajar, la luz pasa por el tipo del destacado → lima → brasa (Duelo) → tipo del Pokémon del día →
  azul (regiones), con `transition` sobre `--luz-a/--luz-b` registradas con `@property`. La cabecera y el pie son
  transparentes en Inicio para que el fondo siga por detrás. Las tarjetas NO usan `backdrop-filter`: con el fondo
  fijo tendría que recalcularse en cada fotograma del desplazamiento. Medido: 60 fps bajando toda la página (1440 y
  390 px). Mismo lenguaje que Legendarios y el Duelo (serifa con palabra en cursiva, líneas finas, vidrio) en verde
  noche y lima. Las clases del Inicio no deben repetir las de otras vistas (`.quien-silueta` es del juego: la del
  Inicio es `.camino-silueta`).
- **Momentos del día** (héroe del Inicio): como el ciclo de día y noche de los juegos, `MOMENTOS_DEL_DIA` (datos.js)
  reparte el día en madrugada (0–5 h), mañana (6–11), tarde (12–17), atardecer (18–20) y noche (21–23), con la hora
  LOCAL. Cada uno tiene título (dos partes: la segunda en cursiva, con el color `--cielo`), relato (`{0}`, `{1}`, `{2}`
  = sus tres primeros protagonistas, botones: pasar por encima los sube al altar, pulsar abre su ficha), cielo (luz
  de abajo del fondo y brillo tras el título) y su lista de Pokémon para el altar, con detalles de los juegos
  (Espeon de día y Umbreon de noche, Lycanroc diurno / crepuscular / nocturno, Rowlet y Noctowl nocturnos, los
  Clefairy bailan con luna llena; Rowlet NO va de mañana: la Pokédex dice que es nocturno). Las formas usan su id
  de PokéAPI (Lycanroc nocturno 10126, crepuscular 10152) con `{ numero, forma }` para la tarjeta. El reloj se
  repasa cada 15 s: si nadie eligió otro momento con sus botones, el Inicio cambia solo al pasar de franja. Sin
  `data-momento` (antes del JS) título y relato están ocultos (`.hero-cambia`) para que no cambien de golpe. El
  relato reserva 3 líneas (`min-height`) para que el héroe no salte al cambiar de momento.
- **Duelo en vivo** (#novedades, dentro del Inicio): combate de muestra en vivo (parejas reconocibles en `PAREJAS`,
  4 ataques con sus movimientos reales y el daño real, y en cada ronda otra arena), lo nuevo, las 6 arenas (pulsar
  una abre el Duelo con ella elegida) y tu equipo con tu récord. No descarga nada hasta que se ve; la arena se pausa
  con `arena.pausar()` si sale de la pantalla, cambias de vista o de pestaña (un IntersectionObserver, un
  MutationObserver sobre el `hidden` de `#inicio` y visibilitychange). Con movimiento reducido, una escena quieta.
  No usar `<header>` dentro: base.css le pone el estilo de la cabecera de la web.
- La ficha tiene «Añadir a mi equipo» en la barra superior (no le quita alto: la ficha sigue estática).
- El servidor (ThreadingHTTPServer) solo encola 5 conexiones: el navegador abre 6 como mucho y va bien, pero un
  script que lance 30 peticiones a la vez recibe «connection refused». Limitar la concurrencia en pruebas.
- «¿Quién es?» no descarga nada hasta que se abre su vista (MutationObserver sobre `hidden`), deja precargada la
  imagen de la siguiente pregunta y pausa el contrarreloj si cambias de vista, de pestaña o abres una ficha.
- La ficha marca `#resultado[aria-busy]`: `true` mientras carga y `false` al terminar (también lo usan las pruebas).
- `vistas.js` pone `<body data-vista="…">` con la vista activa: así cada vista puede adaptar cabecera y pie
  (Legendarios los vuelve azul noche y dorado desde legendarios.css).
- Legendarios: las 71 cartas se crean una vez y `actualizarArchivo()` muestra las primeras `mostradas` del
  filtro elegido (tandas de 10 con «Ver más»; cambiar de filtro vuelve a 10). Rejilla de 5 columnas: 10 = 2 filas.
- Menú con 6 enlaces («Duelo Pokémon» es el más largo): `.brand-note` («Explora · combate · descubre») se oculta por
  debajo de 1180 px, los enlaces se compactan a 1000 px, el menú baja a su propia línea a 880 px («Mundo Pokémon»
  no se parte: `.logo-texto` con nowrap) y en teléfono (≤520 px) es una rejilla de 3 + 3.
- Legendarios usa su propia paleta (azul medianoche + oro) y Georgia como letra con serifa: es intencionado,
  para que la vista se sienta distinta. El Duelo usa el MISMO lenguaje con otra paleta (verde bosque casi
  negro + brasa): una versión anterior «de videojuego» (cielo, Poké Balls, colores chillones) se descartó por
  infantil y por no ir con la web. La maqueta 3D: el plano gira `rotateX(50deg)` y cada figura
  `rotateX(-50deg)` desde sus pies (`transform-style:preserve-3d`); sus medidas van en `cqw` (ancho de la
  maqueta) para que en el móvil no se amontonen. `--tipo-a/--tipo-b` están registradas con `@property` para animar el color.
- Rareza: `rarezaDe(id)` (datos.js) usa `LEGENDARIOS` (71) y `SINGULARES` (23). Ambas listas se comprobaron contra
  las 1025 especies de PokéAPI (is_legendary / is_mythical): no falta ni sobra ninguna. Las formas (Mega…) usan
  el id de su especie (`pokemon.species.url`) para la rareza y la región.
- `LEGENDARIOS` (71) se generó desde PokéAPI y se comprobó que todas son `is_legendary`. La especie en español
  de las de 9.ª generación y Enamorus no existe en PokéAPI: está traducida a mano en datos.js.
- `TABLA_TIPOS` se comprobó contra PokéAPI (/type/<tipo>, damage_relations): coincide en los 18 tipos.
- `.tabla-tipos-marco` necesita `position:relative`: sin él, los textos `.solo-lectores` (absolutos) de la
  tabla escapan del contenedor con scroll y ensanchan toda la página en móvil.

## Pendiente / ideas

- Movimientos en la ficha (el Duelo ya usa los reales: datos-movimientos.js). El equipo del Duelo Pokémon ya
  hace de favoritos (hasta 6).
- `archivo/` se puede borrar cuando ya no haga falta comparar con la versión anterior.
