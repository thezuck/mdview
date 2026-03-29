import React, { useState, useCallback, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { getHtml2PdfCanvasOptions } from './html2pdfCanvasOptions';
import { parse, HtmlGenerator } from 'latex.js';

// Detect language from LaTeX commands (XeLaTeX/polyglossia style preferred for RTL)
const detectLanguage = (latexText) => {
  // Priority 1: Check for polyglossia \setdefaultlanguage (XeLaTeX style - best for RTL)
  const defaultLangMatch = latexText.match(/\\setdefaultlanguage\{([^}]+)\}/);
  if (defaultLangMatch) {
    const lang = defaultLangMatch[1].toLowerCase();
    if (lang === 'hebrew') return 'he';
    if (lang === 'arabic') return 'ar';
    if (lang === 'english') return 'en';
    return lang;
  }
  
  // Check for polyglossia \setotherlanguage with hebrew/arabic (XeLaTeX style)
  const otherLangMatch = latexText.match(/\\setotherlanguage\{(hebrew|arabic)\}/i);
  if (otherLangMatch) {
    const lang = otherLangMatch[1].toLowerCase();
    if (lang === 'hebrew') return 'he';
    if (lang === 'arabic') return 'ar';
  }
  
  // Priority 2: Check for polyglossia package usage (XeLaTeX)
  if (latexText.includes('\\usepackage{polyglossia}') || latexText.includes('\\usepackage[polyglossia]')) {
    // If polyglossia is used, check for hebrew/arabic in document
    if (latexText.match(/\\texthebrew|\\begin\{hebrew\}|\{hebrew\}/i)) return 'he';
    if (latexText.match(/\\textarabic|\\begin\{arabic\}|\{arabic\}/i)) return 'ar';
  }
  
  // Priority 3: Check for babel language options (pdfLaTeX style)
  const babelMatch = latexText.match(/\\usepackage(\[[^\]]*\])?\{babel\}/);
  if (babelMatch) {
    const options = (babelMatch[1] || '').toLowerCase();
    if (options.includes('hebrew')) return 'he';
    if (options.includes('arabic')) return 'ar';
  }
  
  // Priority 4: Check for bidi package (often used with polyglossia for RTL)
  if (latexText.includes('\\usepackage{bidi}')) {
    // Check for RTL indicators in content
    if (latexText.match(/\\begin\{RTL\}|\\RTL/i)) return 'he'; // Default to Hebrew if RTL detected
  }
  
  // Priority 5: Check document class language options
  const docClassMatch = latexText.match(/\\documentclass\[[^\]]*?([a-z]{2})[^\]]*?\]/);
  if (docClassMatch) {
    const lang = docClassMatch[1].toLowerCase();
    if (lang === 'he' || lang === 'ar') return lang;
  }
  
  // Check for XeLaTeX indicator
  if (latexText.includes('\\XeTeXinputencoding') || latexText.match(/\\usepackage\{fontspec\}/)) {
    // XeLaTeX document - check for Hebrew/Arabic fonts or text
    if (latexText.match(/\\newfontfamily\\hebrewfont/i)) return 'he';
    if (latexText.match(/\\newfontfamily\\arabicfont/i)) return 'ar';
  }
  
  return 'en'; // default
};

// Extract font family from LaTeX commands (XeLaTeX/fontspec style)
const extractFontFamily = (latexText) => {
  // Try to match \newfontfamily\hebrewfont[...]{fontname} (XeLaTeX style)
  const fontMatch = latexText.match(/\\newfontfamily\\hebrewfont[^{]*\{([^}]+)\}/);
  if (fontMatch) {
    return fontMatch[1];
  }
  // Try to match \newfontfamily\arabicfont[...]{fontname} (XeLaTeX style)
  const arabicFontMatch = latexText.match(/\\newfontfamily\\arabicfont[^{]*\{([^}]+)\}/);
  if (arabicFontMatch) {
    return arabicFontMatch[1];
  }
  // Try to match \newfontfamily\hebrewfontsf[...]{fontname}
  const fontSfMatch = latexText.match(/\\newfontfamily\\hebrewfontsf[^{]*\{([^}]+)\}/);
  if (fontSfMatch) {
    return fontSfMatch[1];
  }
  // Try to match \setmainfont (XeLaTeX/fontspec)
  const mainFontMatch = latexText.match(/\\setmainfont[^{]*\{([^}]+)\}/);
  if (mainFontMatch) {
    return mainFontMatch[1];
  }
  return null;
};

