"""Cliente mínimo de PokéAPI con caché en memoria.

Devuelve las respuestas tal cual (bytes JSON) para que el navegador las lea sin cambios.
"""
from __future__ import annotations

import json
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from . import config, snapshot


class ErrorPokeAPI(Exception):
    """Algo salió mal al consultar PokéAPI."""


class NoEncontrado(ErrorPokeAPI):
    """PokéAPI respondió 404: ese nombre o número no existe."""


class ErrorDeRespuesta(ErrorPokeAPI):
    """PokéAPI respondió con otro error (por ejemplo, 500)."""


class SinConexion(ErrorPokeAPI):
    """No se pudo contactar con PokéAPI (sin internet, tiempo agotado...)."""


# Caché LRU: la respuesta usada hace más tiempo es la primera en salir.
_cache: "OrderedDict[str, bytes]" = OrderedDict()
_bytes_en_cache = 0
_candado = threading.Lock()  # El servidor atiende varias peticiones a la vez.


def nombre_valido(nombre: str) -> bool:
    """Solo letras, números y guiones: evita pedir rutas raras a PokéAPI."""
    return 0 < len(nombre) <= 100 and all(c.isascii() and (c.isalnum() or c == "-") for c in nombre)


def consultar(ruta: str) -> bytes:
    """Devuelve el JSON de https://pokeapi.co/api/v2/<ruta>, usando la caché si ya se pidió."""
    global _bytes_en_cache
    partes = ruta.split("/")
    if len(partes) == 2 and partes[0] in config.RECURSOS_PERMITIDOS and nombre_valido(partes[1]):
        copia = snapshot.leer(partes[0], partes[1])
        if copia is not None:
            return copia
    with _candado:
        if ruta in _cache:
            _cache.move_to_end(ruta)
            return _cache[ruta]

    datos = descargar_red(ruta)
    with _candado:
        if ruta not in _cache:
            _cache[ruta] = datos
            _bytes_en_cache += len(datos)
            while _bytes_en_cache > config.CACHE_MAXIMO_BYTES and len(_cache) > 1:
                _, antiguo = _cache.popitem(last=False)
                _bytes_en_cache -= len(antiguo)
    return datos


def descargar_red(ruta: str) -> bytes:
    """Consulta la red directamente, incluso si ya existe una copia anterior."""
    solicitud = Request(f"{config.POKEAPI_URL}/{ruta}", headers={"User-Agent": config.USER_AGENT})
    try:
        with urlopen(solicitud, timeout=config.POKEAPI_TIEMPO_ESPERA) as respuesta:
            datos = respuesta.read()
    except HTTPError as error:  # Va antes que URLError porque es una subclase suya.
        raise (NoEncontrado if error.code == 404 else ErrorDeRespuesta)() from error
    except (URLError, TimeoutError, OSError) as error:
        raise SinConexion() from error

    return datos


def obtener_recurso(recurso: str, nombre: str) -> bytes:
    """Un Pokémon, tipo, especie, cadena evolutiva o habilidad."""
    return consultar(f"{recurso}/{quote(nombre)}")



# --- Pokédex compacta --------------------------------------------------------------

_pokedex: bytes | None = None
_candado_pokedex = threading.Lock()


def _id_desde_url(url: str) -> int:
    """"https://pokeapi.co/api/v2/pokemon/25/" → 25"""
    return int(url.rstrip("/").split("/")[-1])


def iniciar_snapshot():
    def reiniciar_cache():
        global _bytes_en_cache, _pokedex
        with _candado:
            _cache.clear()
            _bytes_en_cache = 0
        with _candado_pokedex:
            _pokedex = None
    snapshot.iniciar(descargar_red, reiniciar_cache)


def obtener_pokedex() -> bytes:
    """Todas las especies con sus tipos: [{"id": 1, "nombre": "bulbasaur", "tipos": ["grass", "poison"]}, ...].

    PokéAPI no tiene una consulta que dé esto de una vez, así que se arma con la lista de especies
    y los 18 tipos (19 consultas la primera vez; después sale de la memoria).
    """
    global _pokedex
    with _candado_pokedex:  # Si llegan dos peticiones a la vez, solo una la construye.
        if _pokedex is None:
            especies_locales = snapshot.listar_especies()
            especies = especies_locales if especies_locales is not None else json.loads(consultar("pokemon-species?limit=2000"))["results"]
            with ThreadPoolExecutor(max_workers=6) as grupo:
                datos_tipos = list(grupo.map(lambda tipo: json.loads(consultar(f"type/{tipo}")), config.TIPOS))
            tipos_por_id: dict[int, dict[int, str]] = {}
            for tipo, datos in zip(config.TIPOS, datos_tipos):
                for entrada in datos["pokemon"]:
                    tipos_por_id.setdefault(_id_desde_url(entrada["pokemon"]["url"]), {})[entrada["slot"]] = tipo
            lista = []
            for especie in especies:
                id_ = especie["id"] if especies_locales is not None else _id_desde_url(especie["url"])
                tipos = [tipo for _, tipo in sorted(tipos_por_id.get(id_, {}).items())]
                lista.append({"id": id_, "nombre": especie["name"], "tipos": tipos})
            lista.sort(key=lambda especie: especie["id"])
            _pokedex = json.dumps(lista, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return _pokedex
