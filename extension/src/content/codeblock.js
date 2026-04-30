export function addCopyButtons(root) {
  const pres = root.querySelectorAll('pre');
  for (const pre of pres) {
    const code = pre.querySelector('code');
    if (!code) continue;
    if (pre.classList.contains('mdview-codeblock')) continue;
    pre.classList.add('mdview-codeblock');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdview-copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '');
        btn.textContent = 'Copied';
        btn.classList.add('mdview-copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('mdview-copied');
        }, 1200);
      } catch {
        btn.textContent = 'Error';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 1200);
      }
    });
    pre.appendChild(btn);
  }
}
