/* ============================================================
   settings.js — Panel de Control & Gestión de Estado
   Maneja: configuración persistente + estado diario + UI del panel
   ============================================================ */

'use strict';

/* ================================================================
   DEFAULTS
   ================================================================ */
const SETTINGS_KEY   = 'boletin_settings';
const DAILY_KEY_PFX  = 'boletin_daily_';

const DEFAULTS = {
  settings: {
    user: { name: 'Oscaromar', ciudad: 'La Paz', estado: 'BCS' },
    medications: [
      { id: 'ritalin', name: 'Ritalin',     dose: '1 pastilla', time: 'AM',    active: true },
      { id: 'compb',   name: 'Complejo B',  dose: '1 cápsula',  time: 'AM',    active: true }
    ],
    habits: [
      { id: 'agua',      name: '💧 Agua (2.5 L)',     active: true },
      { id: 'desayuno',  name: '🥗 Desayuno real',    active: true },
      { id: 'ejercicio', name: '🏃 Ejercicio (15 min)', active: true },
      { id: 'sueno',     name: '😴 Sueño 7-8 hrs',    active: true }
    ],
    customChecklist: [],  // { id, text, tag }
    sections: {
      clima: true, salud: true, hijo: true, espiritual: true,
      musica: true, noticias: true, cripto: true, prod: true,
      proyectos: true, pesca: true, moto: true, plan: true, checklist: true
    },
    projects: { pardesantos: true, bnrecords: true, stratex: true, paypaps: true }
  },
  daily: {
    mood: null,          // 'energy' | 'calm' | 'tired' | 'focus'
    withSon: false,
    focusProject: null,  // project id
    priorities: [],      // string[]
    notes: '',
    medications: {},     // { [id]: boolean }
    habits: {}           // { [id]: boolean }
  }
};

/* ================================================================
   STORAGE HELPERS
   ================================================================ */
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULTS.settings));
    return deepMerge(JSON.parse(JSON.stringify(DEFAULTS.settings)), JSON.parse(raw));
  } catch { return JSON.parse(JSON.stringify(DEFAULTS.settings)); }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function getDailyKey() {
  const d = new Date();
  return `${DAILY_KEY_PFX}${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDaily() {
  try {
    const raw = localStorage.getItem(getDailyKey());
    if (!raw) return JSON.parse(JSON.stringify(DEFAULTS.daily));
    return { ...JSON.parse(JSON.stringify(DEFAULTS.daily)), ...JSON.parse(raw) };
  } catch { return JSON.parse(JSON.stringify(DEFAULTS.daily)); }
}

function saveDaily(d) {
  localStorage.setItem(getDailyKey(), JSON.stringify(d));
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/* ================================================================
   PANEL OPEN / CLOSE / TAB SWITCHING
   ================================================================ */
let _currentTab = 'dia';

function openSettings(tab) {
  _currentTab = tab || 'dia';
  document.getElementById('settingsPanel').classList.add('open');
  document.getElementById('settingsOverlay').classList.add('open');
  _renderPanel();
}

function closeSetting() {
  document.getElementById('settingsPanel').classList.remove('open');
  document.getElementById('settingsOverlay').classList.remove('open');
}

function switchTab(tab) {
  _currentTab = tab;
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.stab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  _renderCurrentTab();
}

function _renderPanel() {
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab === _currentTab));
  document.querySelectorAll('.stab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${_currentTab}`));
  _renderCurrentTab();
}

function _renderCurrentTab() {
  const map = { dia: renderDiaTab, salud: renderSaludTab, secciones: renderSeccionesTab, prefs: renderPrefsTab };
  (map[_currentTab] || renderDiaTab)();
}

/* ================================================================
   TAB: MI DÍA
   ================================================================ */
