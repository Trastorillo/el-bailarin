// Genera waiterlife/kobo/index.html a partir de waiterlife/index.html.
// Uso:  cd tools/kobo && npm install && npm run build
// La versión Kobo es la MISMA app (mismas funciones, misma clave y mismos datos de ntfy),
// pasada a JavaScript antiguo (ES5) y con una capa visual para tinta electrónica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as babel from '@babel/core';
import * as esbuild from 'esbuild';
import * as acorn from 'acorn';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const SRC = path.join(root, 'waiterlife/index.html');
const OUT = path.join(root, 'waiterlife/kobo/index.html');

const html = fs.readFileSync(SRC, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error('se esperaba un único <script> en línea');
let app = scripts[0][1];
const body = /<body>([\s\S]*?)<script/.exec(html)[1];

// ---------- cambios sobre el código de la app ----------
function patch(from, to, count = 1) {
  const n = app.split(from).length - 1;
  if (n !== count) throw new Error(`parche: "${from.slice(0, 60)}" aparece ${n} veces (esperaba ${count}). ¿Ha cambiado waiterlife/index.html?`);
  app = app.split(from).join(to);
}
// cifrado y red con los sustitutos de shim.js
patch("if(!sec||!window.crypto||!crypto.subtle)", "if(!sec)");
patch('crypto.subtle.', 'KSUBTLE.', 4);
patch('crypto.getRandomValues(', 'kRand(');
patch('await fetch(', 'await kFetch(', 2);
// sin eventos pointer en el Kobo
patch("document.addEventListener('pointerdown',", 'kOnDown(');
// funciones que shim/overrides envuelven o sustituyen
patch('function say(', 'function _orig_say(');
patch('function openStream(', 'function _orig_openStream(');
patch('function refreshUI(', 'function _orig_refreshUI(');
patch('function resize(', 'function _orig_resize(');
// dibujo a saltos de 15 s: los personajes llegan directamente a su sitio
patch('const dt=Math.min(.1,(t-lastT)/1000);', 'const dt=kDt((t-lastT)/1000);');
patch('  stepAnim(dt);', '  {let kk=0;while(kk++<400&&Object.keys(ANIM).some(id=>ANIM[id].path.length))stepAnim(.25);stepAnim(0)}');
// fuera luces de colores y viñeta oscura (en grises solo ensucian)
patch('    drawLights(ctx,t,ev);\n', '');
patch('  drawVignette(ctx,t);\n', '');
// vertical: la escena ocupa justo el ancho (sin desplazarla a los lados)
patch('if(pt){NH=250;SC=Math.max(st.width/NW,Math.min(1.7*st.width/NW,st.height*.5/NH))}', 'if(pt){NH=250;SC=st.width/NW}');
patch("$('#stage').style.setProperty('--sch',Math.floor(NH*SC)+'px');", 'KSCH=Math.floor(NH*SC);');
// resolución interna más baja: el procesador del Kobo es lento
patch('K=Math.max(2,Math.min(7,Math.ceil(SC*(window.devicePixelRatio||1))));', 'K=Math.max(2,Math.min(3,Math.ceil(SC*(window.devicePixelRatio||1))));');
// fondo alrededor de la escena en blanco (no negro)
patch("g.fillStyle='#140b1d'; g.fillRect(0,0,stat.width,stat.height);", "g.fillStyle='#ffffff'; g.fillRect(0,0,stat.width,stat.height);");
// el Kobo no tiene chat directo (WebRTC): siempre va por el canal cifrado del bar
patch(":p2pState==='ok'?'nadie en directo':'conectando…';", ":'por el canal del bar (cada 15 s)';");
// avisos más largos (la pantalla tarda en refrescar)
patch('setTimeout(()=>t.remove(),4200)', 'setTimeout(()=>t.remove(),9000)');
// emojis en blanco y negro (Noto Emoji) también dentro de la escena
app = app.split("px serif'").join("px \"Noto Emoji\",serif'");
app = app.split('VT323,monospace').join('VT323,"Noto Emoji",monospace');

const shim = fs.readFileSync(path.join(here, 'shim.js'), 'utf8');
const over = fs.readFileSync(path.join(here, 'overrides.js'), 'utf8');
const modern = shim + '\n' + app.replace(/^\s*'use strict';/, '') + '\n' + over;

// ---------- a ES5: babel (+ core-js lo que haga falta) -> esbuild (un solo archivo) -> babel ----------
const targets = { safari: '5.1' };
const tmp = path.join(here, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
const step1 = babel.transformSync(modern, {
  filename: 'app.js', babelrc: false, configFile: false, sourceType: 'script',
  presets: [[require.resolve('@babel/preset-env'), { targets, modules: false }]],
  plugins: [[require.resolve('babel-plugin-polyfill-corejs3'), { method: 'usage-global', version: require('core-js/package.json').version, targets }]]
}).code;
fs.writeFileSync(path.join(tmp, 'app.js'), step1);
const bundled = (await esbuild.build({ entryPoints: [path.join(tmp, 'app.js')], bundle: true, write: false, format: 'iife', target: 'es2015', minify: true, logLevel: 'error', absWorkingDir: here, nodePaths: [path.join(here, 'node_modules')] })).outputFiles[0].text;
const es5 = babel.transformSync(bundled, {
  babelrc: false, configFile: false, sourceType: 'script', compact: true, comments: false,
  presets: [[require.resolve('@babel/preset-env'), { targets, modules: false }]]
}).code;
acorn.parse(es5, { ecmaVersion: 5 }); // falla si queda algo moderno
fs.rmSync(tmp, { recursive: true, force: true });

// SJCL (ES3, sin tocar): solo las piezas necesarias
const sj = ['sjcl', 'aes', 'bitArray', 'codecBytes', 'sha256', 'gcm'].map(f => fs.readFileSync(require.resolve(`sjcl/core/${f}.js`), 'utf8')).join('\n');
const sjcl = `(function(){${sj}\nwindow.sjcl=sjcl;})();`;
acorn.parse(sjcl, { ecmaVersion: 5 });

const css = fs.readFileSync(path.join(here, 'kobo.css'), 'utf8');
const out = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>WaiterLife Kobo</title>
<link rel="icon" href="../icon-192.png">
<!-- Generado por tools/kobo/build.mjs a partir de ../index.html. No editar a mano: cambia la app normal y vuelve a generar. -->
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Noto+Emoji&display=swap" rel="stylesheet">
<style>
${css}</style>
</head>
<body>
${body.trim()}

<script>
${sjcl}
</script>
<script>
${es5}
</script>
</body>
</html>
`;
fs.writeFileSync(OUT, out);
console.log('OK ->', path.relative(root, OUT), Math.round(out.length / 1024) + ' KB');
