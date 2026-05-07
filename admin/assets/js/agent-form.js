import { api } from './api.js';

let currentUser = null;
let editingId = null;
let formData = {};

export async function openAgentForm(user, id, onClose) {
  currentUser = user;
  editingId = id || null;

  if (editingId) {
    try {
      const a = await api.agents.get(editingId);
      formData = {
        name: a.name,
        role: a.role,
        specialization: a.specialization,
        phone: a.phone,
        awards: a.awards || [],
        img: a.img,
        hasAccount: !!a.user,
        isTopMonth: !!a.isTopMonth,
      };
    } catch (err) {
      alert('Не удалось загрузить агента: ' + err.message);
      return;
    }
  } else {
    formData = {
      name: '',
      role: 'Агент',
      specialization: '',
      phone: '',
      awards: [],
      img: null,
      withAccount: true,
      password: '',
      isTopMonth: false,
    };
  }

  renderForm(onClose);
}

function renderForm(onClose) {
  document.getElementById('agent-form-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'agent-form-overlay';
  overlay.className = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch justify-end';
  overlay.innerHTML = formHTML();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleClose(onClose);
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  attachHandlers(onClose);
}

function formHTML() {
  const isEdit = !!editingId;
  const isAdmin = currentUser.role === 'admin';

  const photo = formData.img
    ? `<img src="${formData.img}" class="w-full h-full object-cover" />`
    : `<div class="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 text-5xl">👤</div>`;

  return `
    <div class="bg-white w-full max-w-2xl h-screen overflow-y-auto shadow-2xl">

      <div class="sticky top-0 bg-white z-10 px-8 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-graphite">${isEdit ? 'Редактировать агента' : 'Новый агент'}</h2>
          <p class="text-sm text-graphite/50 mt-0.5">${isEdit ? 'Обновите профиль и сохраните' : 'Создайте профиль и опционально аккаунт для входа'}</p>
        </div>
        <button id="agent-form-close" class="p-2 hover:bg-gray-100 rounded-lg transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <form id="agent-form" class="p-8 space-y-8">

        <!-- Avatar -->
        ${isEdit ? `
          <section>
            <h3 class="form-section-title">Фото</h3>
            <div class="flex items-center gap-5">
              <div id="avatar-preview" class="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                ${photo}
              </div>
              <div>
                <label class="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer transition">
                  <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" />
                  Загрузить фото
                </label>
                <div class="text-xs text-graphite/50 mt-1.5">JPEG, PNG, WEBP до 15 МБ</div>
                <div id="avatar-status" class="text-xs mt-1 hidden"></div>
              </div>
            </div>
          </section>
        ` : ''}

        <!-- Профиль -->
        <section>
          <h3 class="form-section-title">Профиль</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="form-label">ФИО *</label>
              <input name="name" required value="${esc(formData.name)}" class="admin-input" placeholder="Дадахан Мажитов" />
            </div>
            <div>
              <label class="form-label">Должность *</label>
              <input name="role" required value="${esc(formData.role)}" class="admin-input" placeholder="Агент / Топ-агент / РОП" />
            </div>
            <div>
              <label class="form-label">Телефон *</label>
              <input name="phone" required value="${esc(formData.phone)}" class="admin-input" placeholder="+7 708 505 0826" />
            </div>
            <div class="col-span-2">
              <label class="form-label">Специализация *</label>
              <input name="specialization" required value="${esc(formData.specialization)}" class="admin-input" placeholder="Вторичный рынок · Центр Астаны" />
            </div>
          </div>
        </section>

        <!-- Награды -->
        <section>
          <h3 class="form-section-title">Награды и достижения</h3>
          <div class="text-xs text-graphite/50 mb-3">Например: «ТОП-7 Krisha 2024»</div>
          <div id="awards-list" class="flex flex-wrap gap-2 mb-3">
            ${formData.awards.map(a => awardTagHTML(a)).join('')}
          </div>
          <div class="flex gap-2">
            <input id="award-input" type="text" class="admin-input flex-1" placeholder="Добавить награду" />
            <button type="button" id="award-add-btn" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">Добавить</button>
          </div>
        </section>

        <!-- Топ-агент месяца -->
        <section>
          <h3 class="form-section-title">Статус</h3>
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="isTopMonth" ${formData.isTopMonth ? 'checked' : ''} class="form-checkbox mt-0.5" />
              <div>
                <div class="text-sm font-medium text-graphite flex items-center gap-2">
                  <span class="text-amber-500">⭐</span> Топ-агент месяца
                </div>
                <div class="text-xs text-graphite/60 mt-1">Будет показан отдельным блоком вверху на странице агентов сайта. Снимите галочку чтобы убрать статус.</div>
              </div>
            </label>
          </div>
        </section>

        <!-- Аккаунт (только при создании, только админ) -->
        ${!isEdit && isAdmin ? `
          <section>
            <h3 class="form-section-title">Аккаунт для входа</h3>
            <div class="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-4">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="withAccount" ${formData.withAccount ? 'checked' : ''} class="form-checkbox mt-0.5" id="with-account" />
                <div>
                  <div class="text-sm font-medium text-graphite">Создать аккаунт для входа</div>
                  <div class="text-xs text-graphite/60 mt-0.5">Агент сможет логиниться по своему номеру телефона</div>
                </div>
              </label>
            </div>
            <div id="password-section" ${formData.withAccount ? '' : 'class="hidden"'}>
              <label class="form-label">Пароль (минимум 8 символов) *</label>
              <input name="password" type="text" minlength="8" value="${esc(formData.password)}" class="admin-input" placeholder="example1234" />
              <div class="text-xs text-graphite/50 mt-1">Сохраните и передайте сотруднику. Сменить можно позже.</div>
            </div>
          </section>
        ` : ''}

      </form>

      <div class="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-between">
        <div id="agent-form-error" class="text-sm text-red-600 hidden"></div>
        <div class="ml-auto flex gap-3">
          <button type="button" id="agent-form-cancel" class="px-5 py-2.5 text-graphite hover:bg-gray-100 rounded-lg transition">Отмена</button>
          <button type="button" id="agent-form-submit" class="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition">
            ${isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function awardTagHTML(text) {
  return `
    <span class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-amber-50 text-amber-800 text-sm rounded-full" data-award="${esc(text)}">
      ${esc(text)}
      <button type="button" class="award-remove w-5 h-5 hover:bg-amber-200 rounded-full flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `;
}

function attachHandlers(onClose) {
  document.getElementById('agent-form-close').addEventListener('click', () => handleClose(onClose));
  document.getElementById('agent-form-cancel').addEventListener('click', () => handleClose(onClose));
  document.getElementById('agent-form-submit').addEventListener('click', () => handleSubmit(onClose));

  // Awards
  const awardInput = document.getElementById('award-input');
  awardInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addAward(); }
  });
  document.getElementById('award-add-btn')?.addEventListener('click', addAward);

  document.getElementById('awards-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.award-remove');
    if (!btn) return;
    const tag = btn.closest('[data-award]');
    formData.awards = formData.awards.filter(a => a !== tag.dataset.award);
    tag.remove();
  });

  // With-account toggle
  document.getElementById('with-account')?.addEventListener('change', e => {
    document.getElementById('password-section').classList.toggle('hidden', !e.target.checked);
  });

  // Avatar upload (только в режиме редактирования)
  document.getElementById('avatar-input')?.addEventListener('change', handleAvatarUpload);
}

