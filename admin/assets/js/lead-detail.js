import { api } from './api.js';
import { getAgentsForAssignment } from './leads.js';

let currentUser = null;
let lead = null;
let onCloseCallback = null;

const STATUS_OPTIONS = [
  { value: 'new',         label: '🔴 Новая' },
  { value: 'in_progress', label: '🟡 В работе' },
  { value: 'viewing',     label: '🔵 Просмотр назначен' },
  { value: 'closed',      label: '🟢 Закрыта' },
  { value: 'rejected',    label: '⚫ Отказ' },
];

const SOURCE_LABELS = {
  'website':         'Главная страница',
  'website-form':    'Главная страница',
  'property-page':   'Страница объекта',
  'agent-profile':   'Профиль агента',
  'career-page':     'Страница «Карьера»',
};

export async function openLeadDetail(user, id, onClose) {
  currentUser = user;
  onCloseCallback = onClose;

  try {
    lead = await api.leads.get(id);
  } catch (err) {
    alert('Не удалось загрузить заявку: ' + err.message);
    return;
  }

  await render();
}

async function render() {
  document.getElementById('lead-detail-overlay')?.remove();

  const isAdmin = currentUser.role === 'admin';
  const agents = isAdmin ? await getAgentsForAssignment() : [];

  const overlay = document.createElement('div');
  overlay.id = 'lead-detail-overlay';
  overlay.className = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch justify-end';
  overlay.innerHTML = panelHTML(agents, isAdmin);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) handleClose();
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  attachHandlers();
}

