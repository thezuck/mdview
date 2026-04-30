export function isMarkdownUrl(url) {
  try {
    const u = new URL(url);
    return /\.(md|markdown)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function findPlainTextPre(doc = document) {
  const body = doc.body;
  if (!body) return null;
  const pres = body.querySelectorAll('pre');
  if (pres.length === 0) return null;

  let pre = pres[0];
  for (const p of pres) {
    if ((p.textContent || '').length > (pre.textContent || '').length) pre = p;
  }

  const preText = (pre.textContent || '').trim();
  if (preText.length === 0) return null;

  const bodyText = (body.textContent || '').trim();
  if (bodyText.length === 0) return null;

  // The PRE must dominate the body's text. Allow Chrome's reader overlay,
  // injected scripts/links, etc. as long as the PRE is clearly the page content.
  const ratio = preText.length / bodyText.length;
  if (ratio < 0.9) return null;

  return pre;
}

export function readRawText(doc = document) {
  const pre = findPlainTextPre(doc);
  if (pre) return pre.textContent || '';
  return doc.body?.innerText || '';
}
