/* ============================================================
   intel_service.js — Servicio de Inteligencia Situacional v2
   Inspirado en la arquitectura de World Monitor (koala73/worldmonitor)
   Incluye: agregación RSS, clasificación de señales, mareas BCS,
            índice de pesca marino, y logger histórico a Sheets.
   ============================================================ */

'use strict';

/* ================================================================
   CONFIGURACIÓN DE FEEDS
   ================================================================ */
const INTEL_FEEDS = {
  global_intel: [
    {
      id: 'reuters',
      label: '📡 Reuters',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://feeds.reuters.com/reuters/worldNews',
      category: 'global', signal: 'geopolitics'
    },
    {
      id: 'bbcmundo',
      label: '🌍 BBC Mundo',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://feeds.bbci.co.uk/mundo/rss.xml',
      category: 'global', signal: 'world'
    },
    {
      id: 'elnorte',
      label: '🇲🇽 El Norte',
      url: 'https://api.rss2json.com/v1/api.json?count=4&rss_url=https://www.elnorte.com/rss/portada.xml',
      category: 'national', signal: 'mexico'
    }
  ],
  marine: {
    openMeteo: 'https://api.open-meteo.com/v1/marine',
    coordsBCS: { lat: 24.1426, lon: -110.3128 },
    params: 'wave_height,wave_period,wind_wave_height,wind_speed_10m,wind_direction_10m,temperature_2m'
  },
  markets: {
    forex: 'https://open.er-api.com/v6/latest/USD'
  }
};

/* ================================================================
   SIGNAL CLASSIFIER
   ================================================================ */
const SIGNAL_KEYWORDS = {
  economic:   ['inflación','dólar','BANXICO','PIB','economía','mercado','peso','USD','MXN','bolsa','finanzas','tasas'],
  climate:    ['huracán','tormenta','ciclón','lluvia','temperatura','calor','viento','sismo','terremoto','inundación'],
  security:   ['seguridad','crimen','violencia','narcotráfico','ejército','policía','captura','operativo','asesinato'],
  political:  ['gobierno','presidente','gobernador','elecciones','senado','cámara','ley','decreto','reforma'],
  fishing:    ['pesca','camarón','atún','langosta','veda','CONAPESCA','Golfo','Pacífico','Mar de Cortés','peces'],
  technology: ['IA','inteligencia artificial','tecnología','startup','app','digital','ciberseguridad','robot','OpenAI']
};

function classifySignal(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  const scores = {};
  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    scores[signal] = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
  }
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return top[0][1] > 0 ? top[0][0] : 'general';
}

/* ================================================================
   TIDAL DATA CALCULATOR (emula tablademareas.com para BCS)
   Usa fórmulas armónicas simplificadas para La Paz, BCS
   ================================================================ */
function calculateTides() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  // Constantes armónicas aproximadas para La Paz, Baja California Sur
  // Ref: CICESE / tablademareas.com - componentes M2, S2, K1, O1
  const M2_period = 12.42; // horas (mareal semidiurna lunar)
  const S2_period = 12.00; // horas (mareal semidiurna solar)
  const K1_period = 23.93; // horas (mareal diurna)
  const O1_period = 25.82; // horas (mareal diurna lunar)

  // Amplitudes para La Paz (metros)
  const M2_amp = 0.52;
  const S2_amp = 0.20;
  const K1_amp = 0.28;
  const O1_amp = 0.22;

  // Nivel medio (La Paz ~0.85m sobre cero chart datum)
  const meanLevel = 0.85;

  // Fases (ajustadas empíricamente)
  const M2_phase = (dayOfYear * 0.985647) % (2 * Math.PI);
  const S2_phase = (dayOfYear * 0.0172) % (2 * Math.PI);
  const K1_phase = (dayOfYear * 0.0027379) % (2 * Math.PI);
  const O1_phase = (dayOfYear * 0.0026392) % (2 * Math.PI);

  // Proyección para las próximas 24 horas (cada 30 min)
  const tides = [];
  for (let h = 0; h < 24; h += 0.5) {
    const t_rad = (h * 2 * Math.PI);
    const level = meanLevel
      + M2_amp * Math.cos(t_rad / M2_period - M2_phase)
      + S2_amp * Math.cos(t_rad / S2_period - S2_phase)
      + K1_amp * Math.cos(t_rad / K1_period - K1_phase)
      + O1_amp * Math.cos(t_rad / O1_period - O1_phase);

    tides.push({
      hour: h,
      level: Math.max(0, level),
      time: `${String(Math.floor(h)).padStart(2,'0')}:${h % 1 === 0 ? '00' : '30'}`
    });
  }

  // Encontrar pleamares y bajamares
  const extremes = [];
  for (let i = 1; i < tides.length - 1; i++) {
    const prev = tides[i-1].level;
    const curr = tides[i].level;
    const next = tides[i+1].level;
    if (curr > prev && curr > next) {
      extremes.push({ type: 'pleamar', ...tides[i], icon: '↑' });
    } else if (curr < prev && curr < next) {
      extremes.push({ type: 'bajamar', ...tides[i], icon: '↓' });
    }
  }

  // Coeficiente de marea (0-120, refleja amplitud)
  const currentLevel = meanLevel
    + M2_amp * Math.cos((hour * 2 * Math.PI) / M2_period - M2_phase)
    + S2_amp * Math.cos((hour * 2 * Math.PI) / S2_period - S2_phase)
    + K1_amp * Math.cos((hour * 2 * Math.PI) / K1_period - K1_phase)
    + O1_amp * Math.cos((hour * 2 * Math.PI) / O1_period - O1_phase);

  const range = (M2_amp + S2_amp) * 2;
  const coefficient = Math.round(((currentLevel - (meanLevel - range/2)) / range) * 120);

  // Actividad de peces basada en mareas (peak en cambios de marea)
  let fishActivity = 'Moderada';
  let fishActivityScore = 5;
  if (extremes.length > 0) {
    const nearest = extremes.reduce((closest, e) => {
      return Math.abs(e.hour - hour) < Math.abs(closest.hour - hour) ? e : closest;
    }, extremes[0]);
    const diff = Math.abs(nearest.hour - hour);
    if (diff < 1.5) {
      fishActivity = '🔥 Alta — Cambio de marea';
      fishActivityScore = 9;
    } else if (diff < 2.5) {
      fishActivity = '✅ Buena';
      fishActivityScore = 7;
    } else {
      fishActivity = '😐 Baja — Marea estable';
      fishActivityScore = 4;
    }
  }

  return {
    current: parseFloat(Math.max(0, currentLevel).toFixed(2)),
    coefficient: Math.max(0, Math.min(120, coefficient)),
    extremes: extremes.slice(0, 4),
    fishActivity,
    fishActivityScore,
    tideChart: tides,
    source: 'Cálculo armónico BCS (M2+S2+K1+O1)'
  };
}

