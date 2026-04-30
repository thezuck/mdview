export function addHeadingAnchors(root) {
  const seen = new Map();
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of headings) {
    const text = h.textContent || '';
    let slug = slugify(text);
    if (!slug) continue;
    if (seen.has(slug)) {
      const n = seen.get(slug) + 1;
      seen.set(slug, n);
      slug = `${slug}-${n}`;
    } else {
      seen.set(slug, 0);
    }
    h.id = slug;
    const a = document.createElement('a');
    a.className = 'mdview-anchor';
    a.href = `#${slug}`;
    a.setAttribute('aria-label', `Link to ${text}`);
    a.textContent = '#';
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const url = `${location.origin}${location.pathname}${location.search}#${slug}`;
      history.replaceState(null, '', `#${slug}`);
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigator.clipboard?.writeText(url).catch(() => {});
    });
    h.appendChild(a);
  }
}

export function scrollToHashIfPresent() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const target = document.getElementById(decodeURIComponent(hash));
  if (target) {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
