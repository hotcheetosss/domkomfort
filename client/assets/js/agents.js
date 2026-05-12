// Модуль агентов: данные, рендер, детальная страница агента.
import { api } from './api.js';

export let leadership = [];
export let agents = [];
export let properties = {};
let loaded = false;

export async function loadAgentsData() {
  if (loaded) return;
  try {
    const data = await api.agents.list();
    leadership = data.leadership || [];
    agents     = data.agents || [];
    const propsResp = await api.properties.list();
    properties = (propsResp.items || []).reduce((acc, p) => {
      (acc[p.agentId] = acc[p.agentId] || []).push(p);
      return acc;
    }, {});
    loaded = true;
  } catch (e) {
    console.error('Не удалось загрузить агентов:', e);
  }
}

// Безопасное приведение полей агента к нужным типам
function safeAgent(a) {
  const agentListings = properties[a.id] ? properties[a.id].length : 0;

  return {
    id:             a.id || '',
    name:           a.name || 'Без имени',
    role:           a.role || 'Агент',
    specialization: a.specialization || 'Не указана',
    listings:       agentListings || a.listings || 0,
    phone:          a.phone || '',
    img:            a.img || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80',
    awards:         Array.isArray(a.awards) ? a.awards : [],
    isTopMonth:     !!a.isTopMonth,
    topMonthOrder:  Number.isFinite(parseInt(a.topMonthOrder, 10)) ? parseInt(a.topMonthOrder, 10) : 100,
  };
}

function safeLeadership(p) {
  return {
    name:      p.name || 'Без имени',
    role:      p.role || '',
    expertise: p.expertise || '',
    topics:    p.topics || '',
    img:       p.img || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80',
  };
}

export function renderLeadership() {
  const grid = document.getElementById('leadership-grid');
  if (!grid) return;
  grid.innerHTML = leadership.map(safeLeadership).map((p, i) => `
    <div class="premium-card overflow-hidden group" style="transition-delay:${i * 0.05}s">
      <div class="aspect-[4/5] overflow-hidden relative">
        <img src="${p.img}" alt="${p.name}" class="w-full h-full object-cover prop-img" onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80'"/>
        <div class="absolute inset-0 bg-gradient-to-t from-primary-900/80 via-transparent to-transparent"></div>
        <div class="absolute bottom-5 left-5 right-5 text-white">
          <div class="text-gold text-xs uppercase tracking-[0.2em] mb-1">${p.role}</div>
          <div class="font-display text-2xl font-medium leading-tight">${p.name}</div>
        </div>
      </div>
      <div class="p-6">
        <div class="text-xs uppercase tracking-[0.15em] text-primary-600 mb-2">Экспертиза</div>
        <p class="text-sm text-graphite font-medium mb-4">${p.expertise}</p>
        <div class="text-xs uppercase tracking-[0.15em] text-graphite/50 mb-2">По вопросам</div>
        <p class="text-sm text-graphite/70 font-light leading-relaxed">${p.topics}</p>
      </div>
    </div>
  `).join('');
}
// Карточка агента с поддержкой бейджа "TOP месяца"
function agentCardHTML(a, i) {
  const topBadge = a.isTopMonth
    ? `<div class="absolute top-4 left-4 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-bold shadow-lg flex items-center gap-1.5">
         <span>⭐</span> TOP месяца
       </div>`
    : '';

  const krishaBadge = a.awards.length
    ? `<div class="absolute top-4 right-4 krisha-badge text-primary-900 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-semibold">TOP Krisha</div>`
    : '';

  return `
    <a href="#" onclick="openAgent('${a.id}'); return false;" class="premium-card overflow-hidden group block fade-up" style="transition-delay:${(i % 4) * 0.05}s">
      <div class="aspect-[4/5] overflow-hidden relative">
        <img src="${a.img}" alt="${a.name}" class="w-full h-full object-cover prop-img" onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80'"/>
        ${topBadge}
        ${krishaBadge}
        <div class="absolute inset-0 bg-gradient-to-t from-primary-900/80 via-transparent to-transparent"></div>
        <div class="absolute bottom-5 left-5 right-5 text-white">
          <div class="text-primary-300 text-[11px] uppercase tracking-[0.2em] mb-1">${a.role}</div>
          <div class="font-display text-xl font-medium leading-tight">${a.name}</div>
        </div>
      </div>
      <div class="p-5 flex items-center justify-between">
        <div>
          <div class="text-xs text-graphite/50 uppercase tracking-[0.15em] mb-1">Специализация</div>
          <p class="text-sm text-graphite font-medium">${a.specialization}</p>
        </div>
        <div class="text-right">
          <div class="font-display text-3xl text-primary-700 font-light leading-none">${a.listings}</div>
          <div class="text-[10px] text-graphite/50 uppercase tracking-[0.15em] mt-1">объектов</div>
        </div>
      </div>
    </a>
  `;
}