// Preprocess LaTeX to handle packages that latex.js might not support
const preprocessLaTeX = (latexText) => {
  let processed = latexText;
  
  // Split into preamble and document parts
  const docStartIndex = processed.indexOf('\\begin{document}');
  if (docStartIndex === -1) {
    // If no document start found, return as-is (latex.js will error, but we'll handle it)
    return processed;
  }
  
  // Comment out problematic packages/commands in preamble that latex.js might not handle well
  // These packages are often not critical for basic text rendering
  const problematicPackages = [
    'tikz',
    'pgfplots',
  ];
  
  // Comment out problematic packages before document start
  const preamble = processed.substring(0, docStartIndex);
  const document = processed.substring(docStartIndex);
  
  let cleanedPreamble = preamble;
  
  // Comment out problematic packages
  problematicPackages.forEach(pkg => {
    // Match \usepackage{tikz} or \usepackage[options]{tikz} on its own line or with spacing
    const pkgRegex = new RegExp(`(^|\\n)\\s*\\\\usepackage(\\[[^\\]]*\\])?\\{${pkg}\\}(\\s|\\n|$)`, 'gm');
    cleanedPreamble = cleanedPreamble.replace(pkgRegex, (match) => {
      return match.replace(/\\usepackage/, '% \\usepackage') + ' % latex.js compatibility';
    });
  });
  
  // Comment out pgfplotsset commands
  cleanedPreamble = cleanedPreamble.replace(/^(\s*\\pgfplotsset\{[^}]*\})/gm, (match) => {
    return '% ' + match.trim() + ' % pgfplots not fully supported';
  });
  
  // Ensure geometry package usage is simplified (latex.js might have issues with complex options)
  // We'll keep geometry but latex.js should handle basic usage
  
  // Recombine
  processed = cleanedPreamble + document;
  
  return processed;
};

// Basic LaTeX to HTML fallback converter (for when latex.js fails)
const basicLatexToHtml = (latexText) => {
  let html = latexText;
  const lang = detectLanguage(latexText);
  const isRTL = lang === 'he' || lang === 'ar';
  const fontFamily = extractFontFamily(latexText);
  
  // Remove comments
  html = html.replace(/^%.*$/gm, '');
  
  // Remove preamble commands
  html = html.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\geometry\{[^}]*\}/g, '');
  html = html.replace(/\\pgfplotsset\{[^}]*\}/g, '');
  html = html.replace(/\\setdefaultlanguage\{[^}]*\}/g, '');
  html = html.replace(/\\setotherlanguage\{[^}]*\}/g, '');
  html = html.replace(/\\newfontfamily[^{]*\{[^}]*\}/g, '');
  html = html.replace(/\\begin\{document\}/g, '');
  html = html.replace(/\\end\{document\}/g, '');
  
  // Handle sections
  html = html.replace(/\\section\{(.*?)\}/g, '<h1>$1</h1>');
  html = html.replace(/\\subsection\{(.*?)\}/g, '<h2>$1</h2>');
  html = html.replace(/\\subsubsection\{(.*?)\}/g, '<h3>$1</h3>');
  
  // Handle formatting
  html = html.replace(/\\textbf\{(.*?)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{(.*?)\}/g, '<em>$1</em>');
  html = html.replace(/\\texttt\{(.*?)\}/g, '<code>$1</code>');
  
  // Handle paragraphs
  html = html.split(/\n\s*\n/).map(para => {
    para = para.trim();
    if (para && !para.match(/^<[hulol]/)) {
      return `<p>${para}</p>`;
    }
    return para;
  }).join('\n');
  
  const direction = isRTL ? 'rtl' : 'ltr';
  const fontStyle = fontFamily ? `font-family: "${fontFamily}", sans-serif;` : '';
  
  html = `<div dir="${direction}" lang="${lang}"${fontStyle ? ` style="${fontStyle}"` : ''}>${html}</div>`;
  
  return { html, lang, isRTL, fontFamily, isXeLaTeXStyle: false };
};

