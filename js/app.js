/* ============================================================
   app.js — Boletín LA BUENA v3.1 (Situational Awareness Edition)
   Autor: oscaromargp (https://oscaromargp.github.io/Oscaromargp/)
   APIs: Open-Meteo, CoinGecko, rss2json, bible-api, Leaflet
   ============================================================ */

'use strict';

/* ================================================================
   HELPERS
   ================================================================ */
const $ = id => document.getElementById(id);

function dow() { return new Date().getDay(); }

function windDir(deg) {
  return ['N','NE','E','SE','S','SO','O','NO'][Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv < 3)  return { label:'Bajo',     cls:'uv-low',   e:'🟢' };
  if (uv < 6)  return { label:'Moderado', cls:'uv-mod',   e:'🟡' };
  if (uv < 8)  return { label:'Alto',     cls:'uv-high',  e:'🟠' };
  if (uv < 11) return { label:'Muy Alto', cls:'uv-vhigh', e:'🔴' };
  return             { label:'Extremo',   cls:'uv-vhigh', e:'☠️' };
}

function confortLabel(feels) {
  if (feels < 20) return { label:'Fresco 🧥',         cls:'confort-ok'   };
  if (feels < 28) return { label:'Confortable 😊',    cls:'confort-ok'   };
  if (feels < 33) return { label:'Calor moderado 😅', cls:'confort-mod'  };
  if (feels < 37) return { label:'Calor fuerte 🥵',   cls:'confort-hot'  };
  return               { label:'Peligroso 🚨',        cls:'confort-xhot' };
}

function fishingIndex(w) {
  let score = 0;
  const wind  = w.current.wind_speed_10m;
  const uv    = w.current.uv_index ?? 5;
  const temp  = w.current.temperature_2m;
  const hour  = new Date().getHours();
  if (wind < 10)       score += 40;
  else if (wind < 20)  score += 25;
  else if (wind < 30)  score += 10;
  if (uv < 5)          score += 20;
  else if (uv < 8)     score += 10;
  if (temp >= 20 && temp <= 30) score += 20;
  else if (temp > 30 && temp <= 34) score += 10;
  if ((hour >= 5 && hour <= 9) || (hour >= 16 && hour <= 19)) score += 20;
  else if (hour >= 10 && hour <= 15) score += 5;
  return Math.min(100, score);
}

function fishColor(i) {
  if (i >= 75) return '#10b981';
  if (i >= 50) return '#f59e0b';
  if (i >= 25) return '#f97316';
  return '#ef4444';
}

function fmtDate(str) {
  try { return new Date(str).toLocaleDateString('es-MX', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }
  catch { return str; }
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'ahora';
  if (diff < 60) return `hace ${diff}m`;
  return `hace ${Math.floor(diff/60)}h`;
}

/* ================================================================
   DATE / TIME
   ================================================================ */
function renderDateTime() {
  const now = new Date();
  const dayStr = now.toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const timeStr = now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const el = $('dateTime');
  if (el) el.innerHTML = `
    <div class="day">${dayStr.charAt(0).toUpperCase()+dayStr.slice(1)}</div>
    <div class="hud-time">${timeStr} · La Paz, BCS · UTC-7</div>`;
}

/* ================================================================
   TL;DR
   ================================================================ */
function renderTldr() {
  const daily    = getDaily();
  const settings = getSettings();
  const name     = settings.user.name;
  const moodTexts = {
    energy: `Energía máxima, ${name}. Día de ir por lo que más importa. ¡Sin frenos!`,
    calm:   `Día de flujo suave, ${name}. Perfecto para tareas de profundidad. Confía en tu ritmo.`,
    tired:  `Ritmo moderado hoy, ${name}. Prioriza lo esencial. Lo importante es seguir.`,
    focus:  `Modo láser, ${name}. Elimina distracciones. Tienes todo lo necesario.`
  };
  const base = daily.mood
    ? moodTexts[daily.mood]
    : `Dashboard activo, ${name}. Intel global, mareas, clima y proyectos — todo listo.`;
  const priText = (daily.priorities||[]).filter(p=>p.trim()).length
    ? ` ${(daily.priorities).filter(p=>p.trim()).length} prioridad(es) activas.` : '';
  const focusProj = daily.focusProject ? CFG.projects.find(p => p.id === daily.focusProject) : null;
  const focusTxt = focusProj ? ` Foco: ${focusProj.emoji} ${focusProj.name}.` : '';
  const sonTxt = daily.withSon ? ' 💖 ¡Hoy estás con tu hijo!' : '';
  const tldr = $('tldrText');
  if (tldr) tldr.textContent = base + priText + focusTxt + sonTxt;
}

/* ================================================================
   KANBAN BOARD — Prioridades Trello-style con Drag & Drop
   ================================================================ */
const KANBAN_KEY = 'boletin_kanban';

function getKanban() {
  try { return JSON.parse(localStorage.getItem(KANBAN_KEY) || '{"backlog":[],"doing":[],"done":[]}'); }
  catch { return { backlog:[], doing:[], done:[] }; }
}

function saveKanban(data) {
  localStorage.setItem(KANBAN_KEY, JSON.stringify(data));
}

function renderKanban() {
  const data = getKanban();
  const cols = ['backlog', 'doing', 'done'];
  const colColors = { backlog: '#64748b', doing: '#3b82f6', done: '#10b981' };

  cols.forEach(col => {
    const list = $(`klist-${col}`);
    const count = $(`count-${col}`);
    if (!list) return;

    const cards = data[col] || [];
    if (count) count.textContent = cards.length;

    list.innerHTML = cards.map((card, i) => `
      <div class="kanban-card-item" data-id="${esc(card.id)}" data-col="${col}">
        <div class="kanban-card-text">${esc(card.text)}</div>
        <div class="kanban-card-meta">
          ${card.project ? `<span class="kanban-tag" style="background:${_getProjectColor(card.project)}20;color:${_getProjectColor(card.project)}">${esc(card.project)}</span>` : ''}
          <div class="kanban-card-actions">
            ${col !== 'doing' ? `<button class="kbtn" onclick="moveKanbanCard('${card.id}','${col}','doing')" title="→ En Curso">⚡</button>` : ''}
            ${col !== 'done'  ? `<button class="kbtn" onclick="moveKanbanCard('${card.id}','${col}','done')"  title="✓ Listo">✅</button>` : ''}
            <button class="kbtn kbtn-del" onclick="deleteKanbanCard('${card.id}','${col}')" title="Eliminar">✕</button>
          </div>
        </div>
      </div>`).join('') || `<div class="kanban-empty">Sin tarjetas</div>`;
  });

  // Inicializar Sortable si está disponible
  _initSortable();
}

function _getProjectColor(name) {
  const p = CFG.projects.find(p => p.name === name || p.id === name);
  return p ? p.color : '#64748b';
}

function _initSortable() {
  if (typeof Sortable === 'undefined') return;
  ['backlog','doing','done'].forEach(col => {
    const el = $(`klist-${col}`);
    if (!el) return;
    if (el._sortable) {
      el._sortable.destroy();
    }
    el._sortable = new Sortable(el, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'kanban-ghost',
      dragClass: 'kanban-drag',
      onEnd(evt) {
        const data = getKanban();
        const fromCol = evt.from.dataset.col;
        const toCol   = evt.to.dataset.col;
        const cardId  = evt.item.dataset.id;
        const oldIdx  = evt.oldIndex;
        const newIdx  = evt.newIndex;

        if (fromCol === toCol) {
          const arr = data[fromCol];
          const [card] = arr.splice(oldIdx, 1);
          arr.splice(newIdx, 0, card);
        } else {
          const card = data[fromCol].find(c => c.id === cardId);
          if (card) {
            data[fromCol] = data[fromCol].filter(c => c.id !== cardId);
            data[toCol].splice(newIdx, 0, card);
          }
        }
        saveKanban(data);
        renderKanban();
        renderPriorities(); // sync con sección clásica
      }
    });
  });
}

