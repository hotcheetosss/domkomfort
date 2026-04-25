// Модуль объектов: загрузка каталога, фильтры, детальная страница.
import { api } from './api.js';
import { agents } from './agents.js';

export let allProperties = [];
let loaded = false;

// Состояние всех фильтров — одно место истины
const filterState = {
  category: 'all',        // из чипсов: all / Квартира / Новостройка / Дом / Коммерция / rent
  rooms: 'any',           // any / '1' / '2' / '3' / '4+'
  district: '',
  priceMin: null,
  priceMax: null,
  sqmMin: null,
  sqmMax: null,
  sort: 'default',
};

// Парсим "93 400 000" -> 93400000
function parsePrice(str) {
  return parseInt(String(str).replace(/\s/g, ''), 10) || 0;
}

export async function loadProperties() {
  if (loaded) return;
  try {
    const resp = await api.properties.list();
    allProperties = resp.items || [];
    loaded = true;
  } catch (e) {
    console.error('Не удалось загрузить объекты:', e);
  }
}

export function propCardHTML(p) {
  return `
    <a href="#" onclick="openProperty('${p.id}'); return false;" class="premium-card overflow-hidden group block fade-up">
      <div class="aspect-[4/3] overflow-hidden relative">
        <img src="${p.gallery[0]}" alt="${p.title}" class="w-full h-full object-cover prop-img"/>
        ${p.top ? '<div class="absolute top-4 left-4 krisha-badge text-primary-900 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-semibold">TOP</div>' : ''}
        ${p.deal === 'rent' ? '<div class="absolute top-4 right-4 bg-primary-600 text-white text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-medium">Аренда</div>' : ''}
        <div class="absolute bottom-4 left-4 bg-white/95 backdrop-blur text-primary-900 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-semibold">${p.type}</div>
      </div>
      <div class="p-6">
        <div class="text-xs uppercase tracking-[0.15em] text-graphite/50 mb-2">${p.district} · ${p.sqm} м² · ${p.floor ? p.floor + '/' + p.totalFloors : p.totalFloors + ' эт.'}</div>
        <h3 class="font-display text-xl text-primary-900 font-medium leading-tight mb-4">${p.title}</h3>
        <div class="flex items-end justify-between pt-4 border-t border-primary-900/5">
          <div>
            <div class="font-display text-3xl text-primary-700 font-medium leading-none">${p.price}<span class="text-lg"> ₸${p.deal === 'rent' ? '/мес' : ''}</span></div>
            <div class="text-xs text-graphite/50 mt-1">${p.rooms ? p.rooms + '-комн.' : p.type}</div>
          </div>
          <span class="w-10 h-10 rounded-full bg-primary-900 group-hover:bg-primary-600 flex items-center justify-center transition text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    </a>
  `;
}

export function renderProperties() {
  const grid = document.getElementById('properties-grid');
  const empty = document.getElementById('properties-empty');
  const count = document.getElementById('properties-count');
  if (!grid) return;

  let filtered = [...allProperties];

  // 1. Категория (чипсы)
  if (filterState.category === 'rent') {
    filtered = filtered.filter(p => p.deal === 'rent');
  } else if (filterState.category !== 'all') {
    filtered = filtered.filter(p => p.type === filterState.category);
  }

  // 2. Комнаты
  if (filterState.rooms !== 'any') {
    if (filterState.rooms === '4+') {
      filtered = filtered.filter(p => p.rooms >= 4);
    } else {
      filtered = filtered.filter(p => p.rooms === parseInt(filterState.rooms, 10));
    }
  }

  // 3. Район
  if (filterState.district) {
    filtered = filtered.filter(p => p.district === filterState.district);
  }

  // 4. Цена
  if (filterState.priceMin !== null) {
    filtered = filtered.filter(p => parsePrice(p.price) >= filterState.priceMin);
  }
  if (filterState.priceMax !== null) {
    filtered = filtered.filter(p => parsePrice(p.price) <= filterState.priceMax);
  }

  // 5. Площадь
  if (filterState.sqmMin !== null) {
    filtered = filtered.filter(p => p.sqm >= filterState.sqmMin);
  }
  if (filterState.sqmMax !== null) {
    filtered = filtered.filter(p => p.sqm <= filterState.sqmMax);
  }

  // 6. Сортировка
  switch (filterState.sort) {
    case 'price-asc':  filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price)); break;
    case 'price-desc': filtered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price)); break;
    case 'sqm-desc':   filtered.sort((a, b) => b.sqm - a.sqm); break;
    case 'year-desc':  filtered.sort((a, b) => (b.year || 0) - (a.year || 0)); break;
  }

  count.textContent = filtered.length;
  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(propCardHTML).join('');
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
      }, { threshold: 0.1 });
      grid.querySelectorAll('.fade-up').forEach(el => io.observe(el));
    }
  }

  document.querySelectorAll('#properties-filters .filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterState.category);
  });
  document.querySelectorAll('#filter-rooms .mini-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.rooms === filterState.rooms);
  });

  updateResetButton();
}

