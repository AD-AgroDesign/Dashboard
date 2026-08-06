/* ============================================================================
 * agrodesign-mapa.js — Mapa público de intervenciones de AgroDesign
 *
 * Fuente única para las dos formas de embeber (ver embed/README.md):
 *   a) mapa-publico.html, que se inserta en la landing con un <iframe>
 *   b) <div data-agrodesign-mapa> + este <script> dentro de la propia landing
 *
 * Los datos salen de la vista `v_mapa_publico` (output_sql/add_mapa_publico.sql),
 * que expone SOLO lat/lng redondeados a ~1 km, ha_total y ha_naturaleza.
 * El nombre del campo y el del cliente no llegan al browser: quedan afuera de
 * la vista, no ocultos acá. No agregarlos al `select` de abajo.
 *
 * No depende de supabase-js: es un fetch plano a PostgREST.
 * Leaflet se carga solo si la página que embebe no lo trae ya.
 * ==========================================================================*/
(function () {
  'use strict';

  var SB_URL  = 'https://ivucpzmedseoanjrwutn.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2dWNwem1lZHNlb2FuanJ3dXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzIyODcsImV4cCI6MjA5NzgwODI4N30.fDk8fujjqyga6jRM9JxrGfwmlRl96O2PoYfQedHKTLE';
  var ENDPOINT = SB_URL + '/rest/v1/v_mapa_publico?select=lat,lng,ha_total,ha_naturaleza';

  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  var LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

  /* Paleta del dashboard, literal: fuera de index.html las custom properties
     de :root no existen. --acc / --hdr / --muted / --text / --border. */
  var CSS = [
    '.admapa-root { position:relative; width:100%; min-height:240px; background:#eef3e9; }',
    '.admapa-root .leaflet-container { width:100%; height:100%; background:#eef3e9; font:12px/1.4 "Segoe UI",Arial,sans-serif; }',
    /* tinte verde de la paleta sobre el basemap minimalista (igual que el Balance) */
    '.admapa-root .leaflet-tile-pane { filter:hue-rotate(58deg) saturate(.72) brightness(1.03); }',
    '.admapa-pin { width:18px; height:18px; border-radius:50% 50% 50% 0; background:#5aab28; border:2px solid #fff; transform:rotate(-45deg); box-shadow:0 2px 6px rgba(0,0,0,.4); }',
    '.admapa-pin::after { content:""; position:absolute; top:5px; left:5px; width:6px; height:6px; border-radius:50%; background:#2a5218; }',
    '.admapa-root .leaflet-popup-content-wrapper { border-radius:9px; box-shadow:0 4px 16px rgba(0,0,0,.25); }',
    '.admapa-root .leaflet-popup-content { margin:11px 14px; font-family:"Segoe UI",Arial,sans-serif; }',
    '.admapa-pop-name { font-size:13px; font-weight:800; color:#2a5218; margin-bottom:7px; }',
    '.admapa-pop-row { display:flex; justify-content:space-between; gap:18px; font-size:11.5px; padding:2px 0; }',
    '.admapa-pop-row span:first-child { color:#5a7a42; }',
    '.admapa-pop-row span:last-child { font-weight:700; color:#1e3210; }',
    '.admapa-pop-note { margin-top:7px; padding-top:6px; border-top:1px solid #c8ddb0; font-size:9px; line-height:1.35; color:#5a7a42; max-width:190px; }',
    /* capa "tocá para interactuar": sólo en táctil, para no secuestrar el scroll */
    '.admapa-tap { position:absolute; inset:0; z-index:600; display:flex; align-items:center; justify-content:center; background:rgba(30,50,16,.10); cursor:pointer; }',
    '.admapa-tap span { background:rgba(255,255,255,.94); color:#2a5218; font:600 12px/1 "Segoe UI",Arial,sans-serif; padding:9px 14px; border-radius:20px; box-shadow:0 2px 8px rgba(0,0,0,.2); }',
    '.admapa-msg { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:600; background:rgba(255,255,255,.94); color:#5a7a42; font:600 11px/1 "Segoe UI",Arial,sans-serif; padding:7px 12px; border-radius:14px; box-shadow:0 2px 8px rgba(0,0,0,.15); }'
  ].join('\n');

  /* Formato es-AR con 2 decimales — igual que _fmt() del dashboard */
  function fmt(n) {
    return (n == null || isNaN(n)) ? '—'
      : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function injectCSS() {
    if (document.getElementById('admapa-css')) return;
    var s = document.createElement('style');
    s.id = 'admapa-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* Carga Leaflet una sola vez; si la página que embebe ya lo trae, lo reusa. */
  var _leafletP = null;
  function ensureLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (_leafletP) return _leafletP;
    _leafletP = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[href="' + LEAFLET_CSS + '"]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      var sc = document.createElement('script');
      sc.src = LEAFLET_JS;
      sc.async = true;
      sc.onload  = function () { resolve(window.L); };
      sc.onerror = function () { reject(new Error('No se pudo cargar Leaflet')); };
      document.head.appendChild(sc);
    });
    return _leafletP;
  }

  function fetchPuntos() {
    return fetch(ENDPOINT, {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON, Accept: 'application/json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function msg(el, text) {
    var d = document.createElement('div');
    d.className = 'admapa-msg';
    d.textContent = text;
    el.appendChild(d);
  }

  function render(el, L, rows) {
    var map = L.map(el, {
      scrollWheelZoom: false,        // se activa al hacer click: si no, la rueda
      dragging: !L.Browser.mobile,   // secuestra el scroll de la landing
      worldCopyJump: true, zoomControl: true,
      zoomSnap: 0.25, zoomDelta: 0.25, wheelPxPerZoomLevel: 120
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO', subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    var pin = L.divIcon({ className: '', html: '<div class="admapa-pin"></div>',
                          iconSize: [18, 18], iconAnchor: [9, 17], popupAnchor: [0, -16] });
    var pts = [];
    (rows || []).forEach(function (x) {
      var lat = parseFloat(x.lat), lng = parseFloat(x.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      /* Sin nombre ni cliente: rótulo genérico. Nada de lo que se concatena
         acá viene de un texto libre de la base. */
      var html = '<div class="admapa-pop-name">Establecimiento rediseñado</div>'
        + '<div class="admapa-pop-row"><span>Ha. totales</span><span>' + fmt(x.ha_total) + '</span></div>'
        + '<div class="admapa-pop-row"><span>Ha. naturaleza</span><span>' + fmt(x.ha_naturaleza) + '</span></div>'
        + '<div class="admapa-pop-note">Ubicación aproximada para resguardar los datos del cliente.</div>';
      L.marker([lat, lng], { icon: pin }).addTo(map).bindPopup(html);
      pts.push([lat, lng]);
    });

    if (pts.length >= 2)       map.fitBounds(pts, { padding: [40, 40], maxZoom: 11 });
    else if (pts.length === 1) map.setView(pts[0], 9);
    else                       map.setView([-38, -63], 4);   // Argentina por defecto

    /* Rueda: sólo después de un click dentro del mapa */
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

    /* Táctil: el dedo scrollea la página hasta que el usuario toca el mapa */
    if (L.Browser.mobile) {
      var tap = document.createElement('div');
      tap.className = 'admapa-tap';
      tap.innerHTML = '<span>Tocá el mapa para explorarlo</span>';
      tap.addEventListener('click', function () {
        map.dragging.enable();
        tap.parentNode && tap.parentNode.removeChild(tap);
      });
      el.appendChild(tap);
    }

    setTimeout(function () { map.invalidateSize(); }, 80);
    el._admapaMap = map;   // instancia Leaflet, para depurar desde la consola
    return map;
  }

  function mount(el) {
    if (el._admapaMounted) return;
    el._admapaMounted = true;
    injectCSS();
    el.classList.add('admapa-root');
    if (!el.style.height && el.clientHeight < 100) el.style.height = '480px';

    Promise.all([ensureLeaflet(), fetchPuntos()]).then(function (res) {
      var L = res[0], rows = res[1];
      render(el, L, rows);
      if (!rows || !rows.length) msg(el, 'Todavía no hay intervenciones publicadas.');
    })['catch'](function (e) {
      /* Nunca romper la página que embebe: mapa vacío + aviso discreto */
      if (window.L && window.L.map) { try { render(el, window.L, []); } catch (_) {} }
      msg(el, 'No se pudo cargar el mapa.');
      if (window.console) console.warn('[agrodesign-mapa]', e && e.message ? e.message : e);
    });
  }

  function boot() {
    var els = document.querySelectorAll('[data-agrodesign-mapa], #agrodesign-mapa');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Por si la landing inserta el contenedor después (slider, tab, etc.) */
  window.agrodesignMapa = { mount: mount, boot: boot };
})();
