/* ============================================================
   intel_service.js — Servicio de Inteligencia Situacional
   Inspirado en la arquitectura de World Monitor (koala73/worldmonitor)
   para agregación de RSS/API y conciencia situacional local.
   ============================================================ */

'use strict';

/* ================================================================
   CONFIGURACIÓN DE FEEDS — BCS / Baja California Sur Focused
   ================================================================ */
const INTEL_FEEDS = {
  /* --- Noticias Regionales BCS --- */
  bcs_news: [
    {
      id: 'bcs_gov',
      label: '🏛️ Gobierno BCS',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://www.bcs.gob.mx/feed',
      category: 'regional',
      priority: 'high'
    },
    {
      id: 'sudcal',
      label: '📰 El Sudcaliforniano',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://www.sudcaliforniano.com.mx/rss.xml',
      category: 'regional',
      priority: 'medium'
    }
  ],

  /* --- Clima & Océano (Open-Meteo + Buoy Data) --- */
  marine: {
    openMeteo: 'https://api.open-meteo.com/v1/marine',
    coordsBCS: { lat: 24.1426, lon: -110.3128 },
    params: 'wave_height,wave_period,wind_wave_height,wind_speed_10m,wind_direction_10m,temperature_2m'
  },

  /* --- Noticias Globales (Situational Awareness) --- */
  global_intel: [
    {
      id: 'reuters',
      label: '📡 Reuters World',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://feeds.reuters.com/reuters/worldNews',
      category: 'global',
      signal: 'geopolitics'
    },
    {
      id: 'bbcmundo',
      label: '🌍 BBC Mundo',
      url: 'https://api.rss2json.com/v1/api.json?count=5&rss_url=https://feeds.bbci.co.uk/mundo/rss.xml',
      category: 'global',
      signal: 'world'
    },
    {
      id: 'elnorte',
      label: '🇲🇽 El Norte',
      url: 'https://api.rss2json.com/v1/api.json?count=4&rss_url=https://www.elnorte.com/rss/portada.xml',
      category: 'national',
      signal: 'mexico'
    }
  ],

  /* --- Mercados Financieros --- */
  markets: {
    crypto: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd,mxn&include_24hr_change=true',
    forex: 'https://open.er-api.com/v6/latest/USD'
  }
};

/* ================================================================
   SIGNAL CLASSIFIER — Inspirado en World Monitor's cross-stream correlation
   Clasifica noticias en categorías de señal para el panel situacional
   ================================================================ */
const SIGNAL_KEYWORDS = {
  economic:   ['inflación','dólar','BANXICO','PIB','economía','mercado','peso','USD','MXN','bolsa','finanzas'],
  climate:    ['huracán','tormenta','ciclón','lluvia','temperatura','calor','viento','sismo','terremoto'],
  security:   ['seguridad','crimen','violencia','narcotráfico','ejército','policía','captura','operativo'],
  political:  ['gobierno','presidente','gobernador','elecciones','senado','cámara','ley','decreto'],
  fishing:    ['pesca','camarón','atún','langosta','veda','CONAPESCA','Golfo','Pacífico','Mar de Cortés'],
  technology: ['IA','inteligencia artificial','tecnología','startup','app','digital','ciberseguridad']
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
   INTEL AGGREGATOR — Fetches & normalizes data from multiple sources
   ================================================================ */
const IntelService = {
  _cache: new Map(),
  _cacheTTL: 15 * 60 * 1000, // 15 minutos

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

  /* --- Agrega feeds RSS/global --- */
  async aggregateGlobalFeeds() {
    const results = [];
    const feeds = INTEL_FEEDS.global_intel;

    const promises = feeds.map(async (feed) => {
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

    // Sort by date desc
    results.sort((a, b) => b.pubDate - a.pubDate);
    return results;
  },

  /* --- Datos marinos/climáticos para BCS --- */
  async fetchMarineData() {
    const { lat, lon, params } = INTEL_FEEDS.marine.coordsBCS;
    const url = `${INTEL_FEEDS.marine.openMeteo}?latitude=${lat}&longitude=${lon}&hourly=${params}&timezone=America%2FMazatlan&forecast_days=1`;
    const data = await this._fetchWithCache(url, 'marine_bcs');
    if (!data || !data.hourly) return null;

    const currentHour = new Date().getHours();
    const idx = Math.min(currentHour, (data.hourly.time || []).length - 1);

    return {
      waveHeight:   data.hourly.wave_height?.[idx] ?? '—',
      wavePeriod:   data.hourly.wave_period?.[idx] ?? '—',
      windSpeed:    data.hourly.wind_speed_10m?.[idx] ?? '—',
      windDir:      data.hourly.wind_direction_10m?.[idx] ?? '—',
      temperature:  data.hourly.temperature_2m?.[idx] ?? '—',
      timestamp:    data.hourly.time?.[idx] ?? 'N/A'
    };
  },

  /* --- Tipo de cambio USD/MXN --- */
  async fetchForex() {
    const data = await this._fetchWithCache(INTEL_FEEDS.markets.forex, 'forex_usd');
    if (!data || !data.rates) return null;
    return {
      mxn: data.rates.MXN?.toFixed(2) ?? '—',
      eur: data.rates.EUR?.toFixed(4) ?? '—',
      updated: data.time_last_update_utc ?? ''
    };
  },

  /* --- Genera un resumen ejecutivo tipo briefing --- */
  generateBriefing(articles, marine, forex) {
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
      const fishIndex = _calcFishIndex(marine);
      lines.push(`🌊 Condiciones marinas BCS — Olas: ${marine.waveHeight}m · Viento: ${marine.windSpeed} km/h · Índice pesca: <strong>${fishIndex.label}</strong>`);
    }
    if (forex) {
      lines.push(`💱 USD/MXN: <strong>$${forex.mxn}</strong> · EUR/USD: ${forex.eur}`);
    }
    if (articles.length > 0) {
      lines.push(`📡 ${articles.length} señales activas procesadas de ${INTEL_FEEDS.global_intel.length} fuentes`);
    }
    return lines;
  }
};

/* ================================================================
   FISHING INDEX CALCULATOR — usa datos marinos para BCS
   ================================================================ */
function _calcFishIndex(marine) {
  const wave     = parseFloat(marine.waveHeight) || 0;
  const wind     = parseFloat(marine.windSpeed)   || 0;
  const temp     = parseFloat(marine.temperature)  || 25;

  let score = 10;
  if (wave > 2.5) score -= 4;
  else if (wave > 1.5) score -= 2;
  if (wind > 30) score -= 3;
  else if (wind > 20) score -= 1;
  if (temp > 32 || temp < 18) score -= 1;

  score = Math.max(0, Math.min(10, score));

  let label, color, emoji;
  if (score >= 8) { label = 'Excelente 🏆'; color = '#10b981'; emoji = '🟢'; }
  else if (score >= 6) { label = 'Buena 👍'; color = '#22c55e'; emoji = '🟡'; }
  else if (score >= 4) { label = 'Regular ⚠️'; color = '#f59e0b'; emoji = '🟠'; }
  else { label = 'Difícil ⛔'; color = '#ef4444'; emoji = '🔴'; }

  return { score, label, color, emoji };
}

/* Exponer globalmente */
window.IntelService = IntelService;
window.INTEL_FEEDS  = INTEL_FEEDS;
window._calcFishIndex = _calcFishIndex;
