# 📋 Boletín LA BUENA — Panel de Control Personal

> Dashboard personal diario configurable: brújula emocional, operativa, espiritual y estratégica.

**🌐 Sitio en vivo:** [oscaromargp.github.io/boletin-la-buena](https://oscaromargp.github.io/boletin-la-buena)
**📁 Repositorio:** [github.com/oscaromargp/boletin-la-buena](https://github.com/oscaromargp/boletin-la-buena)

---

## ¿Qué es esto?

Un sitio web personal tipo **panel de control** que carga datos reales cada mañana y permite configurarlo completamente según el día. No es un sitio estático — recuerda tus preferencias, tu estado de ánimo, si estás con tu hijo, tus prioridades del día, y adapta el contenido en consecuencia.

---

## ⚙️ Panel de Control — 4 Pestañas

Abre el panel con el botón **⚙️ Mi Día** en el encabezado.

### 🌅 Mi Día
| Campo | Descripción |
|-------|-------------|
| Mood del día | 4 opciones (Con todo / Tranquilo / Cansado / Enfocado) — cambia el TL;DR |
| ¿Con tu hijo? | Toggle que transforma la sección Hijo a modo "presencial" |
| Proyecto foco | Selector que destaca el proyecto con badge dorado |
| Medicación de hoy | Check individual por medicamento activo |
| Prioridades (máx. 5) | Aparecen como tarjeta destacada en el dashboard |
| Nota libre | Campo libre para recordatorios o intenciones del día |

### 💊 Salud
- **Medicamentos**: Agregar, quitar, activar/desactivar (Ritalin, Complejo B, o cualquiera)
- **Hábitos**: Agregar, quitar, activar/desactivar (agua, ejercicio, etc.)
- **Checklist personalizado**: Agregar tareas permanentes al checklist diario

### 🧭 Secciones
Toggle individual para cada sección del boletín. Cambios inmediatos.

### 🎨 Preferencias
- Editar nombre, ciudad y estado
- Mostrar u ocultar proyectos individuales
- Reset completo de configuración

---

## 🔄 Comportamiento inteligente

| Feature | Cómo funciona |
|---------|---------------|
| Auto-apertura | Si no has configurado tu día, el panel se abre solo al cargar |
| Modo hijo presencial | Toggle "con mi hijo hoy" → sección se convierte en guía de actividades juntos |
| TL;DR dinámico | Cambia según mood + prioridades + proyecto foco |
| Plan del día | Se actualiza automáticamente cuando seleccionas proyecto foco |
| Checklist | Combina medicamentos activos + hábitos activos + tareas base + custom |
| Pesca | Índice calculado con datos reales de viento, UV y temperatura |
| Ruta moto | Sugerencia rotativa por día de semana (ajustada a condiciones) |

---

## 🛰️ APIs utilizadas (todas gratuitas, sin clave)

| Dato | API | Costo |
|------|-----|-------|
| Clima 4 ciudades | [Open-Meteo](https://open-meteo.com/) | $0 |
| BTC / ETH / SOL / DOGE | [CoinGecko](https://www.coingecko.com/en/api) | $0 |
| Noticias (Eco / Cripto / Tech) | [rss2json.com](https://rss2json.com/) | $0 |
| Versículo del día RVR1960 | [bible-api.com](https://bible-api.com/) | $0 |

**Costo mensual total: $0.00 MXN** ✅

---

## 📁 Estructura del proyecto

```
boletin-la-buena/
├── index.html              # Layout principal — todas las secciones
├── css/
│   └── style.css           # Diseño oscuro premium + estilos del panel
├── js/
│   ├── config.js           # Datos estáticos: ciudades, proyectos, rutas, música
│   ├── settings.js         # Panel de control UI + localStorage (settings + daily state)
│   └── app.js              # Lógica: fetch APIs + render de secciones
├── .gitignore
└── README.md
```

### Flujo de datos

```
config.js  →  datos estáticos (coords, proyectos, rutas)
settings.js → estado del usuario (localStorage) + UI del panel
app.js      → fetch APIs + render usando config + settings
```

---

## 💾 Almacenamiento (localStorage)

| Clave | Contenido | Persistencia |
|-------|-----------|-------------|
| `boletin_settings` | Medicamentos, hábitos, secciones, proyectos, perfil | Permanente |
| `boletin_daily_YYYY-MM-DD` | Mood, withSon, focusProject, prioridades, notas, meds tomados | 1 día |
| `boletin_ck_YYYY-M-D` | Estado del checklist (qué ítems marcados) | 1 día |

---

## ✏️ Personalización en `config.js`

Para cambiar datos base (no requieren panel):

```javascript
// Agregar una ciudad de clima
CFG.cities.miami = { name: 'Miami', state: 'FL', role: '✈️ Viaje', lat: 25.77, lon: -80.19, tz: 'America%2FNew_York' };

// Agregar una ruta en moto
CFG.motoRoutes.push({ name: 'San Bartolo', dist: '60 km', ... });

// Agregar proyecto
CFG.projects.push({ id: 'nuevo', emoji: '🟪', name: 'Mi Proyecto', ... });
```

---

## 🚀 Actualizar el sitio

```bash
cd C:/ANTIGRAVITI_LAP/repos/boletin-la-buena
git add .
git commit -m "Descripción del cambio"
git push
```

GitHub Pages despliega en ~2 minutos.

---

## 📦 Historial de versiones

| Versión | Descripción |
|---------|-------------|
| v1.0 | Sitio estático con APIs de clima, cripto, noticias y espiritualidad |
| v2.0 | Panel de control configurable: mood, hijo, medicamentos, secciones, proyectos, prioridades |

---

Construido con ❤️ para **Oscaromar** · La Paz, BCS
Basado en el **Prompt Maestro LA BUENA V14** · Abril 2026
