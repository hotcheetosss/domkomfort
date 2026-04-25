import { api } from './api.js';

let currentUser = null;
let agentsList = [];

export async function renderAgentsList(container, user) {
  currentUser = user;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold text-graphite mb-2">Агенты</h1>
        <p class="text-graphite/60">Команда агентства и доступы к админке</p>
      </div>
      ${currentUser.role === 'admin' ? `
        <button onclick="window.openAgentForm()" class="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить агента
        </button>
      ` : ''}
    </div>

    <div id="agents-grid">
      <div class="p-12 text-center text-graphite/40">Загрузка...</div>
    </div>
  `;

  await refresh();
}

async function refresh() {
  try {
    const data = await api.agents.list();
    agentsList = data.items;
    renderGrid();
  } catch (err) {
    document.getElementById('agents-grid').innerHTML = `
      <div class="admin-card text-red-600">Ошибка: ${err.message}</div>
    `;
  }
}

function renderGrid() {
  const grid = document.getElementById('agents-grid');

  if (agentsList.length === 0) {
    grid.innerHTML = `<div class="admin-card text-center py-16 text-graphite/60">Агентов пока нет</div>`;
    return;
  }

  grid.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${agentsList.map(a => agentCardHTML(a)).join('')}
    </div>
  `;
}

function agentCardHTML(a) {
  const hasAccount = !!a.user;
  const isBlocked = hasAccount && !a.user.active;
  const isAdmin = currentUser.role === 'admin';
  const canEdit = isAdmin || (currentUser.agent && currentUser.agent.id === a.id);

  const phoneFormatted = formatPhone(a.phone);

  let statusBadge = '';
  if (!hasAccount) {
    statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded">⚠ Нет доступа</span>`;
  } else if (isBlocked) {
    statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded">🚫 Заблокирован</span>`;
  } else {
    statusBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">✓ Активен</span>`;
  }

  const lastLogin = hasAccount && a.user.lastLoginAt
    ? `Был ${formatRelative(a.user.lastLoginAt)}`
    : 'Ещё не входил';

  const photo = a.img
    ? `<img src="${a.img}" class="w-full h-full object-cover" />`
    : `<div class="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">👤</div>`;

  return `
    <div class="admin-card p-0 overflow-hidden">
      <div class="aspect-[4/3] overflow-hidden bg-gray-100">
        ${photo}
      </div>
      <div class="p-5">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="min-w-0">
            <div class="font-semibold text-graphite truncate">${a.name}</div>
            <div class="text-xs text-graphite/50 mt-0.5">${a.role}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="text-sm text-graphite/70 mb-3 line-clamp-2">${a.specialization || '—'}</div>

        <div class="flex items-center gap-3 text-xs text-graphite/50 mb-4">
          <span>📞 ${phoneFormatted}</span>
          <span>·</span>
          <span>${a.propertiesCount} объектов</span>
        </div>

        ${hasAccount ? `<div class="text-xs text-graphite/40 mb-4">${lastLogin}</div>` : ''}

        ${canEdit ? `
          <div class="flex flex-wrap gap-2">
            <button onclick="window.openAgentForm('${a.id}')" class="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Редактировать</button>
            ${isAdmin ? `
              ${!hasAccount ? `
                <button onclick="window.createAgentAccount('${a.id}')" class="text-sm px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg transition">Создать доступ</button>
              ` : `
                <button onclick="window.resetAgentPassword('${a.id}')" class="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Сбросить пароль</button>
                <button onclick="window.toggleAgentAccess('${a.id}')" class="text-sm px-3 py-1.5 ${isBlocked ? 'bg-primary-50 hover:bg-primary-100 text-primary-700' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'} rounded-lg transition">
                  ${isBlocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
              `}
              ${a.propertiesCount === 0 ? `
                <button onclick="window.deleteAgent('${a.id}')" class="text-sm px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">Удалить</button>
              ` : ''}
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ===== Действия =====
window.openAgentForm = async (id) => {
  const mod = await import('./agent-form.js');
  await mod.openAgentForm(currentUser, id, () => refresh());
};

window.createAgentAccount = async (id) => {
  const password = prompt('Придумайте пароль для нового аккаунта (минимум 8 символов):');
  if (!password) return;
  if (password.length < 8) {
    alert('Пароль должен быть минимум 8 символов');
    return;
  }
  try {
    const res = await api.agents.createAccount(id, password);
    alert(`Аккаунт создан!\n\nЛогин: +${res.login}\nПароль: ${password}\n\nСохраните эти данные и передайте сотруднику.`);
    refresh();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.resetAgentPassword = async (id) => {
  const password = prompt('Новый пароль (минимум 8 символов):');
  if (!password) return;
  if (password.length < 8) {
    alert('Пароль должен быть минимум 8 символов');
    return;
  }
  try {
    await api.agents.resetPassword(id, password);
    alert(`Новый пароль установлен: ${password}\n\nПередайте его сотруднику.`);
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.toggleAgentAccess = async (id) => {
  const a = agentsList.find(x => x.id === id);
  if (!a) return;
  const action = a.user && a.user.active ? 'заблокировать' : 'разблокировать';
  if (!confirm(`Точно хотите ${action} доступ для «${a.name}»?`)) return;
  try {
    await api.agents.toggleActive(id);
    refresh();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.deleteAgent = async (id) => {
  const a = agentsList.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Удалить агента «${a.name}» навсегда?\n\nАккаунт и фото тоже будут удалены.`)) return;
  try {
    await api.agents.remove(id);
    refresh();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

// ===== utils =====
function formatPhone(p) {
  if (!p) return '';
  // 77085050826 -> +7 708 505 08 26
  const m = String(p).match(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return p;
  return `+${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
}

function formatRelative(dateStr) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} дн назад`;
  return date.toLocaleDateString('ru-RU');
}