function renderDiaTab() {
  const daily    = getDaily();
  const settings = getSettings();
  const meds     = settings.medications.filter(m => m.active);

  const moods = [
    { id: 'energy', label: '🔥 Con todo' },
    { id: 'calm',   label: '😌 Tranquilo' },
    { id: 'tired',  label: '😴 Cansado' },
    { id: 'focus',  label: '🎯 Enfocado' }
  ];

  const activeProjects = CFG.projects.filter(p => settings.projects[p.id] !== false);

  document.getElementById('tab-dia').innerHTML = `
    <div class="sp-section">
      <div class="sp-label">🌅 ¿Cómo amaneciste hoy?</div>
      <div class="mood-grid">
        ${moods.map(m => `
          <button class="mood-btn ${daily.mood === m.id ? 'active' : ''}"
            onclick="setMood('${m.id}')">${m.label}</button>`).join('')}
      </div>
    </div>

    <div class="sp-section">
      <div class="sp-row">
        <div>
          <div class="sp-label" style="margin-bottom:2px;">💖 ¿Estás con tu hijo hoy?</div>
          <div class="sp-sub">Cambia el contenido de la sección Hijo</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${daily.withSon ? 'checked' : ''}
            onchange="setWithSon(this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="sp-section">
      <div class="sp-label">🎯 Proyecto foco del día</div>
      <div class="mood-grid">
        ${activeProjects.map(p => `
          <button class="mood-btn ${daily.focusProject === p.id ? 'active' : ''}"
            onclick="setFocusProject('${p.id}')"
            style="${daily.focusProject === p.id ? `border-color:${p.color};color:${p.color};background:${p.color}20` : ''}">
            ${p.emoji} ${p.name}
          </button>`).join('')}
        <button class="mood-btn ${!daily.focusProject ? 'active' : ''}"
          onclick="setFocusProject(null)">⚡ General</button>
      </div>
    </div>

    ${meds.length ? `
    <div class="sp-section">
      <div class="sp-label">💊 Medicación de hoy — ¿ya tomé?</div>
      ${meds.map(m => `
        <label class="sp-check-row">
          <input type="checkbox" ${daily.medications && daily.medications[m.id] ? 'checked' : ''}
            onchange="toggleMedDaily('${m.id}', this.checked)">
          <span><strong>${m.name}</strong></span>
          <span class="sp-sub">${m.dose} · ${m.time}</span>
        </label>`).join('')}
    </div>` : ''}

    <div class="sp-section">
      <div class="sp-label">📋 Mis prioridades de hoy (máx. 5)</div>
      <div id="prioritiesList">
        ${(daily.priorities || []).map((p, i) => `
          <div class="priority-row">
            <span class="pri-num">${i+1}</span>
            <input class="pri-input" value="${_escHtml(p)}"
              onchange="updatePriority(${i}, this.value)"
              placeholder="Prioridad ${i+1}…" style="margin-top:0;">
            <button class="pri-del" onclick="removePriority(${i})">✕</button>
          </div>`).join('')}
      </div>
      ${(daily.priorities || []).length < 5
        ? `<button class="sp-add-btn" onclick="_addPriorityRow()">+ Agregar prioridad</button>`
        : ''}
    </div>

    <div class="sp-section">
      <div class="sp-label">📝 Nota libre del día</div>
      <textarea class="sp-textarea" id="dailyNotes"
        placeholder="¿Algo que quieras recordar, planear o soltar hoy?"
        onchange="saveNotes(this.value)">${_escHtml(daily.notes || '')}</textarea>
    </div>

    <button class="sp-save-btn" onclick="applyAndClose()">💾 Aplicar y cerrar</button>
  `;
}

/* ================================================================
   TAB: SALUD
   ================================================================ */
