# MDView - Multi-Purpose Web Viewer

A comprehensive web application for viewing and working with markdown, PDFs, JSON, and logs. Features drag & drop support, PDF to markdown conversion, AI-powered log analysis, and more.

## Features

### 📄 Markdown Viewer
- **Markdown & PDF Support**: Upload `.md` or `.pdf` files - PDFs are automatically converted to markdown
- **Drag & Drop**: Simply drag your `.md` or `.pdf` file onto the upload area
- **File Picker**: Click the "Choose File" button to select markdown or PDF files
- **PDF to Markdown Conversion**: Automatic conversion of PDF content to formatted markdown
- **Live Preview**: View your content rendered in real-time
- **Download Converted Files**: Download the converted markdown version of your PDF
- **Download as PDF**: Export markdown content as PDF
- **Markdown Editor**: Create and edit markdown with live preview
- **GitHub Flavored Markdown**: Supports tables, strikethrough, task lists, and more
- **Enhanced Tables**: 
  - Resizable columns (drag column borders)
  - Sortable columns (click sort button in header)
  - Hide/show columns (click eye icon in header)
  - Adjustable row heights (drag row resize handles)
  - Apply row height to all rows
- **Color Hints**: Use `[#ff0000]text` syntax to color text in markdown
- **Responsive Design**: Works on desktop and mobile devices
- **Clean Interface**: Modern, minimal design with syntax highlighting

### 📊 JSON Viewer
- **JSON Formatting**: Automatically formats and highlights JSON
- **Syntax Highlighting**: Color-coded JSON structure
- **String Truncation**: Long strings are truncated with "View Full" option
- **Format/Minify**: Format or minify JSON with one click
- **Full Content Overlay**: View complete content in a modal overlay
- **Copy to Clipboard**: Easy copying of JSON content
- **Auto-formatting**: Automatically formats valid JSON on paste

### 📋 Log View
- **Structured Log Parsing**: Automatically parses logs with timestamps and JSON data
- **Multiple Timestamp Formats**: Supports various timestamp patterns
- **JSON Extraction**: Extracts and displays embedded JSON from log entries
- **ANSI Color Support**: Renders ANSI color codes in log output
- **Advanced Filtering**: 
  - Multiple include/exclude filters
  - Enable/disable filters on the fly
  - Edit filters inline
  - Filter tags with visual indicators
- **Resizable Panels**: Adjustable split view between input and output
- **Expandable View**: Full-screen overlay for better log viewing
- **Copy Log Entries**: One-click copy for individual log entries
- **Sample Logs**: Load sample logs to see the viewer in action

### 🤖 Log Analysis (AI-Powered)
- **WebLLM Integration**: AI-powered log analysis using WebGPU
- **Multiple Models**: Choose from Phi-3.5 Mini or Llama 3.2 1B
- **Context Window Management**: Configurable context sizes (64K-128K tokens)
- **Streaming Responses**: Real-time analysis as the AI generates results
- **Large Log Support**: Windowed analysis for logs exceeding context limits
- **Model Caching**: Models are cached in browser for faster subsequent loads
- **Model Backup/Restore**: Save and restore model files
- **Memory Optimization**: Automatically reduces context if memory errors occur
- **Stop Analysis**: Ability to stop ongoing analysis

## Usage

### Quick Start (Single File Version)

The easiest way to use MDView is with the single file version:

1. **Download** `md.html` to your computer
2. **Open** `md.html` in any web browser (double-click or drag to browser)
3. **Use** - Drag markdown files onto the page or click "Choose File"

**Note**: The single file version works best when served from a web server. Use `npm run serve` to test it locally.

### Development Setup

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:9876`

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `build/` directory.

### Single File Build

To create the self-contained single file version:

```bash
npm run build:single
```

This creates `md.html` which contains everything in one file (~700KB).

### Serving Locally

For a production-like experience:

```bash
npm run build
npm run serve
```

This serves the built files statically on port 9876.

## Supported File Types

- `.md` files (Markdown)
- `.markdown` files (alternative extension)
- `.pdf` files (automatically converted to markdown)

## Features in Detail

### Markdown Features
- **Syntax Highlighting**: Code blocks are properly formatted and highlighted
- **Tables**: Full support for GitHub-style markdown tables with enhanced features
- **Links**: Clickable links that open in new tabs
- **Images**: Image support (if referenced in markdown)
- **Lists**: Ordered and unordered lists with proper nesting
- **Blockquotes**: Styled blockquotes with left border
- **Code Blocks**: Syntax-highlighted code with scrollable containers
- **Color Hints**: Use `[#ff0000]your text` to color text (supports hex colors like `#ff0000` or `#f00`)

### Table Enhancements
- **Resize Columns**: Drag the right edge of any column header to resize
- **Sort Columns**: Click the ⇅ button in column headers to sort (ascending/descending)
- **Hide Columns**: Click the 👁️ button to hide/show columns
- **Resize Rows**: Drag the bottom edge of any row to adjust height
- **Apply Height to All**: When resizing a row, you'll be prompted to apply the height to all rows

### Log Analysis Requirements
- **WebGPU**: Required for AI-powered log analysis. Enable in Chrome via `chrome://flags` (search for "WebGPU")
- **Model Download**: First-time use downloads the selected model (2.7GB for Phi-3.5 Mini, 0.8GB for Llama 3.2 1B)
- **Browser Cache**: Models are cached in IndexedDB for faster subsequent loads

## Browser Compatibility

- Chrome (latest) - ✅ Full support including WebGPU
- Firefox (latest) - ✅ Full support
- Safari (latest) - ✅ Full support
- Edge (latest) - ✅ Full support

**Note**: WebGPU (required for Log Analysis) is available in Chrome/Edge. Firefox and Safari support is coming.

## Project Structure

```
mdview/
├── src/
│   ├── App.js              # Main application component
│   ├── JsonView.js          # JSON viewer component
│   ├── LogView.js           # Structured log viewer component
│   ├── LogAnalysis.js       # AI-powered log analysis component
│   ├── pdfToMarkdown.js     # PDF conversion utility
│   └── App.css              # Styles
├── build/                   # Production build output
├── md.html                  # Single file version
├── public/                  # Public assets
└── package.json             # Dependencies and scripts
```

## Scripts

- `npm start` - Start development server (port 9876)
- `npm run build` - Build for production
- `npm run build:single` - Build and create single file version
- `npm run serve` - Serve production build locally (port 9876)
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Self-Contained Versions

### Option 1: Multi-File Version (build directory)
The `build/` directory contains a **complete, self-contained version** that can be:
- ✅ Opened directly in any browser (double-click `build/index.html`)
- ✅ Shared as a ZIP file
- ✅ Uploaded to any web hosting service
- ✅ Run completely offline
- ✅ Distributed via email or file sharing

### Option 2: Single File Version ⭐ (RECOMMENDED)
For maximum portability, use the **single file version**:
- ✅ **`md.html`** - One file contains everything (~700KB)
- ✅ **No external files** required
- ✅ **Perfect for sharing** via email, USB, or any file transfer
- ✅ **Just double-click** to open in any browser
- ✅ **Zero setup** required

**Note**: PDF parsing uses PDF.js which loads the worker script from a CDN, so internet access is required for PDF conversion in the single file version.

## License

This project is open source and available under the [MIT License](LICENSE).