// Convert LaTeX to HTML using latex.js library (supports XeLaTeX-style documents)
const latexToHtml = (latexText) => {
  // Extract language and font info first (before any processing)
  const lang = detectLanguage(latexText);
  const isRTL = lang === 'he' || lang === 'ar';
  const fontFamily = extractFontFamily(latexText);
  const isXeLaTeXStyle = latexText.includes('\\usepackage{polyglossia}') || 
                        latexText.includes('\\usepackage{fontspec}') ||
                        latexText.includes('\\setdefaultlanguage');
  
  // Preprocess to handle unsupported packages
  const preprocessed = preprocessLaTeX(latexText);
  
  try {
    // Parse LaTeX using latex.js
    const generator = new HtmlGenerator({
      hyphenate: false, // Disable hyphenation for RTL languages
    });
    
    const result = parse(preprocessed, { generator });
    
    // Get HTML content from the parsed document
    const htmlDocument = result.htmlDocument();
    let bodyContent = htmlDocument.body.innerHTML;
    
    // Ensure RTL is properly set if detected
    if (isRTL && bodyContent) {
      // Wrap content in a div with proper RTL direction if not already set
      if (!bodyContent.includes('dir=') && !bodyContent.includes('direction')) {
        bodyContent = `<div dir="rtl" lang="${lang}">${bodyContent}</div>`;
      }
    }
    
    // Apply font family if specified
    if (fontFamily && bodyContent) {
      bodyContent = `<div style="font-family: &quot;${fontFamily}&quot;, sans-serif;">${bodyContent}</div>`;
    }
    
    // Get stylesheets from the document
    const stylesheets = Array.from(htmlDocument.head.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => link.outerHTML)
      .join('\n');
    
    return { 
      html: bodyContent, 
      stylesheets,
      lang, 
      isRTL, 
      fontFamily,
      isXeLaTeXStyle
    };
  } catch (error) {
    console.error('LaTeX parsing error with latex.js, falling back to basic parser:', error);
    console.log('Error details:', error.message);
    
    // Fallback to basic parser that handles the essential structure
    try {
      return basicLatexToHtml(latexText);
    } catch (fallbackError) {
      console.error('Basic parser also failed:', fallbackError);
      // Last resort: show content with error message
      return { 
        html: `<div class="latex-error" dir="${isRTL ? 'rtl' : 'ltr'}" lang="${lang}">
          <p><strong>Warning:</strong> Could not fully parse LaTeX document.</p>
          <p>Error: ${error.message}</p>
          <details>
            <summary>Show document content</summary>
            <pre>${latexText.substring(0, 2000)}${latexText.length > 2000 ? '...' : ''}</pre>
          </details>
        </div>`, 
        stylesheets: '',
        lang, 
        isRTL, 
        fontFamily,
        isXeLaTeXStyle
      };
    }
  }
};