function renderSaludTab() {
  const settings = getSettings();

  document.getElementById('tab-salud').innerHTML = `
    <div class="sp-section">
      <div class="sp-label">💊 Mis Medicamentos</div>
      ${settings.medications.map(m => `
        <div class="med-item">
          <div class="sp-row">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.88rem;">${_escHtml(m.name)}</div>
              <div class="sp-sub">${_escHtml(m.dose)} · ${_escHtml(m.time)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
              <label class="toggle-switch small">
                <input type="checkbox" ${m.active ? 'checked' : ''}
                  onchange="toggleMedActive('${m.id}', this.checked)">
                <span class="toggle-slider"></span>
              </label>
              <button class="pri-del" onclick="removeMedication('${m.id}')">✕</button>
            </div>
          </div>
        </div>`).join('')}
      <div class="sp-add-form" id="medAddForm" style="display:none;">
        <input class="pri-input" id="newMedName" placeholder="Nombre (ej: Vitamina D)" style="margin-top:0;">
        <input class="pri-input" id="newMedDose" placeholder="Dosis (ej: 1 cápsula)">
        <select class="pri-input" id="newMedTime">
          <option value="AM">AM (mañana)</option>
          <option value="PM">PM (tarde)</option>
          <option value="Noche">Noche</option>
          <option value="Con comida">Con comida</option>
        </select>
        <button class="sp-save-btn" onclick="addMedication()">✓ Agregar medicamento</button>
        <button class="sp-add-btn" onclick="document.getElementById('medAddForm').style.display='none';document.getElementById('showMedForm').style.display='''">Cancelar</button>
      </div>
      <button class="sp-add-btn" id="showMedForm"
        onclick="document.getElementById('medAddForm').style.display='flex';this.style.display='none'">
        + Agregar medicamento
      </button>
    </div>

    <div class="sp-section">
      <div class="sp-label">🏃 Mis Hábitos Diarios</div>
      ${settings.habits.map(h => `
        <div class="med-item">
          <div class="sp-row">
            <span style="font-size:0.88rem;">${_escHtml(h.name)}</span>
            <label class="toggle-switch small">
              <input type="checkbox" ${h.active ? 'checked' : ''}
                onchange="toggleHabitActive('${h.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>`).join('')}
      <div class="sp-add-form" id="habitAddForm" style="display:none;">
        <input class="pri-input" id="newHabitName" placeholder="Ej: 🧘 Meditación 10 min" style="margin-top:0;">
        <button class="sp-save-btn" onclick="addHabit()">✓ Agregar hábito</button>
        <button class="sp-add-btn" onclick="document.getElementById('habitAddForm').style.display='none';document.getElementById('showHabitForm').style.display=''">Cancelar</button>
      </div>
      <button class="sp-add-btn" id="showHabitForm"
        onclick="document.getElementById('habitAddForm').style.display='flex';this.style.display='none'">
        + Agregar hábito
      </button>
    </div>

    <div class="sp-section">
      <div class="sp-label">✔️ Checklist personalizado</div>
      ${(settings.customChecklist || []).map(item => `
        <div class="med-item">
          <div class="sp-row">
            <span style="font-size:0.84rem;flex:1;">${_escHtml(item.text)}</span>
            <span class="sp-sub" style="margin-right:8px;">${_escHtml(item.tag)}</span>
            <button class="pri-del" onclick="removeCustomChecklist('${item.id}')">✕</button>
          </div>
        </div>`).join('')}
      <div class="sp-add-form" id="clAddForm" style="display:none;">
        <input class="pri-input" id="newClText" placeholder="Nueva tarea (ej: Llamar a cliente)" style="margin-top:0;">
        <input class="pri-input" id="newClTag"  placeholder="Categoría (ej: Trabajo)">
        <button class="sp-save-btn" onclick="addCustomChecklist()">✓ Agregar tarea</button>
        <button class="sp-add-btn" onclick="document.getElementById('clAddForm').style.display='none';document.getElementById('showClForm').style.display=''">Cancelar</button>
      </div>
      <button class="sp-add-btn" id="showClForm"
        onclick="document.getElementById('clAddForm').style.display='flex';this.style.display='none'">
        + Agregar tarea al checklist
      </button>
    </div>
  `;
}

/* ================================================================
   TAB: SECCIONES
   ================================================================ */
function renderSeccionesTab() {
  const settings = getSettings();
  document.getElementById('tab-secciones').innerHTML = `
    <div class="sp-section">
      <div class="sp-label">Activa o desactiva secciones</div>
      <div class="sp-sub" style="margin-bottom:12px;">Los cambios se aplican inmediatamente</div>
      ${CFG.sections.map(s => `
        <div class="med-item">
          <div class="sp-row">
            <span style="font-size:0.88rem;">${s.label}</span>
            <label class="toggle-switch small">
              <input type="checkbox" ${settings.sections[s.id] !== false ? 'checked' : ''}
                onchange="toggleSection('${s.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>`).join('')}
    </div>
  `;
}

/* ================================================================
   TAB: PREFERENCIAS
   ================================================================ */
function renderPrefsTab() {
  const settings = getSettings();
  document.getElementById('tab-prefs').innerHTML = `
    <div class="sp-section">
      <div class="sp-label">👤 Mi Perfil</div>
      <div class="sp-add-form" style="display:flex;">
        <div>
          <div class="sp-sub" style="margin-bottom:2px;">Nombre</div>
          <input class="pri-input" id="prefName" value="${_escHtml(settings.user.name)}" placeholder="Tu nombre" style="margin-top:0;">
        </div>
        <div>
          <div class="sp-sub" style="margin-bottom:2px;">Ciudad base</div>
          <input class="pri-input" id="prefCiudad" value="${_escHtml(settings.user.ciudad)}" placeholder="Ciudad" style="margin-top:0;">
        </div>
        <div>
          <div class="sp-sub" style="margin-bottom:2px;">Estado</div>
          <input class="pri-input" id="prefEstado" value="${_escHtml(settings.user.estado)}" placeholder="Estado" style="margin-top:0;">
        </div>
        <button class="sp-save-btn" id="savePrefsBtn" onclick="saveUserPrefs()">💾 Guardar perfil</button>
      </div>
    </div>

    <div class="sp-section">
      <div class="sp-label">🌐 Proyectos visibles</div>
      ${CFG.projects.map(p => `
        <div class="med-item">
          <div class="sp-row">
            <span style="font-size:0.88rem;">${p.emoji} ${p.name}</span>
            <label class="toggle-switch small">
              <input type="checkbox" ${settings.projects[p.id] !== false ? 'checked' : ''}
                onchange="toggleProject('${p.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>`).join('')}
    </div>

    <div class="sp-section">
      <div class="sp-label" style="color:var(--red);">⚠️ Zona de reset</div>
      <button class="sp-add-btn" style="color:var(--red);border-color:rgba(239,68,68,0.4);"
        onclick="if(confirm('¿Borrar toda la configuración y volver a los valores por defecto?')){localStorage.clear();location.reload()}">
        Reiniciar toda la configuración
      </button>
    </div>
  `;
}

/* ================================================================
   ACTIONS — MI DÍA
   ================================================================ */
function setMood(mood) {
  const daily = getDaily();
  daily.mood = daily.mood === mood ? null : mood;
  saveDaily(daily);
  renderDiaTab();
  _safeCall('renderTldr');
}

function setWithSon(val) {
  const daily = getDaily();
  daily.withSon = !!val;
  saveDaily(daily);
  _safeCall('renderHijo');
}

function setFocusProject(projId) {
  const daily = getDaily();
  daily.focusProject = daily.focusProject === projId ? null : projId;
  saveDaily(daily);
  renderDiaTab();
  _safeCall('renderProyectos');
  _safeCall('renderTldr');
}

function toggleMedDaily(medId, val) {
  const daily = getDaily();
  if (!daily.medications) daily.medications = {};
  daily.medications[medId] = !!val;
  saveDaily(daily);
  _safeCall('renderSalud');
}

function _addPriorityRow() {
  const daily = getDaily();
  if (!daily.priorities) daily.priorities = [];
  if (daily.priorities.length >= 5) return;
  daily.priorities.push('');
  saveDaily(daily);
  renderDiaTab();
}

function updatePriority(idx, val) {
  const daily = getDaily();
  if (!daily.priorities) daily.priorities = [];
  daily.priorities[idx] = val;
  saveDaily(daily);
  _safeCall('renderPriorities');
  _safeCall('renderTldr');
}

function removePriority(idx) {
  const daily = getDaily();
  (daily.priorities || []).splice(idx, 1);
  saveDaily(daily);
  renderDiaTab();
  _safeCall('renderPriorities');
}

function saveNotes(text) {
  const daily = getDaily();
  daily.notes = text;
  saveDaily(daily);
}

function applyAndClose() {
  _safeCall('renderTldr');
  _safeCall('renderSalud');
  _safeCall('renderHijo');
  _safeCall('renderPriorities');
  _safeCall('renderProyectos');
  _safeCall('renderChecklist');
  closeSetting();
}

/* ================================================================
   ACTIONS — SALUD (medicamentos, hábitos, checklist)
   ================================================================ */
function toggleMedActive(medId, val) {
  const s = getSettings();
  const med = s.medications.find(m => m.id === medId);
  if (med) med.active = !!val;
  saveSettings(s);
  _safeCall('renderSalud');
}

function removeMedication(medId) {
  const s = getSettings();
  s.medications = s.medications.filter(m => m.id !== medId);
  saveSettings(s);
  renderSaludTab();
  _safeCall('renderSalud');
}

function addMedication() {
  const name = _val('newMedName');
  const dose = _val('newMedDose');
  const time = _val('newMedTime');
  if (!name) { alert('Escribe el nombre del medicamento'); return; }
  const s = getSettings();
  s.medications.push({ id: 'med_' + Date.now(), name, dose: dose || '1 unidad', time, active: true });
  saveSettings(s);
  renderSaludTab();
  _safeCall('renderSalud');
}

function toggleHabitActive(habitId, val) {
  const s = getSettings();
  const h = s.habits.find(h => h.id === habitId);
  if (h) h.active = !!val;
  saveSettings(s);
  _safeCall('renderSalud');
}

function addHabit() {
  const name = _val('newHabitName');
  if (!name) { alert('Escribe el nombre del hábito'); return; }
  const s = getSettings();
  if (!s.habits) s.habits = [];
  s.habits.push({ id: 'habit_' + Date.now(), name, active: true });
  saveSettings(s);
  renderSaludTab();
  _safeCall('renderSalud');
  _safeCall('renderChecklist');
}

function addCustomChecklist() {
  const text = _val('newClText');
  const tag  = _val('newClTag') || 'Personal';
  if (!text) { alert('Escribe la tarea'); return; }
  const s = getSettings();
  if (!s.customChecklist) s.customChecklist = [];
  s.customChecklist.push({ id: 'cl_' + Date.now(), text, tag });
  saveSettings(s);
  renderSaludTab();
  _safeCall('renderChecklist');
}

function removeCustomChecklist(itemId) {
  const s = getSettings();
  s.customChecklist = (s.customChecklist || []).filter(i => i.id !== itemId);
  saveSettings(s);
  renderSaludTab();
  _safeCall('renderChecklist');
}

/* ================================================================
   ACTIONS — SECCIONES
   ================================================================ */
function toggleSection(sectionId, val) {
  const s = getSettings();
  s.sections[sectionId] = !!val;
  saveSettings(s);
  applySectionVisibility();
}

function applySectionVisibility() {
  const s = getSettings();
  Object.entries(s.sections).forEach(([id, visible]) => {
    const el = document.getElementById(`s-${id}`);
    if (el) el.style.display = visible ? '' : 'none';
  });
}

/* ================================================================
   ACTIONS — PREFERENCIAS
   ================================================================ */
function saveUserPrefs() {
  const s = getSettings();
  s.user.name   = _val('prefName')   || s.user.name;
  s.user.ciudad = _val('prefCiudad') || s.user.ciudad;
  s.user.estado = _val('prefEstado') || s.user.estado;
  saveSettings(s);
  CFG.user = s.user.name;

  // Update brand subtitle
  const sub = document.getElementById('brandSub');
  if (sub) sub.textContent = `Coach de Vida Total · ${s.user.name} · ${s.user.ciudad}, ${s.user.estado}`;

  _safeCall('renderTldr');
  _safeCall('renderBendicion');

  const btn = document.getElementById('savePrefsBtn');
  if (btn) { btn.textContent = '✓ Guardado'; setTimeout(() => btn.textContent = '💾 Guardar perfil', 2000); }
}

function toggleProject(projId, val) {
  const s = getSettings();
  s.projects[projId] = !!val;
  saveSettings(s);
  _safeCall('renderProyectos');
}

/* ================================================================
   AUTO-OPEN ON FIRST DAILY VISIT
   ================================================================ */
function checkFirstVisit() {
  const daily = getDaily();
  const isBlank = !daily.mood && !daily.withSon && !(daily.priorities && daily.priorities.length);
  if (isBlank) {
    setTimeout(() => openSettings('dia'), 900);
  }
}

/* ================================================================
   UTILS (privados)
   ================================================================ */
function _val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function _escHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _safeCall(fn) { if (typeof window[fn] === 'function') window[fn](); }
