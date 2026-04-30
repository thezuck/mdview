# MDView — Chrome Extension

Auto-renders markdown files (`.md`, `.markdown`) when Chrome opens them — both local files and remote URLs.

## What it does

When you click a `.md` file and Chrome opens it (or visit a raw markdown URL like `https://raw.githubusercontent.com/.../README.md`), the extension takes over and renders it with:

- GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks)
- Syntax-highlighted code blocks (via highlight.js)
- One-click copy buttons on code blocks
- Auto-generated table of contents in a sidebar
- Light / dark / auto theme (follows system)
- Heading anchors with shareable URLs
- "View source" toggle to flip back to raw text
- Mermaid diagrams (lazy-loaded only when present)

Pages without `.md`/`.markdown` URLs are untouched.

## Install (sideload)

```bash
cd extension
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select `extension/dist`
5. Click **Details** on the new "MDView — Markdown Viewer" entry
6. Toggle on **Allow access to file URLs** ← required for local `.md` files

That last step is critical — Chrome blocks file:// access by default, and there is no API to enable it programmatically.

## Develop

```bash
npm run dev    # vite watch — rebuilds dist/ on save
npm run build  # production build
npm run zip    # produces mdview-extension-v0.1.0.zip
```

After `npm run dev` is running, click the reload button on the extension card in `chrome://extensions` whenever you want to pick up changes.

## Configure

Right-click the extension icon → "Options", or open the extension's details page and click "Extension options".

| Setting | Default |
|---|---|
| Theme | auto |
| Table of contents | auto-hide if fewer than 3 headings |
| Default view | rendered |
| Render Mermaid diagrams | on |
| Max file size to render | 5 MB |

Above the size limit, you'll see a banner with a "Render anyway" button instead of an automatic render — this prevents the tab from locking up on huge exports.

## Smoke tests

After install, verify:

- [ ] Open a local `.md` from disk via `file://` — should render with theme + TOC
- [ ] Open a raw GitHub `.md` URL — should render identically
- [ ] Open a `.md` containing a ` ```mermaid ` fence — Mermaid lazy-loads, diagram renders
- [ ] Open a 10 MB synthetic `.md` — size guard banner appears; "Render anyway" works
- [ ] Click a heading's hover-anchor — URL hash updates, link copied to clipboard
- [ ] Visit a `.md` URL with `#section` hash — auto-scrolls to that heading
- [ ] Theme toggle in toolbar — cycles auto → light → dark; persists across reload
- [ ] Source toggle in toolbar — shows raw text; toggle returns to rendered
- [ ] TOC toggle in toolbar — sidebar shows/hides
- [ ] Visit a non-`.md` page — page is untouched
- [ ] Visit `https://example.com/foo.md` that returns rich HTML (rare) — page-shape gate bails; page untouched

## Limitations (v0.1)

- URL-extension matching only: a `.md` file served from a route like `/api/getDoc?id=42` (no `.md` in the URL) is not detected. `Content-Type: text/markdown` sniffing is planned for a later version.
- Math (KaTeX) rendering is not bundled.
- Frontmatter is rendered as plain text inside the document body.
- Icons are simple placeholders; replace `extension/public/icons/*` (or rerun `node scripts/gen-icons.mjs` after editing it) before publishing.

## How it works

A single content script is injected at `document_start` on URLs whose path ends in `.md` or `.markdown`. It hides `<html>` until rendering completes, reads the raw text from Chrome's default `<pre>`-wrapped text view, runs it through `marked` → `DOMPurify` → `highlight.js`, builds a TOC, and replaces the body with the rendered shell. Mermaid is dynamically imported only when a `mermaid` fence is present.

If the page is not actually a `<pre>`-wrapped plain-text page (e.g. a SPA route that happens to end in `.md`), the script bails immediately and leaves the page untouched.

See [docs/superpowers/specs/2026-04-30-chrome-extension-markdown-viewer-design.md](../docs/superpowers/specs/2026-04-30-chrome-extension-markdown-viewer-design.md) for the full design.
