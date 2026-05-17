import { api } from './api.js';

let currentUser = null;
let allReviews = [];
let allAgents = [];

const SOURCE_LABELS = {
  '2GIS': '2ГИС',
  'Krisha': 'Krisha.kz',
  'Google': 'Google',
  'WhatsApp': 'WhatsApp',
  'Own': 'Своё',
};

export async function renderReviewsList(container, user) {
  currentUser = user;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold text-graphite mb-2">Отзывы</h1>
        <p class="text-graphite/60">Отзывы клиентов о работе агентов</p>
      </div>
      <button onclick="window.openReviewForm()" class="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Добавить отзыв
      </button>
    </div>

    <div class="admin-card mb-6">
      <label class="text-xs uppercase tracking-wider text-graphite/50 font-medium mb-1.5 block">Фильтр по агенту</label>
      <select id="f-review-agent" class="admin-input max-w-md">
        <option value="">Все агенты</option>
      </select>
    </div>

    <div id="reviews-grid">
      <div class="p-12 text-center text-graphite/40">Загрузка...</div>
    </div>
  `;

  // Подгружаем список агентов для фильтра и формы
  try {
    const agentsData = await api.agents.list();
    allAgents = agentsData.items;
    const select = document.getElementById('f-review-agent');
    select.innerHTML = '<option value="">Все агенты</option>' +
      allAgents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    select.addEventListener('change', () => refresh(select.value));
  } catch (err) {
    console.error('Не удалось загрузить агентов:', err);
  }

  await refresh();
}

async function refresh(agentId) {
  try {
    const data = await api.reviews.list(agentId);
    allReviews = data.items;
    renderGrid();
  } catch (err) {
    document.getElementById('reviews-grid').innerHTML = `
      <div class="admin-card text-red-600">Ошибка: ${err.message}</div>
    `;
  }
}

function renderGrid() {
  const grid = document.getElementById('reviews-grid');

  if (allReviews.length === 0) {
    grid.innerHTML = `
      <div class="admin-card text-center py-16">
        <div class="text-5xl mb-3">💬</div>
        <div class="text-graphite/60">Отзывов пока нет</div>
        <div class="text-sm text-graphite/40 mt-1">Скопируйте отзывы из 2ГИС или Krisha и добавьте сюда</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${allReviews.map(r => reviewCardHTML(r)).join('')}
    </div>
  `;
}

function reviewCardHTML(r) {
  const sourceBadge = r.source
    ? `<span class="inline-block px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">${SOURCE_LABELS[r.source] || r.source}</span>`
    : '';

  const visibleBadge = r.visible
    ? `<span class="inline-flex items-center gap-1.5 text-xs text-primary-700"><span class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>Показывается</span>`
    : `<span class="inline-flex items-center gap-1.5 text-xs text-graphite/50"><span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Скрыт</span>`;

  return `
    <div class="admin-card p-5">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <div class="font-semibold text-graphite truncate">${escapeHtml(r.authorName)}</div>
          <div class="text-xs text-graphite/50 mt-0.5">Об агенте: <span class="text-primary-700">${r.agent ? escapeHtml(r.agent.name) : '—'}</span></div>
        </div>
        ${sourceBadge}
      </div>

      <div class="text-sm text-graphite/80 mb-4 leading-relaxed line-clamp-4">${escapeHtml(r.text)}</div>

      <div class="flex items-center justify-between pt-3 border-t border-gray-100">
        ${visibleBadge}
        <div class="flex gap-1">
          <button onclick="window.openReviewForm(${r.id})" title="Редактировать" class="p-2 hover:bg-gray-100 rounded-lg transition text-graphite/60 hover:text-primary-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="window.deleteReview(${r.id})" title="Удалить" class="p-2 hover:bg-red-50 rounded-lg transition text-graphite/60 hover:text-red-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ===== Действия =====
window.openReviewForm = (id) => {
  openModal(id);
};

window.deleteReview = async (id) => {
  const r = allReviews.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Удалить отзыв от «${r.authorName}»?`)) return;
  try {
    await api.reviews.remove(id);
    await refresh(document.getElementById('f-review-agent').value);
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

// ===== Модалка формы =====
function openModal(id) {
  const isEdit = !!id;
  const review = isEdit ? allReviews.find(r => r.id === id) : null;

  document.getElementById('review-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'review-modal';
  overlay.className = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4';

  const data = review || { agentId: '', authorName: '', text: '', source: '', visible: true, sortOrder: 100 };

  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
      <div class="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-graphite">${isEdit ? 'Редактировать отзыв' : 'Новый отзыв'}</h2>
        <button id="review-close" class="p-2 hover:bg-gray-100 rounded-lg transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <form id="review-form" class="p-6 space-y-5">
        <div>
          <label class="form-label">Агент *</label>
          <select name="agentId" required class="admin-input">
            <option value="">— выберите —</option>
            ${allAgents.map(a => `<option value="${a.id}" ${a.id === data.agentId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="form-label">Имя клиента *</label>
          <input name="authorName" required value="${escapeHtml(data.authorName)}" class="admin-input" placeholder="Айгерим Б." maxlength="100" />
        </div>

        <div>
          <label class="form-label">Текст отзыва *</label>
          <textarea name="text" required rows="5" class="admin-input" placeholder="Скопируйте отзыв из 2ГИС или Krisha..." maxlength="2000">${escapeHtml(data.text)}</textarea>
          <div class="text-xs text-graphite/50 mt-1">До 2000 символов</div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Источник</label>
            <select name="source" class="admin-input">
              <option value="" ${!data.source ? 'selected' : ''}>— не указан —</option>
              <option value="2GIS" ${data.source === '2GIS' ? 'selected' : ''}>2ГИС</option>
              <option value="Krisha" ${data.source === 'Krisha' ? 'selected' : ''}>Krisha.kz</option>
              <option value="Google" ${data.source === 'Google' ? 'selected' : ''}>Google</option>
              <option value="WhatsApp" ${data.source === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
              <option value="Own" ${data.source === 'Own' ? 'selected' : ''}>Своё</option>
            </select>
          </div>

          <div>
            <label class="form-label">Порядок</label>
            <input name="sortOrder" type="number" min="1" step="1" value="${data.sortOrder ?? 100}" class="admin-input" />
            <div class="text-xs text-graphite/50 mt-1">Меньше = выше</div>
          </div>
        </div>

        <label class="flex items-center gap-3 cursor-pointer pt-2">
          <input type="checkbox" name="visible" ${data.visible ? 'checked' : ''} class="form-checkbox" />
          <span class="text-sm text-graphite">Показывать на сайте</span>
        </label>

        <div id="review-error" class="text-sm text-red-600 hidden"></div>
      </form>

      <div class="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
        <button type="button" id="review-cancel" class="px-5 py-2.5 text-graphite hover:bg-gray-100 rounded-lg transition">Отмена</button>
        <button type="button" id="review-submit" class="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition">
          ${isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  document.getElementById('review-close').addEventListener('click', () => overlay.remove());
  document.getElementById('review-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('review-submit').addEventListener('click', () => submit(id));
}

async function submit(id) {
  const form = document.getElementById('review-form');
  const fd = new FormData(form);
  const data = {
    agentId: fd.get('agentId'),
    authorName: fd.get('authorName')?.trim(),
    text: fd.get('text')?.trim(),
    source: fd.get('source') || null,
    visible: fd.get('visible') === 'on',
    sortOrder: parseInt(fd.get('sortOrder'), 10) || 100,
  };

  const errBox = document.getElementById('review-error');
  errBox.classList.add('hidden');

  const submitBtn = document.getElementById('review-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Сохранение...';

  try {
    if (id) {
      await api.reviews.update(id, data);
    } else {
      await api.reviews.create(data);
    }
    document.getElementById('review-modal').remove();
    await refresh(document.getElementById('f-review-agent').value);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = id ? 'Сохранить' : 'Создать';
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}