/* ================================================================
   FISHING INDEX CALCULATOR — combinado: clima + mareas
   ================================================================ */
function _calcFishIndex(marine, tideData) {
  const wave     = parseFloat(marine?.waveHeight) || 0;
  const wind     = parseFloat(marine?.windSpeed)   || 0;
  const temp     = parseFloat(marine?.temperature)  || 25;
  const hour     = new Date().getHours();

  let score = 10;

  // Condiciones marinas
  if (wave > 2.5)       score -= 4;
  else if (wave > 1.5)  score -= 2;
  if (wind > 30)        score -= 3;
  else if (wind > 20)   score -= 1;
  if (temp > 32 || temp < 18) score -= 1;

  // Horario óptimo (madrugada/amanecer/atardecer)
  if ((hour >= 5 && hour <= 8) || (hour >= 16 && hour <= 19)) score += 2;
  else if (hour < 5 || hour > 20) score -= 1;

  // Factor marea
  if (tideData) {
    score += Math.round((tideData.fishActivityScore - 5) * 0.4);
  }

  score = Math.max(0, Math.min(10, score));

  let label, color, emoji;
  if (score >= 8)      { label = 'Excelente 🏆'; color = '#10b981'; emoji = '🟢'; }
  else if (score >= 6) { label = 'Buena 👍';     color = '#22c55e'; emoji = '🟡'; }
  else if (score >= 4) { label = 'Regular ⚠️';   color = '#f59e0b'; emoji = '🟠'; }
  else                 { label = 'Difícil ⛔';   color = '#ef4444'; emoji = '🔴'; }

  return { score, label, color, emoji };
}

/* ================================================================
   INTEL AGGREGATOR
   ================================================================ */
