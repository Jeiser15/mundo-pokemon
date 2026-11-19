# Mundo Pokémon

Una aplicación para buscar Pokémon por nombre en inglés o por número y ver sus tipos, tamaño, habilidades, estadísticas base, evolución y debilidades.

## Cómo ejecutarla

1. Abre esta carpeta en Visual Studio Code.
2. En el menú, selecciona **Terminal > Nuevo terminal**.
3. Escribe `python app.py` y pulsa Enter.
4. Abre en tu navegador: http://127.0.0.1:8000
5. Busca, por ejemplo, `pikachu`, `charizard` o `25`.
6. Para detener el servidor, vuelve a la terminal y pulsa **Ctrl+C**.

Necesitas conexión a internet para consultar PokéAPI y cargar las imágenes. Si el puerto 8000 está ocupado, el programa te avisará; usa otro con `python app.py --puerto 8080` y abre http://127.0.0.1:8080.

## En el celular (Android)

Cada vez que se suben cambios, GitHub compila una app de Android con la web dentro y la publica en
[**Releases**](https://github.com/Jeiser15/mundo-pokemon/releases/latest).

1. Desde el celular, descarga [`mundo-pokemon.apk`](https://github.com/Jeiser15/mundo-pokemon/releases/latest/download/mundo-pokemon.apk).
2. Ábrelo y, si Android lo pide, permite instalar apps desde tu navegador.
3. Abre **Mundo Pokémon**. Necesita internet: sin el servidor de Python, pide los datos directamente a PokéAPI.

La app está en la carpeta `android/` (ver `android/LEEME.md`).

## ¿Cómo está organizado?

```
app.py              ← lo que ejecutas: arranca el servidor
servidor/           ← el servidor en Python
  config.py           ajustes (puerto, límites...)
  pokeapi.py          pide los datos a PokéAPI y los recuerda un rato
  rutas.py            decide qué responder a cada dirección
index.html          ← la estructura de la página
static/             ← lo que descarga el navegador
  css/                los estilos, un archivo por cada parte de la página
  js/                 el comportamiento, un archivo por cada parte de la página
  img/                el icono y los paisajes de la ficha
archivo/            ← copia de la versión anterior (se puede borrar)
```

### ¿Qué hace cada parte?

- **`index.html`**: la estructura de la página. Tiene seis *vistas* (Inicio, Categorías, Legendarios, Pokédex, Duelo Pokémon y ¿Quién es?) y la *ficha*, una ventana que se abre encima. El Inicio tiene un buscador, un Pokémon destacado que va cambiando, accesos a cada sección, un combate de muestra en vivo, el **Pokémon del día** y las nueve regiones, todo sobre un mismo fondo cuya luz cambia de color al bajar.
- **`static/css/`**: colores, diseño y animaciones. `base.css` tiene lo común; el resto, una parte cada uno (por ejemplo, `ficha.css` o `portada.css`, la del Inicio).
- **`static/js/`**: búsquedas, categorías y fichas. `main.js` arranca todo y cada archivo se ocupa de una cosa (por ejemplo, `ficha.js` rellena la ficha y `datos.js` guarda los nombres y colores de los tipos).
- **`app.py` y `servidor/`**: un pequeño servidor que entrega la página a tu navegador y consulta PokéAPI cuando buscas un Pokémon.
- **PokéAPI**: un servicio público que proporciona información de Pokémon por internet. Una API es una forma de pedir datos a otro programa.
- **Snapshot local**: una copia de Pokémon y sus formas, especies, tipos, habilidades y cadenas evolutivas, guardada en `datos/pokeapi.sqlite3`. Se prepara en segundo plano y se actualiza cada 24 horas mientras el servidor está abierto. Si la actualización falla, se conserva la copia anterior y se reintenta más tarde. Durante la primera descarga la página sigue consultando PokéAPI; puede tardar bastante porque descarga miles de recursos sin saturar el servicio. Las imágenes siguen necesitando conexión.

Puedes comprobar el progreso en http://127.0.0.1:8000/api/snapshot: `completados` y `total` indican el avance, y `actualizado` es la fecha de la última copia completa (en segundos Unix). La copia solo se activa cuando termina toda la descarga. Si apagas el servidor antes de terminar, la descarga vuelve a empezar al iniciarlo.

La aplicación incluye una Pokédex con las 1025 especies (buscador y filtros por tipo y región), los 71 legendarios hasta la novena generación, tipos, estadísticas, descripciones, evolución y efectividad defensiva. Los singulares aparecen en la Pokédex general. La Pokédex muestra especies; las formas especiales (Mega, Alola…) se consultan con el botón «Buscar en PokéAPI» que aparece cuando una búsqueda no encuentra nada. La disponibilidad y los datos dependen de PokéAPI. Más adelante se pueden añadir movimientos y favoritos.