function panelHTML(agents, isAdmin) {
  const phoneDigits = lead.phone.replace(/\D/g, '');
  const phoneFmt = formatPhone(lead.phone);
  const source = SOURCE_LABELS[lead.source] || lead.source;
  const created = new Date(lead.createdAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  const propertyBlock = lead.property ? `
    <section class="mb-6">
      <div class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-3">Объект из заявки</div>
      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="aspect-video bg-gray-100">
          ${lead.property.gallery && lead.property.gallery[0]
            ? `<img src="${lead.property.gallery[0]}" class="w-full h-full object-cover" />`
            : `<div class="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🏠</div>`
          }
        </div>
        <div class="p-4">
          <div class="font-semibold text-graphite">${esc(lead.property.title)}</div>
          <div class="text-sm text-graphite/60 mt-1">${esc(lead.property.address || '')}</div>
          <div class="font-display text-xl text-primary-700 font-medium mt-2">${lead.property.priceLabel} ₸${lead.property.deal === 'rent' ? '/мес' : ''}</div>
        </div>
      </div>
    </section>
  ` : '';

  return `
    <div class="bg-white w-full max-w-2xl h-screen overflow-y-auto shadow-2xl">

      <!-- Header -->
      <div class="sticky top-0 bg-white z-10 px-8 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-graphite">Заявка #${lead.id}</h2>
          <div class="text-xs text-graphite/50 mt-0.5">${source} · ${created}</div>
        </div>
        <button id="ld-close" class="p-2 hover:bg-gray-100 rounded-lg transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="p-8">

        <!-- Контакт -->
        <section class="mb-6">
          <div class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-3">Клиент</div>
          <div class="flex items-center justify-between gap-4 p-5 bg-gray-50 rounded-xl">
            <div>
              <div class="text-2xl font-semibold text-graphite">${esc(lead.name)}</div>
              <div class="text-graphite/60 mt-1">${phoneFmt}</div>
            </div>
            <a href="https://wa.me/${phoneDigits}" target="_blank"
               class="inline-flex items-center gap-2 px-5 py-3 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg font-medium transition">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
              Написать в WhatsApp
            </a>
          </div>
        </section>

        <!-- Сообщение клиента -->
        ${lead.message ? `
          <section class="mb-6">
            <div class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-3">Сообщение</div>
            <div class="p-4 bg-amber-50 border-l-4 border-amber-300 rounded-r-lg text-graphite leading-relaxed">
              ${esc(lead.message)}
            </div>
          </section>
        ` : ''}

        ${propertyBlock}

        <!-- Управление -->
        <section class="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Статус</label>
            <select id="ld-status" class="admin-input">
              ${STATUS_OPTIONS.map(s => `<option value="${s.value}" ${s.value === lead.status ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>

          ${isAdmin ? `
            <div>
              <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Назначенный агент</label>
              <select id="ld-agent" class="admin-input">
                <option value="">— Не назначен —</option>
                ${agents.map(a => `<option value="${a.id}" ${a.id === lead.agentId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
              </select>
            </div>
          ` : `
            <div>
              <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Назначенный агент</label>
              <div class="admin-input bg-gray-50">${lead.agent ? esc(lead.agent.name) : 'Не назначен'}</div>
            </div>
          `}
        </section>

        <!-- Заметки -->
        <section class="mb-6">
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Внутренние заметки</label>
          <div class="text-xs text-graphite/50 mb-2">Видны только сотрудникам. Записывайте ход переговоров, договорённости, важные детали.</div>
          <textarea id="ld-notes" rows="6" class="admin-input"
            placeholder="Например: Созвонились в 14:00, договорились на просмотр в субботу 16:00. Клиент готов к торгу.">${esc(lead.notes || '')}</textarea>
          <div class="flex items-center justify-between mt-2 text-xs text-graphite/50">
            <span id="ld-save-status"></span>
            <span id="ld-char-count">0 / 5000</span>
          </div>
        </section>

        <!-- Footer actions -->
        <div class="flex items-center justify-between pt-6 border-t border-gray-200">
          ${isAdmin ? `
            <button id="ld-delete" class="text-sm text-red-600 hover:text-red-700">Удалить заявку</button>
          ` : '<span></span>'}
          <div class="flex gap-3">
            <button id="ld-cancel" class="px-5 py-2.5 text-graphite hover:bg-gray-100 rounded-lg transition">Закрыть</button>
            <button id="ld-save" class="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachHandlers() {
  document.getElementById('ld-close').addEventListener('click', handleClose);
  document.getElementById('ld-cancel').addEventListener('click', handleClose);
  document.getElementById('ld-save').addEventListener('click', handleSave);

  const notes = document.getElementById('ld-notes');
  const counter = document.getElementById('ld-char-count');
  const updateCount = () => counter.textContent = `${notes.value.length} / 5000`;
  notes.addEventListener('input', updateCount);
  updateCount();

  if (currentUser.role === 'admin') {
    document.getElementById('ld-delete')?.addEventListener('click', handleDelete);
  }
}

async function handleSave() {
  const data = {
    status: document.getElementById('ld-status').value,
    notes:  document.getElementById('ld-notes').value,
  };
  if (currentUser.role === 'admin') {
    const agentSel = document.getElementById('ld-agent');
    data.agentId = agentSel.value || null;
  }

  const btn = document.getElementById('ld-save');
  const status = document.getElementById('ld-save-status');
  btn.disabled = true;
  btn.textContent = 'Сохранение...';

  try {
    await api.leads.update(lead.id, data);
    status.textContent = '✅ Сохранено';
    status.className = 'text-primary-700';
    setTimeout(() => handleClose(), 800);
  } catch (err) {
    status.textContent = '❌ ' + err.message;
    status.className = 'text-red-600';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

async function handleDelete() {
  if (!confirm(`Удалить заявку от ${lead.name} навсегда?`)) return;
  try {
    await api.leads.remove(lead.id);
    handleClose();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

function handleClose() {
  document.getElementById('lead-detail-overlay')?.remove();
  document.body.style.overflow = '';
  if (onCloseCallback) onCloseCallback();
}

function formatPhone(p) {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  const m = digits.match(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return p;
  return `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}