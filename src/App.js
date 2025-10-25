import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertPdfToMarkdown } from './pdfToMarkdown';
import './App.css';

function App() {
  const [markdown, setMarkdown] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const fileInputRef = useRef(null);

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

  return (
    <div className="app">
      <header className="header">
        <h1>MDView</h1>
        <p>Markdown & PDF Viewer with Conversion</p>
      </header>

      <main className="main">
        {!markdown ? (
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
                <button
                  className="upload-button"
                  onClick={handleButtonClick}
                >
                  Choose File
                </button>
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
                <button className="clear-button" onClick={handleClear}>
                  Clear
                </button>
              </div>
            </div>
            <div className="markdown-content">
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
