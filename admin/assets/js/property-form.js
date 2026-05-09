// Форма создания и редактирования объекта.
import { api } from './api.js';

let currentUser = null;
let editingId   = null;
let formData    = {};
let agentsList  = [];
let developersCache = [];
let complexesCache  = [];

const HOUSING_CLASSES = ['Эконом','Стандарт', 'Комфорт','Комфорт+', 'Бизнес', 'Премиум', 'Элит'];
const LABEL_COLORS = [
  { value: 'blue',   name: 'Синий',      bg: '#3B82F6', text: '#FFFFFF' },
  { value: 'yellow', name: 'Жёлтый',     bg: '#FACC15', text: '#1F2937' },
  { value: 'red',    name: 'Красный',    bg: '#EF4444', text: '#FFFFFF' },
  { value: 'green',  name: 'Зелёный',    bg: '#22C55E', text: '#FFFFFF' },
  { value: 'purple', name: 'Фиолетовый', bg: '#A855F7', text: '#FFFFFF' },
  { value: 'gray',   name: 'Серый',      bg: '#6B7280', text: '#FFFFFF' },
];
const BUILDING_TYPES  = ['Монолит', 'Монолитно-каркасный', 'Кирпичный', 'Панельный', 'Блочный', 'Деревянный'];
const CONDITIONS = [
  'Без отделки',
  'Черновая отделка',
  'Предчистовая отделка',
  'Косметический ремонт',
  'Хороший ремонт',
  'Дизайнерский ремонт',
  'Свободная планировка',
];

const PAYMENT_TYPES = [
  { value: 'any',      label: 'Любой (наличные или ипотека)' },
  { value: 'cash',     label: 'Только наличные' },
  { value: 'mortgage', label: 'Только ипотека' },
];
// ===== Главная функция =====
export async function openPropertyForm(user, id, onClose) {
  currentUser = user;
  editingId   = id || null;

  try {
    const [agentsResp, devsResp, complexesResp] = await Promise.all([
      api.agents.list(),
      api.developers.list(),
      api.complexes.list(),
    ]);
    agentsList       = agentsResp.agents || agentsResp.items || [];
    developersCache  = devsResp.items || [];
    complexesCache   = complexesResp.items || [];
  } catch (err) {
    alert('Не удалось загрузить справочники: ' + err.message);
    return;
  }

  if (editingId) {
    try {
      const p = await api.properties.get(editingId);
      formData = mapFromServer(p);
    } catch (err) {
      alert('Не удалось загрузить объект: ' + err.message);
      return;
    }
  } else {
    formData = {
      title:         '',
      type:          'Квартира',
      deal:          'sale',
      price:         '',
      district:      '',
      address:       '',
      sqm:           '',
      rooms:         '',
      floor:         '',
      totalFloors:   '',
      year:          new Date().getFullYear(),
      ceilingHeight: '',
      bathroom:      '',
      condition:     '',
      paymentType:   '',
      parking:       '',
      balcony:       '',
      description:   '',
      features:      [],
      gallery:       [],
      top:           false,
      active:        true,
      housingClass:         '',
      buildingType:         '',
      customLabels:         [],
      developerId:          null,
      residentialComplexId: null,
      agentId:       currentUser.role === 'agent' && currentUser.agent
        ? currentUser.agent.id
        : (agentsList[0]?.id || ''),
      videoUrl: '',
    };
  }

  renderForm(onClose);
}

function mapFromServer(p) {
  return {
    id:            p.id,
    title:         p.title,
    type:          p.type,
    deal:          p.deal,
    price:         p._priceNumeric || String(p.price || '').replace(/\s/g, ''),
    district:      p.district,
    address:       p.address,
    sqm:           p.sqm,
    rooms:         p.rooms || '',
    floor:         p.floor || '',
    totalFloors:   p.totalFloors,
    year:          p.year,
    ceilingHeight: p.ceilingHeight || '',
    bathroom:      p.bathroom || '',
    condition:     p.condition || '',
    paymentType:   p.paymentType || '',
    parking:       p.parking || '',
    balcony:       p.balcony || '',
    description:   p.description,
    features:      p.features || [],
    gallery:       p.gallery || [],
    top:           !!p.top,
    active:        p.active !== false,
    housingClass:         p.housingClass || '',
    buildingType:         p.buildingType || '',
    customLabels:         Array.isArray(p.customLabels) ? p.customLabels : [],
    developerId:          p.developerId          || null,
    residentialComplexId: p.residentialComplexId || null,
    agentId:       p.agentId,
    videoUrl:      p.videoUrl || '',
  };
}

