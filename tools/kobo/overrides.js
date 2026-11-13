window.__kstep = 'ajustes';
// ===== Ajustes de WaiterLife para el Kobo (van después del código de la app) =====

// --- datos: en vez de un stream (EventSource), preguntar a ntfy cada 15 s ---
let kPollGen = 0;
function openStream(){
  clearTimeout(esTimer); const gen = ++kPollGen;
  const go = async () => {
    if(gen !== kPollGen) return;
    try{
      const res = await kFetch(NTFY + TOPIC + '/json?poll=1&since=' + (lastId ? encodeURIComponent(lastId) : '1m'));
      if(!res.ok) throw new Error('http ' + res.status);
      const txt = await res.text();
      for(const line of txt.split('\n')){ if(!line.trim()) continue; try{ await handleNtfy(JSON.parse(line), true) }catch(e){} }
      setStatus('live');
    }catch(e){ setStatus(navigator.onLine === false ? 'off' : 'sync') }
    if(gen === kPollGen) esTimer = setTimeout(go, KOBO_TICK);
  };
  go();
}

// --- bocadillos: duran casi una vuelta entera de refresco para que se lean en la pantalla de tinta ---
function say(id, text, ms){
  _orig_say(id, text, Math.max(ms || 4500, KOBO_TICK - 1000));
  if(kInFrame) kSaid = true; else kRedraw(200);
}
function refreshUI(){ _orig_refreshUI(); kRedraw(250) }

// --- tamaño de letra: el Kobo tiene mucha resolución; se puede cambiar en ⋯ ---
function kAutoSize(){ const w = Math.min(window.innerWidth || 600, window.innerHeight || 800); return w >= 1000 ? 30 : w >= 760 ? 26 : w >= 560 ? 22 : 19 }
function kApplySize(){ document.documentElement.style.fontSize = (kSize || kAutoSize()) + 'px' }
function kStepSize(d){
  const cur = kSize || kAutoSize(); let n = 0; while(n < KSIZES.length - 1 && KSIZES[n] < cur) n++;
  n = Math.max(0, Math.min(KSIZES.length - 1, n + d)); kSize = KSIZES[n]; lsSet('wl-kobo-size', String(kSize)); kApplySize(); resize();
}

// --- colocación: escena arriba a todo lo ancho, menús y fichas debajo ---
function resize(){
  kApplySize();
  _orig_resize();
  let el = document.getElementById('kdyn');
  if(!el){ el = document.createElement('style'); el.id = 'kdyn'; document.head.appendChild(el) }
  const h = KSCH + 3;
  el.textContent = '#pop,.drop,#chat{top:' + h + 'px!important;left:0!important;bottom:0;max-height:none}' +
    '#tabs{top:' + h + 'px}';
  kRedraw(100);
}

// --- de color a grises con contraste, pensado para los 16 grises de la tinta electrónica ---
const KCURVE = (function(){
  const c = new Uint8Array(256);
  for(let v = 0; v < 256; v++){
    let y = Math.pow(v / 255, 0.62);          // aclara las sombras del bar (de noche es muy oscuro)
    y = (y - 0.5) * 1.35 + 0.56;              // más contraste
    y = Math.max(0, Math.min(1, y));
    c[v] = Math.round(Math.round(y * 15) * 17); // 16 niveles
  }
  return c;
})();
function kInk(){
  const w = cv.width, h = cv.height; if(!w || !h) return;
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for(let n = 0; n < d.length; n += 4){ const v = KCURVE[(d[n] * 77 + d[n + 1] * 150 + d[n + 2] * 29) >> 8]; d[n] = d[n + 1] = d[n + 2] = v; d[n + 3] = 255 }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.putImageData(im, 0, 0);
}

// --- botones extra en ⋯ : tamaño de letra y refrescar ya ---
(function(){
  const b = $('#bMore'), old = b.onclick;
  b.onclick = e => {
    old(e);
    if(!openDrop) return;
    const box = openDrop;
    const sz = item(box, null, '🔠 Tamaño de letra', 'Ahora: ' + (kSize || kAutoSize()) + ' px', null);
    sz.onclick = null;
    sz.appendChild(miniBtn('A−', () => { kStepSize(-1); closeDrop() }));
    sz.appendChild(miniBtn('A+', () => { kStepSize(1); closeDrop() }));
    item(box, null, '🔄 Actualizar ahora', 'La pantalla se refresca sola cada 15 s', () => { closeDrop(); openStream(); kRedraw(50) });
    item(box, null, '📱 Versión normal', 'La de móvil, con animaciones', () => { location.href = '../' + location.hash });
  };
})();

// --- las fuentes web tardan en el Kobo: repintar el fondo cuando lleguen ---
setTimeout(() => { buildStatic(); kRedraw(50) }, 2500);
setTimeout(() => { buildStatic(); kRedraw(50) }, 8000);

// --- arranque del bucle ---
resize();
kRedraw(300);

window.__kstep = 'en marcha';