function addKanbanCard(col) {
  const text = prompt('Nueva tarea:');
  if (!text || !text.trim()) return;
  const data = getKanban();
  if (!data[col]) data[col] = [];
  data[col].unshift({ id: 'k_' + Date.now(), text: text.trim(), created: new Date().toISOString() });
  saveKanban(data);
  renderKanban();
}

function moveKanbanCard(id, fromCol, toCol) {
  const data = getKanban();
  const card = (data[fromCol] || []).find(c => c.id === id);
  if (!card) return;
  data[fromCol] = data[fromCol].filter(c => c.id !== id);
  if (!data[toCol]) data[toCol] = [];
  data[toCol].unshift(card);
  saveKanban(data);
  renderKanban();
}

function deleteKanbanCard(id, col) {
  if (!confirm('¿Eliminar esta tarjeta?')) return;
  const data = getKanban();
  data[col] = (data[col] || []).filter(c => c.id !== id);
  saveKanban(data);
  renderKanban();
}

async function syncGithubData(btn) {
  if (btn) btn.textContent = '🔄...';
  try {
    const success = await window.GithubSync.syncDown();
    if (success) {
      renderKanban();
      renderPriorities();
      renderDiaTab();
    }
    await window.GithubSync.syncUp(); // Push local changes just in case
    if (btn) btn.textContent = '✅ Sincronizado';
    setTimeout(() => { if (btn) btn.textContent = '⬆⬇ Sincronizar'; }, 3000);
  } catch (err) {
    if (btn) btn.textContent = '❌ Error';
    setTimeout(() => { if (btn) btn.textContent = '⬆⬇ Sincronizar'; }, 3000);
  }
}

// Override saveKanban to trigger async push optionally (debounced to avoid rate limit)
let syncTimeout;
const _origSaveKanban = saveKanban;
window.saveKanban = function(data) {
  _origSaveKanban.call(this, data);
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    window.GithubSync.syncUp();
  }, 5000);
};

/* ================================================================
   PRIORITIES (sección clásica - refleja Kanban "doing")
   ================================================================ */
function renderPriorities() {
  const daily = getDaily();
  const kanban = getKanban();
  const el = $('s-priorities');
  if (!el) return;

  // Mostrar siempre si tiene tarjetas kanban o prioridades del día
  const hasPris = (daily.priorities || []).filter(p=>p.trim()).length > 0;
  const hasKanban = (kanban.backlog||[]).length + (kanban.doing||[]).length + (kanban.done||[]).length > 0;

  el.style.display = (hasPris || hasKanban) ? '' : 'none';
  renderKanban();
}

/* ================================================================
   MAPA SITUACIONAL — Toggle Colapsable con coord exactas BCS
   ================================================================ */
let _mapInitialized = false;
let _mapExpanded = false;

function toggleMap() {
  _mapExpanded = !_mapExpanded;
  const col = $('mapCollapsible');
  const btn = $('mapToggleBtn');

  if (col) col.style.display = _mapExpanded ? 'block' : 'none';
  if (btn) btn.textContent = _mapExpanded ? '▲ Colapsar' : '▼ Expandir';

  if (_mapExpanded && !_mapInitialized) {
    initSitMap();
  }
}

function initSitMap() {
  const mapEl = $('situationalMap');
  if (!mapEl || _mapInitialized) return;
  _mapInitialized = true;

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => _buildMap();
  document.head.appendChild(script);
}

