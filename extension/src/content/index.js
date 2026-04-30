import './styles.css';
import { getSettings, setSettings, onSettingsChanged } from '../lib/settings.js';
import { findPlainTextPre } from '../lib/detect.js';
import { renderMarkdownToHtml, highlightCodeBlocks, renderMermaidIfPresent } from './render.js';
import { addHeadingAnchors, scrollToHashIfPresent } from './anchors.js';
import { addCopyButtons } from './codeblock.js';
import { buildToc, decideTocVisible, setupTocActiveTracking } from './toc.js';
import { buildToolbar } from './toolbar.js';

const SAFETY_TIMEOUT_MS = 1500;

console.debug('[mdview] content script loaded for', location.href);

main().catch((err) => {
  console.error('[mdview] fatal', err);
  reveal();
});

async function main() {
  const safety = setTimeout(() => {
    console.warn('[mdview] safety timeout — revealing without rendering');
    reveal();
  }, SAFETY_TIMEOUT_MS);

  if (document.readyState === 'loading') {
    await new Promise((res) => document.addEventListener('DOMContentLoaded', res, { once: true }));
  }

  const pre = findPlainTextPre();
  if (!pre) {
    const children = [...(document.body?.children ?? [])].map((el) => ({
      tag: el.tagName,
      cls: el.className,
      textLen: (el.textContent || '').length,
    }));
    console.debug('[mdview] page-shape gate failed — body children:', children);
    clearTimeout(safety);
    reveal();
    return;
  }

  const rawText = pre.textContent || '';
  console.debug('[mdview] rendering markdown,', rawText.length, 'chars');
  const settings = await getSettings();

  applyTheme(settings.theme);

  if (rawText.length > settings.maxBytes && settings.maxBytes < Number.MAX_SAFE_INTEGER) {
    renderSizeBanner(rawText, settings);
    clearTimeout(safety);
    reveal();
    return;
  }

  await renderInto(rawText, settings);
  scrollToHashIfPresent();

  onSettingsChanged((partial) => {
    if ('theme' in partial) applyTheme(partial.theme);
  });

  clearTimeout(safety);
  reveal();
}

async function renderInto(rawText, settings) {
  const html = renderMarkdownToHtml(rawText);

  const article = document.createElement('article');
  article.className = 'markdown-body mdview-content';
  article.innerHTML = html;

  highlightCodeBlocks(article);
  addHeadingAnchors(article);
  addCopyButtons(article);

  const headingCount = article.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const tocVisible = decideTocVisible(settings.tocMode, headingCount);
  const toc = tocVisible ? buildToc(article) : null;

  const shell = document.createElement('div');
  shell.className = 'mdview-shell' + (toc ? '' : ' mdview-no-toc');

  const toolbar = buildToolbar({
    initialTheme: settings.theme,
    initialView: settings.defaultView,
    title: deriveTitle(),
    onToggleToc: () => {
      const isVisible = !shell.classList.contains('mdview-no-toc');
      if (isVisible) {
        shell.classList.add('mdview-no-toc');
        if (toc) toc.style.display = 'none';
      } else {
        shell.classList.remove('mdview-no-toc');
        if (toc) toc.style.display = '';
      }
    },
    onThemeChange: (theme) => applyTheme(theme),
    onViewChange: (view) => switchView(view, rawText, article, shell),
  });

  shell.appendChild(toolbar.el);
  if (toc) shell.appendChild(toc);

  const wrapper = document.createElement('main');
  wrapper.className = 'mdview-content-wrapper';
  wrapper.appendChild(article);
  shell.appendChild(wrapper);

  const body = document.createElement('body');
  body.className = 'mdview-body';
  body.appendChild(shell);
  document.documentElement.replaceChild(body, document.body);

  setupTocActiveTracking(toc, article);

  document.title = deriveTitle();

  if (settings.defaultView === 'source') {
    switchView('source', rawText, article, shell);
    toolbar.setView('source');
  }

  await renderMermaidIfPresent(article, { enabled: settings.renderMermaid });
}

function switchView(view, rawText, article, shell) {
  const wrapper = shell.querySelector('.mdview-content-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';
  if (view === 'source') {
    const pre = document.createElement('pre');
    pre.className = 'mdview-source';
    pre.textContent = rawText;
    wrapper.appendChild(pre);
  } else {
    wrapper.appendChild(article);
  }
}

function renderSizeBanner(rawText, settings) {
  const body = document.createElement('body');
  body.className = 'mdview-body';
  const banner = document.createElement('div');
  banner.className = 'mdview-banner';
  banner.innerHTML = `
    <h2>Large markdown file</h2>
    <p>This file is ${formatBytes(rawText.length)} — above the configured ${formatBytes(settings.maxBytes)} render limit. Rendering very large files can lock up the tab.</p>
  `;
  const renderBtn = document.createElement('button');
  renderBtn.type = 'button';
  renderBtn.textContent = 'Render anyway';
  renderBtn.addEventListener('click', () => {
    setSettings({ maxBytes: Number.MAX_SAFE_INTEGER }).catch(() => {});
    location.reload();
  });
  const sourceBtn = document.createElement('button');
  sourceBtn.type = 'button';
  sourceBtn.textContent = 'View source';
  sourceBtn.addEventListener('click', () => {
    banner.remove();
    const pre = document.createElement('pre');
    pre.className = 'mdview-source';
    pre.textContent = rawText;
    body.appendChild(pre);
  });
  banner.appendChild(renderBtn);
  banner.appendChild(sourceBtn);
  body.appendChild(banner);
  document.documentElement.replaceChild(body, document.body);
  document.title = deriveTitle();
}

function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.remove('mdview-theme-auto', 'mdview-theme-light', 'mdview-theme-dark');
  html.classList.add(`mdview-theme-${theme}`);
}

function reveal() {
  document.documentElement.classList.add('mdview-ready');
}

function deriveTitle() {
  try {
    const u = new URL(location.href);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'Markdown';
  } catch {
    return 'Markdown';
  }
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
