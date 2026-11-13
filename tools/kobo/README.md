# WaiterLife para Kobo

`waiterlife/kobo/index.html` es WaiterLife adaptado al navegador del Kobo (probado pensando en el Clara 2E, firmware 4.38). Es la misma app, con las mismas funciones, la misma clave y los mismos datos que la versión del móvil:

- El código se pasa a JavaScript antiguo (ES5) con Babel y core-js, porque el navegador del Kobo es un WebKit viejo.
- El cifrado (SHA-256 y AES-GCM) lo hace SJCL en lugar de `crypto.subtle`, y es compatible con lo que cifra el móvil.
- En vez de mantener una conexión abierta con ntfy, pregunta cada 15 s. La escena se repinta cada 15 s (los personajes dicen sus frases) y justo después de cada toque.
- La escena se convierte a 16 grises con más contraste, sin luces de colores ni animaciones. Los menús son en blanco y negro, con letra grande (se cambia en ⋯).
- El chat va siempre por el canal cifrado del bar, porque el Kobo no tiene chat directo (WebRTC).

## Volver a generarlo

Cada vez que cambies `waiterlife/index.html`:

```sh
cd tools/kobo
npm install
npm run build
```

Si un cambio en la app rompe alguno de los parches, el build lo dice y para.

## Abrirlo en el Kobo

1. Ajustes → Funciones beta → Navegador web.
2. Abre `https://trastorillo.github.io/el-bailarin/waiterlife/kobo/#k=TU_CLAVE` (la misma clave del enlace privado).
3. La clave se queda guardada: luego basta con `…/waiterlife/kobo/`.
