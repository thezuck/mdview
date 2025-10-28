import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';
import { convertPdfToMarkdown } from './pdfToMarkdown';
import './App.css';

function App() {
  const [markdown, setMarkdown] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const fileInputRef = useRef(null);
  const viewerContentRef = useRef(null);
  const editorPreviewRef = useRef(null);

  const readFile = useCallback(async (file) => {
    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith('.md') && !fileName.endsWith('.pdf')) {
      setError('Please select a markdown (.md) or PDF (.pdf) file');
      return;
    }

    setError('');
    setFileName(file.name);
    setIsPdf(fileName.endsWith('.pdf'));

    if (fileName.endsWith('.pdf')) {
      // Handle PDF conversion
      setIsLoading(true);
      try {
        const result = await convertPdfToMarkdown(file);

        if (result.success) {
          setMarkdown(result.markdown);
          setFileName(result.originalName);
        } else {
          setError(result.error || 'Failed to convert PDF to markdown');
        }
      } catch (error) {
        setError('Failed to convert PDF: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Handle markdown files
      const reader = new FileReader();
      reader.onload = (e) => {
        setMarkdown(e.target.result);
      };
      reader.onerror = () => {
        setError('Error reading file');
      };
      reader.readAsText(file);
    }
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
    setMarkdown('');
    setFileName('');
    setError('');
    setIsPdf(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!markdown) return;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'converted-document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, fileName]);

  const handleCreateNew = useCallback(() => {
    setIsCreatingNew(true);
    setEditorContent('# New Markdown Document\n\nStart typing your markdown here...');
    setMarkdown('');
    setFileName('new-document.md');
    setError('');
  }, []);

  const handleEditorChange = useCallback((e) => {
    setEditorContent(e.target.value);
  }, []);

  const handleSaveNew = useCallback(() => {
    setMarkdown(editorContent);
    setIsCreatingNew(false);
  }, [editorContent]);

  const handleCancelNew = useCallback(() => {
    setIsCreatingNew(false);
    setEditorContent('');
    setFileName('');
  }, []);

  const handleDownloadNew = useCallback(() => {
    if (!editorContent) return;

    const blob = new Blob([editorContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'new-document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [editorContent, fileName]);

  const handleDownloadPdf = useCallback(() => {
    if (!viewerContentRef.current) return;

    const pdfFileName = fileName.replace(/\.md$/, '.pdf') || 'document.pdf';
    
    const opt = {
      margin: 0.5,
      filename: pdfFileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(viewerContentRef.current).save();
  }, [fileName]);

  const handleDownloadPdfFromEditor = useCallback(() => {
    if (!editorPreviewRef.current) return;

    const pdfFileName = fileName.replace(/\.md$/, '.pdf') || 'new-document.pdf';
    
    const opt = {
      margin: 0.5,
      filename: pdfFileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(editorPreviewRef.current).save();
  }, [fileName]);

  return (
    <div className="app">
      <header className="header">
        <h1>MDView</h1>
        <p>Markdown & PDF Viewer with Conversion</p>
      </header>

      <main className="main">
        {isCreatingNew ? (
          <div className="editor-container">
            <div className="editor-header">
              <h2>Create New Markdown</h2>
              <div className="editor-header-buttons">
                <button className="download-button" onClick={handleDownloadNew}>
                  Download MD
                </button>
                <button className="download-pdf-button" onClick={handleDownloadPdfFromEditor}>
                  Download PDF
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
                  placeholder="Type your markdown here..."
                  spellCheck="false"
                />
              </div>
              <div className="preview-pane">
                <h3>Preview</h3>
                <div className="markdown-content" ref={editorPreviewRef}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {editorContent}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ) : !markdown ? (
          <div
            className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-content">
              <div className="upload-icon">{isLoading ? '⏳' : '📄'}</div>
              <h2>
                {isLoading
                  ? 'Converting PDF to Markdown...'
                  : 'Drop your markdown or PDF file here'
                }
              </h2>
              <p>
                {isLoading
                  ? 'Please wait while we process your PDF'
                  : 'or click to browse'
                }
              </p>
              {!isLoading && (
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
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="viewer">
            <div className="viewer-header">
              <div className="viewer-header-left">
                <h2>{fileName}</h2>
                {isPdf && <span className="pdf-indicator">Converted from PDF</span>}
              </div>
              <div className="viewer-header-buttons">
                <button className="download-button" onClick={handleDownload}>
                  Download MD
                </button>
                <button className="download-pdf-button" onClick={handleDownloadPdf}>
                  Download PDF
                </button>
                <button className="clear-button" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>
            <div className="markdown-content" ref={viewerContentRef}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