const IntelService = {
  _cache: new Map(),
  _cacheTTL: 15 * 60 * 1000, // 15 min

  async _fetchWithCache(url, key) {
    const cached = this._cache.get(key);
    if (cached && (Date.now() - cached.ts) < this._cacheTTL) {
      return cached.data;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._cache.set(key, { data, ts: Date.now() });
      return data;
    } catch (err) {
      console.warn(`[IntelService] Error fetching ${key}:`, err.message);
      return null;
    }
  },

  async aggregateGlobalFeeds() {
    const results = [];
    const promises = INTEL_FEEDS.global_intel.map(async (feed) => {
      const data = await this._fetchWithCache(feed.url, feed.id);
      if (!data || data.status !== 'ok') return [];
      return (data.items || []).map(item => ({
        feedId:      feed.id,
        feedLabel:   feed.label,
        category:    feed.category,
        signal:      classifySignal(item.title, item.description),
        title:       item.title || '',
        description: (item.description || '').replace(/<[^>]*>/g, '').slice(0, 150),
        link:        item.link || '#',
        pubDate:     item.pubDate ? new Date(item.pubDate) : new Date(),
        thumbnail:   item.thumbnail || null
      }));
    });
    const allArrays = await Promise.allSettled(promises);
    allArrays.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
    results.sort((a, b) => b.pubDate - a.pubDate);
    return results;
  },

  async fetchMarineData() {
    const { lat, lon, params } = INTEL_FEEDS.marine.coordsBCS;
    const url = `${INTEL_FEEDS.marine.openMeteo}?latitude=${lat}&longitude=${lon}&hourly=${params}&timezone=America%2FMazatlan&forecast_days=1`;
    const data = await this._fetchWithCache(url, 'marine_bcs');
    if (!data || !data.hourly) return null;
    const idx = Math.min(new Date().getHours(), (data.hourly.time || []).length - 1);
    return {
      waveHeight:  data.hourly.wave_height?.[idx] ?? '—',
      wavePeriod:  data.hourly.wave_period?.[idx] ?? '—',
      windSpeed:   data.hourly.wind_speed_10m?.[idx] ?? '—',
      windDir:     data.hourly.wind_direction_10m?.[idx] ?? '—',
      temperature: data.hourly.temperature_2m?.[idx] ?? '—',
      timestamp:   data.hourly.time?.[idx] ?? 'N/A'
    };
  },

  async fetchForex() {
    const data = await this._fetchWithCache(INTEL_FEEDS.markets.forex, 'forex_usd');
    if (!data || !data.rates) return null;
    return {
      mxn: data.rates.MXN?.toFixed(2) ?? '—',
      eur: data.rates.EUR?.toFixed(4) ?? '—',
      updated: data.time_last_update_utc ?? ''
    };
  },

  getTideData() {
    return calculateTides();
  },

  generateBriefing(articles, marine, forex, tideData) {
    const signals = {};
    articles.slice(0, 20).forEach(a => {
      if (!signals[a.signal]) signals[a.signal] = 0;
      signals[a.signal]++;
    });
    const topSignal = Object.entries(signals).sort((a, b) => b[1] - a[1])[0];
    const signalEmoji = {
      economic: '📈', climate: '🌊', security: '🔴',
      political: '🏛️', fishing: '🐟', technology: '💻', general: '📰'
    };
    const lines = [];
    if (topSignal) {
      lines.push(`${signalEmoji[topSignal[0]] || '📡'} Señal dominante: <strong>${topSignal[0].toUpperCase()}</strong> (${topSignal[1]} menciones)`);
    }
    if (marine) {
      const fi = _calcFishIndex(marine, tideData);
      lines.push(`🌊 Condiciones BCS — Olas: ${marine.waveHeight}m · Viento: ${marine.windSpeed} km/h · Índice pesca: <strong>${fi.label}</strong>`);
    }
    if (tideData) {
      const next = tideData.extremes[0];
      if (next) {
        lines.push(`🌙 Marea — ${next.type === 'pleamar' ? 'Pleamar' : 'Bajamar'} próxima: ${next.time} (${next.level.toFixed(2)} m) · Coef: ${tideData.coefficient}`);
      }
      lines.push(`🐟 Actividad peces: <strong>${tideData.fishActivity}</strong>`);
    }
    if (forex) {
      lines.push(`💱 USD/MXN: <strong>$${forex.mxn}</strong> · EUR/USD: ${forex.eur}`);
    }
    if (articles.length > 0) {
      lines.push(`📡 ${articles.length} señales activas de ${INTEL_FEEDS.global_intel.length} fuentes`);
    }
    return lines;
  },

  /* --- Logger histórico a localStorage (base de datos local) --- */
  logDailyConditions(marine, tideData, forex) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logKey = 'boletin_bitacora';
      const log = JSON.parse(localStorage.getItem(logKey) || '[]');

      // Evitar duplicados del mismo día
      const exists = log.find(e => e.date === today);
      if (exists) return;

      const entry = {
        date: today,
        timestamp: new Date().toISOString(),
        marine: marine || {},
        tides: tideData ? { coefficient: tideData.coefficient, fishActivity: tideData.fishActivity } : {},
        forex: forex || {},
        source: 'Boletín LA BUENA v3'
      };

      log.unshift(entry);
      // Mantener solo los últimos 90 días
      if (log.length > 90) log.splice(90);
      localStorage.setItem(logKey, JSON.stringify(log));
      console.log('[Bitácora] Condiciones registradas:', today);
    } catch(e) {
      console.warn('[Bitácora] Error logging:', e);
    }
  },

  getHistoricalLog() {
    try {
      return JSON.parse(localStorage.getItem('boletin_bitacora') || '[]');
    } catch { return []; }
  }
};

/* Exponer globalmente */
window.IntelService = IntelService;
window.INTEL_FEEDS  = INTEL_FEEDS;
window._calcFishIndex = _calcFishIndex;
window.calculateTides = calculateTides;