function addAward() {
  const input = document.getElementById('award-input');
  const text = input.value.trim();
  if (!text || formData.awards.includes(text)) {
    input.value = '';
    return;
  }
  formData.awards.push(text);
  document.getElementById('awards-list').insertAdjacentHTML('beforeend', awardTagHTML(text));
  input.value = '';
  input.focus();
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('avatar-status');
  status.classList.remove('hidden', 'text-red-600');
  status.classList.add('text-graphite/60');
  status.textContent = 'Загрузка...';
  try {
    const res = await api.agents.uploadAvatar(editingId, file);
    document.getElementById('avatar-preview').innerHTML = `<img src="${res.img}" class="w-full h-full object-cover" />`;
    formData.img = res.img;
    status.textContent = '✅ Фото обновлено';
    setTimeout(() => status.classList.add('hidden'), 1500);
  } catch (err) {
    status.classList.remove('text-graphite/60');
    status.classList.add('text-red-600');
    status.textContent = '❌ ' + err.message;
  } finally {
    e.target.value = '';
  }
}

async function handleSubmit(onClose) {
  const form = document.getElementById('agent-form');
  const fd = new FormData(form);

  const data = {
    name: fd.get('name')?.trim(),
    role: fd.get('role')?.trim(),
    specialization: fd.get('specialization')?.trim(),
    phone: fd.get('phone')?.trim(),
    awards: formData.awards,
    isTopMonth: fd.get('isTopMonth') === 'on',
  };

  if (!editingId) {
    data.withAccount = fd.get('withAccount') === 'on';
    if (data.withAccount) {
      data.password = fd.get('password');
    }
  }

  const errBox = document.getElementById('agent-form-error');
  errBox.classList.add('hidden');

  const submitBtn = document.getElementById('agent-form-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Сохранение...';

  try {
    if (editingId) {
      await api.agents.update(editingId, data);
    } else {
      await api.agents.create(data);
    }
    handleClose(onClose);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? 'Сохранить' : 'Создать';
  }
}

function handleClose(onClose) {
  document.getElementById('agent-form-overlay')?.remove();
  document.body.style.overflow = '';
  if (onClose) onClose();
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}