function _buildMap() {
  const mapEl = $('situationalMap');
  if (!mapEl || !window.L) return;

  // Centro: La Paz, BCS
  const map = L.map('situationalMap', {
    center: [24.1426, -110.3128],
    zoom: 9,
    zoomControl: true,
    attributionControl: true
  });

  // Tile oscuro HUD
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  const cityIcon = (color, size = 10) => L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 10px ${color};"></div>`,
    className: '',
    iconSize: [size+4, size+4]
  });

  // PUNTOS GEOGRÁFICOS EXACTOS — BCS
  // Coordenadas validadas (ref: INEGI / Google Maps / AEGIS-OSINT)
  const pois = [
    {
      lat: 24.1426, lon: -110.3128,
      name: '🏠 La Paz — Base de operaciones',
      color: '#10b981', size: 12,
      info: 'Capital BCS · Tu hogar · UTC-7'
    },
    {
      // El Mogote — coordenadas exactas corregidas
      lat: 24.1585, lon: -110.3454,
      name: '⚓ El Mogote — Zona de pesca',
      color: '#06b6d4', size: 11,
      info: 'Spot: Dorado, Jurel, Pargo · Pleamar = mejor pesca'
    },
    {
      lat: 24.0477, lon: -110.0660,
      name: '🪁 La Ventana',
      color: '#f59e0b', size: 9,
      info: 'Kitesurf mundial · Playa prístina · Comunidad global'
    },
    {
      lat: 23.4417, lon: -110.2200,
      name: '🏙️ Todos Santos',
      color: '#8b5cf6', size: 9,
      info: 'Pueblo Mágico · Arte · Gastronomía gourmet'
    },
    {
      lat: 22.8897, lon: -109.9167,
      name: '⚡ Cabo San Lucas',
      color: '#ef4444', size: 9,
      info: 'Turismo · Marina · Zona de alta plusvalía'
    },
    {
      lat: 23.7900, lon: -110.0200,
      name: '⛏️ El Triunfo',
      color: '#94a3b8', size: 8,
      info: 'Pueblo minero histórico · Café de altura'
    }
  ];

  pois.forEach(p => {
    L.marker([p.lat, p.lon], { icon: cityIcon(p.color, p.size) })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:monospace;font-size:0.82rem;color:#e2e8f0;min-width:160px;padding:4px 0;">
          <strong style="color:${p.color};display:block;margin-bottom:4px;">${p.name}</strong>
          <span style="color:#94a3b8;font-size:0.75rem;">${p.info}</span><br>
          <span style="color:#475569;font-size:0.68rem;">${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</span>
        </div>
      `, { className: 'hud-popup' });
  });

  // Polígono Mar de Cortés / Bahía de La Paz (zona de pesca)
  const bahia = [
    [24.25, -110.45], [24.32, -110.30], [24.20, -110.10],
    [23.95, -110.00], [23.70, -110.10], [23.60, -110.35],
    [23.80, -110.55], [24.10, -110.55], [24.25, -110.45]
  ];
  L.polygon(bahia, {
    color: '#06b6d4', weight: 1.5, opacity: 0.7,
    fillColor: '#06b6d4', fillOpacity: 0.06,
    dashArray: '5, 8'
  }).addTo(map).bindPopup(
    '<strong style="color:#06b6d4">Bahía de La Paz</strong><br><span style="color:#94a3b8;font-size:0.75rem;">Zona de pesca activa · Mar de Cortés</span>'
  );

  // Radio de El Mogote (zona óptima de pesca ~2km)
  L.circle([24.1585, -110.3454], {
    radius: 2000,
    color: '#06b6d4',
    weight: 1,
    opacity: 0.4,
    fillColor: '#06b6d4',
    fillOpacity: 0.04
  }).addTo(map);

  // Abrir popup de El Mogote automáticamente
  setTimeout(() => {
    map.setView([24.15, -110.33], 10);
  }, 500);
}

/* ================================================================
   PANEL SITUACIONAL — WorldMonitor-style Intel Dashboard
   ================================================================ */
async function renderSitPanel() {
  const panelEl = $('sitPanelContent');
  if (!panelEl) return;

  panelEl.innerHTML = `<div class="intel-loading">
    <div class="intel-spinner"></div>
    <span>Procesando señales de inteligencia…</span>
  </div>`;

  try {
    const [articles, marine, forex] = await Promise.allSettled([
      IntelService.aggregateGlobalFeeds(),
      IntelService.fetchMarineData(),
      IntelService.fetchForex()
    ]);

    const arts  = articles.status  === 'fulfilled' ? articles.value  : [];
    const mar   = marine.status    === 'fulfilled' ? marine.value    : null;
    const fx    = forex.status     === 'fulfilled' ? forex.value     : null;
    const tides = IntelService.getTideData();
    const brief = IntelService.generateBriefing(arts, mar, fx, tides);

    // Clasificar por señal
    const bySignal = {};
    arts.forEach(a => {
      if (!bySignal[a.signal]) bySignal[a.signal] = [];
      bySignal[a.signal].push(a);
    });

    const signalConfig = {
      economic:  { emoji:'📈', label:'Economía',        color:'#10b981' },
      political: { emoji:'🏛️', label:'Político',        color:'#3b82f6' },
      climate:   { emoji:'🌊', label:'Clima/Desastres', color:'#06b6d4' },
      security:  { emoji:'🔴', label:'Seguridad',       color:'#ef4444' },
      fishing:   { emoji:'🐟', label:'Pesca/Mar',       color:'#22c55e' },
      technology:{ emoji:'💻', label:'Tecnología',      color:'#8b5cf6' },
      general:   { emoji:'📰', label:'General',         color:'#94a3b8' }
    };

    panelEl.innerHTML = `
      <!-- Briefing ejecutivo -->
      <div class="intel-briefing">
        <div class="intel-briefing-header">
          <span class="intel-live-dot"></span>
          INTEL BRIEFING · ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}
        </div>
        <ul class="intel-brief-list">
          ${brief.map(line => `<li>${line}</li>`).join('')}
        </ul>
      </div>

      <!-- HUD Metrics -->
      <div class="hud-metrics">
        ${mar ? `
        <div class="hud-metric">
          <div class="hud-metric-label">OLEAJE BCS</div>
          <div class="hud-metric-val">${mar.waveHeight}<span style="font-size:0.65rem">m</span></div>
        </div>
        <div class="hud-metric">
          <div class="hud-metric-label">VIENTO MAR</div>
          <div class="hud-metric-val">${mar.windSpeed}<span style="font-size:0.65rem">km/h</span></div>
        </div>` : ''}
        ${tides ? `
        <div class="hud-metric">
          <div class="hud-metric-label">MAREA</div>
          <div class="hud-metric-val">${tides.current}<span style="font-size:0.65rem">m</span></div>
        </div>
        <div class="hud-metric">
          <div class="hud-metric-label">COEF.</div>
          <div class="hud-metric-val">${tides.coefficient}</div>
        </div>` : ''}
        ${fx ? `
        <div class="hud-metric">
          <div class="hud-metric-label">USD/MXN</div>
          <div class="hud-metric-val" style="font-size:1rem;">$${fx.mxn}</div>
        </div>` : ''}
        <div class="hud-metric">
          <div class="hud-metric-label">SEÑALES</div>
          <div class="hud-metric-val">${arts.length}</div>
        </div>
      </div>

      <!-- Feed de noticias clasificado -->
      <div class="intel-feeds">
        ${Object.entries(bySignal)
          .sort((a,b) => b[1].length - a[1].length)
          .slice(0, 6)
          .map(([signal, items]) => {
            const cfg = signalConfig[signal] || signalConfig.general;
            return `
            <div class="intel-signal-group">
              <div class="intel-signal-header" style="color:${cfg.color}">
                ${cfg.emoji} ${cfg.label.toUpperCase()}
                <span class="intel-signal-count">${items.length}</span>
              </div>
              ${items.slice(0,3).map(a => `
                <div class="intel-article">
                  <div class="intel-article-source">${a.feedLabel}</div>
                  <a class="intel-article-title" href="${a.link}" target="_blank" rel="noopener">
                    ${esc(a.title)}
                  </a>
                  <div class="intel-article-meta">${timeAgo(a.pubDate)}</div>
                </div>`).join('')}
            </div>`;
          }).join('')}
      </div>

      <div class="intel-footer">
        <span>${INTEL_FEEDS.global_intel.length} feeds · ${new Date().toLocaleTimeString('es-MX')}</span>
        <button class="intel-refresh-btn" onclick="renderSitPanel()">↻ Actualizar</button>
      </div>
    `;

    // Log histórico automático
    IntelService.logDailyConditions(mar, tides, fx);

  } catch(err) {
    panelEl.innerHTML = `<div class="intel-error">⚠️ Error. <button onclick="renderSitPanel()">Reintentar</button></div>`;
  }
}

/* ================================================================
   PESCA AVANZADA — Mareas + índice combinado
   ================================================================ */
async function renderPescaAvanzada(weatherData) {
  const pc = $('pescaContent');
  if (!pc) return;

  // Datos de mareas (cálculo armónico BCS)
  const tides = IntelService.getTideData();
  const marine = await IntelService.fetchMarineData().catch(() => null);

  // Índice de pesca combinado
  let weatherIdx = 75; // default si no hay datos
  let wind = 0;
  if (weatherData) {
    weatherIdx = fishingIndex(weatherData);
    wind = Math.round(weatherData.current.wind_speed_10m);
  }

  const fi = _calcFishIndex(marine, tides);
  const finalScore = Math.round((weatherIdx / 10 + fi.score) / 2 * 10);
  const col = fishColor(finalScore);
  const h = new Date().getHours();
  const buena = (h >= 5 && h <= 9) || (h >= 16 && h <= 19);

  // Tabla de mareas del día
  const moreaTbl = tides.extremes.slice(0, 4).map(e => `
    <tr>
      <td style="color:${e.type==='pleamar'?'#06b6d4':'#f59e0b'}">${e.type==='pleamar'?'↑ Pleamar':'↓ Bajamar'}</td>
      <td style="font-family:var(--font-mono)">${e.time}</td>
      <td style="font-family:var(--font-mono)">${e.level.toFixed(2)} m</td>
    </tr>`).join('');

  pc.innerHTML = `
    <div class="pesca-main-grid">
      <!-- Índice combinado -->
      <div class="pesca-idx-panel">
        ${finalScore >= 75 ? `<div class="pesca-alert">🎣 ¡CONDICIONES FAVORABLES! Sal temprano o a las 4 pm.</div>` : ''}
        <div class="pesca-score" style="color:${col}">${finalScore}%</div>
        <div class="pesca-label">Índice de Pesca La Paz · ${fi.label}</div>
        <div class="pesca-bar-bg"><div class="pesca-bar-fill" style="width:${finalScore}%;background:${col};"></div></div>

        <div class="pesca-detail" style="margin-top:12px;">
          <strong>📍 Spot primario:</strong> El Mogote (24.1585, -110.3454)<br>
          <strong>🕐 Hora óptima:</strong> 5–8:30 am ó 4–6:30 pm<br>
          ${wind ? `<strong>🌊 Viento:</strong> ${wind} km/h ${wind<15?'✅ Ideal':wind<25?'⚠️ Tolerable':'🔴 Fuerte'}<br>` : ''}
          ${marine ? `<strong>🌊 Oleaje:</strong> ${marine.waveHeight} m · Período: ${marine.wavePeriod} s<br>` : ''}
          <strong>🐟 Actividad:</strong> <span style="color:${tides.fishActivityScore>=7?'#10b981':'#f59e0b'}">${tides.fishActivity}</span><br>
          <strong>⏰ Ahora:</strong> ${buena?'✅ Ventana óptima abierta':'⏳ Próxima ventana: 4:00–6:30 pm'}<br>
          <strong>🎣 Señuelos:</strong> Poppers, jigs plateados, anchoveta<br>
          <strong>🐠 Especie:</strong> Dorado, jurel, pargo
        </div>
      </div>

      <!-- Tabla de mareas -->
      <div class="pesca-tides-panel">
        <div class="pesca-tide-title">🌙 Tabla de Mareas — La Paz, BCS</div>
        <table class="tide-table">
          <thead><tr><th>Evento</th><th>Hora</th><th>Altura</th></tr></thead>
          <tbody>${moreaTbl || '<tr><td colspan="3" style="color:var(--text-muted);text-align:center">Calculando…</td></tr>'}</tbody>
        </table>

        <div class="tide-coef">
          <span class="coef-label">Coeficiente marea</span>
          <span class="coef-val">${tides.coefficient}</span>
          <span class="coef-desc">${tides.coefficient > 80 ? '↑ Alta' : tides.coefficient > 50 ? '≈ Media' : '↓ Baja'}</span>
        </div>

        <div class="tide-src" style="font-size:0.65rem;color:var(--text-muted);margin-top:8px;">
          ${tides.source}
        </div>
      </div>
    </div>
  `;
}

/* ================================================================
   CLIMA
   ================================================================ */
async function fetchWeather() {
  const params = 'current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,uv_index&daily=temperature_2m_max,temperature_2m_min&forecast_days=1';
  const cities = Object.values(CFG.cities);
  const results = await Promise.allSettled(
    cities.map(c => fetch(`${CFG.openMeteo}?latitude=${c.lat}&longitude=${c.lon}&${params}&timezone=${c.tz}`).then(r=>r.json()))
  );
  const statusEl = $('climaStatus');
  if (statusEl) statusEl.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  let rows = '';
  results.forEach((res, i) => {
    const city = cities[i];
    if (res.status === 'rejected') { rows += `<tr><td colspan="7" class="loading-cell">Error: ${city.name}</td></tr>`; return; }
    const cur   = res.value.current;
    const daily = res.value.daily;
    const uv    = uvLabel(cur.uv_index ?? 0);
    const con   = confortLabel(cur.apparent_temperature);
    const min   = Math.round(daily.temperature_2m_min[0]);
    const max   = Math.round(daily.temperature_2m_max[0]);
    if (i === 0) {
      const badge = $('wbadge-temp');
      if (badge) badge.textContent = `${Math.round(cur.temperature_2m)}°C`;
      renderPescaAvanzada(res.value);
      renderMoto(res.value);
    }
    rows += `<tr>
      <td><div class="ciudad-name">${city.name}, ${city.state}</div><div class="ciudad-role">${city.role}</div></td>
      <td>${min}° / ${max}°</td>
      <td>${Math.round(cur.apparent_temperature)}°C</td>
      <td>${cur.relative_humidity_2m}%</td>
      <td>${windDir(cur.wind_direction_10m)} ${Math.round(cur.wind_speed_10m)} km/h</td>
      <td class="${uv.cls}">${uv.e} ${Math.round(cur.uv_index??0)} — ${uv.label}</td>
      <td class="${con.cls}">${con.label}</td>
    </tr>`;
  });
  const climaBody = $('climaBody');
  if (climaBody) climaBody.innerHTML = rows;
}

/* ================================================================
   CRIPTO DINÁMICO — Market Selector
   ================================================================ */
const MARKET_COINS = {
  bitcoin:   { name: 'Bitcoin',  sym: 'BTC', icon: '₿' },
  ethereum:  { name: 'Ethereum', sym: 'ETH', icon: 'Ξ' },
  solana:    { name: 'Solana',   sym: 'SOL', icon: '◎' },
  dogecoin:  { name: 'Dogecoin', sym: 'DOGE', icon: 'Ð' },
  ripple:    { name: 'XRP',      sym: 'XRP', icon: '✕' },
  tether:    { name: 'Tether',   sym: 'USDT', icon: '₮' },
  'usd-coin':{ name: 'USD Coin', sym: 'USDC', icon: '＄' }
};

function getSelectedMarkets() {
  try {
    const saved = JSON.parse(localStorage.getItem('boletin_markets') || 'null');
    if (saved) return saved;
  } catch {}
  return { bitcoin: true, ethereum: true, solana: true, dogecoin: true };
}

function saveSelectedMarkets(m) {
  localStorage.setItem('boletin_markets', JSON.stringify(m));
}

async function fetchCripto() {
  const selected = getSelectedMarkets();
  const ids = Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
  if (!ids.length) {
    const cc = $('criptoContent');
    if (cc) cc.innerHTML = '<div class="loading-cell" style="color:var(--text-muted)">Selecciona activos en ⚙️ → Markets</div>';
    return;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd,mxn&include_24hr_change=true`;
  const cc = $('criptoContent');
  if (!cc) return;

  try {
    const data = await fetch(url).then(r=>r.json());
    cc.innerHTML = `
      <div class="crypto-list">
        ${ids.map(id => {
          const meta = MARKET_COINS[id];
          const d = data[id];
          if (!d || !meta) return '';
          const chg = d.usd_24h_change ?? 0;
          const cls = chg >= 0 ? 'up' : 'down';
          const arr = chg >= 0 ? '▲' : '▼';
          return `
            <div class="crypto-row">
              <div>
                <span class="crypto-icon">${meta.icon}</span>
                <span class="crypto-name">${meta.name}</span>
                <span class="crypto-symbol">${meta.sym}</span>
              </div>
              <div>
                <span class="crypto-price">$${d.usd.toLocaleString('en-US')}</span>
                <span class="crypto-change ${cls}">${arr} ${Math.abs(chg).toFixed(2)}%</span>
              </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);padding:0 14px 4px;">MXN $${(d.mxn||0).toLocaleString('es-MX')}</div>`;
        }).join('')}
      </div>`;
    renderFlujo(ids, await fetch(url).then(r=>r.json()));
  } catch {
    cc.innerHTML = `<div class="loading-cell">Error CoinGecko. <a href="#" onclick="fetchCripto();return false">Reintentar</a></div>`;
  }
}

/* ================================================================
   CONTROL DE FLUJO — Balance Fiat vs Cripto
   ================================================================ */
function getFlujoConfig() {
  try { return JSON.parse(localStorage.getItem('boletin_flujo') || '{"mxn":0,"usd":0,"crypto":{}}'); }
  catch { return { mxn:0, usd:0, crypto:{} }; }
}

function renderFlujo(coinIds, prices) {
  const fb = $('flujoBalances');
  if (!fb) return;
  const cfg = getFlujoConfig();

  const fiatTotal = (parseFloat(cfg.mxn)||0) + (parseFloat(cfg.usd)||0) * (prices['tether']?.usd ?? 17.5);
  let cryptoTotal = 0;
  const cryptoRows = [];

  coinIds.forEach(id => {
    const meta = MARKET_COINS[id];
    const qty  = parseFloat(cfg.crypto?.[id] || 0);
    const price = prices[id]?.usd ?? 0;
    if (qty > 0 && price > 0) {
      const val = qty * price;
      cryptoTotal += val;
      cryptoRows.push(`<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text-secondary)">${meta?.sym || id} × ${qty}</span>
        <span style="color:var(--text-primary);font-family:var(--font-mono)">$${val.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
      </div>`);
    }
  });

  const grandTotal = fiatTotal + cryptoTotal;
  const cryptoPct = grandTotal > 0 ? Math.round(cryptoTotal / grandTotal * 100) : 0;
  const fiatPct = 100 - cryptoPct;

  if (grandTotal === 0) {
    fb.innerHTML = '';
    return;
  }

  const fp = $('flujoContent');
  if (fp) {
    const plh = fp.querySelector('.flujo-placeholder');
    if (plh) plh.style.display = 'none';
  }

  fb.innerHTML = `
    <div class="flujo-bar">
      <div class="flujo-fiat-bar" style="width:${fiatPct}%" title="Fiat ${fiatPct}%"></div>
      <div class="flujo-crypto-bar" style="width:${cryptoPct}%" title="Crypto ${cryptoPct}%"></div>
    </div>
    <div class="flujo-legend">
      <span><span class="flujo-dot fiat"></span> Fiat ${fiatPct}%</span>
      <span><span class="flujo-dot crypto"></span> Cripto ${cryptoPct}%</span>
    </div>
    <div class="flujo-total">
      Total estimado: <strong>$${grandTotal.toLocaleString('en-US',{maximumFractionDigits:0})} USD</strong>
    </div>
    ${cryptoRows.length ? `<div style="margin-top:10px;">${cryptoRows.join('')}</div>` : ''}
  `;
}

/* ================================================================
   SALUD
   ================================================================ */
function renderSalud() {
  const settings = getSettings();
  const daily    = getDaily();
  const meds     = settings.medications.filter(m => m.active);
  const habits   = settings.habits.filter(h => h.active);
  const tracy    = CFG.tracy[dow()];
  const allItems = [
    ...meds.map(m => ({ id: m.id, name: m.name, objetivo: `${m.dose} · ${m.time}`, isMed: true })),
    ...habits.map(h => ({ id: h.id, name: h.name, objetivo: 'Diario', isMed: false }))
  ];
  const rows = allItems.map(item => {
    const taken  = item.isMed ? !!(daily.medications && daily.medications[item.id]) : !!(daily.habits && daily.habits[item.id]);
    const stCls  = taken ? 'pill-green' : 'pill-yellow';
    const stTxt  = taken ? '✅ Hecho' : '⏳ Pendiente';
    return `<tr>
      <td>${item.isMed ? '💊 ' : ''}${esc(item.name)}</td>
      <td style="color:var(--text-muted);">${esc(item.objetivo)}</td>
      <td><span class="pill ${stCls}">${stTxt}</span></td>
    </tr>`;
  }).join('');
  const emocionAcciones = ['💙 ¿Qué te duele hoy?', '💛 ¿Qué te preocupa?', '💚 ¿Qué te motiva?', '🤍 ¿Qué necesitas soltar?'];
  const sc = $('saludContent');
  if (sc) sc.innerHTML = `
    ${allItems.length ? `
    <table class="habit-table">
      <thead><tr><th>Hábito / Med.</th><th>Objetivo</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p style="color:var(--text-muted);font-size:0.84rem;margin-bottom:12px;">Configura tus medicamentos y hábitos en ⚙️</p>'}
    <div class="salud-tip"><strong>${tracy.title}</strong><br>${tracy.tip}</div>
    <div class="emocion-check">
      ${emocionAcciones.map(q => `<p><span>${q}</span> — Respóndelo en tu nota del día.</p>`).join('')}
    </div>`;
}

/* ================================================================
   HIJO
   ================================================================ */
function renderHijo() {
  const daily = getDaily();
  const now   = new Date();
  const hijoHour = now.getHours() + 1;
  const enVentana = hijoHour >= CFG.hijoWindowStart && hijoHour < CFG.hijoWindowEnd;
  const ventanaMsg = enVentana ? `✅ Buen momento para escribirle` : `⚠️ Fuera de ventana ideal`;
  const ht = $('hijoTitle'); const hc = $('hijoContent');
  if (!ht || !hc) return;
  if (daily.withSon) {
    ht.textContent = 'Estoy con mi hijo hoy 💖';
    hc.innerHTML = `
      <div class="son-today-banner">💖 HOY ESTÁS CON TU HIJO — DÍA ESPECIAL</div>
      <div class="hijo-msg">Hoy es un día para estar presente. Escúchalo. Míralo. Tu presencia es el regalo más grande.</div>
      <div class="hijo-actividad"><div class="hijo-actividad-title" style="color:#10b981;">🎯 Actividades juntos</div>
        <ul style="padding-left:16px;font-size:0.84rem;line-height:1.8;color:var(--text-secondary);">
          <li>Caminar juntos sin destino fijo — que él elija el rumbo</li>
          <li>Ver una película de lo que a él le guste</li>
          <li>Preparar comida juntos, algo simple</li>
        </ul>
      </div>`;
  } else {
    ht.textContent = 'Mensaje para mi Hijo';
    hc.innerHTML = `
      <div class="hijo-msg">Hola, campeón 💙\n\n¿Cómo estás hoy? Te pienso desde La Paz.\nCada día que das lo mejor de ti me llena de orgullo.\n\nTe quiero mucho. Siempre estoy aquí. 🌟</div>
      <div class="hijo-ventana">🕐 ${ventanaMsg}</div>
      <div class="hijo-actividad" style="margin-top:8px;"><div class="hijo-actividad-title">💡 Actividad a distancia</div><p>Mándense fotos de algo bonito que cada uno vio hoy.</p></div>`;
  }
}

/* ================================================================
   ESPIRITUALIDAD
   ================================================================ */
async function fetchEspiritual() {
  const versoHoy = CFG.versos[dow()];
  const acciones = [
    'Tómate 3 min para agradecer en voz alta 3 cosas de ayer.',
    'Perdona a alguien hoy, aunque sea en silencio.',
    'Bendice a las personas que más te cuestan.',
    'Haz una pausa de 60 seg, respira y suelta lo que no controlas.',
    'Escribe una cosa por la que estás genuinamente agradecido.',
    'Ora brevemente por tu hijo, tu familia y tus proyectos.',
    'Declara en voz alta: "Hoy camino en propósito, no en miedo."'
  ];
  const frases = [
    '"El éxito es la suma de pequeños esfuerzos repetidos día tras día." — R. Collier',
    '"Avanza con confianza hacia tus sueños." — Thoreau',
    '"No cuentes los días, haz que los días cuenten." — Muhammad Ali',
    '"Empieza donde estás. Usa lo que tienes. Haz lo que puedes." — Arthur Ashe',
    '"La disciplina es el puente entre metas y logros." — Jim Rohn',
    '"Haz que suceda." — Brian Tracy',
    '"Una cosa a la vez, y esa cosa principal." — Thomas Carlyle'
  ];
  const ec = $('espiritualContent');
  if (!ec) return;
  try {
    const res  = await fetch(`${CFG.bibleApi}${versoHoy.key}?translation=rvr1960`);
    const data = await res.json();
    const txt  = (data.text || '').trim();
    const ref  = data.reference || versoHoy.ref;
    ec.innerHTML = `
      <div class="verse-box"><div class="verse-ref">📖 ${esc(ref)}</div><div class="verse-text">"${esc(txt)}"</div></div>
      <div class="espiritual-accion"><strong>Acción espiritual de hoy:</strong><br>${acciones[dow()]}</div>
      <div class="espiritual-frase">${frases[dow()]}</div>`;
  } catch {
    ec.innerHTML = `
      <div class="verse-box"><div class="verse-ref">📖 ${versoHoy.ref}</div><div class="verse-text"><em>Conecta para ver el versículo completo.</em></div></div>
      <div class="espiritual-accion"><strong>Acción de hoy:</strong><br>${acciones[dow()]}</div>
      <div class="espiritual-frase">${frases[dow()]}</div>`;
  }
}

/* ================================================================
   MÚSICA
   ================================================================ */
function renderMusica() {
  const mc = $('musicaContent');
  if (!mc) return;
  mc.innerHTML = `
    <ul class="music-list">
      ${CFG.music.map(m => `
        <li class="music-item">
          <span class="music-icon">${m.icon}</span>
          <div>
            <div class="music-label">${m.label}</div>
            <a class="music-name" href="${m.link}" target="_blank" rel="noopener">${esc(m.name)}</a>
          </div>
        </li>`).join('')}
    </ul>`;
}

/* ================================================================
   NOTICIAS
   ================================================================ */
async function fetchNoticias() {
  const feeds = [
    { id: 'newsEcon',   url: CFG.rss.economy },
    { id: 'newsCrypto', url: CFG.rss.crypto  },
    { id: 'newsTech',   url: CFG.rss.tech    }
  ];
  await Promise.allSettled(feeds.map(async feed => {
    const el = $(feed.id);
    if (!el) return;
    try {
      const res  = await fetch(CFG.rss2json + encodeURIComponent(feed.url));
      const data = await res.json();
      const items = (data.items || []).slice(0,5);
      if (!items.length) throw new Error('vacío');
      el.innerHTML = items.map(item => `
        <div class="news-item">
          <a class="news-item-title" href="${item.link}" target="_blank" rel="noopener">${esc(stripHtml(item.title||''))}</a>
          <div class="news-item-date">${fmtDate(item.pubDate)}</div>
        </div>`).join('');
    } catch {
      el.innerHTML = `<div class="loading-cell">No disponible. <a href="#" onclick="fetchNoticias();return false">Reintentar</a></div>`;
    }
  }));
}

/* ================================================================
   PRODUCTIVIDAD
   ================================================================ */
function renderProductividad() {
  const tracy = CFG.tracy[dow()];
  const rutinas = [
    '🌅 Levantarte a la misma hora todos los días ancla tu ritmo circadiano.',
    '📵 Primera hora SIN teléfono. Dedícala a lo más importante.',
    '📓 Escribe 3 prioridades en papel antes de abrir el mail.',
    '⚡ El Ritalin alcanza su pico 30-60 min después. Úsalo para tu tarea A.',
    '🔁 Después de cada tarea, 2 min de estiramiento.',
    '🎯 Una reunión = un objetivo claro. Sin objetivo, cancélala.',
    '🌙 Cierra el día: lista de mañana + 3 logros del día.'
  ];
  const pc = $('prodContent');
  if (!pc) return;
  pc.innerHTML = `
    <div class="verse-box" style="margin-bottom:12px;">
      <div class="verse-ref">${tracy.title}</div>
      <div class="verse-text">${tracy.tip}</div>
    </div>
    <div class="salud-tip"><strong>💡 Rutina del día:</strong><br>${rutinas[dow()]}</div>
    <div style="margin-top:12px;font-size:0.82rem;color:var(--text-secondary);">
      <strong>⏰ Bloques:</strong> 90 min de trabajo · 15 min de descanso · Repite.<br>
      Silencia notificaciones. Cierra pestañas. Pon el foco.
    </div>`;
}

/* ================================================================
   PROYECTOS
   ================================================================ */
function renderProyectos() {
  const settings = getSettings();
  const daily    = getDaily();
  const activos  = CFG.projects.filter(p => settings.projects[p.id] !== false);
  const pg = $('proyectosGrid');
  if (!pg) return;
  if (!activos.length) {
    pg.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Activa proyectos desde ⚙️ Preferencias</div>`;
    return;
  }
  pg.innerHTML = activos.map(p => {
    const isFocus = daily.focusProject === p.id;
    return `
      <div class="proyecto-card ${isFocus?'proyecto-focus':''}" style="background:${p.bgGrad};border-color:${p.borderColor};">
        ${isFocus ? '<div class="focus-badge">🎯 FOCO DE HOY</div>' : ''}
        <div class="proyecto-header">
          <span class="proyecto-emoji">${p.emoji}</span>
          <div>
            <div class="proyecto-name" style="color:${p.color}">${p.name}</div>
            <div class="proyecto-url">🔗 <a href="https://${p.url}" target="_blank" rel="noopener">${p.url}</a></div>
          </div>
        </div>
        <div class="proyecto-desc">${p.desc}</div>
        <ul class="proyecto-ideas" style="padding-left:16px;">${p.ideas.map(i=>`<li style="font-size:0.78rem;color:var(--text-secondary);line-height:1.65">${esc(i)}</li>`).join('')}</ul>
        <div class="proyecto-kw">${p.keywords.map(k=>`<span class="kw-tag">${esc(k)}</span>`).join('')}</div>
      </div>`;
  }).join('');
}

/* ================================================================
   MOTO
   ================================================================ */
function renderMoto(weatherData) {
  const wind  = weatherData.current.wind_speed_10m;
  const uv    = weatherData.current.uv_index ?? 5;
  const temp  = weatherData.current.temperature_2m;
  const noOk  = wind > 35 || uv > 10 || temp > 38;
  let ruta    = CFG.motoRoutes[0];
  if (!noOk) ruta = CFG.motoRoutes[dow() % CFG.motoRoutes.length];
  const mc = $('motoContent');
  if (!mc) return;
  mc.innerHTML = `
    <div class="moto-info">
      ${noOk?`<div class="pesca-alert" style="color:var(--red);border-color:rgba(239,68,68,0.4);">⚠️ Condiciones extremas. No se recomienda ruta larga.</div>`:''}
      <div class="moto-ruta-name">📍 ${esc(ruta.name)}</div>
      <div class="moto-stats">
        <div class="moto-stat"><div class="moto-stat-label">Distancia</div><div class="moto-stat-val">${ruta.dist}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Duración</div><div class="moto-stat-val">${ruta.duration}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Gasolina</div><div class="moto-stat-val">${ruta.fuel}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Costo</div><div class="moto-stat-val">${ruta.cost}</div></div>
      </div>
      <div style="font-size:0.82rem;margin:8px 0;">
        <strong>🎭 Cultura:</strong> ${esc(ruta.cultura)}<br>
        <strong>🏠 Inmob.:</strong> ${esc(ruta.immo)}<br>
        <strong>📊 Dificultad:</strong> ${ruta.diff}
      </div>
      <a class="moto-link" href="${ruta.maps}" target="_blank" rel="noopener">🗺️ Ver en Google Maps</a>
    </div>`;
}

/* ================================================================
   PLAN DEL DÍA
   ================================================================ */
function renderPlanDia() {
  const daily = getDaily();
  const focusProj = daily.focusProject ? CFG.projects.find(p=>p.id===daily.focusProject) : null;
  const bloques = [
    { time:'05:00–06:30', title:'🌅 Ritual de mañana',        color:'#f59e0b', desc:'Agua. Medicación. 5 min de gratitud. Leer el boletín. Sin redes.' },
    { time:'06:30–08:00', title:'📖 Espiritualidad & mente',  color:'#8b5cf6', desc:'Versículo, meditación breve o lectura.' },
    { time:'08:00–09:30', title:'🐸 Bloque A — Come el sapo', color:'#ef4444', desc:'Tu tarea más crítica. Sin interrupciones.' },
    { time:'09:30–10:00', title:'☕ Descanso activo',          color:'#10b981', desc:'Estira, agua, respira.' },
    { time:'10:00–12:00', title:`💼 Bloque B${focusProj?' — '+focusProj.name:''}`, color: focusProj?focusProj.color:'#3b82f6', desc:`Proyectos${focusProj?': '+focusProj.name:''}. Sin distracciones.` },
    { time:'12:00–13:30', title:'🥗 Comida & descanso',        color:'#10b981', desc:'Alimento real. Camina 10 min.' },
    { time:'13:30–15:30', title:'🧠 Bloque C — Contenido',    color:'#f59e0b', desc:'Contenido para redes, keywords, blog.' },
    { time:'15:30–16:00', title:'⚡ HIIT / Movimiento',        color:'#ef4444', desc:'15–20 min de ejercicio.' },
    { time:'16:00–18:00', title:'🎣 Exploración / Pesca / Moto', color:'#3b82f6', desc:'Si las condiciones lo permiten.' },
    { time:'18:00–19:00', title:'💖 Tiempo para tu hijo',      color:'#ec4899', desc:'Ventana ideal para llamarle.' },
    { time:'19:00–20:30', title:'📚 Lectura / Podcast',        color:'#8b5cf6', desc:'Seminario Fénix. Sin noticias pesadas.' },
    { time:'20:30–21:00', title:'🌙 Shutdown ritual',          color:'#64748b', desc:'Lista de mañana. 3 logros del día.' }
  ];
  const pc = $('planContent');
  if (!pc) return;
  pc.innerHTML = `
    <div class="plan-grid">
      ${bloques.map(b => `
        <div class="plan-block" style="border-color:${b.color}">
          <div class="plan-time">${b.time}</div>
          <div class="plan-title">${b.title}</div>
          <div class="plan-desc">${b.desc}</div>
        </div>`).join('')}
    </div>`;
}

/* ================================================================
   CHECKLIST
   ================================================================ */
const CK_KEY_PFX = 'boletin_ck_';
function _ckKey() { const d=new Date(); return `${CK_KEY_PFX}${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function _ckState() { try{ return JSON.parse(localStorage.getItem(_ckKey())||'{}'); }catch{ return {}; } }
function _ckSave(s) { localStorage.setItem(_ckKey(), JSON.stringify(s)); }

function renderChecklist() {
  const settings = getSettings();
  const ckState  = _ckState();
  const habitItems = settings.habits.filter(h => h.active).map(h => ({ id: `habit_${h.id}`, text: h.name, tag: 'Salud' }));
  const medItems   = settings.medications.filter(m => m.active).map(m => ({ id: `med_${m.id}`, text: `💊 ${m.name}`, tag: 'Salud' }));
  const allItems   = [...medItems, ...habitItems, ...CFG.baseChecklist, ...(settings.customChecklist || [])];
  const seen = new Set();
  const items = allItems.filter(i => { if(seen.has(i.id)) return false; seen.add(i.id); return true; });
  const cc = $('checklistContent');
  if (!cc) return;
  cc.innerHTML = `
    <div class="checklist-grid">
      ${items.map(item => {
        const done = !!ckState[item.id];
        return `<div class="checklist-item ${done?'done':''}" onclick="toggleCheck('${item.id}')">
          <div class="cli-check">${done?'✓':''}</div>
          <span class="cli-text">${esc(item.text)}</span>
          <span class="cli-tag">${esc(item.tag)}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px;font-size:0.76rem;color:var(--text-muted);">Se reinicia cada día. Agrega tareas desde ⚙️ Salud.</div>`;
}

function toggleCheck(id) { const s = _ckState(); s[id] = !s[id]; _ckSave(s); renderChecklist(); }
function resetChecklist() { localStorage.removeItem(_ckKey()); renderChecklist(); }

/* ================================================================
   FOOTER / BENDICIÓN
   ================================================================ */
function renderBendicion() {
  const settings = getSettings();
  const name = settings.user.name;
  const ciudad = `${settings.user.ciudad}, ${settings.user.estado}`;
  const bends = [
    `Que este día sea abundante en claridad, en paz y en propósito.\nEres guiado. Eres amado.`,
    `Que la sabiduría guíe tus decisiones y el amor tus palabras.\nAvanza con fe, ${name}.`,
    `Que Dios abra puertas que ningún hombre puede cerrar.\nTu trabajo hoy construye el mañana que imaginas.`,
    `Que la gratitud sea tu punto de partida.\nEres más de lo que crees. Sigue adelante.`,
    `Que la paz de Dios guarde tu corazón hoy.\nPaso a paso, con intención y con amor.`
  ];
  const b = bends[dow() % bends.length];
  const bc = $('blessingContent');
  if (bc) bc.innerHTML = `
    <div class="blessing-text">${b.replace('\n','<br>')}</div>
    <div class="blessing-sub">— Boletín LA BUENA v3 · oscaromargp · ${ciudad}</div>`;
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const settings = getSettings();
  CFG.user = settings.user.name;
  const sub = $('brandSub');
  if (sub) sub.textContent = `Situational Awareness Dashboard · oscaromargp · ${settings.user.ciudad}, ${settings.user.estado}`;

  renderDateTime();
  renderTldr();
  renderKanban();
  renderPriorities();
  renderSalud();
  renderHijo();
  renderMusica();
  renderProductividad();
  renderProyectos();
  renderPlanDia();
  renderChecklist();
  renderBendicion();

  // Panel de pesca con datos de mareas (no requiere clima)
  renderPescaAvanzada(null);

  // Visibilidad de secciones
  applySectionVisibility();

  // Reloj en tiempo real
  setInterval(renderDateTime, 1000);

  // Fetch asíncrono en paralelo
  await Promise.allSettled([
    fetchWeather(),
    fetchCripto(),
    fetchNoticias(),
    fetchEspiritual()
  ]);

  // Panel intel situacional
  renderSitPanel();

  // Primera visita
  checkFirstVisit();
});
