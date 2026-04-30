import { getSettings, setSettings, MAX_BYTES_OPTIONS } from '../lib/settings.js';

function el(id) {
  return document.getElementById(id);
}

function populateMaxBytes(current) {
  const select = el('maxBytes');
  select.innerHTML = '';
  for (const opt of MAX_BYTES_OPTIONS) {
    const option = document.createElement('option');
    option.value = String(opt.value);
    option.textContent = opt.label;
    if (opt.value === current) option.selected = true;
    select.appendChild(option);
  }
}

function flashSaved() {
  const status = el('status');
  status.textContent = 'Saved';
  status.classList.add('visible');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => status.classList.remove('visible'), 1200);
}

async function init() {
  const settings = await getSettings();
  el('theme').value = settings.theme;
  el('tocMode').value = settings.tocMode;
  el('defaultView').value = settings.defaultView;
  el('renderMermaid').checked = !!settings.renderMermaid;
  populateMaxBytes(settings.maxBytes);

  el('theme').addEventListener('change', (e) => save({ theme: e.target.value }));
  el('tocMode').addEventListener('change', (e) => save({ tocMode: e.target.value }));
  el('defaultView').addEventListener('change', (e) => save({ defaultView: e.target.value }));
  el('renderMermaid').addEventListener('change', (e) => save({ renderMermaid: e.target.checked }));
  el('maxBytes').addEventListener('change', (e) => save({ maxBytes: Number(e.target.value) }));
}

async function save(partial) {
  await setSettings(partial);
  flashSaved();
}

init().catch((err) => console.error('[mdview options]', err));
