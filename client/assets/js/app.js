// Главный модуль: навигация, анимации, глобальные обработчики.
import { api } from './api.js';
import {
  loadAgentsData, renderLeadership, renderAgentsGrid, renderTeamPreview, openAgent,
} from './agents.js';
import {
  loadProperties, renderProperties, initPropertyFilters, openProperty, switchGallery,
  toggleAdvancedFilters, applyFilters, resetFilters, showPlan,
} from './properties.js';

// ===== Navigation =====
async function navigate(pageName, scrollTo) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageName);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const active = document.querySelector('.nav-link[data-page="' + pageName + '"]');
  if (active) active.classList.add('active');

  if (pageName === 'agents') {
    await loadAgentsData();
    renderLeadership();
    renderAgentsGrid();
    initFadeUp();
  }
  if (pageName === 'properties') {
    await loadAgentsData();
    await loadProperties();
    renderProperties();
    initPropertyFilters();
  }

  setTimeout(() => {
    if (scrollTo) {
      const el = document.getElementById(scrollTo);
      if (el) {
        window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);
}

function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

async function handleForm(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Отправка...'; btn.disabled = true; }

  try {
    const resp = await api.leads.create({ ...data, source: 'website-form' });
    alert(resp.message || 'Спасибо! Мы свяжемся с вами в течение часа.');
    form.reset();
  } catch (err) {
    alert('Ошибка: ' + (err.message || 'попробуйте позже'));
  } finally {
    if (btn) { btn.textContent = originalText; btn.disabled = false; }
  }
  return false;
}

function initFadeUp() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('in-view');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up:not(.in-view)').forEach(el => observer.observe(el));
}

window.navigate = navigate;
window.toggleMenu = toggleMenu;
window.handleForm = handleForm;
window.openAgent = openAgent;
window.openProperty = openProperty;
window.switchGallery = switchGallery;
window.showPlan = showPlan;
window.toggleAdvancedFilters = toggleAdvancedFilters;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;

document.addEventListener('DOMContentLoaded', async () => {
  await loadAgentsData();
  renderTeamPreview();
  initFadeUp();
  document.querySelectorAll('.fade-up').forEach((el, i) => {
    if (i < 5) setTimeout(() => el.classList.add('in-view'), 100 + i * 80);
  });
});