function updateResetButton() {
  const reset = document.getElementById('filters-reset');
  if (!reset) return;
  const isDefault = (
    filterState.category === 'all' &&
    filterState.rooms === 'any' &&
    !filterState.district &&
    filterState.priceMin === null && filterState.priceMax === null &&
    filterState.sqmMin === null && filterState.sqmMax === null &&
    filterState.sort === 'default'
  );
  reset.classList.toggle('hidden', isDefault);
}

export function initPropertyFilters() {
  const bar = document.getElementById('properties-filters');
  if (!bar || bar.dataset.init) return;
  bar.dataset.init = '1';

  // Чипсы-категории
  bar.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      filterState.category = btn.dataset.filter;
      renderProperties();
    });
  });

  // Чипсы «комнаты»
  document.querySelectorAll('#filter-rooms .mini-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      filterState.rooms = btn.dataset.rooms;
      renderProperties();
    });
  });

  document.getElementById('filter-district')?.addEventListener('change', e => {
    filterState.district = e.target.value;
    renderProperties();
  });
  document.getElementById('filter-sort')?.addEventListener('change', e => {
    filterState.sort = e.target.value;
    renderProperties();
  });

  const numericInputs = [
    ['filter-price-min', 'priceMin'],
    ['filter-price-max', 'priceMax'],
    ['filter-sqm-min',   'sqmMin'],
    ['filter-sqm-max',   'sqmMax'],
  ];
  numericInputs.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const v = el.value.trim();
      filterState[key] = v === '' ? null : parseInt(v, 10);
      renderProperties();
    });
  });
}