export function renderAgentsGrid() {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;
  const safe = agents.map(safeAgent);

  // Обновим счётчик "Всего N агентов"
  const countEl = document.getElementById('agent-count');
  if (countEl) countEl.textContent = safe.length;

  // === Топ-агенты месяца — отдельный блок наверху ===
  // === Топ-агенты месяца — отдельный блок наверху ===
  const topAgents = safe
    .filter(a => a.isTopMonth)
    .sort((a, b) => {
      // Сначала по порядку (меньше = выше), потом по имени для одинаковых
      if (a.topMonthOrder !== b.topMonthOrder) return a.topMonthOrder - b.topMonthOrder;
      return a.name.localeCompare(b.name);
    }); 
  const topSection = document.getElementById('top-agents-section');
  const topGrid = document.getElementById('top-agents-grid');

  if (topSection && topGrid) {
    if (topAgents.length > 0) {
      topGrid.innerHTML = topAgents.map((a, i) => agentCardHTML(a, i)).join('');
      topSection.classList.remove('hidden');
    } else {
      topSection.classList.add('hidden');
      topGrid.innerHTML = '';
    }
  }

  // === Все агенты (включая топов — они показываются дважды) ===
  grid.innerHTML = safe.map((a, i) => agentCardHTML(a, i)).join('');
}

export function renderTeamPreview() {
  const wrap = document.getElementById('team-preview');
  if (!wrap || !agents.length) return;
  const safe = agents.map(safeAgent);
  const top = safe.filter(a => a.awards.length).slice(0, 4);
  const chosen = top.length >= 4 ? top : safe.slice(0, 4);
  wrap.innerHTML = chosen.map((a, i) => `
    <a href="#" onclick="openAgent('${a.id}'); return false;" class="premium-card overflow-hidden group block" style="transition-delay:${i * 0.1}s">
      <div class="aspect-[4/5] overflow-hidden relative">
        <img src="${a.img}" alt="${a.name}" class="w-full h-full object-cover prop-img"/>
        <div class="absolute inset-0 bg-gradient-to-t from-primary-900/75 via-transparent to-transparent"></div>
        <div class="absolute bottom-4 left-4 right-4 text-white">
          <div class="font-display text-lg font-medium">${a.name}</div>
          <div class="text-primary-200 text-xs mt-1">${a.specialization}</div>
        </div>
      </div>
    </a>
  `).join('');
}

