/* ============================================================
   app.js — Boletín LA BUENA (Oscaromar)
   APIs: Open-Meteo (clima) · CoinGecko (cripto) · rss2json (noticias) · bible-api (versículo)
   ============================================================ */

'use strict';

/* ---- State global ---- */
const state = { lapazWeather: null, checkin: null };

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);

function dayOfWeek() { return new Date().getDay(); }  // 0=dom ... 6=sab

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv < 3)  return { label: 'Bajo',       cls: 'uv-low',   emoji: '🟢' };
  if (uv < 6)  return { label: 'Moderado',   cls: 'uv-mod',   emoji: '🟡' };
  if (uv < 8)  return { label: 'Alto',       cls: 'uv-high',  emoji: '🟠' };
  if (uv < 11) return { label: 'Muy Alto',   cls: 'uv-vhigh', emoji: '🔴' };
  return             { label: 'Extremo',     cls: 'uv-vhigh', emoji: '☠️' };
}

function confortLabel(feels) {
  if (feels < 20) return { label: 'Fresco 🧥',          cls: 'confort-ok' };
  if (feels < 28) return { label: 'Confortable 😊',     cls: 'confort-ok' };
  if (feels < 33) return { label: 'Calor moderado 😅',  cls: 'confort-mod' };
  if (feels < 37) return { label: 'Calor fuerte 🥵',    cls: 'confort-hot' };
  return               { label: 'Peligroso 🚨',         cls: 'confort-xhot' };
}

