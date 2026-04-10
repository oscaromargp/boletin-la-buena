/* ============================================================
   app.js — Boletín LA BUENA v2 (Panel de Control)
   Lee settings.js para personalización. Fetch: Open-Meteo, CoinGecko, rss2json, bible-api
   ============================================================ */

'use strict';

/* ================================================================
   HELPERS
   ================================================================ */
const $ = id => document.getElementById(id);

function dow() { return new Date().getDay(); }  // 0=Dom…6=Sáb

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

/* ================================================================
   DATE / TIME
   ================================================================ */
function renderDateTime() {
  const now = new Date();
  const dayStr = now.toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const timeStr = now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  $('dateTime').innerHTML = `
    <div class="day">${dayStr.charAt(0).toUpperCase()+dayStr.slice(1)}</div>
    <div>${timeStr} hrs · La Paz, BCS</div>`;
}

/* ================================================================
   TL;DR (lee daily.mood y daily.focusProject)
   ================================================================ */
function renderTldr() {
  const daily    = getDaily();
  const settings = getSettings();
  const name     = settings.user.name;

  const moodTexts = {
    energy: `Tu energía está en su punto máximo, ${name}. Este es el día de ir por lo que más importa. ¡Sin frenos!`,
    calm:   `Un día de flujo suave, ${name}. Perfecto para tareas de profundidad y reflexión. Confía en tu ritmo.`,
    tired:  `Día de ritmo moderado, ${name}. Prioriza lo esencial y date permiso de ir despacio. Lo importante es seguir.`,
    focus:  `En modo láser, ${name}. Elimina distracciones y ve directo a tu tarea A. Tienes todo lo necesario.`
  };
  const base = daily.mood
    ? moodTexts[daily.mood]
    : `Buenos días, ${name}. Esta es tu brújula del día: clima, cripto, noticias, plan y checklist — todo configurado para ti.`;

  const priText = (daily.priorities||[]).filter(p=>p.trim()).length
    ? ` Tienes ${(daily.priorities).filter(p=>p.trim()).length} prioridad(es) definidas.` : '';

  const focusProj = daily.focusProject
    ? CFG.projects.find(p => p.id === daily.focusProject) : null;
  const focusTxt = focusProj ? ` Proyecto foco hoy: ${focusProj.emoji} ${focusProj.name}.` : '';

  const sonTxt = daily.withSon ? ' 💖 ¡Hoy estás con tu hijo!' : '';

  $('tldrText').textContent = base + priText + focusTxt + sonTxt;
}

/* ================================================================
   PRIORIDADES DEL DÍA
   ================================================================ */
