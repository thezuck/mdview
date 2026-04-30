export const DEFAULTS = Object.freeze({
  theme: 'auto',
  tocMode: 'auto',
  renderMermaid: true,
  defaultView: 'rendered',
  maxBytes: 5 * 1024 * 1024,
});

export const MAX_BYTES_OPTIONS = [
  { label: '1 MB', value: 1 * 1024 * 1024 },
  { label: '5 MB', value: 5 * 1024 * 1024 },
  { label: '25 MB', value: 25 * 1024 * 1024 },
  { label: 'Unlimited', value: Number.MAX_SAFE_INTEGER },
];

export async function getSettings() {
  if (!globalThis.chrome?.storage?.sync) return { ...DEFAULTS };
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(partial) {
  if (!globalThis.chrome?.storage?.sync) return;
  await chrome.storage.sync.set(partial);
}

export function onSettingsChanged(cb) {
  if (!globalThis.chrome?.storage?.onChanged) return () => {};
  const listener = (changes, area) => {
    if (area !== 'sync') return;
    const partial = {};
    for (const k of Object.keys(changes)) partial[k] = changes[k].newValue;
    cb(partial);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
