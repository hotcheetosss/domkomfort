import { api } from './api.js';

let currentUser = null;
let leadsData = { items: [], stats: {} };
let agentsCache = null;

const filterState = {
  status: '',
  period: '',
  search: '',
  unassigned: false,
};

const STATUS_LABELS = {
  new:         { label: 'Новая',           color: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500' },
  in_progress: { label: 'В работе',        color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  viewing:     { label: 'Просмотр',        color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  closed:      { label: 'Закрыта',         color: 'bg-primary-50 text-primary-700 border-primary-200', dot: 'bg-primary-500' },
  rejected:    { label: 'Отказ',           color: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
};

const SOURCE_LABELS = {
  'website':         'Главная',
  'website-form':    'Главная',
  'property-page':   'Страница объекта',
  'agent-profile':   'Профиль агента',
  'career-page':     'Карьера',
};

export async function renderLeadsList(container, user) {
  currentUser = user;

  container.innerHTML = `
    <div class="mb-6">
      <h1 class="text-3xl font-semibold text-graphite mb-2">Заявки</h1>
      <p class="text-graphite/60">${user.role === 'admin' ? 'Все заявки агентства' : 'Ваши заявки и назначенные'}</p>
    </div>

    <!-- Status tabs -->
    <div id="status-tabs" class="flex flex-wrap gap-2 mb-6"></div>

    <!-- Toolbar -->
    <div class="admin-card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Поиск</label>
          <input id="lf-search" type="text" placeholder="Имя, телефон или текст..." class="admin-input" />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Период</label>
          <select id="lf-period" class="admin-input">
            <option value="">За всё время</option>
            <option value="today">Сегодня</option>
            <option value="week">7 дней</option>
            <option value="month">30 дней</option>
          </select>
        </div>
      </div>
    </div>

    <!-- List -->
    <div id="leads-list">
      <div class="p-12 text-center text-graphite/40">Загрузка...</div>
    </div>
  `;

  document.getElementById('lf-search').addEventListener('input', debounce(() => {
    filterState.search = document.getElementById('lf-search').value.trim();
    refresh();
  }, 300));
  document.getElementById('lf-period').addEventListener('change', e => {
    filterState.period = e.target.value;
    refresh();
  });

  await refresh();
}

async function refresh() {
  const params = {};
  if (filterState.status)     params.status = filterState.status;
  if (filterState.period)     params.period = filterState.period;
  if (filterState.search)     params.search = filterState.search;
  if (filterState.unassigned) params.unassigned = 'true';

  try {
    leadsData = await api.leads.list(params);
    renderTabs();
    renderList();
  } catch (err) {
    document.getElementById('leads-list').innerHTML = `
      <div class="admin-card text-red-600">Ошибка: ${err.message}</div>
    `;
  }
}

function renderTabs() {
  const tabs = document.getElementById('status-tabs');
  const s = leadsData.stats;
  const isAdmin = currentUser.role === 'admin';

  const items = [
    { key: 'all',         label: 'Все',         count: s.all },
    { key: 'new',         label: 'Новые',       count: s.new },
    { key: 'in_progress', label: 'В работе',    count: s.in_progress },
    { key: 'viewing',     label: 'Просмотр',    count: s.viewing },
    { key: 'closed',      label: 'Закрыты',     count: s.closed },
    { key: 'rejected',    label: 'Отказы',      count: s.rejected },
  ];

  if (isAdmin && s.unassigned > 0) {
    items.push({ key: 'unassigned', label: '⚠ Без агента', count: s.unassigned, special: true });
  }

  const activeKey = filterState.unassigned ? 'unassigned' : (filterState.status || 'all');

  tabs.innerHTML = items.map(i => `
    <button data-tab="${i.key}" class="px-4 py-2 text-sm rounded-lg border transition flex items-center gap-2
      ${i.key === activeKey ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-graphite border-gray-200 hover:border-gray-300'}
      ${i.special && i.key !== activeKey ? 'border-amber-300 text-amber-700' : ''}">
      ${i.label}
      <span class="${i.key === activeKey ? 'bg-white/20 text-white' : 'bg-gray-100 text-graphite/60'} px-1.5 py-0.5 rounded text-xs font-medium">${i.count || 0}</span>
    </button>
  `).join('');

  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'unassigned') {
        filterState.unassigned = true;
        filterState.status = '';
      } else if (tab === 'all') {
        filterState.unassigned = false;
        filterState.status = '';
      } else {
        filterState.unassigned = false;
        filterState.status = tab;
      }
      refresh();
    });
  });
}

