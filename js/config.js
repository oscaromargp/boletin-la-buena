/* ============================================================
   config.js — Configuración central del Boletín LA BUENA
   ============================================================ */

const CFG = {
  user: 'Oscaromar',

  /* ---- Ciudades con coordenadas para Open-Meteo ---- */
  cities: {
    lapaz: {
      name: 'La Paz', state: 'BCS', role: '🏠 Tu base',
      lat: 24.1426, lon: -110.3128, tz: 'America%2FMazatlan'
    },
    acayucan: {
      name: 'Acayucan', state: 'Ver.', role: '👨‍👩‍👦 Padres',
      lat: 17.9494, lon: -94.9143, tz: 'America%2FMexico_City'
    },
    puertoescondido: {
      name: 'Pto. Escondido', state: 'Oax.', role: '💖 Tu hijo',
      lat: 15.8624, lon: -97.0730, tz: 'America%2FMexico_City'
    },
    tulum: {
      name: 'Tulum', state: 'Q.Roo', role: '🤙 Hermano',
      lat: 20.2114, lon: -87.4654, tz: 'America%2FCancun'
    }
  },

  /* ---- Ventana de contacto con el hijo (hora local hijo = UTC-6) ---- */
  hijoWindowStart: 6,   // 6am hora hijo
  hijoWindowEnd: 20,    // 8pm hora hijo

  /* ---- APIs ---- */
  openMeteo: 'https://api.open-meteo.com/v1/forecast',
  coinGecko: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd,mxn&include_24hr_change=true',
  rss2json:  'https://api.rss2json.com/v1/api.json?count=5&rss_url=',
  bibleApi:  'https://bible-api.com/',

  /* ---- RSS Feeds (fuentes libres sin CORS) ---- */
  rss: {
    economy: 'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/category/economia/',
    crypto:  'https://es.cointelegraph.com/rss',
    tech:    'https://hipertextual.com/feed'
  },

  /* ---- Versículos por día de semana ---- */
  versos: [
    { ref: 'Salmos 23:1',       key: 'psalm+23:1' },         // Domingo
    { ref: 'Jeremías 29:11',    key: 'jeremiah+29:11' },     // Lunes
    { ref: 'Filipenses 4:13',   key: 'philippians+4:13' },   // Martes
    { ref: 'Isaías 41:10',      key: 'isaiah+41:10' },       // Miércoles
    { ref: 'Proverbios 3:5-6',  key: 'proverbs+3:5-6' },     // Jueves
    { ref: 'Josué 1:9',         key: 'joshua+1:9' },         // Viernes
    { ref: 'Romanos 8:28',      key: 'romans+8:28' }         // Sábado
  ],

  /* ---- Técnicas Brian Tracy por día ---- */
  tracy: [
    { title: '🐸 Come el sapo',         tip: 'Haz la tarea más difícil e importante PRIMERO, antes de revisar mensajes o redes. El resto del día fluye solo.' },
    { title: '📊 Método ABCDE',         tip: 'Clasifica cada tarea: A=crítica, B=importante, C=agradable, D=delega, E=elimina. Solo ataca las A antes de mediodía.' },
    { title: '⏱️ Time Blocking',        tip: 'Programa bloques de 90 min sin interrupciones. Silencia el teléfono. Tu cerebro tarda 23 min en recuperar el enfoque.' },
    { title: '🎯 Regla 80/20',          tip: 'El 20% de tus actividades produce el 80% de tus resultados. Identifica ese 20% hoy y enfócate ahí exclusivamente.' },
    { title: '🔗 Manejo único (single-handling)', tip: 'Inicia una tarea y no la sueltes hasta terminarla. Cada interrupción te cuesta hasta 25 min de reenfoque.' },
    { title: '⚡ Crea urgencia artificial', tip: 'Pon un deadline hoy mismo, aunque no lo haya. "Esto debe estar listo a las 2pm". La urgencia activa el enfoque.' },
    { title: '⚡ Regla de los 2 minutos', tip: 'Si algo tarda menos de 2 minutos, hazlo YA. Acumular micro-tareas agota más energía mental que ejecutarlas.' }
  ],

  /* ---- Proyectos ---- */
  projects: [
    {
      emoji: '🟦', name: 'Par de Santos', url: 'pardesantos.mx',
      color: '#3b82f6', borderColor: 'rgba(59,130,246,0.25)',
      bgGrad: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)',
      desc: 'Inmobiliaria & bienes raíces en BCS. Plataforma de listados y consultoría de propiedades en La Paz y Los Cabos.',
      keywords: ['bienes raíces La Paz', 'casas en venta BCS', 'terrenos Los Cabos', 'inversión inmobiliaria México', 'propiedades Baja California Sur'],
      ideas: ['Blog: "5 razones para invertir en BCS en 2026"', 'Reel: tour virtual de una propiedad', 'Keyword: "casas frente al mar La Paz"']
    },
    {
      emoji: '🟥', name: 'BN Records', url: 'bnrecords.mx',
      color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)',
      bgGrad: 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)',
      desc: 'Sello discográfico independiente. Producción, distribución y promoción de artistas emergentes en México.',
      keywords: ['música independiente México', 'distribución musical digital', 'sello discográfico BCS', 'artistas emergentes', 'producción musical'],
      ideas: ['Blog: "Cómo subir tu música a Spotify en 2026"', 'Post: detrás de cámaras de grabación', 'Keyword: "distribuidora musical México"']
    },
    {
      emoji: '🟩', name: '9Stratex', url: '9stratex.com',
      color: '#10b981', borderColor: 'rgba(16,185,129,0.25)',
      bgGrad: 'linear-gradient(135deg, rgba(16,185,129,0.08), transparent)',
      desc: 'Agencia de estrategia digital y automatización de negocios. IA, n8n y consultoría para PYMEs mexicanas.',
      keywords: ['automatización empresas México', 'estrategia digital', 'IA para negocios', 'n8n automatización', 'consultoría tecnológica'],
      ideas: ['Blog: "Automatiza tu empresa con IA en 3 pasos"', 'Case study: flujo de n8n real', 'Keyword: "automatización de procesos México"']
    },
    {
      emoji: '🟨', name: 'Paypaps', url: 'paypaps.com',
      color: '#f59e0b', borderColor: 'rgba(245,158,11,0.25)',
      bgGrad: 'linear-gradient(135deg, rgba(245,158,11,0.08), transparent)',
      desc: 'Plataforma de pagos y fintech. Soluciones de cobro digital, wallets y transferencias para negocios mexicanos.',
      keywords: ['pagos digitales México', 'fintech PYME', 'cobros online', 'billetera digital', 'pasarela de pago México'],
      ideas: ['Blog: "Cobra en línea sin comisiones exageradas"', 'Post: comparativa de pasarelas de pago', 'Keyword: "cómo aceptar pagos online México"']
    }
  ],

  /* ---- Rutas en moto (Italika FT150 TS 2024) ---- */
  motoRoutes: [
    {
      name: 'Malecón de La Paz',
      dist: '8 km ida', duration: '20 min', fuel: '0.3 L',
      cost: '$6 MXN', diff: '⭐ Fácil',
      maps: 'https://maps.app.goo.gl/XvnLhBqBtR6p9VKFA',
      cultura: 'Paseo icónico frente a la bahía. Perfecto al amanecer o atardecer.',
      immo: 'Zona de alta plusvalía. Propiedades frente al mar cotizan 3–5x más.',
      minWindOk: 35
    },
    {
      name: 'La Ventana / El Sargento',
      dist: '70 km', duration: '1h 20min', fuel: '2.4 L',
      cost: '$52 MXN', diff: '⭐⭐ Moderada',
      maps: 'https://maps.app.goo.gl/D9Vo2pNWYGWXxKEJA',
      cultura: 'Meca del kitesurf mundial. Playa increíble, comunidad extranjera.',
      immo: 'Hotspot inmobiliario. Terrenos frente al mar aún accesibles vs. Cabo.',
      minWindOk: 25
    },
    {
      name: 'Todos Santos',
      dist: '80 km', duration: '1h 30min', fuel: '2.7 L',
      cost: '$58 MXN', diff: '⭐⭐ Moderada',
      maps: 'https://maps.app.goo.gl/gjnS4V4P1E3Kt7H47',
      cultura: 'Pueblo Mágico. Arte, gastronomía gourmet, arquitectura colonial.',
      immo: 'Muy cotizado por extranjeros. Casas históricas y desarrollo de lujo.',
      minWindOk: 30
    },
    {
      name: 'El Triunfo',
      dist: '56 km', duration: '1h', fuel: '1.9 L',
      cost: '$41 MXN', diff: '⭐⭐ Moderada',
      maps: 'https://maps.app.goo.gl/MdNKoLPT1d6V2g7Y8',
      cultura: 'Pueblo minero del siglo XIX. Chimeneas históricas, museo y café de altura.',
      immo: 'Potencial de ecoturismo. Propiedades históricas a precios bajos.',
      minWindOk: 30
    },
    {
      name: 'Los Planes',
      dist: '65 km', duration: '1h 15min', fuel: '2.2 L',
      cost: '$47 MXN', diff: '⭐⭐ Moderada',
      maps: 'https://maps.app.goo.gl/nAY8pXgKqJjLP2Sj9',
      cultura: 'Valle agrícola tranquilo. Mango, dátil, caña de azúcar.',
      immo: 'Terrenos agrícolas disponibles. Potencial agroturístico.',
      minWindOk: 35
    }
  ],

  /* ---- Música & Podcasts fijos ---- */
  music: [
    { icon: '🎵', label: 'Playlist del día', name: 'Enfoque & Flow', link: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO' },
    { icon: '📺', label: 'Seminario Fénix', name: 'Dante Gebel — Episodio reciente', link: 'https://www.youtube.com/@SeminarioFenix' },
    { icon: '🎙️', label: 'Predicación', name: 'Dante Gebel Oficial', link: 'https://www.youtube.com/@DanteGebelOficial' },
    { icon: '🎹', label: 'Instrumental', name: 'Lofi Hip Hop Radio — beats to study', link: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
    { icon: '🎸', label: 'Canción del día', name: '"Oceans" — Hillsong United', link: 'https://open.spotify.com/track/7LfDiWjMPbY0LIJapgtQSX' }
  ]
};
