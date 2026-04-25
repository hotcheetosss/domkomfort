// Главный модуль админки: загрузка, навигация, логин, роуты
import { api, getToken, setToken, clearToken } from './api.js';

let currentUser = null;

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', async () => {
  setupLoginForm();

  const token = getToken();
  if (token) {
    // Проверяем что токен ещё валидный
    try {
      currentUser = await api.auth.me();
      showApp();
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }

  setupNavigation();
});

// ===== Показ страниц =====
function showLogin() {
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('page-app').classList.add('hidden');
}

function showApp() {
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('page-app').classList.remove('hidden');

  // Заполнить данные юзера в sidebar
  const avatar = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');

  const initials = currentUser.name.split(' ').map(p => p[0]).slice(0, 2).join('');
  avatar.textContent = initials;
  nameEl.textContent = currentUser.name;
  roleEl.textContent = currentUser.role === 'admin' ? 'Администратор' : 'Агент';

  // Отметить роль на body — CSS скроет admin-only пункты меню для агента
  document.body.dataset.role = currentUser.role;

  // Показать дашборд
  showSection('dashboard');
}

// ===== Логин =====
function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';

    try {
      const { token, user } = await api.auth.login(phone, password);
      setToken(token);
      localStorage.setItem('domkomfort_user', JSON.stringify(user));
      currentUser = user;
      showApp();
    } catch (err) {
      errorBox.textContent = err.message || 'Ошибка входа';
      errorBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Войти';
    }
  });
}

// ===== Logout =====
async function logout() {
  try { await api.auth.logout(); } catch {}
  clearToken();
  currentUser = null;
  showLogin();
}
window.logout = logout;

// ===== Навигация внутри админки =====
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      showSection(section);
    });
  });
}

async function showSection(section) {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === section);
  });

  const container = document.getElementById('admin-content');

  switch (section) {
    case 'dashboard':  renderDashboard(container); break;
    case 'properties':
      const propsModule = await import('./properties.js');
      propsModule.renderPropertiesList(container, currentUser);
      break;
    case 'agents':
      const agentsModule = await import('./agents.js');
      agentsModule.renderAgentsList(container, currentUser);
      break;
    case 'leads':
      const leadsModule = await import('./leads.js');
      leadsModule.renderLeadsList(container, currentUser);
      break;
    case 'users':      renderPlaceholder(container, 'Сотрудники', 'Скоро — управление доступами.'); break;
  }
}

// ===== Разделы =====
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-graphite mb-2">Добро пожаловать, ${currentUser.name.split(' ')[0]}!</h1>
      <p class="text-graphite/60">Сводка агентства</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="stat-card">
        <div class="stat-label">Объектов</div>
        <div class="stat-value" id="stat-properties">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Агентов</div>
        <div class="stat-value" id="stat-agents">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Заявок (всего)</div>
        <div class="stat-value" id="stat-leads">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Новых заявок</div>
        <div class="stat-value text-red-600" id="stat-leads-new">—</div>
      </div>
    </div>

    <div class="admin-card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-graphite">Последние заявки</h2>
        <a href="#" onclick="document.querySelector('[data-section=leads]').click(); return false;" class="text-sm text-primary-700 hover:text-primary-800">Все заявки →</a>
      </div>
      <div id="recent-leads">
        <div class="text-center text-graphite/40 py-8">Загрузка...</div>
      </div>
    </div>
  `;

  try {
    const [props, agentsData, leadsData] = await Promise.all([
      api.properties.listPublic(),
      api.agents.listPublic(),
      api.leads.list({}),
    ]);
    document.getElementById('stat-properties').textContent = props.count;
    document.getElementById('stat-agents').textContent = agentsData.agents.length;
    document.getElementById('stat-leads').textContent = leadsData.stats.all || 0;
    document.getElementById('stat-leads-new').textContent = leadsData.stats.new || 0;

    renderRecentLeads(leadsData.items.slice(0, 5));
  } catch (err) {
    console.error('Ошибка загрузки дашборда:', err);
  }
}

function renderRecentLeads(items) {
  const wrap = document.getElementById('recent-leads');
  if (items.length === 0) {
    wrap.innerHTML = `<div class="text-center text-graphite/40 py-8">Заявок пока нет</div>`;
    return;
  }
  wrap.innerHTML = items.map(l => {
    const phoneDigits = l.phone.replace(/\D/g, '');
    const time = new Date(l.createdAt).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const statusDot = {
      new: 'bg-red-500', in_progress: 'bg-amber-500',
      viewing: 'bg-blue-500', closed: 'bg-primary-500', rejected: 'bg-gray-400',
    }[l.status] || 'bg-gray-300';
    return `
      <div class="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
        <div class="w-2 h-2 rounded-full ${statusDot} flex-shrink-0"></div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-graphite">${l.name}</div>
          <div class="text-xs text-graphite/60 truncate">${l.message || (l.property ? l.property.title : '—')}</div>
        </div>
        <div class="text-xs text-graphite/50 flex-shrink-0">${time}</div>
      </div>
    `;
  }).join('');
}