"""Rutas HTTP del servidor.

    /                              → index.html
    /static/<ruta>                 → archivos de la carpeta static/ (CSS, JS, imágenes)
    /api/pokedex                   → todas las especies con sus tipos (lista compacta)
    /api/<recurso>/<nombre>        → pokemon, type, pokemon-species, evolution-chain, ability
"""
from __future__ import annotations

import json
from email.utils import formatdate, parsedate_to_datetime
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse

from . import config, pokeapi, snapshot


class ManejadorPokedex(BaseHTTPRequestHandler):
    server_version = "Pokedex/1.0"

    def do_GET(self):
        url = urlparse(self.path)
        ruta = url.path

        if ruta == "/":
            self.enviar_archivo(config.PAGINA_PRINCIPAL)
        elif ruta.startswith("/static/"):
            self.servir_estatico(ruta.removeprefix("/static/"))
        elif ruta == "/api/snapshot":
            self.responder_json(200, snapshot.estado())
        elif ruta == "/api/pokedex":
            try:
                self.responder_api(pokeapi.obtener_pokedex())
            except pokeapi.ErrorPokeAPI:
                self.responder_json(502, {"error": "No se pudo cargar la Pokédex. Comprueba tu conexión e inténtalo de nuevo."})
        else:
            partes = ruta.split("/", 3)  # "/api/pokemon/pikachu" → ['', 'api', 'pokemon', 'pikachu']
            if len(partes) == 4 and partes[1] == "api" and partes[2] in config.RECURSOS_PERMITIDOS:
                self.api_recurso(partes[2], partes[3])
            else:
                self.responder_json(404, {"error": "Página no encontrada."})

    # --- Archivos ---------------------------------------------------------------

    def servir_estatico(self, relativa: str):
        carpeta = config.CARPETA_ESTATICOS.resolve()
        archivo = (carpeta / unquote(relativa)).resolve()
        # resolve() + is_relative_to() impide salir de static/ con rutas como "../app.py".
        if not archivo.is_relative_to(carpeta) or not archivo.is_file():
            self.responder_json(404, {"error": "Archivo no encontrado."})
            return
        self.enviar_archivo(archivo)

    def enviar_archivo(self, archivo: Path):
        """Envía un archivo. El navegador lo guarda, pero pregunta si cambió antes de reutilizarlo."""
        modificado = int(archivo.stat().st_mtime)
        cabeceras = {"Last-Modified": formatdate(modificado, usegmt=True), "Cache-Control": "no-cache"}
        desde = self.headers.get("If-Modified-Since")
        if desde:
            try:
                if modificado <= parsedate_to_datetime(desde).timestamp():
                    self.responder(304, b"", None, cabeceras)  # Sin cambios: el navegador usa su copia.
                    return
            except (TypeError, ValueError):
                pass
        tipo = config.TIPOS_MIME.get(archivo.suffix.lower(), "application/octet-stream")
        self.responder(200, archivo.read_bytes(), tipo, cabeceras)

    # --- API (proxy de PokéAPI) -------------------------------------------------


    def api_recurso(self, recurso: str, nombre: str):
        nombre = nombre.strip().lower()
        if not pokeapi.nombre_valido(nombre):
            self.responder_json(400, {"error": "Escribe un nombre o número válido."})
            return
        try:
            self.responder_api(pokeapi.obtener_recurso(recurso, nombre))
        except pokeapi.NoEncontrado:
            self.responder_json(404, {"error": "No encontramos ese Pokémon."})
        except pokeapi.ErrorDeRespuesta:
            self.responder_json(502, {"error": "PokéAPI no pudo responder. Inténtalo de nuevo."})
        except pokeapi.SinConexion:
            self.responder_json(502, {"error": "No se pudo conectar con PokéAPI. Comprueba tu conexión a internet."})

    # --- Respuestas -------------------------------------------------------------

    def responder_api(self, contenido: bytes):
        self.responder(200, contenido, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def responder_json(self, codigo: int, datos: dict):
        contenido = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.responder(codigo, contenido, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def responder(self, codigo: int, contenido: bytes, tipo: str | None, cabeceras: dict):
        self.send_response(codigo)
        if tipo:
            self.send_header("Content-Type", tipo)
        for nombre, valor in cabeceras.items():
            self.send_header(nombre, valor)
        self.send_header("Content-Length", str(len(contenido)))
        self.end_headers()
        self.wfile.write(contenido)
