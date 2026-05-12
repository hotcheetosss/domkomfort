import { api } from './api.js';

let currentUser = null;
let allItems = [];

const filterState = {
  search:   '',
  type:     '',
  deal:     '',
  active:   '',
  agentId:  '',
};

export async function renderPropertiesList(container, user) {
  currentUser = user;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold text-graphite mb-2">Объекты</h1>
        <p class="text-graphite/60">${user.role === 'admin' ? 'Все объекты агентства' : 'Ваши объекты'}</p>
      </div>
      <button onclick="window.openPropertyForm()" class="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Добавить объект
      </button>
    </div>

    <!-- Filters -->
    <div class="admin-card mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="lg:col-span-2">
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Поиск</label>
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="f-search" type="text" placeholder="Название или адрес..." class="admin-input pl-9" />
          </div>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Тип</label>
          <select id="f-type" class="admin-input">
            <option value="">Все</option>
            <option>Квартира</option>
            <option>Новостройка</option>
            <option>Дом</option>
            <option>Коммерция</option>
          </select>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Сделка</label>
          <select id="f-deal" class="admin-input">
            <option value="">Все</option>
            <option value="sale">Продажа</option>
            <option value="rent">Аренда</option>
          </select>
        </div>
      </div>

      <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div class="flex items-center gap-2 text-sm">
          <button data-active="" class="status-chip active">Все</button>
          <button data-active="true" class="status-chip">Активные</button>
          <button data-active="false" class="status-chip">Скрытые</button>
        </div>
        <button onclick="window.resetPropertiesFilters()" class="text-sm text-graphite/60 hover:text-primary-700 transition">Сбросить</button>
      </div>
    </div>

    <!-- Table -->
    <div class="admin-card p-0 overflow-hidden">
      <div id="props-table-wrap">
        <div class="p-12 text-center text-graphite/40">Загрузка...</div>
      </div>
    </div>
  `;

  document.getElementById('f-search').addEventListener('input', debounce(() => {
    filterState.search = document.getElementById('f-search').value.trim();
    refresh();
  }, 300));
  document.getElementById('f-type').addEventListener('change', e => {
    filterState.type = e.target.value;
    refresh();
  });
  document.getElementById('f-deal').addEventListener('change', e => {
    filterState.deal = e.target.value;
    refresh();
  });
  document.querySelectorAll('.status-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      filterState.active = btn.dataset.active;
      document.querySelectorAll('.status-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refresh();
    });
  });

  await refresh();
}

window.resetPropertiesFilters = () => {
  filterState.search = filterState.type = filterState.deal = filterState.active = '';
  document.getElementById('f-search').value = '';
  document.getElementById('f-type').value = '';
  document.getElementById('f-deal').value = '';
  document.querySelectorAll('.status-chip').forEach((b, i) => b.classList.toggle('active', i === 0));
  refresh();
};

async function refresh() {
  const params = {};
  if (filterState.search) params.search = filterState.search;
  if (filterState.type)   params.type = filterState.type;
  if (filterState.deal)   params.deal = filterState.deal;
  if (filterState.active) params.active = filterState.active;

  try {
    const data = await api.properties.list(params);
    allItems = data.items;
    renderTable();
  } catch (err) {
    document.getElementById('props-table-wrap').innerHTML = `
      <div class="p-12 text-center text-red-600">Ошибка: ${err.message}</div>
    `;
  }
}

function renderTable() {
  const wrap = document.getElementById('props-table-wrap');

  if (allItems.length === 0) {
    wrap.innerHTML = `
      <div class="p-16 text-center">
        <div class="text-5xl mb-3">📭</div>
        <div class="text-graphite/60">Объектов не найдено</div>
        <div class="text-sm text-graphite/40 mt-1">Попробуйте изменить фильтры или добавьте новый объект</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-5 py-3 text-xs uppercase tracking-wider text-graphite/60 font-medium">Объект</th>
            <th class="text-left px-5 py-3 text-xs uppercase tracking-wider text-graphite/60 font-medium">Тип</th>
            <th class="text-right px-5 py-3 text-xs uppercase tracking-wider text-graphite/60 font-medium">Цена</th>
            <th class="text-left px-5 py-3 text-xs uppercase tracking-wider text-graphite/60 font-medium">Агент</th>
            <th class="text-center px-5 py-3 text-xs uppercase tracking-wider text-graphite/60 font-medium">Статус</th>
            <th class="px-5 py-3 w-28"></th>
          </tr>
        </thead>
        <tbody>
          ${allItems.map(p => rowHTML(p)).join('')}
        </tbody>
      </table>
    </div>
    <div class="p-4 border-t border-gray-100 text-sm text-graphite/60">
      Всего: <span class="font-medium text-graphite">${allItems.length}</span>
    </div>
  `;
}

function rowHTML(p) {
  const thumb = p.gallery && p.gallery[0]
    ? `<img src="${p.gallery[0]}" class="w-14 h-14 rounded-lg object-cover" />`
    : `<div class="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-graphite/30 text-xs">нет фото</div>`;

  const dealBadge = p.deal === 'rent'
    ? `<span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">Аренда</span>`
    : `<span class="inline-block px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">Продажа</span>`;

  const statusBadge = p.active
    ? `<span class="inline-flex items-center gap-1.5 text-xs text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Активен</span>`
    : `<span class="inline-flex items-center gap-1.5 text-xs text-graphite/50"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Скрыт</span>`;

  // Админ удаляет любые объекты; агент — только свои
  const canDelete = currentUser.role === 'admin'
    || (currentUser.agent && p.agent && currentUser.agent.id === p.agent.id);

  return `
    <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition">
      <td class="px-5 py-4">
        <div class="flex items-center gap-3">
          ${thumb}
          <div class="min-w-0">
            <div class="font-medium text-graphite truncate max-w-md">${p.title}</div>
            <div class="text-xs text-graphite/50 mt-0.5">${p.district} · ${p.sqm} м²${p.rooms ? ` · ${p.rooms}-комн.` : ''}${p.top ? ` · TOP` : ''}</div>
          </div>
        </div>
      </td>
      <td class="px-5 py-4">
        <div class="text-sm text-graphite">${p.type}</div>
        <div class="mt-1">${dealBadge}</div>
      </td>
      <td class="px-5 py-4 text-right">
        <div class="font-medium text-graphite">${p.price} ₸${p.deal === 'rent' ? '/мес' : ''}</div>
      </td>
      <td class="px-5 py-4">
        <div class="text-sm text-graphite">${p.agent ? p.agent.name : '—'}</div>
        ${p.agent ? `<div class="text-xs text-graphite/50">${p.agent.phone}</div>` : ''}
      </td>
      <td class="px-5 py-4 text-center">${statusBadge}</td>
      <td class="px-5 py-4">
        <div class="flex items-center justify-end gap-1">
          <button onclick="window.openPropertyForm('${p.id}')" title="Редактировать" class="p-2 hover:bg-gray-100 rounded-lg transition text-graphite/60 hover:text-primary-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="window.togglePropertyActive('${p.id}', ${!p.active})" title="${p.active ? 'Скрыть' : 'Опубликовать'}" class="p-2 hover:bg-gray-100 rounded-lg transition text-graphite/60 hover:text-graphite">
            ${p.active
              ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
              : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
            }
          </button>
          ${canDelete ? `
            <button onclick="window.deletePropertyConfirm('${p.id}')" title="Удалить" class="p-2 hover:bg-red-50 rounded-lg transition text-graphite/60 hover:text-red-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

window.togglePropertyActive = async (id, makeActive) => {
  try {
    if (makeActive) {
      await api.properties.activate(id);
    } else {
      await api.properties.deactivate(id);
    }
    await refresh();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.deletePropertyConfirm = async (id) => {
  const item = allItems.find(p => p.id === id);
  if (!item) return;
  if (!confirm(`Удалить навсегда: «${item.title}»?\n\nФото объекта тоже будут удалены. Это действие нельзя отменить.`)) return;
  try {
    await api.properties.remove(id);
    await refresh();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.openPropertyForm = async (id) => {
  const mod = await import('./property-form.js');
  await mod.openPropertyForm(currentUser, id, () => refresh());
};

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}