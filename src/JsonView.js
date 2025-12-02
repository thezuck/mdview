import React, { useState, useCallback, useMemo, useEffect } from 'react';

function JsonView() {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [overlayContent, setOverlayContent] = useState(null);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [autoFormatted, setAutoFormatted] = useState(false);

  const MAX_STRING_LENGTH = 50;

  // Parse JSON with error handling
  const parsedJson = useMemo(() => {
    if (!jsonText.trim()) return null;
    
    try {
      // First, try to parse as-is
      let parsed;
      let wasUnescaped = false;
      try {
        parsed = JSON.parse(jsonText);
      } catch (firstError) {
        // If that fails, try to unescape the string first
        // This handles cases where the JSON itself is escaped (e.g., from API responses)
        const unescaped = jsonText
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        parsed = JSON.parse(unescaped);
        wasUnescaped = true;
      }
      
      setError('');
      return { data: parsed, wasUnescaped };
    } catch (e) {
      setError(`Invalid JSON: ${e.message}`);
      return null;
    }
  }, [jsonText]);

  // Auto-format JSON after successful parsing
  useEffect(() => {
    if (parsedJson && !autoFormatted) {
      try {
        const formatted = JSON.stringify(parsedJson.data, null, 2);
        // Only update if the formatted version is different
        if (formatted !== jsonText) {
          setJsonText(formatted);
          setAutoFormatted(true);
        }
      } catch (e) {
        // If formatting fails, just continue with the current text
      }
    }
  }, [parsedJson, autoFormatted, jsonText]);

  // Reset auto-format flag when user manually changes the text
  const handleJsonTextChange = useCallback((newText) => {
    setJsonText(newText);
    setAutoFormatted(false);
  }, []);

  // Check if string should be truncated
  const shouldTruncate = useCallback((str) => {
    return typeof str === 'string' && str.length > MAX_STRING_LENGTH;
  }, []);

  // Open overlay with full content
  const openOverlay = useCallback((content, title = 'Full Content') => {
    setOverlayContent(content);
    setOverlayTitle(title);
  }, []);

  // Close overlay
  const closeOverlay = useCallback(() => {
    setOverlayContent(null);
    setOverlayTitle('');
  }, []);

  // Add keyboard support for closing overlay with Escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && overlayContent) {
        closeOverlay();
      }
    };

    // Add event listener when overlay is open
    if (overlayContent) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [overlayContent, closeOverlay]);

  // Render JSON with syntax highlighting and truncation
  const renderJson = useCallback((json, depth = 0, path = 'root') => {
    // Extract the actual data if it's wrapped
    const actualJson = json?.data !== undefined ? json.data : json;
    if (actualJson === null || actualJson === undefined) {
      return <span className="json-null">null</span>;
    }
    
    if (typeof actualJson === 'string') {
      if (shouldTruncate(actualJson)) {
        const truncated = actualJson.substring(0, MAX_STRING_LENGTH) + '...';
        return (
          <span className="json-string-container">
            <span className="json-string">"{truncated}"</span>
            <button 
              className="json-expand-button"
              onClick={() => openOverlay(actualJson, `String at ${path}`)}
              title="Click to view full content"
            >
              📄 View Full
            </button>
          </span>
        );
      }
      return <span className="json-string">"{actualJson}"</span>;
    }
    
    if (typeof actualJson === 'number') {
      return <span className="json-number">{actualJson}</span>;
    }
    
    if (typeof actualJson === 'boolean') {
      return <span className="json-boolean">{actualJson.toString()}</span>;
    }
    
    if (Array.isArray(actualJson)) {
      if (actualJson.length === 0) return <span className="json-bracket">[]</span>;
      return (
        <div className="json-array">
          <span className="json-bracket">[</span>
          {actualJson.map((item, idx) => (
            <div key={idx} className="json-array-item" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
              {renderJson(item, depth + 1, `${path}[${idx}]`)}
              {idx < actualJson.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ marginLeft: `${depth * 20}px` }}>
            <span className="json-bracket">]</span>
          </div>
        </div>
      );
    }
    
    if (typeof actualJson === 'object') {
      const keys = Object.keys(actualJson);
      if (keys.length === 0) return <span className="json-bracket">{'{}'}</span>;
      
      return (
        <div className="json-object">
          <span className="json-bracket">{'{'}</span>
          {keys.map((key, idx) => (
            <div key={key} className="json-object-item" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
              <span className="json-key">"{key}"</span>
              <span className="json-colon">: </span>
              {renderJson(actualJson[key], depth + 1, `${path}.${key}`)}
              {idx < keys.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ marginLeft: `${depth * 20}px` }}>
            <span className="json-bracket">{'}'}</span>
          </div>
        </div>
      );
    }
    
    return String(actualJson);
  }, [shouldTruncate, openOverlay]);

  const handleClear = useCallback(() => {
    setJsonText('');
    setError('');
    setAutoFormatted(false);
  }, []);

  const handleFormat = useCallback(() => {
    if (parsedJson) {
      try {
        const formatted = JSON.stringify(parsedJson.data, null, 2);
        setJsonText(formatted);
        setAutoFormatted(true);
      } catch (e) {
        setError('Failed to format JSON');
      }
    }
  }, [parsedJson]);

  const handleMinify = useCallback(() => {
    if (parsedJson) {
      try {
        const minified = JSON.stringify(parsedJson.data);
        setJsonText(minified);
        setAutoFormatted(true);
      } catch (e) {
        setError('Failed to minify JSON');
      }
    }
  }, [parsedJson]);

  const sampleJson = {
    "name": "AI Assistant Configuration",
    "version": "1.0.0",
    "settings": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2048
    },
    "systemPrompt": "You are an expert in computer vision and image analysis.\nYou excel at describing images, detecting elements inside them, and understanding visual content.\nYou are exceptionally skilled at recognizing and understanding websites shown in videos.\nYour specific skills allow you to understand complex website pages and break them down into components, with 100 percent accuracy in both visual content and component structure, location, size, and functionality.",
    "content": "\nYou are an expert in computer vision and image analysis.\nYou excel at describing images, detecting elements inside them, and understanding visual content.\nYou are exceptionally skilled at recognizing and understanding websites shown in videos.\nYour specific skills allow you to understand complex website pages and break them down into \ncomponents, with 100 percent accuracy in both visual content and component structure, \nlocation, size, and functionality. You can identify UI elements, buttons, forms, navigation menus, \nand understand their purpose and interaction patterns. You are also skilled at detecting \nvisual hierarchies, color schemes, typography, and layout structures. When analyzing websites, \nyou provide detailed descriptions of each component, its position on the page, its styling, \nand its likely functionality based on common web design patterns.",
    "capabilities": [
      "Image description and analysis",
      "Website component detection",
      "UI element recognition",
      "Layout structure analysis"
    ],
    "examples": {
      "shortText": "This is a short string",
      "longDescription": "This is a very long description that goes on and on and on and should be truncated in the viewer because it exceeds the maximum length we want to display inline in the JSON structure to keep things clean and readable",
      "nestedData": {
        "level1": {
          "level2": {
            "detailedExplanation": "This deeply nested explanation contains a lot of text that describes various aspects of the system's functionality, including how it processes inputs, generates outputs, handles edge cases, manages errors, and optimizes performance across different scenarios and use cases."
          }
        }
      }
    }
  };

  return (
    <div className="json-view-content">
      <div className="json-view-header">
        <h2>JSON Viewer</h2>
        <p>Paste or type JSON to view it formatted with syntax highlighting</p>
      </div>

      <div className="json-view-workspace">
        <div className="json-input-section">
          <div className="json-input-header">
            <h3>JSON Input</h3>
            <div className="json-input-buttons">
              <button 
                className="sample-button"
                onClick={() => setJsonText(JSON.stringify(sampleJson, null, 2))}
              >
                Load Sample
              </button>
              <button 
                className="format-button"
                onClick={handleFormat}
                disabled={!parsedJson}
              >
                Format
              </button>
              <button 
                className="minify-button"
                onClick={handleMinify}
                disabled={!parsedJson}
              >
                Minify
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
            className="json-input-textarea"
            value={jsonText}
            onChange={(e) => handleJsonTextChange(e.target.value)}
            placeholder="Paste your JSON here...&#10;&#10;Example:&#10;{&#10;  &quot;name&quot;: &quot;value&quot;,&#10;  &quot;array&quot;: [1, 2, 3]&#10;}"
            spellCheck="false"
          />
        </div>

        <div className="json-output-section">
          <h3>Formatted View</h3>
          {error ? (
            <div className="json-error">
              <div className="error-icon">⚠️</div>
              <div className="error-text">{error}</div>
            </div>
          ) : !parsedJson ? (
            <div className="json-placeholder">
              <div className="placeholder-icon">{ }</div>
              <p>Formatted JSON will appear here</p>
              <p className="placeholder-hint">Paste valid JSON on the left to see it formatted</p>
            </div>
          ) : (
            <div className="json-display">
              {renderJson(parsedJson)}
            </div>
          )}
        </div>
      </div>

      {overlayContent && (
        <div className="json-overlay" onClick={closeOverlay}>
          <div className="json-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="json-overlay-header">
              <h3>{overlayTitle}</h3>
              <button className="json-overlay-close" onClick={closeOverlay}>✕</button>
            </div>
            <div className="json-overlay-body">
              <pre className="json-overlay-text">{overlayContent}</pre>
            </div>
            <div className="json-overlay-footer">
              <div className="json-overlay-stats">
                Length: {overlayContent.length} characters | 
                Lines: {overlayContent.split('\n').length}
              </div>
              <button 
                className="json-overlay-copy"
                onClick={() => {
                  navigator.clipboard.writeText(overlayContent);
                  // Could add a toast notification here
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

export default JsonView;