export function openAgent(id) {
  const raw = agents.find(x => x.id === id);
  if (!raw) return;
  const a = safeAgent(raw);
  const props = properties[id] || [];

  const content = document.getElementById('agent-detail-content');
  content.innerHTML = `
    <section class="py-16 bg-primary-900 text-white">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div class="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          <div class="relative">
            <div class="aspect-[4/5] overflow-hidden rounded-lg">
              <img src="${a.img}" alt="${a.name}" class="w-full h-full object-cover"/>
            </div>
            ${a.awards.length ? `<div class="absolute -top-4 -right-4 krisha-badge text-primary-900 text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-full font-semibold">TOP Krisha</div>` : ''}
          </div>
          <div>
            <div class="text-primary-300 text-xs uppercase tracking-[0.3em] mb-4">${a.role}</div>
            <h1 class="font-display text-5xl lg:text-7xl font-light leading-[0.95] mb-6">${a.name}</h1>
            <p class="text-white/70 text-lg font-light leading-relaxed mb-10 max-w-xl">
              Специализация: <span class="text-white">${a.specialization}</span>.
              Ведёт ${a.listings} активных объектов, сопровождает сделку от первого звонка до подписания ДКП.
            </p>
            ${a.awards.length ? `
              <div class="flex flex-wrap gap-3 mb-10">
                ${a.awards.map(aw => `<span class="text-xs uppercase tracking-[0.15em] text-gold border border-gold/40 px-4 py-2 rounded-full">⋄ ${aw}</span>`).join('')}
              </div>
            ` : ''}
            <div class="grid grid-cols-3 gap-6 mb-10 max-w-md">
              <div>
                <div class="font-display text-4xl text-primary-300 font-light mb-1">${a.listings}</div>
                <div class="text-white/50 text-xs uppercase tracking-[0.15em]">Объектов</div>
              </div>
              <div>
                <div class="font-display text-4xl text-primary-300 font-light mb-1">4.9</div>
                <div class="text-white/50 text-xs uppercase tracking-[0.15em]">Рейтинг</div>
              </div>
              <div>
                <div class="font-display text-4xl text-primary-300 font-light mb-1">24/7</div>
                <div class="text-white/50 text-xs uppercase tracking-[0.15em]">На связи</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-4">
              <a href="https://wa.me/${a.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn-wa">WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-20 lg:py-28 bg-ivory">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-6">
          <div>
            <div class="section-label">Портфель агента</div>
            <h2 class="font-display text-4xl lg:text-5xl text-primary-900 font-light leading-[1.05]">
              Объекты, которые <span class="italic text-primary-600">ведёт ${a.name.split(' ')[0]}</span>
            </h2>
          </div>
          <div class="text-sm text-graphite/60">
            Всего: <span class="font-medium text-primary-700 font-display text-2xl">${props.length}</span> объектов
          </div>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${props.length ? props.map(p => `
            <a href="#" onclick="openProperty('${p.id}'); return false;" class="premium-card overflow-hidden group block">
              <div class="aspect-[4/3] overflow-hidden relative">
                <img src="${(p.gallery && p.gallery[0]) || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'}" alt="${p.title}" class="w-full h-full object-cover prop-img"/>
                ${p.top ? '<div class="absolute top-4 left-4 krisha-badge text-primary-900 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-semibold">TOP</div>' : ''}
                ${p.deal === 'rent' ? '<div class="absolute top-4 right-4 bg-primary-600 text-white text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-full font-medium">Аренда</div>' : ''}
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
          `).join('') : `
            <div class="col-span-full text-center py-16">
              <p class="text-graphite/60 font-light text-lg">Агент готовит новые объекты к публикации.</p>
              <p class="text-graphite/60 font-light">Напишите в WhatsApp, чтобы узнать о ближайших поступлениях.</p>
            </div>
          `}
        </div>
      </div>
    </section>

    <section class="py-16 bg-primary-900 text-white">
      <div class="max-w-[1400px] mx-auto px-6 lg:px-10 text-center">
        <h3 class="font-display text-3xl lg:text-4xl font-light mb-4">Нашли интересный объект?</h3>
        <p class="text-white/70 mb-8 max-w-xl mx-auto">Напишите напрямую агенту ${a.name.split(' ')[0]} в WhatsApp — организуем просмотр и ответим на вопросы.</p>
        <a href="https://wa.me/${a.phone.replace(/[^0-9]/g,'')}" target="_blank" class="btn-wa">Связаться с ${a.name.split(' ')[0]}</a>
      </div>
    </section>
  `;
  window.navigate('agent-detail');
}