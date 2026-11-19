"""Ajustes del servidor. Si necesitas cambiar el puerto o los límites, hazlo aquí."""
from pathlib import Path

# --- Carpetas del proyecto -------------------------------------------------
RAIZ = Path(__file__).resolve().parent.parent
PAGINA_PRINCIPAL = RAIZ / "index.html"
CARPETA_ESTATICOS = RAIZ / "static"  # Todo lo que hay aquí se sirve en /static/...

# --- Servidor local --------------------------------------------------------
HOST = "127.0.0.1"
PUERTO = 8000  # También se puede cambiar al arrancar: python app.py --puerto 8080

# --- PokéAPI ---------------------------------------------------------------
POKEAPI_URL = "https://pokeapi.co/api/v2"
POKEAPI_TIEMPO_ESPERA = 10  # segundos
USER_AGENT = "ProyectoPokemon/1.0"

# Recursos de PokéAPI que el navegador puede pedir a través de /api/<recurso>/<nombre>.
RECURSOS_PERMITIDOS = ("pokemon", "type", "pokemon-species", "evolution-chain", "ability")
# Los 18 tipos: /api/pokedex los usa para saber los tipos de cada especie.
TIPOS = ("normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
         "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy")

# Las respuestas de PokéAPI se guardan en memoria mientras el servidor está encendido.
# Así, abrir dos veces la misma ficha no vuelve a descargar nada.
CACHE_MAXIMO_BYTES = 64 * 1024 * 1024

# Copia local de los recursos que usa la aplicación, renovada en segundo plano.
SNAPSHOT_ARCHIVO = RAIZ / "datos" / "pokeapi.sqlite3"
SNAPSHOT_INTERVALO = 24 * 60 * 60
SNAPSHOT_REINTENTO = 30 * 60
SNAPSHOT_PAUSA = 0.15  # Espacia las peticiones para no saturar PokéAPI.

# Tipos de contenido por extensión. Se fijan aquí porque en Windows el registro
# a veces asocia .js con text/plain y el navegador rechazaría los módulos.
TIPOS_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}
