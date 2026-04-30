# Chrome Extension — Markdown Viewer (`mdview-extension`)

**Status:** Approved design, ready for implementation plan
**Date:** 2026-04-30
**Scope:** v0.1 — sideload-only Chrome MV3 extension that renders markdown files when Chrome opens them.

## Problem

When Chrome opens a markdown file (local `file://` or remote `.md` URL like a raw GitHub link), it shows the raw text. Users want the same in-browser auto-rendering experience that Adobe Acrobat provides for PDFs.

## Goals

- Activate automatically on URLs ending in `.md` or `.markdown` (local and remote).
- Render quickly with a small bundle (~130KB without Mermaid).
- Provide a clean reading shell: sticky toolbar, optional TOC sidebar, theme toggle, source toggle.
- Stay out of the way on every other page.

## Non-goals (v0.1)

- Editing markdown.
- Drag-and-drop (Chrome already opened the file).
- Frontmatter parsing.
- User-supplied custom CSS.
- Math (KaTeX) rendering.
- `Content-Type: text/markdown` header sniffing (URL-extension matching only — header sniffing can be added later if needed).
- Chrome Web Store listing (sideload only for v0.1; build artifact will still be a zip suitable for later submission).
- JSON, log, or PDF handling. Those remain in the main mdview app.

## Architecture

A single content script is injected at `document_start` on URLs whose path ends in `.md` or `.markdown` (with optional query/hash). The script:

1. Injects CSS that hides `<html>` until rendering completes (prevents raw-text flicker).
2. Waits for `DOMContentLoaded`, then reads the raw text from Chrome's default text-rendering wrapper (`<pre>`).
3. Confirms the page is actually plain-text markdown (sanity check — bails out if the page is already rich HTML).
4. Pipes the raw text through `marked` → `DOMPurify` → an `<article>` element.
5. Runs `highlight.js` on code blocks, lazy-loads Mermaid only if a `mermaid` fence exists.
6. Builds a TOC, adds code-block copy buttons, applies theme.
7. Replaces the body with the rendered shell and unhides `<html>`.

```
[ Chrome opens .md URL ]
        ↓
[ content_script.js injected at document_start ]
        ↓
[ inject hide-body CSS ]
        ↓
[ DOMContentLoaded: read <pre>.textContent ]
        ↓
[ marked + DOMPurify → HTML ]
        ↓
[ highlight.js on code blocks ]
        ↓
[ if mermaid fences exist: lazy-load + render ]
        ↓
[ toc.js builds sidebar; codeblock.js adds copy buttons ]
        ↓
[ replace document.body with rendered shell ]
        ↓
[ unhide <html> ]
```

## Project layout

```
extension/
├── package.json              # vite + small deps; scripts: dev, build, zip
├── vite.config.js            # builds content/options bundles
├── README.md                 # install + usage; "Allow file URLs" note
├── public/
│   ├── manifest.json
│   └── icons/                # 16, 32, 48, 128 px (placeholders OK initially)
├── src/
│   ├── content/
│   │   ├── index.js          # entrypoint: detect, hide body, render, swap
│   │   ├── render.js         # marked + DOMPurify + highlight + mermaid pipeline
│   │   ├── toc.js            # builds TOC sidebar from headings
│   │   ├── toolbar.js        # view-source toggle, theme toggle
│   │   ├── codeblock.js      # adds copy buttons
│   │   ├── anchors.js        # heading anchors + hash navigation
│   │   └── styles.css        # github-markdown-css + custom shell styles
│   ├── options/
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   └── lib/
│       ├── settings.js       # chrome.storage.sync wrapper with defaults
│       └── detect.js         # URL + page-shape heuristics
└── dist/                     # build output (loaded unpacked)
```

Each module has one responsibility and is independently testable. `render.js` does not know about TOC/toolbar; `toc.js` reads the rendered DOM and emits a sidebar; `toolbar.js` only mediates settings ↔ DOM.

## Manifest (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "MDView — Markdown Viewer",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{
    "matches": ["file:///*", "*://*/*"],
    "include_globs": ["*.md", "*.markdown", "*.md?*", "*.markdown?*", "*.md#*", "*.markdown#*"],
    "js": ["content.js"],
    "css": ["hide-body.css"],
    "run_at": "document_start",
    "all_frames": false
  }],
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

Notes:
- `include_globs` filters by URL ending — Chrome runs the script only on candidate URLs.
- `hide-body.css` sets `html { visibility: hidden !important; }`. The content script removes this class once render is complete, with a 200ms timeout fallback so a render bug never leaves the page invisible.
- `<all_urls>` is required because `.md` files can be served from anywhere. We do not read or modify any non-markdown page (the URL glob keeps us out).
- `file:///*` requires the user to enable "Allow access to file URLs" in `chrome://extensions` after install. Chrome does not allow programmatic enablement. README must call this out prominently.

## Detection (`src/lib/detect.js`)

Two-step gate before doing any work:

1. **URL gate** (handled by `include_globs`): path ends in `.md` or `.markdown`.
2. **Page-shape gate** (in content script): `document.body.children.length === 1 && document.body.firstElementChild.tagName === 'PRE'`. This is Chrome's default rendering for `text/plain` content. If the page is anything else (a real HTML page that happens to have `.md` in its URL — e.g. a SPA route), bail: remove the hide-body class so the page becomes visible, do nothing else.

`Content-Type: text/markdown` header sniffing is explicitly out of scope for v0.1.

## Rendering pipeline (`src/content/render.js`)