export function toggleAdvancedFilters() {
  const panel = document.getElementById('advanced-filters');
  const chevron = document.getElementById('filters-chevron');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

export function applyFilters() {
  renderProperties();
  const grid = document.getElementById('properties-grid');
  if (grid) window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
}

export function resetFilters() {
  filterState.category = 'all';
  filterState.rooms = 'any';
  filterState.district = '';
  filterState.priceMin = null;
  filterState.priceMax = null;
  filterState.sqmMin = null;
  filterState.sqmMax = null;
  filterState.sort = 'default';

  ['filter-price-min', 'filter-price-max', 'filter-sqm-min', 'filter-sqm-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const dist = document.getElementById('filter-district');
  if (dist) dist.value = '';
  const sort = document.getElementById('filter-sort');
  if (sort) sort.value = 'default';

  renderProperties();
}

export function openProperty(id) {
  const p = allProperties.find(x => x.id === id);
  if (!p) return;
  const agent = agents.find(a => a.id === p.agentId);
  const similar = allProperties
    .filter(x => x.id !== p.id && (x.type === p.type || x.district === p.district))
    .slice(0, 3);

  const container = document.getElementById('property-detail-content');
  container.innerHTML = `
    <section class="pb-16 bg-ivory">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div class="grid lg:grid-cols-[1.5fr_1fr] gap-8 lg:gap-12">
          <div>
            <div class="aspect-[16/11] overflow-hidden rounded-lg bg-primary-100 mb-4 relative">
              <img id="gallery-main" src="${p.gallery[0]}" alt="${p.title}" class="w-full h-full object-cover transition-opacity duration-300"/>
              <div class="absolute top-5 left-5 flex gap-2">
                ${p.top ? '<div class="krisha-badge text-primary-900 text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-full font-semibold">TOP Krisha</div>' : ''}
                ${p.deal === 'rent' ? '<div class="bg-primary-600 text-white text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-full font-medium">Аренда</div>' : ''}
                <div class="bg-white/95 backdrop-blur text-primary-900 text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-full font-semibold">${p.type}</div>
              </div>
            </div>
            <div class="grid grid-cols-${Math.min(p.gallery.length, 5)} gap-3">
              ${p.gallery.map((img, i) => `
                <div class="aspect-[4/3] overflow-hidden rounded gallery-thumb ${i === 0 ? 'active' : ''}" onclick="switchGallery(this, '${img}')">
                  <img src="${img}" alt="" class="w-full h-full object-cover"/>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="lg:sticky lg:top-32 self-start">
            <div class="text-xs uppercase tracking-[0.25em] text-primary-600 mb-3">${p.district}</div>
            <h1 class="font-display text-3xl lg:text-5xl text-primary-900 font-light leading-[1.05] mb-6">${p.title}</h1>
            <div class="flex items-baseline gap-2 mb-4">
              <span class="font-display text-5xl text-primary-700 font-medium">${p.price}</span>
              <span class="font-display text-2xl text-primary-700">₸${p.deal === 'rent' ? '/мес' : ''}</span>
            </div>
            ${p.deal !== 'rent' ? `<div class="text-sm text-graphite/50 mb-8">≈ ${Math.round(parseInt(p.price.replace(/\s/g, '')) / p.sqm).toLocaleString('ru-RU')} ₸ за м²</div>` : '<div class="mb-8"></div>'}

            <div class="grid grid-cols-3 gap-4 mb-8 pb-8 border-b border-primary-900/10">
              <div>
                <div class="font-display text-3xl text-primary-900 font-light">${p.sqm}</div>
                <div class="text-[11px] uppercase tracking-[0.15em] text-graphite/50 mt-1">м²</div>
              </div>
              <div>
                <div class="font-display text-3xl text-primary-900 font-light">${p.rooms || '—'}</div>
                <div class="text-[11px] uppercase tracking-[0.15em] text-graphite/50 mt-1">${p.rooms ? 'комнат' : p.type}</div>
              </div>
              <div>
                <div class="font-display text-3xl text-primary-900 font-light">${p.floor || '—'}${p.floor ? '/' + p.totalFloors : ''}</div>
                <div class="text-[11px] uppercase tracking-[0.15em] text-graphite/50 mt-1">этаж</div>
              </div>
            </div>

            <div class="flex items-start gap-3 mb-8 text-sm text-graphite/70">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary-600 mt-0.5 flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${p.address}</span>
            </div>

            <div class="flex flex-col gap-3">
              <a href="https://wa.me/${(agent && agent.phone ? agent.phone : '77085050826').replace(/[^0-9]/g,'')}?text=${encodeURIComponent('Здравствуйте! Интересует объект: ' + p.title + ' (' + p.price + ' ₸)')}" target="_blank" class="btn-wa justify-center">Написать в WhatsApp</a>
              <a href="tel:${(agent && agent.phone ? agent.phone : '+77085050826')}" class="btn-primary justify-center">Записаться на просмотр</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-16 lg:py-24 bg-cream">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-16">
        <div>
          <div class="section-label">Об объекте</div>
          <h2 class="font-display text-3xl lg:text-4xl text-primary-900 font-light leading-[1.15] mb-8">${p.description.split('.')[0]}.</h2>
          <p class="text-graphite/75 font-light leading-relaxed text-lg mb-10">${p.description}</p>
          <div class="text-xs uppercase tracking-[0.2em] text-primary-600 mb-4">Ключевые особенности</div>
          <div class="flex flex-wrap gap-2">
            ${p.features.map(f => `<span class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-primary-900/10 rounded-full text-sm text-graphite"><span class="w-1.5 h-1.5 rounded-full bg-primary-600"></span>${f}</span>`).join('')}
          </div>
        </div>
        <div class="bg-white rounded-lg p-8 premium-card self-start">
          <div class="text-xs uppercase tracking-[0.2em] text-primary-600 mb-6">Характеристики</div>
          <div>
            <div class="spec-row"><span class="spec-label">Тип</span><span class="spec-value">${p.type}</span></div>
            <div class="spec-row"><span class="spec-label">Площадь</span><span class="spec-value">${p.sqm} м²</span></div>
            ${p.rooms ? `<div class="spec-row"><span class="spec-label">Комнат</span><span class="spec-value">${p.rooms}</span></div>` : ''}
            ${p.floor ? `<div class="spec-row"><span class="spec-label">Этаж</span><span class="spec-value">${p.floor} из ${p.totalFloors}</span></div>` : `<div class="spec-row"><span class="spec-label">Этажность</span><span class="spec-value">${p.totalFloors} эт.</span></div>`}
            <div class="spec-row"><span class="spec-label">Год постройки</span><span class="spec-value">${p.year}</span></div>
            <div class="spec-row"><span class="spec-label">Высота потолков</span><span class="spec-value">${p.ceilingHeight} м</span></div>
            <div class="spec-row"><span class="spec-label">Санузел</span><span class="spec-value">${p.bathroom}</span></div>
            <div class="spec-row"><span class="spec-label">Состояние</span><span class="spec-value">${p.condition}</span></div>
            <div class="spec-row"><span class="spec-label">Паркинг</span><span class="spec-value">${p.parking}</span></div>
            <div class="spec-row"><span class="spec-label">Балкон</span><span class="spec-value">${p.balcony}</span></div>
            <div class="spec-row"><span class="spec-label">Район</span><span class="spec-value">${p.district}</span></div>
          </div>
        </div>
      </div>
    </section>

    ${agent ? `
    <section class="py-16 lg:py-20 bg-primary-900 text-white">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div class="text-primary-300 text-xs uppercase tracking-[0.3em] mb-4">Ведёт объект</div>
        <div class="grid lg:grid-cols-[auto_1fr_auto] gap-8 items-center">
          <div class="flex items-center gap-5">
            <div class="w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
              <img src="${agent.img}" alt="${agent.name}" class="w-full h-full object-cover"/>
            </div>
            <div>
              <div class="font-display text-2xl lg:text-3xl font-light">${agent.name}</div>
              <div class="text-white/60 text-sm mt-1">${agent.role}</div>
            </div>
          </div>
          <div class="text-white/70 font-light max-w-lg">${agent.specialization}. Ведёт ${agent.listings} активных объектов. На связи 24/7.</div>
          <div class="flex gap-3">
            <a href="#" onclick="openAgent('${agent.id}'); return false;" class="btn-ghost" style="color:#fff;border-color:rgba(255,255,255,0.25)">Профиль агента</a>
          </div>
        </div>
      </div>
    </section>
    ` : ''}

    ${similar.length ? `
    <section class="py-16 lg:py-24 bg-ivory">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div class="section-label">Похожие объекты</div>
        <h2 class="font-display text-3xl lg:text-4xl text-primary-900 font-light mb-12">Возможно, вам подойдёт</h2>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${similar.map(sp => propCardHTML(sp)).join('')}
        </div>
      </div>
    </section>
    ` : ''}
  `;

  window.navigate('property-detail');
}

export function switchGallery(thumb, src) {
  document.getElementById('gallery-main').src = src;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}