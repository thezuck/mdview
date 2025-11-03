import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

function LogView() {
  const [rawLog, setRawLog] = useState('');
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage width of left panel
  const [isResizing, setIsResizing] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const workspaceRef = useRef(null);

  // Parse ANSI color codes to CSS classes
  const parseAnsiColors = useCallback((text) => {
    if (!text) return [];
    
    const ansiMap = {
      '\u001b[31m': 'ansi-red',      // Red (errors)
      '\u001b[32m': 'ansi-green',    // Green (success)
      '\u001b[33m': 'ansi-yellow',   // Yellow (warnings)
      '\u001b[36m': 'ansi-cyan',     // Cyan (info)
      '\u001b[39m': 'ansi-reset',    // Reset
      '\u001b[0m': 'ansi-reset',     // Reset
    };

    const parts = [];
    let currentClass = '';
    let currentText = '';
    let i = 0;

    while (i < text.length) {
      let foundAnsi = false;
      
      // Check for ANSI codes
      for (const [code, className] of Object.entries(ansiMap)) {
        if (text.substring(i, i + code.length) === code) {
          // Save current text if any
          if (currentText) {
            parts.push({ text: currentText, class: currentClass });
            currentText = '';
          }
          
          // Update class
          currentClass = className === 'ansi-reset' ? '' : className;
          i += code.length;
          foundAnsi = true;
          break;
        }
      }
      
      if (!foundAnsi) {
        currentText += text[i];
        i++;
      }
    }
    
    // Add remaining text
    if (currentText) {
      parts.push({ text: currentText, class: currentClass });
    }
    
    return parts;
  }, []);

  // Parse a single log entry
  const parseLogEntry = useCallback((logText) => {
    const entries = [];
    const lines = logText.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Match timestamp pattern: [DD/MM/YYYY HH:MM GMT+/-N]
      const timestampMatch = line.match(/^\[(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+GMT[+-]?\d+)\]\s*(.*)/);
      
      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        const message = timestampMatch[2];
        
        // Check if this line contains JSON
        let jsonData = null;
        let restOfMessage = message;
        
        // Find JSON in the message
        const jsonMatch = message.match(/:\s*(\{.*)/);
        if (jsonMatch) {
          try {
            // Try to parse the JSON (might span multiple lines)
            let jsonStr = jsonMatch[1];
            let braceCount = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
            let j = i + 1;
            
            // Collect more lines if JSON is incomplete
            while (braceCount > 0 && j < lines.length) {
              jsonStr += '\n' + lines[j];
              braceCount += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
              j++;
            }
            
            jsonData = JSON.parse(jsonStr);
            restOfMessage = message.substring(0, jsonMatch.index + 1).trim();
            i = j - 1; // Skip the lines we consumed
          } catch (e) {
            // Not valid JSON, treat as regular message
          }
        }
        
        entries.push({
          type: 'log',
          timestamp,
          message: restOfMessage,
          json: jsonData
        });
      } else if (line.trim()) {
        // Continuation of previous entry or standalone text
        if (entries.length > 0 && entries[entries.length - 1].type === 'log') {
          // Add to previous entry's additional lines
          if (!entries[entries.length - 1].additionalLines) {
            entries[entries.length - 1].additionalLines = [];
          }
          entries[entries.length - 1].additionalLines.push(line);
        } else {
          // Standalone text
          entries.push({
            type: 'text',
            content: line
          });
        }
      }
      
      i++;
    }
    
    return entries;
  }, []);

  const parsedEntries = useMemo(() => {
    if (!rawLog.trim()) return [];
    return parseLogEntry(rawLog);
  }, [rawLog, parseLogEntry]);

  // Determine log level from message
  const getLogLevel = useCallback((message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed')) return 'error';
    if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) return 'warning';
    if (lowerMessage.includes('success') || lowerMessage.includes('✓') || lowerMessage.includes('✅')) return 'success';
    return 'info';
  }, []);

  // Render JSON with syntax highlighting
  const renderJson = useCallback((json, depth = 0) => {
    if (json === null || json === undefined) {
      return <span className="json-null">null</span>;
    }
    
    if (typeof json === 'string') {
      // Check if string contains ANSI codes or newlines (like stdout/stderr)
      if (json.includes('\u001b[') || json.includes('\n')) {
        const parts = parseAnsiColors(json);
        return (
          <div className="json-multiline-string">
            {parts.map((part, idx) => (
              <span key={idx} className={part.class}>{part.text}</span>
            ))}
          </div>
        );
      }
      return <span className="json-string">"{json}"</span>;
    }
    
    if (typeof json === 'number') {
      return <span className="json-number">{json}</span>;
    }
    
    if (typeof json === 'boolean') {
      return <span className="json-boolean">{json.toString()}</span>;
    }
    
    if (Array.isArray(json)) {
      if (json.length === 0) return <span className="json-bracket">[]</span>;
      return (
        <div className="json-array">
          <span className="json-bracket">[</span>
          {json.map((item, idx) => (
            <div key={idx} className="json-array-item" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
              {renderJson(item, depth + 1)}
              {idx < json.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ marginLeft: `${depth * 20}px` }}>
            <span className="json-bracket">]</span>
          </div>
        </div>
      );
    }
    
    if (typeof json === 'object') {
      const keys = Object.keys(json);
      if (keys.length === 0) return <span className="json-bracket">{'{}'}</span>;
      
      return (
        <div className="json-object">
          <span className="json-bracket">{'{'}</span>
          {keys.map((key, idx) => (
            <div key={key} className="json-object-item" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
              <span className="json-key">"{key}"</span>
              <span className="json-colon">: </span>
              {renderJson(json[key], depth + 1)}
              {idx < keys.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ marginLeft: `${depth * 20}px` }}>
            <span className="json-bracket">{'}'}</span>
          </div>
        </div>
      );
    }
    
    return String(json);
  }, [parseAnsiColors]);

  const handleClear = useCallback(() => {
    setRawLog('');
  }, []);

  const handlePaste = useCallback((e) => {
    // Allow default paste behavior
  }, []);

  const handleExpandOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !workspaceRef.current) return;
    
    const containerRect = workspaceRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80%
    if (newLeftWidth >= 20 && newLeftWidth <= 80) {
      setLeftPanelWidth(newLeftWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Handle ESC key to close overlay
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOverlayOpen) {
        handleCloseOverlay();
      }
    };

    if (isOverlayOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOverlayOpen, handleCloseOverlay]);

  const sampleLog = `[29/10/2025 21:34 GMT+2] Failed to build resource 019a3031-d9e0-75ba-964c-a2c96a6a40f9: {"service":"runner-backend","command":"npm run build","code":1,"stdout":"\\n> app@0.0.0 build\\n> NODE_ENV=production npm run generate-imports && npx vite build\\n\\n\\n> app@0.0.0 generate-imports\\n> node scripts/generate-dynamic-imports.js\\n\\n🔍 Scanning for numbered directories...\\nFound numbered directories: [ 0 ]\\n  ✓ Found App file for page 0: App.tsx\\n📝 Updating component files...\\nUpdated DynamicMainApp.jsx (simplified version)\\nUpdated MainApp.jsx\\nUpdated vite.config.js\\n♻️  Using shared components from src/components (not copying)...\\n🖼️  Copying images from numbered directories...\\n✅ Copied images from src/0/images to public/images/0/\\n🖼️  Fixing image paths in components...\\n🔧 Image path mode: PRODUCTION (using ./images/ prefix)\\n🔧 Fixing component import paths...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🔧 Fixing router components in App files to prevent nested router errors...\\n🚫 Fixing nested lazy loading to prevent path resolution issues...\\n🔧 Re-fixing component import paths after lazy loading fixes...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🚀 Aggressively fixing ALL import paths to prevent build failures...\\n🔧 Aggressively fixed 0 import paths across all files\\n🎨 Fixing CSS files for Tailwind compatibility...\\n🔍 Validating import paths...\\n✅ All 8 import paths validated successfully\\n✅ Successfully updated MainApp.jsx, DynamicMainApp.jsx, vite.config.js, configured shared components, fixed router issues, fixed nested lazy loading, and fixed CSS\\n📊 Generated imports for directories: 0\\n♻️  All generated code now references shared components from src/components\\n\\u001b[36mvite v6.4.1 \\u001b[32mbuilding for production...\\u001b[36m\\u001b[39m\\ntransforming...\\n\\u001b[32m✓\\u001b[39m 5 modules transformed.\\n","stderr":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n","error":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n"}

[29/10/2025 21:34 GMT+2] Build error details: {"service":"runner-backend","command":"npm run build","code":1,"stdout":"\\n> app@0.0.0 build\\n> NODE_ENV=production npm run generate-imports && npx vite build\\n\\n\\n> app@0.0.0 generate-imports\\n> node scripts/generate-dynamic-imports.js\\n\\n🔍 Scanning for numbered directories...\\nFound numbered directories: [ 0 ]\\n  ✓ Found App file for page 0: App.tsx\\n📝 Updating component files...\\nUpdated DynamicMainApp.jsx (simplified version)\\nUpdated MainApp.jsx\\nUpdated vite.config.js\\n♻️  Using shared components from src/components (not copying)...\\n🖼️  Copying images from numbered directories...\\n✅ Copied images from src/0/images to public/images/0/\\n🖼️  Fixing image paths in components...\\n🔧 Image path mode: PRODUCTION (using ./images/ prefix)\\n🔧 Fixing component import paths...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🔧 Fixing router components in App files to prevent nested router errors...\\n🚫 Fixing nested lazy loading to prevent path resolution issues...\\n🔧 Re-fixing component import paths after lazy loading fixes...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🚀 Aggressively fixing ALL import paths to prevent build failures...\\n🔧 Aggressively fixed 0 import paths across all files\\n🎨 Fixing CSS files for Tailwind compatibility...\\n🔍 Validating import paths...\\n✅ All 8 import paths validated successfully\\n✅ Successfully updated MainApp.jsx, DynamicMainApp.jsx, vite.config.js, configured shared components, fixed router issues, fixed nested lazy loading, and fixed CSS\\n📊 Generated imports for directories: 0\\n♻️  All generated code now references shared components from src/components\\n\\u001b[36mvite v6.4.1 \\u001b[32mbuilding for production...\\u001b[36m\\u001b[39m\\ntransforming...\\n\\u001b[32m✓\\u001b[39m 5 modules transformed.\\n","stderr":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n"}`;

  // Component to render log entries (reusable for both panel and overlay)
  const renderLogEntries = useCallback(() => {
    return parsedEntries.map((entry, idx) => {
      if (entry.type === 'log') {
        const level = getLogLevel(entry.message);
        return (
          <div key={idx} className={`log-entry log-entry-${level}`}>
            <div className="log-entry-header">
              <span className="log-timestamp">{entry.timestamp}</span>
              <span className={`log-level log-level-${level}`}>
                {level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️'}
              </span>
            </div>
            <div className="log-message">{entry.message}</div>
            {entry.json && (
              <div className="log-json">
                {renderJson(entry.json)}
              </div>
            )}
            {entry.additionalLines && entry.additionalLines.length > 0 && (
              <div className="log-additional">
                {entry.additionalLines.map((line, lineIdx) => {
                  const parts = parseAnsiColors(line);
                  return (
                    <div key={lineIdx} className="log-additional-line">
                      {parts.map((part, partIdx) => (
                        <span key={partIdx} className={part.class}>{part.text}</span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div key={idx} className="log-text-entry">
            {entry.content}
          </div>
        );
      }
    });
  }, [parsedEntries, getLogLevel, renderJson, parseAnsiColors]);

  return (
    <div className="log-view-content">
      <div className="log-view-header">
        <h2>Structured Log Viewer</h2>
        <p>Paste structured logs with timestamps and JSON data for a clean, readable view</p>
      </div>

      <div className="log-view-workspace" ref={workspaceRef}>
        <div className="log-input-section" style={{ width: `${leftPanelWidth}%` }}>
          <div className="log-input-header">
            <h3>Raw Log Input</h3>
            <div className="log-input-buttons">
              <button 
                className="sample-button"
                onClick={() => setRawLog(sampleLog)}
              >
                Load Sample
              </button>
              <button 
                className="clear-button" 
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            className="log-input-textarea"
            value={rawLog}
            onChange={(e) => setRawLog(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste your structured logs here...&#10;&#10;Example format:&#10;[29/10/2025 21:34 GMT+2] Error message: {&quot;key&quot;: &quot;value&quot;}"
            spellCheck="false"
          />
        </div>

        <div 
          className="resize-divider" 
          onMouseDown={handleMouseDown}
          style={{ cursor: 'col-resize' }}
        />

        <div className="log-output-section" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="log-output-header">
            <h3>Formatted View</h3>
            {parsedEntries.length > 0 && (
              <button 
                className="expand-overlay-button"
                onClick={handleExpandOverlay}
                title="Expand to full screen"
              >
                ⛶ Expand
              </button>
            )}
          </div>
          {parsedEntries.length === 0 ? (
            <div className="log-placeholder">
              <div className="placeholder-icon">📋</div>
              <p>Formatted logs will appear here</p>
              <p className="placeholder-hint">Paste logs on the left to see them parsed and formatted</p>
            </div>
          ) : (
            <div className="log-entries">
              {renderLogEntries()}
            </div>
          )}
        </div>
      </div>

      {/* Overlay for expanded view */}
      {isOverlayOpen && (
        <div className="log-overlay" onClick={handleCloseOverlay}>
          <div className="log-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="log-overlay-header">
              <h3>Formatted View (Expanded)</h3>
              <button 
                className="log-overlay-close"
                onClick={handleCloseOverlay}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="log-overlay-body">
              <div className="log-entries">
                {renderLogEntries()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogView;