```
raw text
  ↓ marked  (gfm: true, breaks: false, headerIds: false — anchors.js owns IDs)
  ↓ DOMPurify  (default config + allow common attrs: id, class, target)
  ↓ inject HTML into <article id="mdview-content">
  ↓ highlight.js  (auto-detect language; common-languages bundle)
  ↓ if doc contains ```mermaid: dynamic import('mermaid'), render each fence
  ↓ codeblock.js: add copy buttons
  ↓ anchors.js: add slug IDs + hover-anchor links to all headings
  ↓ toc.js: scan h1–h6, build sidebar list
```

**Bundle sizes (gzipped, approximate):**
| Lib | Size |
|---|---|
| marked | ~14KB |
| DOMPurify | ~22KB |
| highlight.js (common-languages bundle) | ~80KB |
| github-markdown-css | ~6KB |
| **Subtotal (always loaded)** | **~130KB** |
| mermaid (lazy-loaded only when fence present) | ~700KB |

## UI shell

```
┌─────────────────────────────────────────────┐
│  [☰ TOC]                  [🌓] [📄 Source]  │  ← sticky toolbar
├──────────┬──────────────────────────────────┤
│          │                                  │
│  TOC     │   <article> rendered markdown    │
│  panel   │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

- **TOC**: collapsible sidebar. Auto-hidden if the document has fewer than 3 headings (overridable in options).
- **Theme toggle**: cycles auto → light → dark. Persists per-extension via `chrome.storage.sync`.
- **Source toggle**: swaps the rendered article for a `<pre>` of the original raw text. Toggle returns to rendered.
- **Heading anchors**: every heading gets a slug `id` and a `#` link visible on hover. Clicking it copies the URL-with-hash to clipboard.
- **Hash navigation**: on load, if `location.hash` is present, smooth-scroll to that heading after render.

## Options page

Single page; settings stored in `chrome.storage.sync`:

| Setting | Values | Default |
|---|---|---|
| Theme | auto / light / dark | auto |
| TOC default | auto-hide (<3 headings) / always-show / always-hide | auto-hide |
| Render Mermaid diagrams | on / off | on |
| Default view | rendered / source | rendered |
| Max file size to render | 1 MB / 5 MB / 25 MB / unlimited | 5 MB |

Above the size limit, the extension renders a banner with a "Render anyway" button and a "View source" link instead of auto-rendering. This prevents Chrome from locking up on a giant export.

## Settings module (`src/lib/settings.js`)

```js
const DEFAULTS = {
  theme: 'auto',
  tocMode: 'auto',         // 'auto' | 'show' | 'hide'
  renderMermaid: true,
  defaultView: 'rendered', // 'rendered' | 'source'
  maxBytes: 5 * 1024 * 1024,
};

export async function getSettings() { /* chrome.storage.sync.get + merge defaults */ }
export async function setSettings(partial) { /* chrome.storage.sync.set(partial) */ }
export function onSettingsChanged(cb) { /* chrome.storage.onChanged listener */ }
```

Single source of truth for both content script and options page. Defaults survive missing keys.

## Build & install (sideload)

- `npm run dev` — vite watch, outputs to `dist/`. Load unpacked from `dist/` in `chrome://extensions`.
- `npm run build` — production build with minification.
- `npm run zip` — produces `mdview-extension-v0.1.0.zip` for later store submission.

After installing, the user must:
1. Open `chrome://extensions`
2. Find "MDView — Markdown Viewer"
3. Click "Details"
4. Toggle on **Allow access to file URLs**

The README documents this with a screenshot placeholder.

## Testing

Manual smoke tests documented in `extension/README.md`:

| Test | Expected |
|---|---|
| Open a local `.md` via `file://` | Renders with theme + TOC |
| Open a raw GitHub `.md` URL | Renders identically |
| Open a `.md` containing a ```mermaid fence | Mermaid lazy-loads, diagram renders |
| Open a 10MB synthetic `.md` | Size-guard banner appears; "Render anyway" works |
| Click any heading's hover-anchor | URL hash updates, link copied |
| Visit a `.md` URL with `#section` hash | Auto-scrolls to that heading after render |
| Theme toggle | Cycles auto → light → dark; persists across reload |
| Source toggle | Shows raw text; toggle returns to rendered |
| TOC toggle | Sidebar shows/hides |
| Visit a non-`.md` page | Page is untouched |
| Visit `https://example.com/foo.md` that returns rich HTML | Page-shape gate bails; page untouched |

No unit tests in v0.1 — the code is small and mostly DOM glue. Vitest can be added later if detection or settings logic grows non-trivial.

## Risks & open questions

- **First-render flicker**: `hide-body.css` should make this near-invisible, but a render error must always result in `<html>` becoming visible again. Implementation must use a `try/finally` and a 200ms safety timeout to remove the hide class no matter what.
- **DOMPurify defaults are strict**: GFM task list checkboxes and some heading-id attributes need to be allowed explicitly. To verify during implementation against a sample doc with checkboxes, tables, and code blocks.
- **`include_globs` URL fragment behavior**: Chrome's docs are imprecise on whether `*.md#*` is needed in addition to `*.md`. We ship both to be safe; remove later if redundant.
- **Mermaid bundle size**: 700KB is significant. Mermaid is loaded only on docs that contain a `mermaid` fence, so users who never view diagrams never download it.
- **CSP on remote markdown pages**: a server-set Content-Security-Policy can theoretically block inline scripts. Content scripts are exempt from page CSP, but inline `<script>` we inject would be blocked. Implementation must inject DOM nodes via `appendChild` and use external stylesheets bundled into the extension, never inline `<script>` tags.

## Future work (post-v0.1)

- `Content-Type: text/markdown` header sniffing for URLs without `.md` extension
- Math rendering (KaTeX) toggle
- Frontmatter rendering (table at top, optional hide)
- Print stylesheet
- Chrome Web Store submission
- A right-click context-menu action: "Render this page as markdown" for ambiguous URLs