function renderForm(onClose) {
  document.getElementById('property-form-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'property-form-overlay';
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
  const districts = ['Есильский р-н', 'Алматинский р-н', 'Сарыаркинский р-н',  'Байконыр','Нура','Сарайшык', 'Караоткель'];
  const types = ['Квартира', 'Новостройка', 'Дом', 'Коммерция'];
  const canChangeAgent = currentUser.role === 'admin';

  // Текущие выбранные застройщик/ЖК (для отображения значений в селекторах)
  const selectedDev     = developersCache.find(d => d.id === formData.developerId);
  const selectedComplex = complexesCache.find(c => c.id === formData.residentialComplexId);

  return `
    <div class="bg-white w-full max-w-3xl h-screen overflow-y-auto shadow-2xl">

      <!-- Header -->
      <div class="sticky top-0 bg-white z-10 px-8 py-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-graphite">${isEdit ? 'Редактировать объект' : 'Новый объект'}</h2>
          <p class="text-sm text-graphite/50 mt-0.5">${isEdit ? 'Обновите данные и сохраните изменения' : 'Заполните информацию о новом объекте'}</p>
        </div>
        <button id="form-close" class="p-2 hover:bg-gray-100 rounded-lg transition" title="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <form id="property-form" class="p-8 space-y-8">

        <!-- 1. Основное -->
        <section>
          <h3 class="form-section-title">Основное</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="form-label">Заголовок объявления *</label>
              <input name="title" required value="${esc(formData.title)}" class="admin-input" placeholder="3-комн. квартира в ЖК «Астана Тауэрс»" />
            </div>

            <div>
              <label class="form-label">Тип *</label>
              <select name="type" required class="admin-input">
                ${types.map(t => `<option ${t === formData.type ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="form-label">Сделка *</label>
              <div class="flex gap-2">
                <label class="flex-1 cursor-pointer">
                  <input type="radio" name="deal" value="sale" ${formData.deal === 'sale' ? 'checked' : ''} class="sr-only peer" />
                  <div class="px-4 py-2.5 text-sm text-center border border-gray-300 rounded-lg peer-checked:bg-primary-700 peer-checked:text-white peer-checked:border-primary-700 transition">Продажа</div>
                </label>
                <label class="flex-1 cursor-pointer">
                  <input type="radio" name="deal" value="rent" ${formData.deal === 'rent' ? 'checked' : ''} class="sr-only peer" />
                  <div class="px-4 py-2.5 text-sm text-center border border-gray-300 rounded-lg peer-checked:bg-primary-700 peer-checked:text-white peer-checked:border-primary-700 transition">Аренда</div>
                </label>
              </div>
            </div>

            <div>
              <label class="form-label">Цена, ₸ *</label>
              <input name="price" required type="text" value="${formatPriceForInput(formData.price)}" class="admin-input" placeholder="93 400 000" data-price-input />
              <div class="text-xs text-graphite/50 mt-1" id="price-hint"></div>
            </div>

            ${canChangeAgent ? `
              <div>
                <label class="form-label">Агент *</label>
                <select name="agentId" required class="admin-input">
                  ${agentsList.map(a => `<option value="${a.id}" ${a.id === formData.agentId ? 'selected' : ''}>${a.name}</option>`).join('')}
                </select>
              </div>
            ` : `<input type="hidden" name="agentId" value="${formData.agentId}" />`}

            <div class="col-span-2 flex items-center gap-6 mt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="top" ${formData.top ? 'checked' : ''} class="form-checkbox" />
                <span class="text-sm text-graphite">⭐ TOP Krisha</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="active" ${formData.active ? 'checked' : ''} class="form-checkbox" />
                <span class="text-sm text-graphite">Опубликован на сайте</span>
              </label>
            </div>
          </div>
        </section>

        <!-- 2. Застройщик и ЖК -->
        <section>
          <h3 class="form-section-title">Застройщик и жилой комплекс</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">Застройщик</label>
              <div class="combo-input-wrap">
                <input id="dev-input" type="text" class="admin-input" placeholder="Начните вводить или оставьте пустым..."
                  value="${esc(selectedDev ? selectedDev.name : '')}"
                  data-id="${selectedDev ? selectedDev.id : ''}" autocomplete="off" />
                <div id="dev-dropdown" class="combo-dropdown hidden"></div>
              </div>
              <div class="text-xs text-graphite/50 mt-1">Например: BI Group, BAZIS, Mega Astana</div>
            </div>

            <div>
              <label class="form-label">Жилой комплекс</label>
              <div class="combo-input-wrap">
                <input id="complex-input" type="text" class="admin-input" placeholder="Начните вводить или оставьте пустым..."
                  value="${esc(selectedComplex ? selectedComplex.name : '')}"
                  data-id="${selectedComplex ? selectedComplex.id : ''}" autocomplete="off" />
                <div id="complex-dropdown" class="combo-dropdown hidden"></div>
              </div>
              <div class="text-xs text-graphite/50 mt-1">Например: Astana Tower, Expo Village</div>
            </div>
          </div>
        </section>

        <!-- 3. Адрес и площадь -->
        <section>
          <h3 class="form-section-title">Адрес и площадь</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">Район *</label>
              <select name="district" required class="admin-input">
                <option value="">— выберите —</option>
                ${districts.map(d => `<option ${d === formData.district ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="form-label">Адрес *</label>
              <input name="address" required value="${esc(formData.address)}" class="admin-input" placeholder="ул. Достык, 5" />
            </div>

            <div>
              <label class="form-label">Площадь, м² *</label>
              <input name="sqm" required type="number" step="0.1" value="${formData.sqm}" class="admin-input" placeholder="112" />
            </div>

            <div>
              <label class="form-label">Комнат</label>
              <input name="rooms" type="number" value="${formData.rooms}" class="admin-input" placeholder="3" />
              <div class="text-xs text-graphite/50 mt-1">0 для коммерции</div>
            </div>

            <div>
              <label class="form-label">Этаж</label>
              <input name="floor" type="number" value="${formData.floor}" class="admin-input" placeholder="15" />
            </div>

            <div>
              <label class="form-label">Этажей в доме *</label>
              <input name="totalFloors" required type="number" value="${formData.totalFloors}" class="admin-input" placeholder="22" />
            </div>

            <div>
              <label class="form-label">Год постройки *</label>
              <input name="year" required type="number" min="1900" max="2030" value="${formData.year}" class="admin-input" placeholder="2021" />
            </div>
          </div>
        </section>

        <!-- 4. Класс и тип дома -->
        <section>
          <h3 class="form-section-title">Класс жилья и материалы</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">Класс жилья</label>
              <select name="housingClass" class="admin-input">
                <option value="">— не указан —</option>
                ${HOUSING_CLASSES.map(c => `<option ${c === formData.housingClass ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="form-label">Тип дома</label>
              <select name="buildingType" class="admin-input">
                <option value="">— не указан —</option>
                ${BUILDING_TYPES.map(t => `<option ${t === formData.buildingType ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
        </section>

        <!-- 5. Характеристики -->
        <section>
          <h3 class="form-section-title">Характеристики</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">Высота потолков, м</label>
              <input name="ceilingHeight" type="number" step="0.1" value="${formData.ceilingHeight}" class="admin-input" placeholder="3.1" />
            </div>

            <div>
              <label class="form-label">Санузел</label>
              <input name="bathroom" value="${esc(formData.bathroom)}" class="admin-input" placeholder="2 с/у" />
            </div>
            <div>
              <label class="form-label">Состояние</label>
              <select name="condition" class="admin-input">
                <option value="">— не указано —</option>
                ${CONDITIONS.map(c => `<option ${c === formData.condition ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">Вид оплаты</label>
              <select name="paymentType" class="admin-input">
                <option value="">— не указано —</option>
                ${PAYMENT_TYPES.map(pt => `<option value="${pt.value}" ${pt.value === formData.paymentType ? 'selected' : ''}>${pt.label}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="form-label">Паркинг</label>
              <input name="parking" value="${esc(formData.parking)}" class="admin-input" placeholder="Подземный паркинг" />
            </div>

            <div class="col-span-2">
              <label class="form-label">Балкон</label>
              <input name="balcony" value="${esc(formData.balcony)}" class="admin-input" placeholder="Лоджия, 6 м²" />
            </div>
          </div>
        </section>

        <!-- Кастомные лейблы -->
        <section>
          <h3 class="form-section-title">Лейблы на карточке</h3>
          <div class="text-xs text-graphite/50 mb-3">До 2 цветных бейджиков, которые показываются на фото объекта в каталоге. Например: «Готовый дом», «Комиссия 0%», «Срочно».</div>
          <div id="custom-labels-list" class="space-y-3"></div>
          <button type="button" id="add-label-btn" class="mt-3 text-sm text-primary-700 hover:text-primary-800 font-medium">+ Добавить лейбл</button>
        </section>

        <!-- 6. Описание -->
        <section>
          <h3 class="form-section-title">Описание</h3>
          <textarea name="description" required rows="6" class="admin-input" placeholder="Расскажите подробно об объекте...">${esc(formData.description)}</textarea>
        </section>
        <!-- Видео-обзор -->
        <section>
          <h3 class="form-section-title">Видео-обзор</h3>
          <div class="text-xs text-graphite/50 mb-3">Ссылка на видео объекта (YouTube, Instagram, любой другой источник). На карточке появится кнопка «Смотреть видео».</div>
          <input
            name="videoUrl"
            type="url"
            value="${esc(formData.videoUrl)}"
            class="admin-input"
            placeholder="https://youtu.be/abc123 или https://instagram.com/p/..."
            maxlength="500"
          />
        </section>

        <!-- 7. Особенности -->
        <section>
          <h3 class="form-section-title">Ключевые особенности</h3>
          <div class="text-xs text-graphite/50 mb-3">Например: «Панорамный вид», «Мебель в подарок».</div>
          <div id="features-list" class="flex flex-wrap gap-2 mb-3">
            ${formData.features.map(f => featureTagHTML(f)).join('')}
          </div>
          <div class="flex gap-2">
            <input id="feature-input" type="text" class="admin-input flex-1" placeholder="Добавить особенность и нажать Enter" />
            <button type="button" id="feature-add-btn" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">Добавить</button>
          </div>
        </section>

        <!-- 8. Фото -->
        <section>
          <h3 class="form-section-title">Фотографии</h3>
          ${editingId ? `
            <div class="text-xs text-graphite/50 mb-3">Перетаскивайте превью, чтобы изменить порядок. Первое фото — главное.</div>
            <div id="gallery-grid" class="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4"></div>
            <label class="block">
              <input id="photo-input" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden" />
              <div class="border-2 border-dashed border-gray-300 hover:border-primary-500 rounded-lg p-8 text-center cursor-pointer transition">
                <div class="text-3xl mb-2">📷</div>
                <div class="text-sm font-medium text-graphite">Загрузить фотографии</div>
                <div class="text-xs text-graphite/50 mt-1">JPEG, PNG, WEBP · до 15 МБ · до 20 за раз</div>
              </div>
            </label>
            <div id="upload-status" class="text-sm text-graphite/60 mt-2 hidden"></div>
          ` : `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-graphite/60">
              Сначала сохраните объект — после этого появится возможность загрузить фотографии.
            </div>
          `}
        </section>
      </form>

      <!-- Footer -->
      <div class="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-between">
        <div id="form-error" class="text-sm text-red-600 hidden"></div>
        <div class="ml-auto flex gap-3">
          <button type="button" id="form-cancel" class="px-5 py-2.5 text-graphite hover:bg-gray-100 rounded-lg transition">Отмена</button>
          <button type="button" id="form-submit" class="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition">
            ${isEdit ? 'Сохранить изменения' : 'Создать объект'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function featureTagHTML(text) {
  return `
    <span class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-primary-50 text-primary-800 text-sm rounded-full" data-feature="${esc(text)}">
      ${esc(text)}
      <button type="button" class="feature-remove w-5 h-5 hover:bg-primary-200 rounded-full flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `;
}

function galleryThumbHTML(url) {
  return `
    <div class="relative group aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 bg-gray-100" draggable="true" data-url="${esc(url)}">
      <img src="${url}" class="w-full h-full object-cover pointer-events-none" />
      <button type="button" class="photo-delete absolute top-1.5 right-1.5 w-7 h-7 bg-white/90 hover:bg-red-50 hover:text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition" title="Удалить фото">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  `;
}

// ===== Combo (поиск с автодополнением) =====
function setupCombo({ inputId, dropdownId, getItems, onSelect, onCreate, createLabel }) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  function rerender() {
    const q = input.value.trim().toLowerCase();
    const all = getItems();
    const matches = q ? all.filter(i => i.name.toLowerCase().includes(q)) : all;

    let html = '';
    if (matches.length) {
      html += matches.slice(0, 10).map(i => `
        <div class="combo-item" data-id="${i.id}">${esc(i.name)}${i.developer ? `<span class="text-xs text-graphite/50 ml-2">${esc(i.developer.name)}</span>` : ''}</div>
      `).join('');
    } else {
      html += `<div class="combo-item-empty">Ничего не найдено</div>`;
    }

    if (q && !all.some(i => i.name.toLowerCase() === q)) {
      html += `<div class="combo-item combo-item-create" data-create="1"><span class="text-primary-700">+ ${createLabel}: «${esc(input.value.trim())}»</span></div>`;
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
  }

  input.addEventListener('focus', rerender);
  input.addEventListener('input', rerender);

  // Закрытие при клике вне
  document.addEventListener('click', (e) => {
    if (e.target !== input && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  dropdown.addEventListener('click', async (e) => {
    const item = e.target.closest('.combo-item');
    if (!item) return;
    if (item.dataset.create === '1') {
      const name = input.value.trim();
      if (!name) return;
      try {
        const created = await onCreate(name);
        input.value = created.name;
        input.dataset.id = created.id;
        dropdown.classList.add('hidden');
      } catch (err) {
        alert('Ошибка: ' + err.message);
      }
    } else {
      const id = item.dataset.id;
      const found = getItems().find(i => String(i.id) === id);
      if (found) {
        input.value = found.name;
        input.dataset.id = found.id;
        if (onSelect) onSelect(found);
      }
      dropdown.classList.add('hidden');
    }
  });

  // Если очистили инпут — сбрасываем выбор
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!input.value.trim()) {
        input.dataset.id = '';
      }
    }, 200);
  });
}

// ===== Обработчики =====
function attachHandlers(onClose) {
  document.getElementById('form-close').addEventListener('click', () => handleClose(onClose));
  document.getElementById('form-cancel').addEventListener('click', () => handleClose(onClose));
  document.getElementById('form-submit').addEventListener('click', () => handleSubmit(onClose));

  // Цена
  const priceInput = document.querySelector('[data-price-input]');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      const digits = priceInput.value.replace(/\D/g, '');
      priceInput.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      updatePriceHint(digits);
    });
    updatePriceHint(String(formData.price || ''));
    // Кастомные лейблы
  renderLabels();
  document.getElementById('add-label-btn')?.addEventListener('click', () => {
    if (formData.customLabels.length >= 2) {
      alert('Максимум 2 лейбла');
      return;
    }
    formData.customLabels.push({ text: '', color: 'blue' });
    renderLabels();
  });
  }

  // Особенности
  document.getElementById('feature-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFeature(); }
  });
  document.getElementById('feature-add-btn')?.addEventListener('click', addFeature);
  document.getElementById('features-list').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.feature-remove');
    if (!removeBtn) return;
    const tag = removeBtn.closest('[data-feature]');
    formData.features = formData.features.filter(f => f !== tag.dataset.feature);
    tag.remove();
  });

  // Combo: застройщик
  setupCombo({
    inputId: 'dev-input',
    dropdownId: 'dev-dropdown',
    getItems: () => developersCache,
    createLabel: 'Добавить застройщика',
    onCreate: async (name) => {
      const created = await api.developers.create(name);
      developersCache.push({ id: created.id, name: created.name, propertiesCount: 0, complexesCount: 0 });
      developersCache.sort((a, b) => a.name.localeCompare(b.name));
      return created;
    },
    onSelect: () => {},
  });

  // Combo: ЖК
  setupCombo({
    inputId: 'complex-input',
    dropdownId: 'complex-dropdown',
    getItems: () => complexesCache,
    createLabel: 'Добавить ЖК',
    onCreate: async (name) => {
      // Если выбран застройщик — привязываем ЖК к нему
      const devInput = document.getElementById('dev-input');
      const developerId = devInput && devInput.dataset.id ? parseInt(devInput.dataset.id, 10) : null;
      const created = await api.complexes.create(name, developerId);
      complexesCache.push({
        id: created.id,
        name: created.name,
        developer: created.developer,
        developerId: created.developerId,
        propertiesCount: 0,
      });
      complexesCache.sort((a, b) => a.name.localeCompare(b.name));
      return created;
    },
    onSelect: () => {},
  });

  // Фото — только в режиме редактирования
  if (editingId) {
    renderGallery();
    document.getElementById('photo-input')?.addEventListener('change', handlePhotoUpload);
  }
}

function addFeature() {
  const input = document.getElementById('feature-input');
  const text = input.value.trim();
  if (!text || formData.features.includes(text)) {
    input.value = '';
    return;
  }
  formData.features.push(text);
  document.getElementById('features-list').insertAdjacentHTML('beforeend', featureTagHTML(text));
  input.value = '';
  input.focus();
}
function renderLabels() {
  const list = document.getElementById('custom-labels-list');
  if (!list) return;

  if (formData.customLabels.length === 0) {
    list.innerHTML = '<div class="text-xs text-graphite/40 italic py-2">Лейблов пока нет</div>';
    return;
  }

  list.innerHTML = formData.customLabels.map((label, idx) => {
    const color = LABEL_COLORS.find(c => c.value === label.color) || LABEL_COLORS[0];
    return `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider" style="background:${color.bg};color:${color.text}">
          ${esc(label.text || 'Превью')}
        </span>
        <input type="text" value="${esc(label.text)}" maxlength="30" placeholder="Текст лейбла" class="flex-1 admin-input" data-label-text="${idx}" />
        <select class="admin-input w-40" data-label-color="${idx}">
          ${LABEL_COLORS.map(c => `<option value="${c.value}" ${c.value === label.color ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <button type="button" class="p-2 text-red-600 hover:bg-red-50 rounded transition" data-label-remove="${idx}" title="Удалить">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-label-text]').forEach(input => {
    input.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.labelText, 10);
      formData.customLabels[idx].text = e.target.value;
      // обновим только превью, не перерисовывая всё (чтобы фокус не терялся)
      const tag = e.target.previousElementSibling;
      if (tag) tag.textContent = e.target.value || 'Превью';
    });
  });

  list.querySelectorAll('[data-label-color]').forEach(sel => {
    sel.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.labelColor, 10);
      formData.customLabels[idx].color = e.target.value;
      renderLabels();
    });
  });

  list.querySelectorAll('[data-label-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.labelRemove, 10);
      formData.customLabels.splice(idx, 1);
      renderLabels();
    });
  });
}