function LaTeXView() {
  const [latexContent, setLatexContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [documentLang, setDocumentLang] = useState('en');
  const [isRTL, setIsRTL] = useState(false);
  const [fontFamily, setFontFamily] = useState(null);
  const fileInputRef = useRef(null);
  const previewContentRef = useRef(null);
  const editorPreviewRef = useRef(null);

  const readFile = useCallback((file) => {
    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith('.tex')) {
      setError('Please select a LaTeX (.tex) file');
      return;
    }

    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      setLatexContent(e.target.result);
    };
    reader.onerror = () => {
      setError('Error reading file');
    };
    reader.readAsText(file);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      readFile(file);
    }
  }, [readFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      readFile(files[0]);
    }
  }, [readFile]);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(() => {
    setLatexContent('');
    setFileName('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!latexContent) return;

    const blob = new Blob([latexContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [latexContent, fileName]);

  const handleCreateNew = useCallback(() => {
    setIsCreatingNew(true);
    // Use XeLaTeX-style template with polyglossia for better RTL support
    setEditorContent('\\documentclass[12pt, a4paper]{article}\n\\usepackage{fontspec}\n\\usepackage{polyglossia}\n\\setdefaultlanguage{english}\n% For Hebrew documents, use: \\setdefaultlanguage{hebrew}\n% For Arabic documents, use: \\setdefaultlanguage{arabic}\n\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\n\\begin{document}\n\n\\title{My Document}\n\\author{Your Name}\n\\maketitle\n\n\\section{Introduction}\n\nStart writing your LaTeX document here.\n\n% For Hebrew text, use: \\texthebrew{עברית}\n% For Arabic text, use: \\textarabic{عربي}\n\n\\end{document}');
    setLatexContent('');
    setFileName('new-document.tex');
    setError('');
  }, []);

  const handleEditorChange = useCallback((e) => {
    setEditorContent(e.target.value);
  }, []);

  const handleSaveNew = useCallback(() => {
    setLatexContent(editorContent);
    setIsCreatingNew(false);
  }, [editorContent]);

  const handleCancelNew = useCallback(() => {
    setIsCreatingNew(false);
    setEditorContent('');
    setFileName('');
  }, []);

  const handleDownloadNew = useCallback(() => {
    if (!editorContent) return;

    const blob = new Blob([editorContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'new-document.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [editorContent, fileName]);

  const handleDownloadPdf = useCallback(() => {
    if (!previewContentRef.current) return;

    const pdfFileName = fileName.replace(/\.tex$/, '.pdf') || 'document.pdf';
    
    const opt = {
      margin: 0.5,
      filename: pdfFileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: getHtml2PdfCanvasOptions(),
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(previewContentRef.current).save();
  }, [fileName]);

  const handleDownloadPdfFromEditor = useCallback(() => {
    if (!editorPreviewRef.current) return;

    const pdfFileName = fileName.replace(/\.tex$/, '.pdf') || 'new-document.pdf';
    
    const opt = {
      margin: 0.5,
      filename: pdfFileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: getHtml2PdfCanvasOptions(),
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(editorPreviewRef.current).save();
  }, [fileName]);

  const handlePrint = useCallback(() => {
    const contentRef = isCreatingNew ? editorPreviewRef : previewContentRef;
    if (!contentRef.current) return;

    const dir = isRTL ? 'rtl' : 'ltr';
    const lang = documentLang || 'en';
    const font = fontFamily ? `"${fontFamily}", sans-serif` : 'serif';
    const dirStyle = isRTL ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${lang}" dir="${dir}">
        <head>
          <title>Print</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: ${font}; 
              padding: 20px; 
              ${dirStyle}
            }
            h1, h2, h3, h4 { color: #333; }
            code { background: #f4f4f4; padding: 2px 4px; }
            pre { background: #f4f4f4; padding: 10px; }
            blockquote { ${isRTL ? 'border-right: 4px solid #ccc; padding-right: 10px; margin-right: 0;' : 'border-left: 4px solid #ccc; padding-left: 10px; margin-left: 0;'} }
            .math { margin: 10px 0; }
          </style>
        </head>
        <body>
          ${contentRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [isCreatingNew, isRTL, documentLang, fontFamily]);

  // Update preview when content changes
  useEffect(() => {
    const content = isCreatingNew ? editorContent : latexContent;
    const previewRef = isCreatingNew ? editorPreviewRef : previewContentRef;
    
    if (previewRef.current && content) {
      const result = latexToHtml(content);
      
      // Inject stylesheets if any - create link elements in document head
      if (result.stylesheets) {
        // Remove old latex.js stylesheets first
        const existingStyles = document.querySelectorAll('link[data-latex-js]');
        existingStyles.forEach(link => link.remove());
        
        // Parse the stylesheet HTML and create actual link elements
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = result.stylesheets;
        const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
          const newLink = document.createElement('link');
          newLink.rel = 'stylesheet';
          newLink.href = link.href;
          newLink.setAttribute('data-latex-js', 'true');
          // Try to resolve relative URLs to node_modules
          if (link.href && !link.href.startsWith('http') && link.href.includes('css/')) {
            // For webpack/bundler, we might need to use require or import
            // For now, try to construct a path
            const href = link.href.startsWith('/') ? link.href : `/${link.href}`;
            newLink.href = href;
          }
          document.head.appendChild(newLink);
        });
      }
      
      previewRef.current.innerHTML = result.html;
      
      // Update language state
      setDocumentLang(result.lang || 'en');
      setIsRTL(result.isRTL || false);
      setFontFamily(result.fontFamily || null);
      
      // Apply direction and language to preview container
      if (previewRef.current) {
        previewRef.current.setAttribute('dir', result.isRTL ? 'rtl' : 'ltr');
        previewRef.current.setAttribute('lang', result.lang || 'en');
        if (result.fontFamily) {
          previewRef.current.style.fontFamily = `"${result.fontFamily}", sans-serif`;
        } else {
          previewRef.current.style.fontFamily = '';
        }
      }
    } else if (previewRef.current && !content) {
      previewRef.current.innerHTML = '';
      setDocumentLang('en');
      setIsRTL(false);
      setFontFamily(null);
      
      // Clean up stylesheets
      const existingStyles = document.querySelectorAll('link[data-latex-js]');
      existingStyles.forEach(link => link.remove());
      
      if (previewRef.current) {
        previewRef.current.setAttribute('dir', 'ltr');
        previewRef.current.setAttribute('lang', 'en');
        previewRef.current.style.fontFamily = '';
      }
    }
  }, [latexContent, editorContent, isCreatingNew]);

  return (
    <>
      {isCreatingNew ? (
        <div className="editor-container">
          <div className="editor-header">
            <h2>Create New LaTeX Document</h2>
            <div className="editor-header-buttons">
              <button className="download-button" onClick={handleDownloadNew}>
                Download TEX
              </button>
              <button className="download-pdf-button" onClick={handleDownloadPdfFromEditor}>
                Download PDF
              </button>
              <button className="download-pdf-button" onClick={handlePrint}>
                Print
              </button>
              <button className="save-button" onClick={handleSaveNew}>
                Save & Preview
              </button>
              <button className="clear-button" onClick={handleCancelNew}>
                Cancel
              </button>
            </div>
          </div>
          <div className="editor-content">
            <div className="editor-pane">
              <h3>Editor</h3>
              <textarea
                className="markdown-editor"
                value={editorContent}
                onChange={handleEditorChange}
                placeholder="Type your LaTeX code here..."
                spellCheck="false"
              />
            </div>
            <div className="preview-pane">
              <h3>Preview</h3>
              <div className="markdown-content latex-content" ref={editorPreviewRef} />
            </div>
          </div>
        </div>
      ) : !latexContent ? (
        <div
          className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-content">
            <div className="upload-icon">📝</div>
            <h2>Drop your LaTeX file here</h2>
            <p>or click to browse</p>
            <div className="upload-buttons">
              <button
                className="upload-button"
                onClick={handleButtonClick}
              >
                Choose File
              </button>
              <button
                className="create-new-button"
                onClick={handleCreateNew}
              >
                Create New
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tex"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="viewer">
          <div className="viewer-header">
            <div className="viewer-header-left">
              <h2>{fileName}</h2>
            </div>
            <div className="viewer-header-buttons">
              <button className="download-button" onClick={handleDownload}>
                Download TEX
              </button>
              <button className="download-pdf-button" onClick={handleDownloadPdf}>
                Download PDF
              </button>
              <button className="download-pdf-button" onClick={handlePrint}>
                Print
              </button>
              <button className="clear-button" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>
          <div className="markdown-content latex-content" ref={previewContentRef} />
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </>
  );
}

export default LaTeXView;

