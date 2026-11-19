"""Punto de entrada de Mundo Pokémon.

Uso:
    python app.py               → http://127.0.0.1:8000
    python app.py --puerto 8080 → si el 8000 está ocupado
"""
import argparse
import os
from http.server import ThreadingHTTPServer

from servidor import config, pokeapi
from servidor.rutas import ManejadorPokedex


class Servidor(ThreadingHTTPServer):
    # En Windows, reutilizar la dirección dejaría abrir dos servidores en el mismo
    # puerto sin dar error; así avisamos si el puerto ya está ocupado.
    allow_reuse_address = os.name != "nt"


def main():
    argumentos = argparse.ArgumentParser(description="Servidor local de Mundo Pokémon.")
    argumentos.add_argument("--puerto", type=int, default=config.PUERTO, help=f"puerto local (por defecto {config.PUERTO})")
    puerto = argumentos.parse_args().puerto

    try:
        servidor = Servidor((config.HOST, puerto), ManejadorPokedex)
    except OSError:
        print(f"No se pudo abrir el puerto {puerto}: puede que otro programa lo esté usando.")
        print(f"Prueba con otro, por ejemplo: python app.py --puerto {puerto + 80}")
        return

    pokeapi.iniciar_snapshot()
    print(f"Abre http://{config.HOST}:{puerto} en tu navegador. Para detenerlo, pulsa Ctrl+C.", flush=True)
    print("El snapshot local se prepara en segundo plano y se actualiza cada 24 horas.", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
