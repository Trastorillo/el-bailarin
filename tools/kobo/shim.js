// ===== Piezas que le faltan al navegador del Kobo (WebKit antiguo) =====
// Se cargan antes que el código de WaiterLife. Babel + core-js ponen el resto (Promise, Set, padStart…).

// --- cifrado: SHA-256 y AES-GCM con SJCL, compatible con crypto.subtle de la app del móvil ---
const KSUBTLE = (function(){
  const toBits = u8 => sjcl.codec.bytes.toBits(Array.prototype.slice.call(new Uint8Array(u8.buffer ? u8.buffer : u8, u8.byteOffset || 0, u8.byteLength !== undefined ? u8.byteLength : u8.length)));
  const toBuf = bits => new Uint8Array(sjcl.codec.bytes.fromBits(bits)).buffer;
  return {
    digest(alg, data){ return new Promise(res => res(toBuf(sjcl.hash.sha256.hash(toBits(data))))) },
    importKey(fmt, raw){ return new Promise(res => res({ prf: new sjcl.cipher.aes(toBits(raw)) })) },
    encrypt(o, key, data){ return new Promise(res => res(toBuf(sjcl.mode.gcm.encrypt(key.prf, toBits(data), toBits(o.iv), [], 128)))) },
    decrypt(o, key, data){ return new Promise(res => res(toBuf(sjcl.mode.gcm.decrypt(key.prf, toBits(data), toBits(o.iv), [], 128)))) }
  };
})();
function kRand(u8){
  try{ if(window.crypto && crypto.getRandomValues) return crypto.getRandomValues(u8) }catch(e){}
  for(let n=0;n<u8.length;n++) u8[n] = Math.floor(Math.random()*256) ^ ((Date.now()>>(n%8)) & 255);
  return u8;
}

// --- texto <-> bytes ---
if(!window.TextEncoder){
  window.TextEncoder = function(){};
  TextEncoder.prototype.encode = function(s){ const b = unescape(encodeURIComponent(s)); const u = new Uint8Array(b.length); for(let n=0;n<b.length;n++) u[n] = b.charCodeAt(n); return u };
}
if(!window.TextDecoder){
  window.TextDecoder = function(){};
  TextDecoder.prototype.decode = function(buf){ const u = new Uint8Array(buf.buffer ? buf.buffer : buf); let s = ''; for(let n=0;n<u.length;n++) s += String.fromCharCode(u[n]); return decodeURIComponent(escape(s)) };
}

// --- fetch mínimo con XMLHttpRequest (solo lo que usa la app) ---
function kFetch(url, opts){
  opts = opts || {};
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open(opts.method || 'GET', url, true);
    x.timeout = 20000;
    x.onload = () => { const txt = x.responseText || ''; res({ ok: x.status >= 200 && x.status < 300, status: x.status, text: () => Promise.resolve(txt) }) };
    x.onerror = () => rej(new Error('red'));
    x.ontimeout = () => rej(new Error('tiempo'));
    x.send(opts.body == null ? null : opts.body);
  });
}

// --- DOM y canvas ---
if(!Element.prototype.matches) Element.prototype.matches = Element.prototype.webkitMatchesSelector;
if(!Element.prototype.closest) Element.prototype.closest = function(sel){ let el = this; while(el && el.nodeType === 1){ if(el.matches(sel)) return el; el = el.parentNode } return null };
if(!Element.prototype.remove) Element.prototype.remove = function(){ if(this.parentNode) this.parentNode.removeChild(this) };
if(window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.ellipse){
  CanvasRenderingContext2D.prototype.ellipse = function(x, y, rx, ry, rot, a0, a1, ccw){
    this.save(); this.translate(x, y); this.rotate(rot); this.scale(rx || 1e-6, ry || 1e-6);
    this.arc(0, 0, 1, a0, a1, ccw); this.restore();
  };
}
if(window.Blob && !Blob.prototype.text){
  Blob.prototype.text = function(){ const b = this; return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(b) }) };
}
if(!window.performance) window.performance = {};
if(!performance.now){ const t0 = Date.now(); performance.now = () => Date.now() - t0 }
try{ if(document.visibilityState === undefined) Object.defineProperty(document, 'visibilityState', { get: () => document.webkitVisibilityState || 'visible' }) }catch(e){}
// el Kobo no tiene eventos pointer: tocar = touchstart / mousedown
function kOnDown(fn){ document.addEventListener('touchstart', fn, true); document.addEventListener('mousedown', fn, true) }

// --- bucle de dibujo a ritmo de tinta electrónica ---
// La escena no se anima: se repinta cada 15 s (para que hablen los personajes) y justo después de cada toque o cambio.
const KOBO_TICK = 15000;
let kFrameCb = null, kTimer = null, kInFrame = false, kSaid = false;
window.requestAnimationFrame = function(cb){ kFrameCb = cb };
function kRun(){
  clearTimeout(kTimer); kTimer = null;
  const cb = kFrameCb; if(!cb) return;
  kFrameCb = null; kInFrame = true; kSaid = false;
  try{ cb(performance.now()) }catch(e){ console.log('frame', e && e.message) }
  // si alguien ha empezado a hablar en esta vuelta, se repinta ya para que el bocadillo salga en esta misma pantalla
  if(kSaid && kFrameCb){ const cb2 = kFrameCb; kFrameCb = null; KDT_ZERO = true; try{ cb2(performance.now()) }catch(e){} KDT_ZERO = false }
  kInFrame = false;
  try{ kInk() }catch(e){}
  kTimer = setTimeout(kRun, KOBO_TICK);
}
function kRedraw(ms){
  if(kInFrame) return;
  clearTimeout(kTimer); kTimer = setTimeout(kRun, ms == null ? 120 : ms);
}
let KDT_ZERO = false;
function kDt(sec){ return KDT_ZERO ? 0 : Math.max(0, Math.min(KOBO_TICK/1000, sec)) }
// tras cada toque, repintar la escena
document.addEventListener('click', () => kRedraw(150), true);

// valores que usa la app desde el arranque
let KSCH = 0;
const KSIZES = [16, 19, 22, 26, 30, 35];
let kSize = parseInt(lsGet('wl-kobo-size'), 10);
