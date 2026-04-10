# 📋 Boletín LA BUENA — Oscaromar

> Dashboard personal diario: brújula emocional, operativa, espiritual y estratégica.

**🌐 Sitio en vivo:** [oscaromargp.github.io/boletin-la-buena](https://oscaromargp.github.io/boletin-la-buena)

---

## ¿Qué es esto?

Un sitio web personal que se carga cada mañana y presenta automáticamente:

- 🌤️ **Clima real** de La Paz, Acayucan, Puerto Escondido y Tulum (Open-Meteo API)
- ₿ **Precios cripto** en tiempo real: BTC, ETH, SOL, DOGE (CoinGecko API)
- 📰 **Noticias filtradas**: Economía, Cripto y Tecnología (RSS via rss2json)
- 📖 **Versículo bíblico del día** (bible-api.com — traducción RVR1960)
- 💊 **Salud & hábitos**: Ritalin, Complejo B, agua, ejercicio
- 💖 **Mensaje para tu hijo** con ventana de horario (Puerto Escondido, Oaxaca)
- 📖 **Espiritualidad**: Versículo + acción + frase inspiradora
- 🔊 **Música & Podcasts**: Playlist Spotify, Seminario Fénix, Dante Gebel
- 🧠 **Productividad**: Técnica Brian Tracy del día
- 🌐 **Proyectos**: Par de Santos, BN Records, 9Stratex, Paypaps + ideas y keywords
- 🐟 **Índice de pesca** calculado con datos reales de viento, UV y temperatura
- 🏍️ **Ruta sugerida** en moto (Italika FT150 TS) según condiciones del día
- 🧭 **Plan del día** por bloques horarios
- ✔️ **Checklist** persistente (se guarda en el navegador, se reinicia cada día)

---

## Tecnología utilizada

| Componente | Tecnología |
|-----------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Hosting  | GitHub Pages (gratis) |
| Clima    | [Open-Meteo](https://open-meteo.com/) — sin clave API |
| Cripto   | [CoinGecko API](https://www.coingecko.com/en/api) — sin clave API |
| Noticias | [rss2json.com](https://rss2json.com/) — sin clave API |
| Biblia   | [bible-api.com](https://bible-api.com/) — sin clave API |

**Costo mensual de operación: $0.00 MXN** ✅

---

## Estructura del proyecto

```
boletin-la-buena/
├── index.html          # Landing page principal
├── css/
│   └── style.css       # Diseño oscuro premium (navy + dorado)
├── js/
│   ├── config.js       # Configuración: ciudades, APIs, proyectos, rutas
│   └── app.js          # Toda la lógica: fetch APIs + render secciones
├── .gitignore
└── README.md
```

---

## Personalización

Edita `js/config.js` para cambiar:

- **Ciudades**: coordenadas y zonas horarias
- **Proyectos**: nombres, URLs, keywords, ideas
- **Rutas de moto**: destinos, distancias, costos
- **Música**: links de Spotify / YouTube
- **Versículos**: lista por día de semana

---

## Cómo actualizar el sitio

```bash
cd boletin-la-buena
git add .
git commit -m "Actualización: descripción del cambio"
git push
```

GitHub Pages despliega automáticamente en 1-2 minutos.

---

## Créditos

Construido con ❤️ para **Oscaromar** · La Paz, BCS  
Versión: 1.0 · Abril 2026  
Basado en el **Prompt Maestro LA BUENA V14**
