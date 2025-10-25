# MDView - Web Markdown & PDF Viewer

A web-only markdown and PDF viewer that allows users to drag & drop or select markdown files to view their content in the browser. **PDF files are automatically converted to markdown for viewing and download.**

## Features

- **Markdown & PDF Support**: Upload `.md` or `.pdf` files - PDFs are automatically converted to markdown
- **Drag & Drop**: Simply drag your `.md` or `.pdf` file onto the upload area
- **File Picker**: Click the "Choose File" button to select markdown or PDF files
- **PDF to Markdown Conversion**: Automatic conversion of PDF content to formatted markdown
- **Live Preview**: View your content rendered in real-time
- **Download Converted Files**: Download the converted markdown version of your PDF
- **GitHub Flavored Markdown**: Supports tables, strikethrough, task lists, and more
- **Responsive Design**: Works on desktop and mobile devices
- **Clean Interface**: Modern, minimal design with syntax highlighting

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

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

**Alternative: Static Server (Production-like)**
For a production-like experience without hot reload:
```bash
npm run build
npm run serve
```
This serves the built files statically on port 9876.

**Offline Usage (Recommended)**
For the best offline experience, use a static server:
```bash
npm run build:single
npm run serve
```
Then open `http://localhost:9876`

**Single File Version**
The `md.html` file is a completely self-contained version (715 KB) that includes:
- All JavaScript bundled inline
- All CSS bundled inline
- PDF to Markdown conversion
- No external dependencies

**Important**: Due to React 18 limitations, the single file works best when served from a web server (not opened directly with file://). Use `npm run serve` to test it locally.

**Note**: PDF parsing uses PDF.js which loads the worker script from a CDN, so internet access is required for PDF conversion.

## Usage

1. **Drag & Drop Method**: Drag a `.md` or `.pdf` file from your file explorer and drop it onto the upload area
2. **File Picker Method**: Click the "Choose File" button and select a markdown or PDF file
3. **PDF Conversion**: If you upload a PDF, it will be automatically converted to markdown format
4. **View Content**: The content will be rendered in the viewer
5. **Download**: Click the "Download MD" button to download the converted markdown file (for PDFs) or the original markdown
6. **Clear**: Click the "Clear" button to remove the current file and start over

## Supported File Types

- `.md` files (Markdown)
- `.markdown` files (alternative extension)
- `.pdf` files (automatically converted to markdown)

## Features in Detail

- **Syntax Highlighting**: Code blocks are properly formatted and highlighted
- **Tables**: Full support for GitHub-style markdown tables
- **Links**: Clickable links that open in new tabs
- **Images**: Image support (if referenced in markdown)
- **Lists**: Ordered and unordered lists with proper nesting
- **Blockquotes**: Styled blockquotes with left border
- **Code Blocks**: Syntax-highlighted code with scrollable containers

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Build for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `build/` directory.

## Self-Contained Browser Version

### Option 1: Multi-File Version (build directory)
The `build/` directory contains a **complete, self-contained version** that can be:

- ✅ Opened directly in any browser (double-click `build/index.html`)
- ✅ Shared as a ZIP file
- ✅ Uploaded to any web hosting service
- ✅ Run completely offline
- ✅ Distributed via email or file sharing

### Option 2: Single File Version ⭐ (RECOMMENDED)
For maximum portability, use the **single file version**:

- ✅ **`md.html`** - One file contains everything (343KB)
- ✅ **No external files** required
- ✅ **Perfect for sharing** via email, USB, or any file transfer
- ✅ **Just double-click** to open in any browser
- ✅ **Zero setup** required

**Download:** `mdview-single.zip` (includes `md.html`, documentation, and example)

### Usage

1. Run `npm run build`
2. Open `build/index.html` directly in your browser
3. The application will work completely offline!

### Alternative: Serve Locally

If you want to serve it locally (optional):

```bash
npm install -g serve
serve -s build
```

Then open `http://localhost:5000`

## License

This project is open source and available under the [MIT License](LICENSE).