function fishingIndex(w) {
  let score = 0;
  const wind   = w.current.wind_speed_10m;
  const uv     = w.current.uv_index ?? 5;
  const temp   = w.current.temperature_2m;
  const hour   = new Date().getHours();

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

function fishingColor(idx) {
  if (idx >= 75) return '#10b981';
  if (idx >= 50) return '#f59e0b';
  if (idx >= 25) return '#f97316';
  return '#ef4444';
}

function formatNewsDate(str) {
  try {
    const d = new Date(str);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return str; }
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/* ===== DATE / TIME ===== */
function renderDateTime() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dayStr = now.toLocaleDateString('es-MX', opts);
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  $('dateTime').innerHTML = `
    <div class="day">${dayStr.charAt(0).toUpperCase() + dayStr.slice(1)}</div>
    <div>${timeStr} hrs · La Paz, BCS</div>
  `;
}

/* ===== TL;DR ===== */
function renderTldr() {
  const hora = new Date().getHours();
  let momento = hora < 12 ? 'mañana' : hora < 18 ? 'tarde' : 'noche';
  $('tldrText').textContent =
    `Buenos días, ${CFG.user}. Esta es tu brújula del día: clima de las 4 ciudades que importan, ` +
    `precios cripto en tiempo real, noticias filtradas, mensaje para tu hijo, plan por bloques y tu checklist. ` +
    `Todo listo para que tu ${momento} fluya con intención.`;
}

/* ===== MORNING CHECK-IN ===== */
function renderCheckin() {
  const questions = [
    { q: `${CFG.user}, ¿cómo amaneció tu energía hoy?`, opts: ['🔥 Con todo', '😌 Tranquilo', '😴 Necesito momentum', '🎯 Enfocado'] },
    { q: '¿Qué quieres priorizar hoy?', opts: ['💼 9Stratex', '🏠 Par de Santos', '🎵 BN Records', '💰 Paypaps'] },
    { q: '¿Qué sensación domina tu mañana?', opts: ['🧠 Claridad', '😌 Calma', '⚡ Energía', '🤔 Necesito orden'] },
    { q: '¿Algún pendiente urgente que empujar hoy?', opts: ['Clientes', 'Contenido', 'Finanzas', 'Familia'] }
  ];
  const q = questions[dayOfWeek() % questions.length];
  $('checkinQuestion').textContent = q.q;
  $('checkinOptions').innerHTML = q.opts.map(opt =>
    `<button class="checkin-btn" onclick="this.classList.toggle('active')">${opt}</button>`
  ).join('');
}

/* ===== CLIMA ===== */
async function fetchWeather() {
  const params = 'current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,uv_index&daily=temperature_2m_max,temperature_2m_min&forecast_days=1';
  const entries = Object.values(CFG.cities);

  const results = await Promise.allSettled(
    entries.map(c =>
      fetch(`${CFG.openMeteo}?latitude=${c.lat}&longitude=${c.lon}&${params}&timezone=${c.tz}`)
        .then(r => r.json())
    )
  );

  $('climaStatus').textContent = 'Actualizado ahora';

  let rows = '';
  results.forEach((res, i) => {
    const city = entries[i];
    if (res.status === 'rejected') {
      rows += `<tr><td colspan="7" class="loading-cell">Error al cargar ${city.name}</td></tr>`;
      return;
    }
    const d = res.value;
    const cur = d.current;
    const uv = uvLabel(cur.uv_index ?? 0);
    const confort = confortLabel(cur.apparent_temperature);
    const min = Math.round(d.daily.temperature_2m_min[0]);
    const max = Math.round(d.daily.temperature_2m_max[0]);

    if (i === 0) {
      state.lapazWeather = d;
      $('wbadge-temp').textContent = `${Math.round(cur.temperature_2m)}°C`;
      renderPesca(d);
      renderMoto(d);
    }

    rows += `
      <tr>
        <td>
          <div class="ciudad-name">${city.name}, ${city.state}</div>
          <div class="ciudad-role">${city.role}</div>
        </td>
        <td>${min}° / ${max}°</td>
        <td>${Math.round(cur.apparent_temperature)}°C</td>
        <td>${cur.relative_humidity_2m}%</td>
        <td>${windDir(cur.wind_direction_10m)} ${Math.round(cur.wind_speed_10m)} km/h</td>
        <td class="${uv.cls}">${uv.emoji} ${Math.round(cur.uv_index ?? 0)} — ${uv.label}</td>
        <td class="${confort.cls}">${confort.label}</td>
      </tr>`;
  });

  $('climaBody').innerHTML = rows;
}

/* ===== SALUD ===== */
function renderSalud() {
  const habits = [
    { habit: '💊 Ritalin',     objetivo: '1 pastilla AM',  estado: 'pill-yellow', estadoTxt: '⏳ Pendiente' },
    { habit: '🅱️ Complejo B',  objetivo: '1 cápsula AM',  estado: 'pill-yellow', estadoTxt: '⏳ Pendiente' },
    { habit: '💧 Agua',        objetivo: '2.5 L al día',   estado: 'pill-gray',   estadoTxt: '— Trackear' },
    { habit: '🥗 Alimento',    objetivo: 'Desayuno real',  estado: 'pill-gray',   estadoTxt: '— Trackear' },
    { habit: '🏃 Ejercicio',   objetivo: '15 min HIIT',    estado: 'pill-gray',   estadoTxt: '— Trackear' },
    { habit: '😴 Sueño',       objetivo: '7–8 hrs',        estado: 'pill-gray',   estadoTxt: '— Trackear' },
  ];

  const tracy = CFG.tracy[dayOfWeek()];

  $('saludContent').innerHTML = `
    <table class="habit-table">
      <thead><tr><th>Hábito</th><th>Objetivo</th><th>Estado</th></tr></thead>
      <tbody>
        ${habits.map(h => `
          <tr>
            <td>${h.habit}</td>
            <td>${h.objetivo}</td>
            <td><span class="pill ${h.estado}">${h.estadoTxt}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="salud-tip">
      <strong>${tracy.title}</strong><br>${tracy.tip}
    </div>
    <div class="emocion-check">
      <p>Preguntas de análisis emocional:</p>
      <p><span>💙 ¿Qué te duele hoy?</span> Nómbralo sin juzgarlo.</p>
      <p><span>💛 ¿Qué te preocupa?</span> ¿Es urgente o solo ruido?</p>
      <p><span>💚 ¿Qué te motiva?</span> Conéctate con eso ahora.</p>
      <p><span>🤍 ¿Qué necesitas soltar?</span> Dale permiso de irse.</p>
    </div>
    <div class="salud-tip" style="margin-top:10px; border-color: #f59e0b;">
      📋 <strong>Recordatorio:</strong> Agenda tu análisis clínico trimestral y chequeo general con el médico.
    </div>
  `;
}

/* ===== HIJO ===== */
function renderHijo() {
  const now = new Date();
  const hijoHour = now.getHours() + 1; // hijo UTC-6, tú UTC-7 → +1 hr
  const dentroVentana = hijoHour >= CFG.hijoWindowStart && hijoHour < CFG.hijoWindowEnd;
  const ventanaMsg = dentroVentana
    ? '✅ <strong>Buen momento para escribirle</strong> (son las ' + hijoHour + ':00 en Puerto Escondido)'
    : '⚠️ Fuera de su ventana ideal. Espera a las 6am hora de Oaxaca.';

  $('hijoContent').innerHTML = `
    <div class="hijo-msg">Hola, campeón 💙

¿Cómo estás hoy? Te pienso desde La Paz.
Hoy quería decirte que eres increíble.
Cada día que das lo mejor de ti me llena de orgullo.

¿Sabes qué? El sol aquí brilla fuerte hoy,
y cada rayo me recuerda tu sonrisa.

Te quiero mucho. Siempre estoy aquí para ti. 🌟</div>

    <div class="hijo-actividad">
      <div class="hijo-actividad-title">💡 Actividad compartida a distancia</div>
      <p>Cuéntenle cada uno lo mejor de su día por WhatsApp. Pueden turnarse enviando fotos de algo bonito que vieron hoy.</p>
    </div>

    <div class="hijo-actividad" style="margin-top:8px; border-color: rgba(245,158,11,0.3);">
      <div class="hijo-actividad-title" style="color:#f59e0b;">📍 Tema simple de conversación</div>
      <p>¿Cuál fue tu animal favorito esta semana? ¿O qué te hizo reír? (preguntas claras, sin sobrecarga)</p>
    </div>

    <div class="hijo-ventana">🕐 ${ventanaMsg}</div>

    <div class="hijo-actividad" style="margin-top:8px; border-color: rgba(139,92,246,0.3);">
      <div class="hijo-actividad-title" style="color:#8b5cf6;">🙏 Bendición espiritual</div>
      <p><em>"Que Dios te guarde, te llene de paz y te recuerde siempre lo amado que eres. Eres lo más importante."</em></p>
    </div>
  `;
}

/* ===== ESPIRITUALIDAD ===== */
async function fetchEspiritual() {
  const versoHoy = CFG.versos[dayOfWeek()];
  const tracy = CFG.tracy[dayOfWeek()];

  const acciones = [
    'Tómate 3 minutos para agradecer en voz alta 3 cosas específicas de ayer.',
    'Perdona a alguien hoy, aunque sea en silencio. La libertad es tuya, no de ellos.',
    'Bendice a las personas que más te cuestan. Es el acto más avanzado de fe.',
    'Haz una pausa de 60 segundos, respira profundo y suelta lo que no controlas.',
    'Escribe una sola cosa por la que estás genuinamente agradecido hoy.',
    'Ora brevemente por tu hijo, tu familia y tus proyectos antes de empezar el día.',
    'Declara en voz alta: "Hoy camino en propósito, no en miedo."'
  ];

  const frases = [
    '"El éxito es la suma de pequeños esfuerzos repetidos día tras día." — R. Collier',
    '"Avanza con confianza hacia tus sueños." — Thoreau',
    '"No cuentes los días, haz que los días cuenten." — Muhammad Ali',
    '"Empieza donde estás. Usa lo que tienes. Haz lo que puedes." — Arthur Ashe',
    '"Haz que suceda." — Brian Tracy',
    '"La disciplina es el puente entre metas y logros." — Jim Rohn',
    '"Una cosa a la vez, y esa cosa principal." — Thomas Carlyle'
  ];

  const idx = dayOfWeek();

  try {
    const res = await fetch(`${CFG.bibleApi}${versoHoy.key}?translation=rvr1960`);
    const data = await res.json();
    const texto = (data.text || '').trim();
    const ref = data.reference || versoHoy.ref;

    $('espiritualContent').innerHTML = `
      <div class="verse-box">
        <div class="verse-ref">📖 ${ref}</div>
        <div class="verse-text">"${texto}"</div>
      </div>
      <div class="espiritual-accion">
        <strong>Acción espiritual de hoy:</strong><br>${acciones[idx]}
      </div>
      <div class="espiritual-frase">${frases[idx]}</div>
    `;
  } catch {
    $('espiritualContent').innerHTML = `
      <div class="verse-box">
        <div class="verse-ref">📖 ${versoHoy.ref}</div>
        <div class="verse-text"><em>(Carga la página con internet para el versículo completo)</em></div>
      </div>
      <div class="espiritual-accion"><strong>Acción espiritual:</strong><br>${acciones[idx]}</div>
      <div class="espiritual-frase">${frases[idx]}</div>
    `;
  }
}

/* ===== MÚSICA ===== */
function renderMusica() {
  $('musicaContent').innerHTML = `
    <ul class="music-list">
      ${CFG.music.map(m => `
        <li class="music-item">
          <span class="music-icon">${m.icon}</span>
          <div>
            <div class="music-label">${m.label}</div>
            <a class="music-name" href="${m.link}" target="_blank" rel="noopener">${m.name}</a>
          </div>
        </li>`).join('')}
    </ul>
  `;
}

/* ===== NOTICIAS ===== */
async function fetchNoticias() {
  const feeds = [
    { id: 'newsEcon',   url: CFG.rss.economy },
    { id: 'newsCrypto', url: CFG.rss.crypto  },
    { id: 'newsTech',   url: CFG.rss.tech    }
  ];

  await Promise.allSettled(feeds.map(async feed => {
    try {
      const url = CFG.rss2json + encodeURIComponent(feed.url);
      const res = await fetch(url);
      const data = await res.json();
      const items = (data.items || []).slice(0, 5);

      if (!items.length) throw new Error('Sin artículos');

      $(feed.id).innerHTML = items.map(item => `
        <div class="news-item">
          <a class="news-item-title" href="${item.link}" target="_blank" rel="noopener">
            ${stripHtml(item.title || 'Sin título')}
          </a>
          <div class="news-item-date">${formatNewsDate(item.pubDate)}</div>
        </div>`).join('');
    } catch {
      $(feed.id).innerHTML = `<div class="loading-cell">
        No se pudo cargar. <a href="#" onclick="fetchNoticias();return false">Reintentar</a>
      </div>`;
    }
  }));
}

/* ===== CRIPTO PRECIOS ===== */
async function fetchCripto() {
  const coins = [
    { id: 'bitcoin',  name: 'Bitcoin',  symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'solana',   name: 'Solana',   symbol: 'SOL' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' }
  ];

  try {
    const res = await fetch(CFG.coinGecko);
    const data = await res.json();

    $('criptoContent').innerHTML = `
      <div class="crypto-list">
        ${coins.map(c => {
          const d = data[c.id];
          if (!d) return '';
          const chg = d.usd_24h_change ?? 0;
          const cls = chg >= 0 ? 'up' : 'down';
          const arrow = chg >= 0 ? '▲' : '▼';
          return `
            <div class="crypto-row">
              <div>
                <span class="crypto-name">${c.name}</span>
                <span class="crypto-symbol">${c.symbol}</span>
              </div>
              <div>
                <span class="crypto-price">$${d.usd.toLocaleString('en-US')}</span>
                <span class="crypto-change ${cls}">${arrow} ${Math.abs(chg).toFixed(2)}%</span>
              </div>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);padding:0 14px 6px;">
              MXN: $${(d.mxn || 0).toLocaleString('es-MX')}
            </div>`;
        }).join('')}
      </div>
    `;
  } catch {
    $('criptoContent').innerHTML = `<div class="loading-cell">Error al cargar CoinGecko. <a href="#" onclick="fetchCripto();return false">Reintentar</a></div>`;
  }
}

/* ===== PRODUCTIVIDAD ===== */
function renderProductividad() {
  const tracy = CFG.tracy[dayOfWeek()];
  const rutinas = [
    '🌅 Levantarte a la misma hora todos los días ancla tu ritmo circadiano.',
    '📵 Primera hora SIN teléfono. Dedícala a lo más importante del día.',
    '📓 Escribe 3 prioridades en papel antes de abrir el mail.',
    '⚡ El Ritalin alcanza su pico de efecto 30-60 min después. Úsalo bien.',
    '🔁 Después de cada tarea completada, haz 2 min de estiramiento.',
    '🎯 Una reunión = un objetivo claro. Sin objetivo definido, cancélala.',
    '🌙 Cierra el día con un "shutdown ritual": lista de mañana, 3 logros del día.'
  ];

  $('prodContent').innerHTML = `
    <div class="verse-box" style="margin-bottom:12px;">
      <div class="verse-ref">${tracy.title}</div>
      <div class="verse-text">${tracy.tip}</div>
    </div>
    <div class="salud-tip">
      <strong>💡 Rutina del día:</strong><br>
      ${rutinas[dayOfWeek()]}
    </div>
    <div style="margin-top:12px;font-size:0.82rem;color:var(--text-secondary);">
      <strong>⏰ Bloques recomendados de enfoque:</strong><br>
      Trabaja en bloques de <strong>90 minutos</strong> con <strong>15 min de descanso</strong> entre cada uno.
      Silencia notificaciones. Cierra pestañas innecesarias.
    </div>
  `;
}

/* ===== PROYECTOS ===== */
function renderProyectos() {
  $('proyectosGrid').innerHTML = CFG.projects.map(p => `
    <div class="proyecto-card" style="background:${p.bgGrad};border-color:${p.borderColor};">
      <div class="proyecto-header">
        <span class="proyecto-emoji">${p.emoji}</span>
        <div>
          <div class="proyecto-name" style="color:${p.color}">${p.name}</div>
          <div class="proyecto-url">🔗 <a href="https://${p.url}" target="_blank" rel="noopener">${p.url}</a></div>
        </div>
      </div>
      <div class="proyecto-desc">${p.desc}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin:8px 0 4px;font-weight:600;">IDEAS DEL DÍA</div>
      <ul style="padding-left:16px;font-size:0.8rem;color:var(--text-secondary);">
        ${p.ideas.map(i => `<li style="margin-bottom:3px;">${i}</li>`).join('')}
      </ul>
      <div class="proyecto-kw">
        ${p.keywords.map(k => `<span class="kw-tag">${k}</span>`).join('')}
      </div>
    </div>`).join('');
}

/* ===== PESCA ===== */
function renderPesca(weatherData) {
  const idx = fishingIndex(weatherData);
  const color = fishingColor(idx);
  const wind = Math.round(weatherData.current.wind_speed_10m);
  const hora = new Date().getHours();
  const esHoraBuena = (hora >= 5 && hora <= 9) || (hora >= 16 && hora <= 19);

  let alertHtml = '';
  if (idx >= 75) {
    alertHtml = `<div class="pesca-alert">🎣 ¡ALERTA DE PESCA! Condiciones favorables hoy (${idx}%). Sal temprano.</div>`;
  }

  $('pescaContent').innerHTML = `
    ${alertHtml}
    <div class="pesca-meter">
      <div class="pesca-score" style="color:${color}">${idx}%</div>
      <div class="pesca-label">Índice de Pesca — La Paz, BCS</div>
      <div class="pesca-bar-bg">
        <div class="pesca-bar-fill" style="width:${idx}%;background:${color};"></div>
      </div>
    </div>
    <div class="pesca-detail">
      <strong>📍 Spot ideal:</strong> Mogote / Bahía de La Paz (acceso fácil en moto + lancha)<br>
      <strong>🕐 Hora óptima:</strong> 5:00–8:30 am o 4:00–6:30 pm<br>
      <strong>🌊 Viento actual:</strong> ${wind} km/h ${wind < 15 ? '✅ Favorable' : wind < 25 ? '⚠️ Tolerable' : '🔴 Fuerte'}<br>
      <strong>🎣 Señuelos sugeridos:</strong> Poppers, jigs plateados, anchoveta artificial<br>
      <strong>🐟 Especie probable:</strong> Dorado, jurel, pargo (según temporada abril)<br>
      <strong>⏰ Hoy es ${esHoraBuena ? '✅ hora buena de pesca' : '⏳ espera las horas pico'}:</strong>
        ${esHoraBuena ? '¡Sal ahora si puedes!' : 'Próxima ventana: 4:00–6:30 pm'}<br>
      <strong>♻️ Sostenibilidad:</strong> Respeta tallas mínimas. Solo lo que vas a consumir.
    </div>
  `;
}

/* ===== MOTO ===== */
function renderMoto(weatherData) {
  const wind = weatherData.current.wind_speed_10m;
  const uv   = weatherData.current.uv_index ?? 5;
  const temp = weatherData.current.temperature_2m;

  // Seleccionar ruta según condiciones
  let ruta = CFG.motoRoutes[0]; // default: Malecón
  if (wind < 25 && uv < 9 && temp < 36) {
    const idx = dayOfWeek() % CFG.motoRoutes.length;
    ruta = CFG.motoRoutes[idx];
  }

  const noRecomendada = wind > 35 || uv > 10 || temp > 38;

  $('motoContent').innerHTML = `
    <div class="moto-info">
      ${noRecomendada
        ? '<div class="pesca-alert" style="border-color:rgba(239,68,68,0.4);color:#ef4444;">⚠️ Condiciones extremas. No se recomienda ruta larga hoy.</div>'
        : ''}
      <div class="moto-ruta-name">📍 ${ruta.name}</div>
      <div class="moto-stats">
        <div class="moto-stat"><div class="moto-stat-label">Distancia</div><div class="moto-stat-val">${ruta.dist}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Duración</div><div class="moto-stat-val">${ruta.duration}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Gasolina</div><div class="moto-stat-val">${ruta.fuel}</div></div>
        <div class="moto-stat"><div class="moto-stat-label">Costo aprox.</div><div class="moto-stat-val">${ruta.cost}</div></div>
      </div>
      <div style="margin:8px 0;font-size:0.82rem;">
        <strong>🎭 Cultura:</strong> ${ruta.cultura}<br>
        <strong>🏠 Immo:</strong> ${ruta.immo}<br>
        <strong>📊 Dificultad:</strong> ${ruta.diff}
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;">
        🏍️ Italika FT150 TS · Vel. segura: 60–70 km/h · Máx. sin descanso: 50 min
      </div>
      <a class="moto-link" href="${ruta.maps}" target="_blank" rel="noopener">
        🗺️ Ver en Google Maps
      </a>
    </div>
  `;
}

/* ===== PLAN DEL DÍA ===== */
function renderPlanDia() {
  const bloques = [
    { time: '05:00 – 06:30', title: '🌅 Ritual de mañana', color: '#f59e0b',
      desc: 'Levantarte. Agua. Ritalin + Complejo B. 5 min de gratitud. Lee el boletín.' },
    { time: '06:30 – 08:00', title: '📖 Espiritualidad & mente', color: '#8b5cf6',
      desc: 'Versículo del día, meditación breve o lectura. Sin teléfono todavía.' },
    { time: '08:00 – 09:30', title: '🐸 Bloque A (Come el sapo)', color: '#ef4444',
      desc: 'Ataca la tarea más crítica del día. Sin interrupciones. Teléfono en silencio.' },
    { time: '09:30 – 10:00', title: '☕ Descanso activo', color: '#10b981',
      desc: 'Estira, toma agua, respira. Revisa mensajes importantes (solo 15 min).' },
    { time: '10:00 – 12:00', title: '💼 Bloque B (Proyectos)', color: '#3b82f6',
      desc: '9Stratex / Par de Santos / BN Records / Paypaps — según prioridad del día.' },
    { time: '12:00 – 13:30', title: '🥗 Comida & descanso', color: '#10b981',
      desc: 'Alimento real. Sin pantalla si puedes. Camina 10 minutos después.' },
    { time: '13:30 – 15:30', title: '🧠 Bloque C (Contenido & estrategia)', color: '#f59e0b',
      desc: 'Contenido para redes, keywords, blog o estrategia para tus negocios.' },
    { time: '15:30 – 16:00', title: '⚡ HIIT o movimiento', color: '#ef4444',
      desc: '15-20 min de ejercicio intenso. Libera endorfinas para el cierre del día.' },
    { time: '16:00 – 18:00', title: '🎣 Exploración / Pesca / Moto', color: '#3b82f6',
      desc: 'Si las condiciones lo permiten: sal a explorar, pescar o rodar en moto.' },
    { time: '18:00 – 19:00', title: '💖 Tiempo para tu hijo', color: '#ec4899',
      desc: 'Ventana ideal para llamar o escribirle. Mensaje simple, con amor.' },
    { time: '19:00 – 20:30', title: '📚 Lectura / Podcast / Reflexión', color: '#8b5cf6',
      desc: 'Seminario Fénix o Dante Gebel. Lectura. Sin noticias pesadas.' },
    { time: '20:30 – 21:00', title: '🌙 Shutdown ritual', color: '#64748b',
      desc: 'Lista de mañana. 3 logros del día. Cierra el trabajo. Descansa.' }
  ];

  $('planContent').innerHTML = `
    <div class="plan-grid">
      ${bloques.map(b => `
        <div class="plan-block" style="border-color:${b.color}">
          <div class="plan-time">${b.time}</div>
          <div class="plan-title">${b.title}</div>
          <div class="plan-desc">${b.desc}</div>
        </div>`).join('')}
    </div>
  `;
}

/* ===== CHECKLIST ===== */
function getChecklistState() {
  const saved = localStorage.getItem('boletin_checklist_' + todayKey());
  return saved ? JSON.parse(saved) : {};
}

function saveChecklistState(state) {
  localStorage.setItem('boletin_checklist_' + todayKey(), JSON.stringify(state));
}

const CHECKLIST_ITEMS = [
  { id: 'ritalin',   text: '💊 Tomar Ritalin',              tag: 'Salud' },
  { id: 'compb',     text: '🅱️ Tomar Complejo B',           tag: 'Salud' },
  { id: 'agua',      text: '💧 Agua (2+ vasos AM)',          tag: 'Salud' },
  { id: 'desayuno',  text: '🥗 Desayuno real',              tag: 'Salud' },
  { id: 'ejercicio', text: '🏃 15 min de ejercicio',        tag: 'Salud' },
  { id: 'espirit',   text: '📖 Versículo / reflexión',      tag: 'Espíritu' },
  { id: 'hijo',      text: '💖 Escribirle a mi hijo',       tag: 'Familia' },
  { id: 'tareaA',    text: '🐸 Tarea A (lo más crítico)',   tag: 'Trabajo' },
  { id: 'proyecto',  text: '💼 Avance en proyecto',         tag: 'Trabajo' },
  { id: 'contenido', text: '📝 Crear contenido / post',     tag: 'Digital' },
  { id: 'shutdown',  text: '🌙 Shutdown ritual nocturno',   tag: 'Cierre' },
  { id: 'gratitud',  text: '🙏 3 cosas de gratitud',        tag: 'Espíritu' },
];

function renderChecklist() {
  const ckState = getChecklistState();

  $('checklistContent').innerHTML = `
    <div class="checklist-grid">
      ${CHECKLIST_ITEMS.map(item => {
        const done = !!ckState[item.id];
        return `
          <div class="checklist-item ${done ? 'done' : ''}" onclick="toggleCheck('${item.id}')">
            <div class="cli-check">${done ? '✓' : ''}</div>
            <span class="cli-text">${item.text}</span>
            <span class="cli-tag">${item.tag}</span>
          </div>`;
      }).join('')}
    </div>
    <div style="margin-top:12px;font-size:0.78rem;color:var(--text-muted);">
      El checklist se reinicia automáticamente cada día. Tu progreso de hoy se guarda en el navegador.
    </div>
  `;
}

function toggleCheck(id) {
  const ckState = getChecklistState();
  ckState[id] = !ckState[id];
  saveChecklistState(ckState);
  renderChecklist();
}

function resetChecklist() {
  localStorage.removeItem('boletin_checklist_' + todayKey());
  renderChecklist();
}

/* ===== FOOTER BENDICIÓN ===== */
function renderBendicion() {
  const bendiciones = [
    'Que este día sea abundante en claridad, en paz y en propósito.\nCada paso que das hoy tiene significado. Eres guiado. Eres amado.',
    'Que la sabiduría guíe tus decisiones y el amor guíe tus palabras.\nHoy es un nuevo comienzo. Avanza con fe.',
    'Que Dios abra puertas que ningún hombre puede cerrar.\nTu trabajo hoy construye el mañana que imaginas.',
    'Que la gratitud sea tu punto de partida y la generosidad tu destino.\nEres más de lo que crees. Sigue adelante.',
    'Que la paz de Dios que sobrepasa todo entendimiento guarde tu corazón hoy.\nPaso a paso, con intención y con amor.'
  ];
  const b = bendiciones[dayOfWeek() % bendiciones.length];

  $('blessingContent').innerHTML = `
    <div class="blessing-text">${b.replace('\n', '<br>')}</div>
    <div class="blessing-sub">— Boletín LA BUENA · ${CFG.user} · La Paz, BCS</div>
  `;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  // Renderizar secciones estáticas inmediatamente
  renderDateTime();
  renderTldr();
  renderCheckin();
  renderSalud();
  renderHijo();
  renderMusica();
  renderProductividad();
  renderProyectos();
  renderPlanDia();
  renderChecklist();
  renderBendicion();

  // Actualizar reloj cada minuto
  setInterval(renderDateTime, 60_000);

  // Fetch asíncrono en paralelo
  await Promise.allSettled([
    fetchWeather(),
    fetchCripto(),
    fetchNoticias(),
    fetchEspiritual()
  ]);
});
