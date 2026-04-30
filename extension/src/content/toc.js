export function buildToc(contentRoot) {
  const headings = contentRoot.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length < 1) return null;

  const aside = document.createElement('aside');
  aside.className = 'mdview-toc';
  const heading = document.createElement('h2');
  heading.textContent = 'Contents';
  aside.appendChild(heading);

  const list = document.createElement('ul');
  for (const h of headings) {
    if (!h.id) continue;
    const li = document.createElement('li');
    li.className = `mdview-toc-${h.tagName.toLowerCase()}`;
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = stripAnchorMarker(h.textContent || '');
    a.dataset.targetId = h.id;
    li.appendChild(a);
    list.appendChild(li);
  }
  aside.appendChild(list);

  return aside;
}

export function setupTocActiveTracking(tocEl, contentRoot) {
  if (!tocEl) return () => {};
  const links = new Map();
  for (const a of tocEl.querySelectorAll('a[data-target-id]')) {
    links.set(a.dataset.targetId, a);
  }
  if (links.size === 0) return () => {};

  const headings = [...contentRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) =>
    links.has(h.id),
  );
  if (headings.length === 0) return () => {};

  let current = null;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (current && current !== id) links.get(current)?.classList.remove('mdview-toc-active');
          links.get(id)?.classList.add('mdview-toc-active');
          current = id;
          break;
        }
      }
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
  );
  for (const h of headings) observer.observe(h);
  return () => observer.disconnect();
}

function stripAnchorMarker(text) {
  return text.replace(/#$/, '').trim();
}

export function decideTocVisible(tocMode, headingCount) {
  if (tocMode === 'show') return true;
  if (tocMode === 'hide') return false;
  return headingCount >= 3;
}
