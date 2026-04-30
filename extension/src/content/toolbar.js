import { setSettings } from '../lib/settings.js';

const THEME_CYCLE = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: '🌓 Auto', light: '☀️ Light', dark: '🌙 Dark' };

export function buildToolbar({ initialTheme, initialView, title, onToggleToc, onThemeChange, onViewChange }) {
  const bar = document.createElement('div');
  bar.className = 'mdview-toolbar';

  const tocBtn = button('☰ TOC');
  tocBtn.title = 'Toggle table of contents';
  tocBtn.addEventListener('click', () => onToggleToc());
  bar.appendChild(tocBtn);

  const titleEl = document.createElement('span');
  titleEl.className = 'mdview-title';
  titleEl.textContent = title;
  bar.appendChild(titleEl);

  const spacer = document.createElement('span');
  spacer.className = 'mdview-spacer';
  bar.appendChild(spacer);

  let theme = initialTheme;
  const themeBtn = button(THEME_LABEL[theme]);
  themeBtn.title = 'Cycle theme (auto / light / dark)';
  themeBtn.addEventListener('click', () => {
    const idx = THEME_CYCLE.indexOf(theme);
    theme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    themeBtn.textContent = THEME_LABEL[theme];
    setSettings({ theme }).catch(() => {});
    onThemeChange(theme);
  });
  bar.appendChild(themeBtn);

  let view = initialView;
  const viewBtn = button(view === 'source' ? '📖 Rendered' : '📄 Source');
  viewBtn.title = 'Toggle between rendered and raw source';
  viewBtn.addEventListener('click', () => {
    view = view === 'source' ? 'rendered' : 'source';
    viewBtn.textContent = view === 'source' ? '📖 Rendered' : '📄 Source';
    onViewChange(view);
  });
  bar.appendChild(viewBtn);

  return {
    el: bar,
    setTheme(next) {
      theme = next;
      themeBtn.textContent = THEME_LABEL[theme];
    },
    setView(next) {
      view = next;
      viewBtn.textContent = view === 'source' ? '📖 Rendered' : '📄 Source';
    },
  };
}

function button(text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  return b;
}
