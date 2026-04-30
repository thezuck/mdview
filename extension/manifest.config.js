import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'MDView — Markdown Viewer',
  version: pkg.version,
  description: 'Auto-renders markdown files (.md, .markdown) when opened in Chrome.',
  permissions: ['storage'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['file:///*', '*://*/*'],
      include_globs: [
        '*.md',
        '*.markdown',
        '*.md?*',
        '*.markdown?*',
        '*.md#*',
        '*.markdown#*',
      ],
      js: ['src/content/index.js'],
      css: ['src/content/hide-body.css'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  options_ui: {
    page: 'src/options/options.html',
    open_in_tab: true,
  },
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
});