function updatePriceHint(digits) {
  const hint = document.getElementById('price-hint');
  if (!hint) return;
  if (!digits) { hint.textContent = ''; return; }
  const num = parseInt(digits, 10);
  if (isNaN(num)) { hint.textContent = ''; return; }
  if (num >= 1_000_000) {
    const mln = (num / 1_000_000).toFixed(2).replace(/\.?0+$/, '');
    hint.textContent = `≈ ${mln} млн ₸`;
  } else if (num >= 1000) {
    hint.textContent = `${(num / 1000).toFixed(0)} тыс ₸`;
  }
}

// ===== Галерея =====
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  if (formData.gallery.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-sm text-graphite/40">Фотографий пока нет</div>`;
    return;
  }
  grid.innerHTML = formData.gallery.map(galleryThumbHTML).join('');

  let dragSrc = null;
  grid.querySelectorAll('[draggable]').forEach(el => {
    el.addEventListener('dragstart', () => { dragSrc = el; el.classList.add('opacity-50'); });
    el.addEventListener('dragend', () => { el.classList.remove('opacity-50'); dragSrc = null; });
    el.addEventListener('dragover', (e) => { e.preventDefault(); });
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === el) return;
      const fromUrl = dragSrc.dataset.url;
      const toUrl = el.dataset.url;
      const fromIdx = formData.gallery.indexOf(fromUrl);
      const toIdx = formData.gallery.indexOf(toUrl);
      formData.gallery.splice(fromIdx, 1);
      formData.gallery.splice(toIdx, 0, fromUrl);
      renderGallery();
      try {
        await api.properties.reorderPhotos(editingId, formData.gallery);
      } catch (err) {
        alert('Не удалось сохранить порядок: ' + err.message);
      }
    });
  });

  grid.querySelectorAll('.photo-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.closest('[data-url]').dataset.url;
      if (!confirm('Удалить это фото?')) return;
      try {
        const res = await api.properties.deletePhoto(editingId, url);
        formData.gallery = res.gallery;
        renderGallery();
      } catch (err) {
        alert('Ошибка: ' + err.message);
      }
    });
  });
}

