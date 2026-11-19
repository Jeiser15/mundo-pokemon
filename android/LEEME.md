# App de Android

Una app mínima que muestra la web de Mundo Pokémon a pantalla completa (una *WebView*).

- **No hay que compilarla a mano.** GitHub la compila sola cada vez que se suben cambios de la web o de esta
  carpeta (`.github/workflows/apk.yml`) y deja el APK en la sección **Releases** del repositorio.
- **La web va dentro del APK.** Al compilar se copian `index.html` y `static/` a `app/src/main/assets/`
  (esa carpeta no se guarda en git). `MainActivity.java` los sirve con `WebViewAssetLoader`.
- **Sin servidor de Python.** En el celular no hay `app.py`: `static/js/api.js` lo detecta y pide los datos
  directamente a PokéAPI.

Para compilarla en tu PC harían falta Android Studio (o el SDK de Android) y Java 17: copia antes la web a
`app/src/main/assets/` como hace el flujo de GitHub.
