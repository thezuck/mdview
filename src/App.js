import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import html2pdf from 'html2pdf.js';
import { convertPdfToMarkdown } from './pdfToMarkdown';
import LogAnalysis from './LogAnalysis';
import LogView from './LogView';
import JsonView from './JsonView';
import './App.css';

// Function to clean up HTML entities in table cells
const preprocessMarkdown = (markdownText) => {
  // Process table rows
  const lines = markdownText.split('\n');
  const processedLines = lines.map(line => {
    // Check if this is a table row (contains |)
    if (line.includes('|')) {
      // Split by | and process each cell
      const cells = line.split('|');
      const processedCells = cells.map(cell => {
        let processed = cell;
        
        // Convert HTML entities (but keep <br> tags as-is)
        processed = processed.replace(/&nbsp;/gi, ' ');
        processed = processed.replace(/&lt;/gi, '<');
        processed = processed.replace(/&gt;/gi, '>');
        processed = processed.replace(/&amp;/gi, '&');
        
        return processed;
      });
      return processedCells.join('|');
    }
    return line;
  });
  
  return processedLines.join('\n');
};

function App() {
  const [activeTab, setActiveTab] = useState('markdown');
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

  // Make table columns resizable, hideable, sortable, and rows height-adjustable
  useEffect(() => {
    const applyColorHints = (contentRef) => {
      if (!contentRef.current) return;
      
      // Find all text nodes and apply color hints
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          // Match color hints like [#ff0000] or [#f00]
          const colorHintRegex = /\[(#[0-9A-Fa-f]{3,6})\]/g;
          
          if (colorHintRegex.test(text)) {
            // Reset regex
            colorHintRegex.lastIndex = 0;
            
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            
            while ((match = colorHintRegex.exec(text)) !== null) {
              const color = match[1];
              const matchStart = match.index;
              const matchEnd = colorHintRegex.lastIndex;
              
              // Add text before the color hint (if any)
              if (matchStart > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchStart)));
              }
              
              // Find the end of the text to color (until next color hint, newline, or end)
              const remainingText = text.substring(matchEnd);
              const nextColorMatch = remainingText.match(/\[(#[0-9A-Fa-f]{3,6})\]/);
              const nextNewline = remainingText.indexOf('\n');
              
              let endIndex = remainingText.length;
              if (nextColorMatch && (nextNewline === -1 || nextColorMatch.index < nextNewline)) {
                endIndex = nextColorMatch.index;
              } else if (nextNewline !== -1) {
                endIndex = nextNewline;
              }
              
              const coloredText = remainingText.substring(0, endIndex);
              
              if (coloredText) {
                const span = document.createElement('span');
                span.style.color = color;
                span.textContent = coloredText;
                fragment.appendChild(span);
              }
              
              lastIndex = matchEnd + endIndex;
            }
            
            // Add any remaining text
            if (lastIndex < text.length) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            // Replace the text node with the fragment
            node.parentNode.replaceChild(fragment, node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
          // Walk through child nodes
          Array.from(node.childNodes).forEach(child => walk(child));
        }
      };
      
      walk(contentRef.current);
    };

    const enhanceTables = (contentRef) => {
      if (!contentRef.current) return;

      const tables = contentRef.current.querySelectorAll('table');
      tables.forEach((table) => {
        // Skip if already initialized
        if (table.classList.contains('enhanced-initialized')) return;
        table.classList.add('enhanced-initialized');

        const tbody = table.querySelector('tbody');
        const headers = table.querySelectorAll('th');
        
        // Create popup for applying row height to all rows
        const createApplyHeightPopup = (height) => {
          // Remove existing popup if any
          const existingPopup = document.querySelector('.apply-height-popup');
          if (existingPopup) existingPopup.remove();
          
          const popup = document.createElement('div');
          popup.className = 'apply-height-popup';
          popup.innerHTML = `
            <div class="apply-height-content">
              <span>Apply height (${height}px) to all rows?</span>
              <div class="apply-height-buttons">
                <button class="apply-height-yes">Yes</button>
                <button class="apply-height-no">No</button>
              </div>
            </div>
          `;
          document.body.appendChild(popup);
          
          // Position at bottom of screen
          setTimeout(() => popup.classList.add('show'), 10);
          
          return new Promise((resolve) => {
            popup.querySelector('.apply-height-yes').onclick = () => {
              popup.classList.remove('show');
              setTimeout(() => popup.remove(), 300);
              resolve(true);
            };
            popup.querySelector('.apply-height-no').onclick = () => {
              popup.classList.remove('show');
              setTimeout(() => popup.remove(), 300);
              resolve(false);
            };
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              if (document.body.contains(popup)) {
                popup.classList.remove('show');
                setTimeout(() => popup.remove(), 300);
                resolve(false);
              }
            }, 5000);
          });
        };

        // Add row resize handles
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          rows.forEach((row) => {
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'row-resize-handle';
            resizeHandle.title = 'Drag to resize row height';
            row.style.position = 'relative';
            row.appendChild(resizeHandle);
            
            let startY, startHeight;
            
            const onMouseMove = (e) => {
              const height = startHeight + (e.pageY - startY);
              if (height > 30) {
                row.style.height = height + 'px';
                const cells = row.querySelectorAll('td');
                cells.forEach((cell) => {
                  cell.style.maxHeight = height + 'px';
                  cell.style.overflow = 'auto';
                });
              }
            };
            
            const onMouseUp = async (e) => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              document.body.style.cursor = 'default';
              document.body.style.userSelect = 'auto';
              resizeHandle.classList.remove('dragging');
              
              const finalHeight = row.offsetHeight;
              
              // Show popup asking to apply to all rows
              const applyToAll = await createApplyHeightPopup(finalHeight);
              
              if (applyToAll) {
                const allRows = tbody.querySelectorAll('tr');
                allRows.forEach((r) => {
                  r.style.height = finalHeight + 'px';
                  const cells = r.querySelectorAll('td');
                  cells.forEach((cell) => {
                    cell.style.maxHeight = finalHeight + 'px';
                    cell.style.overflow = 'auto';
                  });
                });
              }
            };
            
            resizeHandle.addEventListener('mousedown', (e) => {
              e.preventDefault();
              e.stopPropagation();
              startY = e.pageY;
              startHeight = row.offsetHeight;
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
              resizeHandle.classList.add('dragging');
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            });
          });
        }
        
        headers.forEach((th, colIndex) => {
          // Create header controls wrapper
          const headerWrapper = document.createElement('div');
          headerWrapper.className = 'th-wrapper';
          
          const headerText = document.createElement('span');
          headerText.className = 'th-text';
          headerText.textContent = th.textContent;
          
          const headerControls = document.createElement('div');
          headerControls.className = 'th-controls';
          
          // Hide/Show button
          const hideBtn = document.createElement('button');
          hideBtn.className = 'th-btn th-hide-btn';
          hideBtn.innerHTML = '👁️';
          hideBtn.title = 'Hide column';
          hideBtn.onclick = (e) => {
            e.stopPropagation();
            
            // Toggle visibility
            const isHidden = th.classList.contains('column-hidden');
            if (isHidden) {
              // Show column
              th.classList.remove('column-hidden');
              hideBtn.innerHTML = '👁️';
              hideBtn.title = 'Hide column';
              
              // Toggle all cells in this column
              const rows = table.querySelectorAll('tr');
              rows.forEach((row) => {
                const cell = row.children[colIndex];
                if (cell && cell !== th) {
                  cell.classList.remove('column-hidden');
                }
              });
              
              // Remove restore indicators for this column
              table.querySelectorAll(`.column-restore-indicator[data-col-index="${colIndex}"]`).forEach(indicator => {
                indicator.remove();
              });
            } else {
              // Hide column
              th.classList.add('column-hidden');
              hideBtn.innerHTML = '👁️‍🗨️';
              hideBtn.title = 'Show column';
              
              // Toggle all cells in this column
              const rows = table.querySelectorAll('tr');
              rows.forEach((row) => {
                const cell = row.children[colIndex];
                if (cell && cell !== th) {
                  cell.classList.add('column-hidden');
                }
              });
              
              // Add restore indicator on the adjacent visible column
              const allHeaders = Array.from(table.querySelectorAll('th'));
              let targetHeader = null;
              let position = 'left'; // Position on target header
              
              // Try to find the next visible column to the right
              for (let i = colIndex + 1; i < allHeaders.length; i++) {
                if (!allHeaders[i].classList.contains('column-hidden')) {
                  targetHeader = allHeaders[i];
                  position = 'left';
                  break;
                }
              }
              
              // If no visible column to the right, find the previous visible column to the left
              if (!targetHeader) {
                for (let i = colIndex - 1; i >= 0; i--) {
                  if (!allHeaders[i].classList.contains('column-hidden')) {
                    targetHeader = allHeaders[i];
                    position = 'right';
                    break;
                  }
                }
              }
              
              // Add restore indicator if we found a target header
              if (targetHeader) {
                // Check if there's already an indicator for this position
                const existingIndicator = targetHeader.querySelector(`.column-restore-indicator.position-${position}`);
                if (!existingIndicator) {
                  const indicator = document.createElement('div');
                  indicator.className = `column-restore-indicator position-${position}`;
                  indicator.dataset.colIndex = colIndex;
                  indicator.innerHTML = '▼';
                  indicator.title = `Click to restore hidden column`;
                  indicator.onclick = (evt) => {
                    evt.stopPropagation();
                    // Restore the hidden column
                    hideBtn.click();
                  };
                  targetHeader.appendChild(indicator);
                }
              }
            }
          };
          
          // Sort button
          const sortBtn = document.createElement('button');
          sortBtn.className = 'th-btn th-sort-btn';
          sortBtn.innerHTML = '⇅';
          sortBtn.title = 'Sort by this column';
          sortBtn.dataset.sortDirection = 'none';
          sortBtn.onclick = (e) => {
            e.stopPropagation();
            
            // Clear other sort indicators
            table.querySelectorAll('.th-sort-btn').forEach(btn => {
              if (btn !== sortBtn) {
                btn.dataset.sortDirection = 'none';
                btn.innerHTML = '⇅';
              }
            });
            
            const currentDirection = sortBtn.dataset.sortDirection;
            let newDirection;
            
            if (currentDirection === 'none' || currentDirection === 'desc') {
              newDirection = 'asc';
              sortBtn.innerHTML = '↑';
            } else {
              newDirection = 'desc';
              sortBtn.innerHTML = '↓';
            }
            sortBtn.dataset.sortDirection = newDirection;
            
            // Sort rows
            if (tbody) {
              const rows = Array.from(tbody.querySelectorAll('tr'));
              rows.sort((a, b) => {
                const aCell = a.children[colIndex];
                const bCell = b.children[colIndex];
                const aText = aCell ? aCell.textContent.trim() : '';
                const bText = bCell ? bCell.textContent.trim() : '';
                
                // Try numeric comparison first
                const aNum = parseFloat(aText);
                const bNum = parseFloat(bText);
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                  return newDirection === 'asc' ? aNum - bNum : bNum - aNum;
                }
                
                // String comparison
                const comparison = aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' });
                return newDirection === 'asc' ? comparison : -comparison;
              });
              
              // Reorder rows
              rows.forEach(row => tbody.appendChild(row));
            }
          };
          
          headerControls.appendChild(hideBtn);
          headerControls.appendChild(sortBtn);
          
          // Clear original content and add new structure
          th.textContent = '';
          headerWrapper.appendChild(headerText);
          headerWrapper.appendChild(headerControls);
          th.appendChild(headerWrapper);
          
          // Add resize handle
          const resizer = document.createElement('div');
          resizer.className = 'column-resizer';
          th.appendChild(resizer);
          
          let startX, startWidth;
          
          const onMouseMove = (e) => {
            const width = startWidth + (e.pageX - startX);
            if (width > 20) {
              th.style.minWidth = width + 'px';
              th.style.width = width + 'px';
              th.style.maxWidth = width + 'px';
              
              const rows = table.querySelectorAll('tr');
              rows.forEach((row) => {
                const cell = row.children[colIndex];
                if (cell) {
                  cell.style.minWidth = width + 'px';
                  cell.style.width = width + 'px';
                  cell.style.maxWidth = width + 'px';
                }
              });
            }
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
          };
          
          resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });
        });
      });
    };

    // Apply to both viewer and editor preview
    if (markdown) {
      enhanceTables(viewerContentRef);
      applyColorHints(viewerContentRef);
    }
    if (isCreatingNew && editorContent) {
      enhanceTables(editorPreviewRef);
      applyColorHints(editorPreviewRef);
    }
  }, [markdown, isCreatingNew, editorContent]);

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
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'markdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('markdown')}
        >
          Markdown Viewer
        </button>
        <button 
          className={`tab ${activeTab === 'jsonview' ? 'active' : ''}`}
          onClick={() => setActiveTab('jsonview')}
        >
          JSON View
        </button>
        <button 
          className={`tab ${activeTab === 'logview' ? 'active' : ''}`}
          onClick={() => setActiveTab('logview')}
        >
          Log View
        </button>
        <button 
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Log Analysis
        </button>
      </div>

      <main className="main">
        {activeTab === 'jsonview' ? (
          <div className="json-view-container">
            <JsonView />
          </div>
        ) : activeTab === 'logview' ? (
          <div className="log-view-container">
            <LogView />
          </div>
        ) : activeTab === 'markdown' ? (
          <>
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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {preprocessMarkdown(editorContent)}
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
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                rehypePlugins={[rehypeRaw]}
              >
                {preprocessMarkdown(markdown)}
              </ReactMarkdown>
            </div>
          </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </>
        ) : (
          <div className="log-analysis-container">
            <LogAnalysis />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
