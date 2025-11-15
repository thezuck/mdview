import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';

function LogView() {
  const [rawLog, setRawLog] = useState('');
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage width of left panel
  const [isResizing, setIsResizing] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [jsonOverlayStack, setJsonOverlayStack] = useState([]); // Stack for navigation history
  const workspaceRef = useRef(null);
  const jsonOverlayBodyRef = useRef(null); // Ref for the overlay body to manage scroll
  
  // Filter state
  const [filters, setFilters] = useState([]); // Array of {id, text, mode: 'include'|'exclude', enabled: true|false}
  const [currentFilterText, setCurrentFilterText] = useState('');
  const [currentFilterMode, setCurrentFilterMode] = useState('include');
  const [selectedFilterId, setSelectedFilterId] = useState(null);
  const [debouncedFilterText, setDebouncedFilterText] = useState('');
  const debounceTimerRef = useRef(null);
  
  // Copy feedback state
  const [copiedEntryIndex, setCopiedEntryIndex] = useState(null);
  const copyTimerRef = useRef(null);

  const MAX_STRING_LENGTH = 100; // Maximum length before truncating strings in JSON
  
  // Debounce filter text changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      // Update filters with new text if a filter is selected
      if (selectedFilterId) {
        setFilters(prev => prev.map(f => 
          f.id === selectedFilterId ? { ...f, text: currentFilterText } : f
        ));
      }
    }, 2000);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentFilterText, selectedFilterId]);
  
  // Debounce filter mode changes
  useEffect(() => {
    if (selectedFilterId) {
      setFilters(prev => prev.map(f => 
        f.id === selectedFilterId ? { ...f, mode: currentFilterMode } : f
      ));
    }
  }, [currentFilterMode, selectedFilterId]);
  
  // Filter management functions
  const addFilter = useCallback(() => {
    if (!currentFilterText.trim()) return;
    
    if (selectedFilterId) {
      // Update existing filter
      setFilters(prev => prev.map(f => 
        f.id === selectedFilterId ? { ...f, text: currentFilterText, mode: currentFilterMode } : f
      ));
      setSelectedFilterId(null);
    } else {
      // Add new filter
      const newFilter = {
        id: Date.now().toString(),
        text: currentFilterText,
        mode: currentFilterMode,
        enabled: true
      };
      setFilters(prev => [...prev, newFilter]);
    }
    
    setCurrentFilterText('');
    setCurrentFilterMode('include');
  }, [currentFilterText, currentFilterMode, selectedFilterId]);
  
  const deleteFilter = useCallback((id) => {
    setFilters(prev => prev.filter(f => f.id !== id));
    if (selectedFilterId === id) {
      setSelectedFilterId(null);
      setCurrentFilterText('');
      setCurrentFilterMode('include');
    }
  }, [selectedFilterId]);
  
  const disableFilter = useCallback((id) => {
    setFilters(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: false } : f
    ));
  }, []);
  
  const toggleFilterEnabled = useCallback((id) => {
    setFilters(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
  }, []);
  
  const selectFilter = useCallback((id) => {
    const filter = filters.find(f => f.id === id);
    if (filter) {
      setSelectedFilterId(id);
      setCurrentFilterText(filter.text);
      setCurrentFilterMode(filter.mode);
    }
  }, [filters]);
  
  const updateFilterInline = useCallback((id, field, value) => {
    setFilters(prev => prev.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  }, []);
  
  // Copy log entry to clipboard
  const copyLogEntry = useCallback((entry, index) => {
    let textToCopy = '';
    
    if (entry.type === 'log') {
      textToCopy = `${entry.timestamp} ${entry.message}`;
      if (entry.json) {
        textToCopy += '\n' + JSON.stringify(entry.json, null, 2);
      }
      if (entry.additionalLines && entry.additionalLines.length > 0) {
        textToCopy += '\n' + entry.additionalLines.join('\n');
      }
    } else {
      textToCopy = entry.content;
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Clear any existing timer
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      
      // Set the copied entry index to show visual feedback
      setCopiedEntryIndex(index);
      
      // Reset after 2 seconds
      copyTimerRef.current = setTimeout(() => {
        setCopiedEntryIndex(null);
        copyTimerRef.current = null;
      }, 2000);
      
      console.log('Log entry copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, []);
  
  // Get current overlay content from stack
  const jsonOverlayContent = jsonOverlayStack.length > 0 ? jsonOverlayStack[jsonOverlayStack.length - 1].content : null;
  const jsonOverlayTitle = jsonOverlayStack.length > 0 ? jsonOverlayStack[jsonOverlayStack.length - 1].title : '';
  const jsonOverlayScrollTop = jsonOverlayStack.length > 0 ? (jsonOverlayStack[jsonOverlayStack.length - 1].scrollTop || 0) : 0;

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

  // Check if string should be truncated
  const shouldTruncate = useCallback((str) => {
    return typeof str === 'string' && str.length > MAX_STRING_LENGTH;
  }, []);

  // Open JSON overlay with full content - pushes to navigation stack
  const openJsonOverlay = useCallback((content, title = 'Full Content') => {
    // Save current scroll position before navigating to new content
    const currentScrollTop = jsonOverlayBodyRef.current ? jsonOverlayBodyRef.current.scrollTop : 0;
    
    setJsonOverlayStack(prev => {
      if (prev.length > 0) {
        const updatedStack = [...prev];
        updatedStack[updatedStack.length - 1] = {
          ...updatedStack[updatedStack.length - 1],
          scrollTop: currentScrollTop
        };
        return [...updatedStack, { content, title, scrollTop: 0 }];
      }
      // First item in stack
      return [...prev, { content, title, scrollTop: 0 }];
    });
  }, []);

  // Go back in the overlay stack
  const goBackInOverlay = useCallback(() => {
    setJsonOverlayStack(prev => {
      if (prev.length > 1) {
        return prev.slice(0, -1); // Remove last item
      }
      return []; // Close overlay if at root
    });
  }, []);

  // Close JSON overlay completely
  const closeJsonOverlay = useCallback(() => {
    setJsonOverlayStack([]);
  }, []);

  // Parse a single log entry
  const parseLogEntry = useCallback((logText) => {
    const entries = [];
    const lines = logText.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Try multiple timestamp patterns
      let timestampMatch = null;
      let timestamp = '';
      let message = '';
      
      // Pattern 1: [DD/MM/YYYY HH:MM GMT+/-N]
      timestampMatch = line.match(/^\[(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+GMT[+-]?\d+)\]\s*(.*)/);
      if (timestampMatch) {
        timestamp = timestampMatch[1];
        message = timestampMatch[2];
      } else {
        // Pattern 2: YYYY-MM-DD HH:MM:SS [level]:
        timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[(\w+)\]:\s*(.*)/);
        if (timestampMatch) {
          timestamp = timestampMatch[1];
          const level = timestampMatch[2];
          message = timestampMatch[3];
          // Prepend level to message for context
          message = `[${level}] ${message}`;
        }
      }
      
      if (timestampMatch) {
        
        // Check if this line contains JSON
        let jsonData = null;
        let restOfMessage = message;
        
        // Find JSON in the message - look for the first occurrence of '{' which starts valid JSON
        // This handles cases where the message has multiple colons or multiple JSON objects
        let jsonStartIndex = -1;
        
        // Try to find JSON by looking for '{' characters from left to right
        // We want the first valid JSON, which is usually the largest/most important one
        for (let k = 0; k < message.length; k++) {
          if (message[k] === '{') {
            try {
              // Try to parse from this position
              let jsonStr = message.substring(k);
              let braceCount = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
              let j = i + 1;
              
              // Collect more lines if JSON is incomplete
              while (braceCount > 0 && j < lines.length) {
                jsonStr += '\n' + lines[j];
                braceCount += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
                j++;
              }
              
              // Try to parse it
              const parsed = JSON.parse(jsonStr);
              // If successful, this is our JSON (first valid one found)
              jsonData = parsed;
              jsonStartIndex = k;
              i = j - 1; // Skip the lines we consumed
              break; // Found first valid JSON, stop looking
            } catch (e) {
              // Not valid JSON from this position, continue searching
              continue;
            }
          }
        }
        
        // Extract the message part (everything before the JSON)
        if (jsonData && jsonStartIndex > 0) {
          restOfMessage = message.substring(0, jsonStartIndex).trim();
          // Remove trailing colon or space if present
          if (restOfMessage.endsWith(':')) {
            restOfMessage = restOfMessage.substring(0, restOfMessage.length - 1).trim();
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
  
  // Apply filters to parsed entries
  const filteredEntries = useMemo(() => {
    if (filters.length === 0) return parsedEntries;
    
    const enabledFilters = filters.filter(f => f.enabled);
    if (enabledFilters.length === 0) return parsedEntries;
    
    return parsedEntries.filter(entry => {
      // Convert entry to searchable text
      let entryText = '';
      if (entry.type === 'log') {
        entryText = entry.timestamp + ' ' + entry.message;
        if (entry.json) {
          entryText += ' ' + JSON.stringify(entry.json);
        }
        if (entry.additionalLines) {
          entryText += ' ' + entry.additionalLines.join(' ');
        }
      } else {
        entryText = entry.content;
      }
      entryText = entryText.toLowerCase();
      
      // Apply each enabled filter
      for (const filter of enabledFilters) {
        const filterText = filter.text.toLowerCase();
        const matches = entryText.includes(filterText);
        
        if (filter.mode === 'include') {
          // Include mode: if it doesn't match, exclude this entry
          if (!matches) return false;
        } else {
          // Exclude mode: if it matches, exclude this entry
          if (matches) return false;
        }
      }
      
      return true;
    });
  }, [parsedEntries, filters]);

  // Determine log level from message
  const getLogLevel = useCallback((message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed')) return 'error';
    if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) return 'warning';
    if (lowerMessage.includes('success') || lowerMessage.includes('✓') || lowerMessage.includes('✅')) return 'success';
    return 'info';
  }, []);

  // Render JSON with syntax highlighting and truncation
  const renderJson = useCallback((json, depth = 0, path = 'root') => {
    if (json === null || json === undefined) {
      return <span className="json-null">null</span>;
    }
    
    if (typeof json === 'string') {
      // Check if string should be truncated
      if (shouldTruncate(json)) {
        const truncated = json.substring(0, MAX_STRING_LENGTH) + '...';
        
        return (
          <span className="json-string-container">
            <span className="json-string">"{truncated}"</span>
            <button 
              className="json-expand-button"
              onClick={() => openJsonOverlay(json, `String at ${path}`)}
              title="Click to view full content"
            >
              📄 View Full
            </button>
          </span>
        );
      }
      
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
              {renderJson(item, depth + 1, `${path}[${idx}]`)}
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
              {renderJson(json[key], depth + 1, `${path}.${key}`)}
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
  }, [parseAnsiColors, shouldTruncate, openJsonOverlay]);

  // Render overlay content - try to parse as JSON, otherwise show as text
  const renderOverlayContent = useCallback((content) => {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content);
      // If successful, render using the same JSON renderer
      return (
        <div className="json-display">
          {renderJson(parsed, 0, 'overlay')}
        </div>
      );
    } catch (e) {
      // Not valid JSON, check if it contains ANSI codes or just show as text
      if (content.includes('\u001b[')) {
        const parts = parseAnsiColors(content);
        return (
          <pre className="json-overlay-text">
            {parts.map((part, idx) => (
              <span key={idx} className={part.class}>{part.text}</span>
            ))}
          </pre>
        );
      }
      // Plain text
      return <pre className="json-overlay-text">{content}</pre>;
    }
  }, [renderJson, parseAnsiColors]);

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

  // Handle ESC key to go back in JSON overlay stack
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && jsonOverlayContent) {
        goBackInOverlay();
      }
    };

    if (jsonOverlayContent) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [jsonOverlayContent, goBackInOverlay]);

  // Restore scroll position when navigating back - happens before paint
  useLayoutEffect(() => {
    if (jsonOverlayBodyRef.current && jsonOverlayScrollTop !== undefined) {
      jsonOverlayBodyRef.current.scrollTop = jsonOverlayScrollTop;
    }
  }, [jsonOverlayScrollTop, jsonOverlayStack.length]);
  
  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const sampleLog = `2025-11-04 13:36:21 [info]: Received response after tool execution {"round":3,"hasContent":true,"hasMoreToolCalls":true,"finishReason":"tool_calls"}

2025-11-04 13:36:21 [info]: Tool Call Request {"toolName":"feature_implementation","toolCallId":"call_pmNoth06oT1kqQXwbKpgpkDS","conversationId":"53386d5f-b2b1-42cf-934c-ec425d429ad9","provider":"openai","model":"gpt-5"}

[05/11/2025 13:24 GMT+0]   🔨 Executing tool: write_file {"service":"runner-backend"}

[05/11/2025 13:24 GMT+0]      Args: {"file_path":"src/components/Example.tsx","content":"import React from 'react';\\n\\nconst Example = () => <div>Hello</div>;\\n\\nexport default Example;"} {"service":"runner-backend"}

[29/10/2025 21:34 GMT+2] Failed to build resource 019a3031-d9e0-75ba-964c-a2c96a6a40f9: {"service":"runner-backend","command":"npm run build","code":1,"stdout":"\\n> app@0.0.0 build\\n> NODE_ENV=production npm run generate-imports && npx vite build\\n\\n\\n> app@0.0.0 generate-imports\\n> node scripts/generate-dynamic-imports.js\\n\\n🔍 Scanning for numbered directories...\\nFound numbered directories: [ 0 ]\\n  ✓ Found App file for page 0: App.tsx\\n📝 Updating component files...\\nUpdated DynamicMainApp.jsx (simplified version)\\nUpdated MainApp.jsx\\nUpdated vite.config.js\\n♻️  Using shared components from src/components (not copying)...\\n🖼️  Copying images from numbered directories...\\n✅ Copied images from src/0/images to public/images/0/\\n🖼️  Fixing image paths in components...\\n🔧 Image path mode: PRODUCTION (using ./images/ prefix)\\n🔧 Fixing component import paths...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🔧 Fixing router components in App files to prevent nested router errors...\\n🚫 Fixing nested lazy loading to prevent path resolution issues...\\n🔧 Re-fixing component import paths after lazy loading fixes...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🚀 Aggressively fixing ALL import paths to prevent build failures...\\n🔧 Aggressively fixed 0 import paths across all files\\n🎨 Fixing CSS files for Tailwind compatibility...\\n🔍 Validating import paths...\\n✅ All 8 import paths validated successfully\\n✅ Successfully updated MainApp.jsx, DynamicMainApp.jsx, vite.config.js, configured shared components, fixed router issues, fixed nested lazy loading, and fixed CSS\\n📊 Generated imports for directories: 0\\n♻️  All generated code now references shared components from src/components\\n\\u001b[36mvite v6.4.1 \\u001b[32mbuilding for production...\\u001b[36m\\u001b[39m\\ntransforming...\\n\\u001b[32m✓\\u001b[39m 5 modules transformed.\\n","stderr":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n","error":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n"}

[29/10/2025 21:34 GMT+2] Build error details: {"service":"runner-backend","command":"npm run build","code":1,"stdout":"\\n> app@0.0.0 build\\n> NODE_ENV=production npm run generate-imports && npx vite build\\n\\n\\n> app@0.0.0 generate-imports\\n> node scripts/generate-dynamic-imports.js\\n\\n🔍 Scanning for numbered directories...\\nFound numbered directories: [ 0 ]\\n  ✓ Found App file for page 0: App.tsx\\n📝 Updating component files...\\nUpdated DynamicMainApp.jsx (simplified version)\\nUpdated MainApp.jsx\\nUpdated vite.config.js\\n♻️  Using shared components from src/components (not copying)...\\n🖼️  Copying images from numbered directories...\\n✅ Copied images from src/0/images to public/images/0/\\n🖼️  Fixing image paths in components...\\n🔧 Image path mode: PRODUCTION (using ./images/ prefix)\\n🔧 Fixing component import paths...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🔧 Fixing router components in App files to prevent nested router errors...\\n🚫 Fixing nested lazy loading to prevent path resolution issues...\\n🔧 Re-fixing component import paths after lazy loading fixes...\\n  ✓ Component import already correct in components/MessagingWidget.tsx: \\"../../../components\\"\\n🚀 Aggressively fixing ALL import paths to prevent build failures...\\n🔧 Aggressively fixed 0 import paths across all files\\n🎨 Fixing CSS files for Tailwind compatibility...\\n🔍 Validating import paths...\\n✅ All 8 import paths validated successfully\\n✅ Successfully updated MainApp.jsx, DynamicMainApp.jsx, vite.config.js, configured shared components, fixed router issues, fixed nested lazy loading, and fixed CSS\\n📊 Generated imports for directories: 0\\n♻️  All generated code now references shared components from src/components\\n\\u001b[36mvite v6.4.1 \\u001b[32mbuilding for production...\\u001b[36m\\u001b[39m\\ntransforming...\\n\\u001b[32m✓\\u001b[39m 5 modules transformed.\\n","stderr":"\\u001b[31m✗\\u001b[39m Build failed in 323ms\\n\\u001b[31merror during build:\\n\\u001b[31m[vite:load-fallback] Could not load /Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css (imported by src/main.jsx): ENOENT: no such file or directory, open '/Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/src/0/src/styles.css'\\u001b[31m\\n    at async open (node:internal/fs/promises:640:25)\\n    at async Object.readFile (node:internal/fs/promises:1277:14)\\n    at async Object.handler (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:45872:27)\\n    at async PluginDriver.hookFirstAndGetPlugin (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22308:28)\\n    at async file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:21308:33\\n    at async Queue.work (file:///Users/amirzucker/workspace/liveprd_workspace/900bf3c9-cd76-467f-9704-f9a5dc3b90f4/019a3031-d9e0-75ba-964c-a2c96a6a40f9/node_modules/rollup/dist/es/shared/node-entry.js:22536:32)\\u001b[39m\\n"}`;

  // Component to render filter tags
  const renderFilterTags = useCallback(() => {
    if (filters.length === 0) return null;
    
    return (
      <div className="filter-tags-container">
        <div className="filter-tags-label">Active Filters:</div>
        <div className="filter-tags">
          {filters.map((filter) => (
            <div 
              key={filter.id} 
              className={`filter-tag ${filter.mode === 'exclude' ? 'filter-tag-exclude' : 'filter-tag-include'} ${!filter.enabled ? 'filter-tag-disabled' : ''}`}
              onClick={() => selectFilter(filter.id)}
              title={`Click to edit • ${filter.enabled ? 'Enabled' : 'Disabled'}`}
            >
              <span className="filter-tag-mode">{filter.mode === 'include' ? '✓' : '✕'}</span>
              <span className="filter-tag-text">{filter.text}</span>
              <button
                className="filter-tag-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (filter.enabled) {
                    disableFilter(filter.id);
                  } else {
                    toggleFilterEnabled(filter.id);
                  }
                }}
                title={filter.enabled ? 'Disable filter' : 'Enable filter'}
              >
                {filter.enabled ? '×' : '○'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }, [filters, selectFilter, disableFilter, toggleFilterEnabled]);
  
  // Component to render filter input (reusable for both panel and overlay)
  const renderFilterInput = useCallback(() => {
    return (
      <div className="filter-input-section-inline">
        <div className="filter-input-controls">
          <input
            type="text"
            className="filter-input-text"
            value={currentFilterText}
            onChange={(e) => setCurrentFilterText(e.target.value)}
            placeholder="Enter text to filter by..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addFilter();
              }
            }}
          />
          <div className="filter-mode-toggle">
            <button
              className={`filter-mode-button ${currentFilterMode === 'include' ? 'active' : ''}`}
              onClick={() => setCurrentFilterMode('include')}
            >
              Include
            </button>
            <button
              className={`filter-mode-button ${currentFilterMode === 'exclude' ? 'active' : ''}`}
              onClick={() => setCurrentFilterMode('exclude')}
            >
              Exclude
            </button>
          </div>
          <button
            className="filter-add-button"
            onClick={addFilter}
            disabled={!currentFilterText.trim()}
          >
            {selectedFilterId ? 'Update' : 'Add'} Filter
          </button>
          {selectedFilterId && (
            <button
              className="filter-cancel-button"
              onClick={() => {
                setSelectedFilterId(null);
                setCurrentFilterText('');
                setCurrentFilterMode('include');
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }, [currentFilterText, currentFilterMode, selectedFilterId, addFilter]);
  
  // Component to render log entries (reusable for both panel and overlay)
  const renderLogEntries = useCallback(() => {
    return filteredEntries.map((entry, idx) => {
      const isCopied = copiedEntryIndex === idx;
      
      if (entry.type === 'log') {
        const level = getLogLevel(entry.message);
        return (
          <div key={idx} className={`log-entry log-entry-${level}`}>
            <div className="log-entry-header">
              <div className="log-entry-header-left">
                <span className="log-timestamp">{entry.timestamp}</span>
                <span className={`log-level log-level-${level}`}>
                  {level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️'}
                </span>
              </div>
              <div className="log-entry-copy-wrapper">
                {isCopied && (
                  <span className="log-copy-notification">Text copied</span>
                )}
                <button
                  className={`log-entry-copy ${isCopied ? 'log-entry-copy-success' : ''}`}
                  onClick={() => copyLogEntry(entry, idx)}
                  title="Copy log entry to clipboard"
                >
                  📋
                </button>
              </div>
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
            <div className="log-text-entry-content">{entry.content}</div>
            <div className="log-entry-copy-wrapper">
              {isCopied && (
                <span className="log-copy-notification">Text copied</span>
              )}
              <button
                className={`log-entry-copy log-entry-copy-text ${isCopied ? 'log-entry-copy-success' : ''}`}
                onClick={() => copyLogEntry(entry, idx)}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>
        );
      }
    });
  }, [filteredEntries, getLogLevel, renderJson, parseAnsiColors, copyLogEntry, copiedEntryIndex]);

  return (
    <div className="log-view-content">
      <div className="log-view-header">
        <h2>Structured Log Viewer</h2>
        <p>Paste structured logs with timestamps and JSON data for a clean, readable view</p>
      </div>

      <div className="log-view-workspace" ref={workspaceRef}>
        <div className="log-input-section" style={{ width: `${leftPanelWidth}%` }}>
          <div className="log-input-top-section">
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
          
          <div className="filter-list-section">
            <div className="filter-list-header">
              <h3>Applied Filters</h3>
              <span className="filter-count">{filters.length} filter{filters.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="filter-list">
              {filters.length === 0 ? (
                <div className="filter-list-empty">
                  No filters applied. Add a filter using the panel on the right.
                </div>
              ) : (
                filters.map((filter) => (
                  <div 
                    key={filter.id} 
                    className={`filter-item ${selectedFilterId === filter.id ? 'filter-item-selected' : ''} ${!filter.enabled ? 'filter-item-disabled' : ''}`}
                    onClick={() => selectFilter(filter.id)}
                  >
                    <div className="filter-item-controls">
                      <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={() => toggleFilterEnabled(filter.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Enable/disable filter"
                      />
                    </div>
                    <div className="filter-item-content">
                      <input
                        type="text"
                        className="filter-item-text"
                        value={filter.text}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateFilterInline(filter.id, 'text', e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <select
                        className="filter-item-mode"
                        value={filter.mode}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateFilterInline(filter.id, 'mode', e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="include">Include</option>
                        <option value="exclude">Exclude</option>
                      </select>
                    </div>
                    <button
                      className="filter-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFilter(filter.id);
                      }}
                      title="Delete filter"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div 
          className="resize-divider" 
          onMouseDown={handleMouseDown}
          style={{ cursor: 'col-resize' }}
        />

        <div className="log-output-section" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="log-output-header">
            <h3>
              Formatted View 
              {filters.filter(f => f.enabled).length > 0 && (
                <span className="filter-active-indicator">
                  ({filteredEntries.length} of {parsedEntries.length} entries)
                </span>
              )}
            </h3>
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
          
          {renderFilterInput()}
          {renderFilterTags()}
          
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
              <h3>
                Formatted View (Expanded)
                {filters.filter(f => f.enabled).length > 0 && (
                  <span className="filter-active-indicator">
                    ({filteredEntries.length} of {parsedEntries.length} entries)
                  </span>
                )}
              </h3>
              <button 
                className="log-overlay-close"
                onClick={handleCloseOverlay}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="log-overlay-filters">
              {renderFilterInput()}
              {renderFilterTags()}
            </div>
            <div className="log-overlay-body">
              <div className="log-entries">
                {renderLogEntries()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON overlay for viewing full content */}
      {jsonOverlayContent && (
        <div className="json-overlay">
          <div className="json-overlay-content">
            <div className="json-overlay-header">
              <div className="json-overlay-header-left">
                {jsonOverlayStack.length > 1 && (
                  <button 
                    className="json-overlay-back"
                    onClick={goBackInOverlay}
                    title="Go back (ESC)"
                  >
                    ← Back
                  </button>
                )}
                <h3>{jsonOverlayTitle}</h3>
              </div>
              <button className="json-overlay-close" onClick={closeJsonOverlay} title="Close overlay">✕</button>
            </div>
            <div className="json-overlay-body" ref={jsonOverlayBodyRef}>
              {renderOverlayContent(jsonOverlayContent)}
            </div>
            <div className="json-overlay-footer">
              <div className="json-overlay-stats">
                Length: {jsonOverlayContent.length} characters | 
                Lines: {jsonOverlayContent.split('\n').length}
                {jsonOverlayStack.length > 1 && ` | Level: ${jsonOverlayStack.length}`}
              </div>
              <button 
                className="json-overlay-copy"
                onClick={() => {
                  navigator.clipboard.writeText(jsonOverlayContent);
                }}
              >
                📋 Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogView;