async function handlePhotoUpload(e) {
  const files = [...e.target.files];
  if (files.length === 0) return;
  const status = document.getElementById('upload-status');
  status.classList.remove('hidden');
  status.textContent = `Загружаем ${files.length} фото...`;
  try {
    const res = await api.properties.uploadPhotos(editingId, files);
    formData.gallery = res.gallery;
    status.textContent = `✅ Загружено: ${res.added.length}`;
    setTimeout(() => status.classList.add('hidden'), 2000);
    renderGallery();
  } catch (err) {
    status.textContent = '❌ ' + err.message;
    status.classList.add('text-red-600');
  } finally {
    e.target.value = '';
  }
}

// ===== Сохранение =====
async function handleSubmit(onClose) {
  const form = document.getElementById('property-form');
  const fd = new FormData(form);

  const devInput     = document.getElementById('dev-input');
  const complexInput = document.getElementById('complex-input');

  // Если в combo есть текст, но не выбран существующий и не нажата опция «создать» —
  // создаём автоматически при сохранении
  let developerId = devInput.dataset.id ? parseInt(devInput.dataset.id, 10) : null;
  if (!developerId && devInput.value.trim()) {
    try {
      const created = await api.developers.create(devInput.value.trim());
      developerId = created.id;
    } catch (err) {
      showError('Не удалось создать застройщика: ' + err.message);
      return;
    }
  }

  let residentialComplexId = complexInput.dataset.id ? parseInt(complexInput.dataset.id, 10) : null;
  if (!residentialComplexId && complexInput.value.trim()) {
    try {
      const created = await api.complexes.create(complexInput.value.trim(), developerId);
      residentialComplexId = created.id;
    } catch (err) {
      showError('Не удалось создать ЖК: ' + err.message);
      return;
    }
  }

  const data = {
    title:         fd.get('title')?.trim(),
    type:          fd.get('type'),
    deal:          fd.get('deal'),
    price:         fd.get('price')?.replace(/\s/g, ''),
    district:      fd.get('district'),
    address:       fd.get('address')?.trim(),
    sqm:           fd.get('sqm'),
    rooms:         fd.get('rooms') || 0,
    floor:         fd.get('floor') || null,
    totalFloors:   fd.get('totalFloors'),
    year:          fd.get('year'),
    ceilingHeight: fd.get('ceilingHeight') || null,
    bathroom:      fd.get('bathroom')?.trim() || null,
    condition:     fd.get('condition') || null,
    paymentType:   fd.get('paymentType') || null,
    parking:       fd.get('parking')?.trim() || null,
    balcony:       fd.get('balcony')?.trim() || null,
    description:   fd.get('description')?.trim(),
    features:      formData.features,
    top:           fd.get('top') === 'on',
    active:        fd.get('active') === 'on',
    agentId:       fd.get('agentId'),
    housingClass:  fd.get('housingClass') || null,
    buildingType:  fd.get('buildingType') || null,
    customLabels:  formData.customLabels.filter(l => l.text && l.text.trim()),
    developerId,
    residentialComplexId,
    videoUrl: fd.get('videoUrl')?.trim() || null,
  };

  const submitBtn = document.getElementById('form-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Сохранение...';

  try {
    if (editingId) {
      await api.properties.update(editingId, data);
    } else {
      const created = await api.properties.create(data);
      handleClose(onClose);
      setTimeout(() => openPropertyForm(currentUser, created.id, onClose), 100);
      return;
    }
    handleClose(onClose);
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? 'Сохранить изменения' : 'Создать объект';
  }
}

function showError(msg) {
  const errBox = document.getElementById('form-error');
  errBox.textContent = msg;
  errBox.classList.remove('hidden');
}

function handleClose(onClose) {
  document.getElementById('property-form-overlay')?.remove();
  document.body.style.overflow = '';
  if (onClose) onClose();
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPriceForInput(price) {
  if (!price) return '';
  const digits = String(price).replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}