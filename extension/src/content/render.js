import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';

const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);
renderer.code = function code(token) {
  if ((token.lang || '').trim().toLowerCase() === 'mermaid') {
    const escaped = escapeHtml(token.text);
    return `<pre class="mdview-mermaid-source" data-mdview-mermaid="1">${escaped}</pre>`;
  }
  return originalCode(token);
};

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
});

const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'id', 'class', 'data-mdview-mermaid', 'checked', 'disabled', 'align'],
  ADD_TAGS: ['svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker', 'foreignObject'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel|file|sms|data:image\/(?:png|jpeg|gif|webp|svg\+xml));|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function renderMarkdownToHtml(rawText) {
  const dirty = marked.parse(rawText);
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}

export function highlightCodeBlocks(root) {
  const blocks = root.querySelectorAll('pre > code');
  for (const block of blocks) {
    if (block.closest('[data-mdview-mermaid]')) continue;
    const langClass = [...block.classList].find((c) => c.startsWith('language-'));
    const lang = langClass?.slice('language-'.length);
    try {
      if (lang && hljs.getLanguage(lang)) {
        const result = hljs.highlight(block.textContent, { language: lang, ignoreIllegals: true });
        block.innerHTML = result.value;
        block.classList.add('hljs');
      } else {
        const result = hljs.highlightAuto(block.textContent);
        block.innerHTML = result.value;
        block.classList.add('hljs');
      }
    } catch {
      // leave unhighlighted on failure
    }
  }
}

export async function renderMermaidIfPresent(root, { enabled }) {
  if (!enabled) {
    root.querySelectorAll('[data-mdview-mermaid]').forEach((el) => {
      el.removeAttribute('data-mdview-mermaid');
    });
    return;
  }
  const fences = root.querySelectorAll('[data-mdview-mermaid]');
  if (fences.length === 0) return;

  let mermaid;
  try {
    ({ default: mermaid } = await import('mermaid'));
  } catch (err) {
    console.warn('[mdview] failed to load mermaid', err);
    return;
  }

  const isDark = document.documentElement.classList.contains('mdview-theme-dark') ||
    (document.documentElement.classList.contains('mdview-theme-auto') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict',
  });

  let counter = 0;
  for (const fence of fences) {
    counter += 1;
    const source = fence.textContent;
    const id = `mdview-mermaid-${counter}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const wrapper = document.createElement('div');
      wrapper.className = 'mdview-mermaid';
      wrapper.innerHTML = svg;
      fence.replaceWith(wrapper);
    } catch (err) {
      const errEl = document.createElement('pre');
      errEl.className = 'mdview-mermaid-error';
      errEl.textContent = `Mermaid render error:\n${err?.message || err}\n\n${source}`;
      fence.replaceWith(errEl);
    }
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