function renderPriorities() {
  const daily = getDaily();
  const pris  = (daily.priorities || []).filter(p => p.trim());
  const el    = $('s-priorities');
  if (!el) return;
  if (!pris.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  $('prioritiesContent').innerHTML = `
    <div class="priorities-list">
      ${pris.map((p,i) => `
        <div class="priority-item">
          <span class="pri-badge">${i+1}</span>
          <span class="pri-txt">${esc(p)}</span>
        </div>`).join('')}
    </div>
    ${daily.notes ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.82rem;color:var(--text-secondary);">
      <strong style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;">Nota del día</strong><br>
      ${esc(daily.notes)}
    </div>` : ''}
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
  $('climaStatus').textContent = 'Actualizado ahora';
  let rows = '';
  results.forEach((res, i) => {
    const city = cities[i];
    if (res.status === 'rejected') { rows += `<tr><td colspan="7" class="loading-cell">Error: ${city.name}</td></tr>`; return; }
    const cur  = res.value.current;
    const daily = res.value.daily;
    const uv    = uvLabel(cur.uv_index ?? 0);
    const con   = confortLabel(cur.apparent_temperature);
    const min   = Math.round(daily.temperature_2m_min[0]);
    const max   = Math.round(daily.temperature_2m_max[0]);
    if (i === 0) {
      $('wbadge-temp').textContent = `${Math.round(cur.temperature_2m)}°C`;
      renderPesca(res.value);
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
  $('climaBody').innerHTML = rows;
}

/* ================================================================
   SALUD (lee settings.medications, settings.habits, daily)
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

  const emocionAcciones = [
    '💙 ¿Qué te duele hoy?', '💛 ¿Qué te preocupa?', '💚 ¿Qué te motiva?', '🤍 ¿Qué necesitas soltar?'
  ];

  $('saludContent').innerHTML = `
    ${allItems.length ? `
    <table class="habit-table">
      <thead><tr><th>Hábito / Med.</th><th>Objetivo</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p style="color:var(--text-muted);font-size:0.84rem;margin-bottom:12px;">Configura tus medicamentos y hábitos en ⚙️</p>'}
    <div class="salud-tip">
      <strong>${tracy.title}</strong><br>${tracy.tip}
    </div>
    <div class="emocion-check">
      ${emocionAcciones.map(q => `<p><span>${q}</span> — Respóndelo en tu nota del día.</p>`).join('')}
    </div>
    <div class="salud-tip" style="margin-top:10px;border-color:#f59e0b;">
      📋 <strong>Recuerda:</strong> Agenda tu análisis clínico trimestral y chequeo con el médico.
    </div>
  `;
}

/* ================================================================
   HIJO (cambia según daily.withSon)
   ================================================================ */
function renderHijo() {
  const daily = getDaily();
  const now   = new Date();
  const hijoHour = now.getHours() + 1;  // hijo en UTC-6, tú en UTC-7
  const enVentana = hijoHour >= CFG.hijoWindowStart && hijoHour < CFG.hijoWindowEnd;
  const ventanaMsg = enVentana
    ? `✅ Buen momento para escribirle (son las ${hijoHour}:00 en Puerto Escondido)`
    : `⚠️ Fuera de su ventana ideal. Espera a las 6:00 am hora de Oaxaca.`;

  if (daily.withSon) {
    // MODO: Estoy con mi hijo hoy
    $('hijoTitle').textContent = 'Estoy con mi hijo hoy 💖';
    $('hijoContent').innerHTML = `
      <div class="son-today-banner">💖 HOY ESTÁS CON TU HIJO — DÍA ESPECIAL</div>
      <div class="hijo-msg">Hoy es un día para estar presente. No para entretenerlo, sino para acompañarlo. Escúchalo. Míralo. Comparte su mundo a su ritmo. Tu presencia es el regalo más grande.</div>

      <div class="hijo-actividad">
        <div class="hijo-actividad-title" style="color:#10b981;">🎯 Actividades para hacer juntos hoy</div>
        <ul style="padding-left:16px;font-size:0.84rem;line-height:1.8;color:var(--text-secondary);">
          <li>Salir a caminar juntos sin prisa — que él elija el rumbo</li>
          <li>Ver una película o video de algo que a él le guste</li>
          <li>Dibujar o colorear juntos (sin presión, sin resultado)</li>
          <li>Preparar algo de comer juntos — algo simple y seguro</li>
          <li>Escuchar música que le guste y bailar si quiere</li>
        </ul>
      </div>

      <div class="hijo-actividad" style="margin-top:8px;border-color:rgba(245,158,11,0.3);">
        <div class="hijo-actividad-title" style="color:#f59e0b;">💡 Guía para este día</div>
        <ul style="padding-left:16px;font-size:0.82rem;line-height:1.8;color:var(--text-secondary);">
          <li>Palabras claras, simples y tranquilas</li>
          <li>Poco cambio de plan — si hiciste una promesa, cúmplela</li>
          <li>Sin sobrecargar emociones — ritmo suave</li>
          <li>Celebra sus logros pequeños en voz alta</li>
          <li>Terminen el día con algo que a él le genere seguridad</li>
        </ul>
      </div>

      <div class="hijo-actividad" style="margin-top:8px;border-color:rgba(139,92,246,0.3);">
        <div class="hijo-actividad-title" style="color:#8b5cf6;">🙏 Bendición del día con él</div>
        <p style="font-style:italic;font-size:0.86rem;color:var(--text-secondary);">"Gracias, Señor, por este tiempo juntos. Que cada momento sea un ladrillo de amor que él lleve consigo toda la vida. Eres lo más importante."</p>
      </div>`;
  } else {
    // MODO: Mensaje a distancia
    $('hijoTitle').textContent = 'Mensaje para mi Hijo';
    $('hijoContent').innerHTML = `
      <div class="hijo-msg">Hola, campeón 💙

¿Cómo estás hoy? Te pienso desde La Paz.
Quería decirte que eres increíble.
Cada día que das lo mejor de ti me llena de orgullo.

El sol aquí brilla fuerte hoy,
y cada rayo me recuerda tu sonrisa.

Te quiero mucho. Siempre estoy aquí. 🌟</div>

      <div class="hijo-actividad">
        <div class="hijo-actividad-title">💡 Actividad compartida a distancia</div>
        <p>Mándense fotos de algo bonito que cada uno vio hoy. O cuéntenle lo mejor de su día por WhatsApp.</p>
      </div>

      <div class="hijo-actividad" style="margin-top:8px;border-color:rgba(245,158,11,0.3);">
        <div class="hijo-actividad-title" style="color:#f59e0b;">📍 Tema de conversación simple</div>
        <p>¿Cuál fue tu animal favorito esta semana? ¿O qué te hizo reír? — Preguntas claras, sin sobrecarga.</p>
      </div>

      <div class="hijo-ventana">🕐 ${ventanaMsg}</div>

      <div class="hijo-actividad" style="margin-top:8px;border-color:rgba(139,92,246,0.3);">
        <div class="hijo-actividad-title" style="color:#8b5cf6;">🙏 Bendición espiritual</div>
        <p style="font-style:italic;font-size:0.86rem;">"Que Dios te guarde, te llene de paz y te recuerde siempre lo amado que eres. Eres lo más importante."</p>
      </div>`;
  }
}

/* ================================================================
   ESPIRITUALIDAD
   ================================================================ */
async function fetchEspiritual() {
  const versoHoy = CFG.versos[dow()];
  const acciones = [
    'Tómate 3 minutos para agradecer en voz alta 3 cosas específicas de ayer.',
    'Perdona a alguien hoy, aunque sea en silencio. La libertad es tuya, no de ellos.',
    'Bendice a las personas que más te cuestan. Es el acto más avanzado de fe.',
    'Haz una pausa de 60 segundos, respira y suelta lo que no controlas.',
    'Escribe una cosa por la que estás genuinamente agradecido hoy.',
    'Ora brevemente por tu hijo, tu familia y tus proyectos antes de empezar.',
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
  try {
    const res  = await fetch(`${CFG.bibleApi}${versoHoy.key}?translation=rvr1960`);
    const data = await res.json();
    const txt  = (data.text || '').trim();
    const ref  = data.reference || versoHoy.ref;
    $('espiritualContent').innerHTML = `
      <div class="verse-box">
        <div class="verse-ref">📖 ${esc(ref)}</div>
        <div class="verse-text">"${esc(txt)}"</div>
      </div>
      <div class="espiritual-accion"><strong>Acción espiritual de hoy:</strong><br>${acciones[dow()]}</div>
      <div class="espiritual-frase">${frases[dow()]}</div>`;
  } catch {
    $('espiritualContent').innerHTML = `
      <div class="verse-box">
        <div class="verse-ref">📖 ${versoHoy.ref}</div>
        <div class="verse-text"><em>Carga con internet para ver el versículo completo.</em></div>
      </div>
      <div class="espiritual-accion"><strong>Acción de hoy:</strong><br>${acciones[dow()]}</div>
      <div class="espiritual-frase">${frases[dow()]}</div>`;
  }
}

/* ================================================================
   MÚSICA
   ================================================================ */
function renderMusica() {
  $('musicaContent').innerHTML = `
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
    try {
      const res  = await fetch(CFG.rss2json + encodeURIComponent(feed.url));
      const data = await res.json();
      const items = (data.items || []).slice(0,5);
      if (!items.length) throw new Error('vacío');
      $(feed.id).innerHTML = items.map(item => `
        <div class="news-item">
          <a class="news-item-title" href="${item.link}" target="_blank" rel="noopener">${esc(stripHtml(item.title||''))}</a>
          <div class="news-item-date">${fmtDate(item.pubDate)}</div>
        </div>`).join('');
    } catch {
      $(feed.id).innerHTML = `<div class="loading-cell">No se pudo cargar. <a href="#" onclick="fetchNoticias();return false">Reintentar</a></div>`;
    }
  }));
}

/* ================================================================
   CRIPTO
   ================================================================ */
async function fetchCripto() {
  const coins = [
    { id:'bitcoin',  name:'Bitcoin',  sym:'BTC'  },
    { id:'ethereum', name:'Ethereum', sym:'ETH'  },
    { id:'solana',   name:'Solana',   sym:'SOL'  },
    { id:'dogecoin', name:'Dogecoin', sym:'DOGE' }
  ];
  try {
    const data = await fetch(CFG.coinGecko).then(r=>r.json());
    $('criptoContent').innerHTML = `
      <div class="crypto-list">
        ${coins.map(c => {
          const d = data[c.id]; if (!d) return '';
          const chg = d.usd_24h_change ?? 0;
          const cls = chg >= 0 ? 'up' : 'down';
          const arr = chg >= 0 ? '▲' : '▼';
          return `
            <div class="crypto-row">
              <div><span class="crypto-name">${c.name}</span><span class="crypto-symbol">${c.sym}</span></div>
              <div>
                <span class="crypto-price">$${d.usd.toLocaleString('en-US')}</span>
                <span class="crypto-change ${cls}">${arr} ${Math.abs(chg).toFixed(2)}%</span>
              </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);padding:0 14px 4px;">MXN $${(d.mxn||0).toLocaleString('es-MX')}</div>`;
        }).join('')}
      </div>`;
  } catch {
    $('criptoContent').innerHTML = `<div class="loading-cell">Error CoinGecko. <a href="#" onclick="fetchCripto();return false">Reintentar</a></div>`;
  }
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
  $('prodContent').innerHTML = `
    <div class="verse-box" style="margin-bottom:12px;">
      <div class="verse-ref">${tracy.title}</div>
      <div class="verse-text">${tracy.tip}</div>
    </div>
    <div class="salud-tip">
      <strong>💡 Rutina del día:</strong><br>${rutinas[dow()]}
    </div>
    <div style="margin-top:12px;font-size:0.82rem;color:var(--text-secondary);">
      <strong>⏰ Bloques:</strong> 90 min de trabajo · 15 min de descanso · Repite.<br>
      Silencia notificaciones. Cierra pestañas. Pon el foco.
    </div>`;
}

/* ================================================================
   PROYECTOS (lee settings.projects y daily.focusProject)
   ================================================================ */
function renderProyectos() {
  const settings = getSettings();
  const daily    = getDaily();
  const activos  = CFG.projects.filter(p => settings.projects[p.id] !== false);

  if (!activos.length) {
    $('proyectosGrid').innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px;">Activa proyectos desde ⚙️ Preferencias</div>`;
    return;
  }

  $('proyectosGrid').innerHTML = activos.map(p => {
    const isFocus = daily.focusProject === p.id;
    return `
      <div class="proyecto-card ${isFocus?'proyecto-focus':''}"
        style="background:${p.bgGrad};border-color:${p.borderColor};">
        ${isFocus ? '<div class="focus-badge">🎯 FOCO DE HOY</div>' : ''}
        <div class="proyecto-header">
          <span class="proyecto-emoji">${p.emoji}</span>
          <div>
            <div class="proyecto-name" style="color:${p.color}">${p.name}</div>
            <div class="proyecto-url">🔗 <a href="https://${p.url}" target="_blank" rel="noopener">${p.url}</a></div>
          </div>
        </div>
        <div class="proyecto-desc">${p.desc}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;margin:6px 0 3px;">IDEAS HOY</div>
        <ul class="proyecto-ideas" style="padding-left:16px;">
          ${p.ideas.map(i=>`<li>${esc(i)}</li>`).join('')}
        </ul>
        <div class="proyecto-kw">
          ${p.keywords.map(k=>`<span class="kw-tag">${esc(k)}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

/* ================================================================
   PESCA
   ================================================================ */
function renderPesca(weatherData) {
  const idx  = fishingIndex(weatherData);
  const col  = fishColor(idx);
  const wind = Math.round(weatherData.current.wind_speed_10m);
  const h    = new Date().getHours();
  const buena = (h >= 5 && h <= 9) || (h >= 16 && h <= 19);

  $('pescaContent').innerHTML = `
    ${idx >= 75 ? `<div class="pesca-alert">🎣 ¡ALERTA DE PESCA! Condiciones favorables hoy (${idx}%). Sal temprano o a las 4 pm.</div>` : ''}
    <div class="pesca-meter" style="margin-bottom:12px;">
      <div class="pesca-score" style="color:${col}">${idx}%</div>
      <div class="pesca-label">Índice de Pesca — La Paz, BCS</div>
      <div class="pesca-bar-bg"><div class="pesca-bar-fill" style="width:${idx}%;background:${col};"></div></div>
    </div>
    <div class="pesca-detail">
      <strong>📍 Spot:</strong> Mogote / Bahía de La Paz<br>
      <strong>🕐 Hora óptima:</strong> 5–8:30 am o 4–6:30 pm<br>
      <strong>🌊 Viento:</strong> ${wind} km/h ${wind<15?'✅ Ideal':wind<25?'⚠️ Tolerable':'🔴 Fuerte'}<br>
      <strong>🎣 Señuelos:</strong> Poppers, jigs plateados, anchoveta artificial<br>
      <strong>🐟 Especie:</strong> Dorado, jurel, pargo (temporada abril)<br>
      <strong>⏰ Ahora:</strong> ${buena?'✅ Hora buena — ¡sal si puedes!':'⏳ Próxima ventana: 4:00–6:30 pm'}<br>
      <strong>♻️ Sostén.:</strong> Respeta tallas mínimas. Solo lo que vas a consumir.
    </div>`;
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

  $('motoContent').innerHTML = `
    <div class="moto-info">
      ${noOk?`<div class="pesca-alert" style="color:var(--red);border-color:rgba(239,68,68,0.4);">⚠️ Condiciones extremas. No se recomienda ruta larga hoy.</div>`:''}
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
      <div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:8px;">🏍️ Italika FT150 TS · 60–70 km/h · máx. 50 min sin parar</div>
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
    { time:'06:30–08:00', title:'📖 Espiritualidad & mente',  color:'#8b5cf6', desc:'Versículo, meditación breve o lectura. Sin teléfono todavía.' },
    { time:'08:00–09:30', title:'🐸 Bloque A — Come el sapo', color:'#ef4444', desc:'Tu tarea más crítica del día. Sin interrupciones. Teléfono en silencio.' },
    { time:'09:30–10:00', title:'☕ Descanso activo',          color:'#10b981', desc:'Estira, agua, respira. Revisa mensajes (solo 15 min).' },
    { time:'10:00–12:00', title:`💼 Bloque B${focusProj?' — '+focusProj.name:''}`, color: focusProj?focusProj.color:'#3b82f6', desc:`Proyectos${focusProj?': '+focusProj.name+' con enfoque total':''}. Sin distracciones.` },
    { time:'12:00–13:30', title:'🥗 Comida & descanso',        color:'#10b981', desc:'Alimento real. Sin pantalla si puedes. Camina 10 min.' },
    { time:'13:30–15:30', title:'🧠 Bloque C — Contenido',    color:'#f59e0b', desc:'Contenido para redes, keywords, blog o estrategia de negocio.' },
    { time:'15:30–16:00', title:'⚡ HIIT / Movimiento',        color:'#ef4444', desc:'15–20 min de ejercicio. Libera endorfinas para el cierre.' },
    { time:'16:00–18:00', title:'🎣 Exploración / Pesca / Moto', color:'#3b82f6', desc:'Si las condiciones lo permiten: sal a explorar, pescar o rodar.' },
    { time:'18:00–19:00', title:'💖 Tiempo para tu hijo',      color:'#ec4899', desc:'Ventana ideal para llamarle o escribirle. Mensaje simple, con amor.' },
    { time:'19:00–20:30', title:'📚 Lectura / Podcast',        color:'#8b5cf6', desc:'Seminario Fénix o Dante Gebel. Lectura. Sin noticias pesadas.' },
    { time:'20:30–21:00', title:'🌙 Shutdown ritual',          color:'#64748b', desc:'Lista de mañana. 3 logros del día. Cierra el trabajo. Descansa.' }
  ];

  $('planContent').innerHTML = `
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
   CHECKLIST (combina base + hábitos activos + custom de settings)
   ================================================================ */
const CK_KEY_PFX = 'boletin_ck_';
function _ckKey() { const d=new Date(); return `${CK_KEY_PFX}${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function _ckState() { try{ return JSON.parse(localStorage.getItem(_ckKey())||'{}'); }catch{ return {}; } }
function _ckSave(s) { localStorage.setItem(_ckKey(), JSON.stringify(s)); }

function renderChecklist() {
  const settings = getSettings();
  const ckState  = _ckState();

  // Combinar: base + hábitos activos como items + custom de settings
  const habitItems = settings.habits
    .filter(h => h.active)
    .map(h => ({ id: `habit_${h.id}`, text: h.name, tag: 'Salud' }));

  const medItems = settings.medications
    .filter(m => m.active)
    .map(m => ({ id: `med_${m.id}`, text: `💊 ${m.name}`, tag: 'Salud' }));

  const allItems = [
    ...medItems,
    ...habitItems,
    ...CFG.baseChecklist,
    ...(settings.customChecklist || [])
  ];

  // Deduplicar por id
  const seen = new Set();
  const items = allItems.filter(i => { if(seen.has(i.id)) return false; seen.add(i.id); return true; });

  $('checklistContent').innerHTML = `
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
    <div style="margin-top:10px;font-size:0.76rem;color:var(--text-muted);">
      El checklist se reinicia cada día. Agrega tareas desde ⚙️ Salud.
    </div>`;
}

function toggleCheck(id) {
  const s = _ckState(); s[id] = !s[id]; _ckSave(s); renderChecklist();
}
function resetChecklist() { localStorage.removeItem(_ckKey()); renderChecklist(); }

/* ================================================================
   FOOTER / BENDICIÓN
   ================================================================ */
function renderBendicion() {
  const settings = getSettings();
  const name = settings.user.name;
  const ciudad = `${settings.user.ciudad}, ${settings.user.estado}`;
  const bends = [
    `Que este día sea abundante en claridad, en paz y en propósito.\nCada paso que das hoy tiene significado. Eres guiado. Eres amado.`,
    `Que la sabiduría guíe tus decisiones y el amor tus palabras.\nHoy es un nuevo comienzo. Avanza con fe, ${name}.`,
    `Que Dios abra puertas que ningún hombre puede cerrar.\nTu trabajo hoy construye el mañana que imaginas.`,
    `Que la gratitud sea tu punto de partida y la generosidad tu destino.\nEres más de lo que crees. Sigue adelante.`,
    `Que la paz de Dios guarde tu corazón hoy.\nPaso a paso, con intención y con amor.`
  ];
  const b = bends[dow() % bends.length];
  $('blessingContent').innerHTML = `
    <div class="blessing-text">${b.replace('\n','<br>')}</div>
    <div class="blessing-sub">— Boletín LA BUENA · ${name} · ${ciudad}</div>`;
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Aplicar nombre desde settings
  const settings = getSettings();
  CFG.user = settings.user.name;
  const sub = $('brandSub');
  if (sub) sub.textContent = `Coach de Vida Total · ${settings.user.name} · ${settings.user.ciudad}, ${settings.user.estado}`;

  // Render estático inmediato
  renderDateTime();
  renderTldr();
  renderPriorities();
  renderSalud();
  renderHijo();
  renderMusica();
  renderProductividad();
  renderProyectos();
  renderPlanDia();
  renderChecklist();
  renderBendicion();

  // Aplicar visibilidad de secciones
  applySectionVisibility();

  // Actualizar reloj cada minuto
  setInterval(renderDateTime, 60_000);

  // Fetch asíncrono
  await Promise.allSettled([
    fetchWeather(),
    fetchCripto(),
    fetchNoticias(),
    fetchEspiritual()
  ]);

  // Auto-abrir panel si es primera visita del día
  checkFirstVisit();
});