function renderList() {
  const list = document.getElementById('leads-list');

  if (leadsData.items.length === 0) {
    list.innerHTML = `
      <div class="admin-card text-center py-16">
        <div class="text-5xl mb-3">📭</div>
        <div class="text-graphite/60">Заявок пока нет</div>
        <div class="text-sm text-graphite/40 mt-1">Они появятся здесь, как только клиенты заполнят форму на сайте</div>
      </div>
    `;
    return;
  }

  list.innerHTML = `<div class="space-y-3">${leadsData.items.map(l => leadCardHTML(l)).join('')}</div>`;
}

function leadCardHTML(lead) {
  const status = STATUS_LABELS[lead.status] || STATUS_LABELS.new;
  const time = formatDateTime(lead.createdAt);
  const phoneFmt = formatPhone(lead.phone);
  const phoneDigits = lead.phone.replace(/\D/g, '');
  const source = SOURCE_LABELS[lead.source] || lead.source;

  const propertyBlock = lead.property ? `
    <div class="mt-2 inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-gray-100 rounded-lg">
      🏠 <span class="text-graphite font-medium">${esc(lead.property.title)}</span>
      <span class="text-graphite/50">·</span>
      <span class="text-graphite/70">${lead.property.priceLabel} ₸${lead.property.deal === 'rent' ? '/мес' : ''}</span>
    </div>
  ` : '';

  const agentBlock = lead.agent
    ? `<span class="text-xs text-graphite/60">Агент: <span class="font-medium">${esc(lead.agent.name)}</span></span>`
    : `<span class="text-xs text-amber-700 font-medium">Без агента</span>`;

  return `
    <div class="admin-card hover:border-primary-200 transition cursor-pointer" onclick="window.openLeadDetail(${lead.id})">
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex items-center gap-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 ${status.color} text-xs font-medium rounded-full border">
            <span class="w-1.5 h-1.5 rounded-full ${status.dot}"></span>
            ${status.label}
          </div>
          <span class="text-xs text-graphite/50">${time}</span>
          <span class="text-xs text-graphite/50">·</span>
          <span class="text-xs text-graphite/50">${source}</span>
        </div>
        ${agentBlock}
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-3 mb-1">
            <div class="font-semibold text-lg text-graphite">${esc(lead.name)}</div>
            <div class="text-graphite/60">${phoneFmt}</div>
          </div>
          ${lead.message ? `<div class="text-sm text-graphite/70 line-clamp-2">${esc(lead.message)}</div>` : `<div class="text-sm text-graphite/40 italic">Без сообщения</div>`}
          ${propertyBlock}
        </div>
        <a href="https://wa.me/${phoneDigits}" target="_blank" onclick="event.stopPropagation()"
           class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg text-sm font-medium transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
          WhatsApp
        </a>
      </div>
    </div>
  `;
}

// ===== Детальная карточка =====
window.openLeadDetail = async (id) => {
  const mod = await import('./lead-detail.js');
  await mod.openLeadDetail(currentUser, id, () => refresh());
};

// ===== Helpers =====
function formatPhone(p) {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  const m = digits.match(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return p;
  return `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
}

function formatDateTime(s) {
  const d = new Date(s);
  const now = new Date();
  const diff = now - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (hr < 48) return 'вчера ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// Загрузка списка агентов (для назначения) — кэш
export async function getAgentsForAssignment() {
  if (agentsCache) return agentsCache;
  const data = await api.agents.list();
  agentsCache = data.items;
  return agentsCache;
}