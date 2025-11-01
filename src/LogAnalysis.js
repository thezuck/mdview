import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as webllm from "@mlc-ai/web-llm";

function LogAnalysis() {
  const [logText, setLogText] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState('');
  const [loadingProgress, setLoadingProgress] = useState('');
  const [cacheStatus, setCacheStatus] = useState('');
  const engineRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('Phi-3.5-mini-instruct-q4f16_1-MLC');
  const [loadedModel, setLoadedModel] = useState(null); // Track which model is actually loaded
  const [loadedContextSize, setLoadedContextSize] = useState(null); // Track context size of loaded model
  const [windowStart, setWindowStart] = useState(0);
  const [modelSectionExpanded, setModelSectionExpanded] = useState(true);
  const [maxContextWindow, setMaxContextWindow] = useState(() => {
    // Try to load saved successful context size from localStorage
    const saved = localStorage.getItem('webllm-max-context');
    return saved ? parseInt(saved, 10) : 65536; // Default to 64K tokens (more stable)
  });
  const abortControllerRef = useRef(null);
  const shouldStopRef = useRef(false); // Additional flag to ensure streaming stops
  const [analysisProgress, setAnalysisProgress] = useState(''); // Track current stage of analysis
  
  const AVAILABLE_MODELS = {
    'Phi-3.5-mini-instruct-q4f16_1-MLC': { 
      name: 'Phi-3.5 Mini (Fast, 2.7GB)', 
      size: '~2.7GB',
      maxContextWindow: 131072,  // 128K tokens max
      recommendedContext: 65536  // 64K recommended for stability
    },
    'Llama-3.2-1B-Instruct-q4f16_1-MLC': { 
      name: 'Llama 3.2 1B (Smaller, 0.8GB)', 
      size: '~0.8GB',
      maxContextWindow: 131072,  // 128K tokens max
      recommendedContext: 65536  // 64K recommended for stability
    },
  };

  // Calculate input/output tokens based on 75/25 ratio
  const getTokenAllocation = (contextSize) => {
    return {
      inputTokens: Math.floor(contextSize * 0.75),
      outputTokens: Math.floor(contextSize * 0.25)
    };
  };

  const currentAllocation = getTokenAllocation(maxContextWindow);

  // Calculate max characters from tokens (roughly 3.5 chars per token)
  const getMaxInputChars = (tokens) => {
    return Math.floor(tokens * 3.5); // ~3.5 chars per token for safety
  };

  const MAX_WINDOW_SIZE = getMaxInputChars(currentAllocation.inputTokens);

  const checkModelCache = useCallback(async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const hasCachedModel = cacheNames.some(name => 
          name.includes('webllm') || name.includes('model')
        );
        
        if (hasCachedModel) {
          setCacheStatus('Model files found in cache - fast loading available!');
        } else {
          setCacheStatus(`No cached model - first load will download ${AVAILABLE_MODELS[selectedModel].size}`);
        }
      }
    } catch (err) {
      console.error('Error checking cache:', err);
    }
  }, [selectedModel, AVAILABLE_MODELS]);

  useEffect(() => {
    checkModelCache();
  }, [checkModelCache]);

  const loadModel = useCallback(async () => {
    if (engineRef.current) return;
    
    setIsLoadingModel(true);
    setError('');
    const modelInfo = AVAILABLE_MODELS[selectedModel];
    setLoadingProgress(`Initializing ${modelInfo.name}...`);
    
    try {
      console.log(`Loading WebLLM model: ${selectedModel}`);
      console.log('WebGPU available:', !!navigator.gpu);
      
      if (!navigator.gpu) {
        throw new Error('WebGPU is required for WebLLM. Please enable WebGPU in chrome://flags or use a compatible browser.');
      }
      
      const engine = await webllm.CreateMLCEngine(
        selectedModel, 
        {
          initProgressCallback: (progress) => {
            console.log('WebLLM Progress:', progress);
            setLoadingProgress(progress.text);
          },
        },
        {
          context_window_size: maxContextWindow, // ChatOptions - context size configuration
        }
      );
      
      console.log(`Engine created with context window: ${maxContextWindow} tokens`);
      
      engineRef.current = engine;
      setModelLoaded(true);
      setLoadedModel(selectedModel); // Track which model is actually loaded
      setLoadedContextSize(maxContextWindow); // Track the context size
      setModelSectionExpanded(false); // Minimize after successful load
      setCacheStatus(`${modelInfo.name} ready (${Math.floor(maxContextWindow / 1024)}K context, WebGPU)`);
      setLoadingProgress(''); // Clear loading progress after successful load
      console.log(`Successfully loaded model: ${selectedModel} with ${maxContextWindow} token context`);
      
      // Debug: Log available engine methods
      console.log('Available engine methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(engine)).filter(m => typeof engine[m] === 'function'));
    } catch (err) {
      console.error('Error loading model:', err);
      let errorMsg = err.message;
      
      if (!navigator.gpu) {
        errorMsg = 'WebGPU is required. Please enable WebGPU in chrome://flags (search for "WebGPU") and restart your browser.';
      }
      
      setError('Failed to load model: ' + errorMsg);
      setModelSectionExpanded(true);
      setCacheStatus('⚠️ WebGPU required - enable in chrome://flags');
    } finally {
      setIsLoadingModel(false);
    }
  }, [selectedModel, AVAILABLE_MODELS, maxContextWindow]);

  const getWindowedText = useCallback(() => {
    const trimmedText = logText.trim();
    const end = Math.min(windowStart + MAX_WINDOW_SIZE, trimmedText.length);
    return trimmedText.slice(windowStart, end);
  }, [logText, windowStart]);

  const moveWindow = useCallback((direction) => {
    const trimmedText = logText.trim();
    const maxStart = Math.max(0, trimmedText.length - MAX_WINDOW_SIZE);
    
    if (direction === 'start') {
      setWindowStart(0);
    } else if (direction === 'end') {
      setWindowStart(maxStart);
    } else if (direction === 'prev') {
      setWindowStart(prev => Math.max(0, prev - MAX_WINDOW_SIZE));
    } else if (direction === 'next') {
      setWindowStart(prev => Math.min(maxStart, prev + MAX_WINDOW_SIZE));
    }
  }, [logText]);

  const handleSliderChange = useCallback((e) => {
    setWindowStart(parseInt(e.target.value, 10));
  }, []);

  const analyzeLog = useCallback(async () => {
    if (!logText.trim()) {
      setError('Please paste some log content to analyze');
      return;
    }

    // Prevent starting a new analysis if one is already running
    if (abortControllerRef.current) {
      setError('Analysis already in progress. Please wait or click Stop first.');
      return;
    }

    // Immediate feedback - show we're starting
    setIsAnalyzing(true);
    setError('');
    setAnalysis('');
    setAnalysisProgress('Preparing analysis...');
    shouldStopRef.current = false; // Reset stop flag

    // Check if we need to load or reload the model
    const needsReload = !engineRef.current || 
                        loadedModel !== selectedModel || 
                        loadedContextSize !== maxContextWindow;
    
    if (needsReload) {
      setAnalysisProgress('Loading AI model...');
      if (engineRef.current) {
        if (loadedModel !== selectedModel) {
          console.log(`Model mismatch: loaded=${loadedModel}, selected=${selectedModel}. Reloading...`);
        } else if (loadedContextSize !== maxContextWindow) {
          console.log(`Context size mismatch: loaded=${loadedContextSize}, current=${maxContextWindow}. Reloading...`);
        }
        await engineRef.current.unload();
        engineRef.current = null;
        setModelLoaded(false);
        setLoadedModel(null);
        setLoadedContextSize(null);
      }
      
      await loadModel();
      if (!engineRef.current) {
        setError('Model failed to load. Please try again.');
        setIsAnalyzing(false);
        setAnalysisProgress('');
        return;
      }
    }

    console.log(`Starting analysis with loaded model: ${loadedModel}`);

    // Create AbortController for this analysis
    abortControllerRef.current = new AbortController();
    
    setAnalysisProgress('Processing log content...');

    const attemptAnalysis = async (contextSize) => {
      // Use the windowed text
      const windowedLog = getWindowedText();
      const allocation = getTokenAllocation(contextSize);
      
      // Estimate tokens in input (rough: 1 token ≈ 3.5 chars)
      const estimatedInputTokens = Math.ceil(windowedLog.length / 3.5);
      
      // Dynamic output allocation: if input is less than max, give more to output
      let outputTokens = allocation.outputTokens;
      if (estimatedInputTokens < allocation.inputTokens) {
        const remainingTokens = contextSize - estimatedInputTokens;
        // Give up to 50% of remaining to output (but cap at the allocation limit * 2)
        outputTokens = Math.min(
          Math.floor(remainingTokens * 0.5),
          allocation.outputTokens * 2,
          contextSize - estimatedInputTokens - 500 // Keep some buffer
        );
      }
      
      console.log(`Context: ${contextSize} tokens, Input: ~${estimatedInputTokens} tokens, Output: ${outputTokens} tokens`);
      
      const messages = [
        {
          role: "system",
          content: `You are a helpful log analysis assistant. Analyze logs concisely and identify errors, warnings, and key events. Keep your response under ${outputTokens} tokens (approximately ${Math.floor(outputTokens * 3.5)} characters).`
        },
        {
          role: "user",
          content: `Analyze this log excerpt and provide a concise summary:
1. Overview of what's happening
2. Any errors or warnings found
3. Potential issues
4. Key events

Important: Keep your response concise and under ${outputTokens} tokens.

Log excerpt:
${windowedLog}`
        }
      ];

      console.log('Running WebLLM inference with prompt length:', windowedLog.length);
      
      // Check if already aborted
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Analysis aborted');
      }
      
      setAnalysisProgress('Sending request to AI model...');
      
      // Enable streaming for real-time progress feedback
      const requestOptions = {
        messages: messages,
        temperature: 0.5,
        max_tokens: outputTokens,
        stream: true, // Enable streaming to show progress
      };
      
      // Add signal if supported (WebLLM may support this as it follows OpenAI API conventions)
      if (abortControllerRef.current) {
        requestOptions.signal = abortControllerRef.current.signal;
      }
      
      const responseStream = await engineRef.current.chat.completions.create(requestOptions);
      
      setAnalysisProgress('Waiting for model response...');
      
      let fullContent = '';
      let chunkCount = 0;
      
      // Process streaming response chunks
      for await (const chunk of responseStream) {
        // Check if aborted during streaming - break immediately
        if (shouldStopRef.current || abortControllerRef.current?.signal.aborted) {
          console.log('Streaming aborted by user - breaking out of loop');
          throw new Error('Analysis aborted');
        }
        
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          chunkCount++;
          fullContent += content;
          // Update progress on first chunk
          if (chunkCount === 1) {
            setAnalysisProgress('Generating analysis...');
          }
          // Update UI in real-time with partial results
          setAnalysis(fullContent);
        }
      }

      return fullContent || 'No analysis generated. Please try again.';
    };

    try {
      let currentContextSize = maxContextWindow;
      let attemptCount = 0;
      const maxAttempts = 5;
      
      while (attemptCount < maxAttempts) {
        try {
          const analysisText = await attemptAnalysis(currentContextSize);
          
          // Success! Save this context size for future use
          if (currentContextSize !== maxContextWindow) {
            console.log(`Successful with reduced context: ${currentContextSize} tokens. Saving...`);
            setMaxContextWindow(currentContextSize);
            localStorage.setItem('webllm-max-context', currentContextSize.toString());
            setCacheStatus(`Context optimized to ${currentContextSize} tokens for your system`);
          } else {
            // Save successful max context
            localStorage.setItem('webllm-max-context', currentContextSize.toString());
          }
          
          // Analysis is already set during streaming, but ensure final state is set
          if (analysisText) {
            setAnalysis(analysisText);
          }
          break; // Success, exit retry loop
          
        } catch (err) {
          const errorMsg = err.message || '';
          
          // Check if it's a memory-related error
          if (errorMsg.includes('memory') || errorMsg.includes('Memory') || 
              errorMsg.includes('OOM') || errorMsg.includes('out of memory')) {
            
            attemptCount++;
            if (attemptCount >= maxAttempts) {
              throw new Error(`Out of memory after ${maxAttempts} attempts. Your system cannot handle the current log size. Try shorter logs or close other applications.`);
            }
            
            // Reduce context by 20%
            currentContextSize = Math.floor(currentContextSize * 0.8);
            console.log(`Memory error detected. Reducing context to ${currentContextSize} tokens and retrying (attempt ${attemptCount}/${maxAttempts})...`);
            setLoadingProgress(`Memory limit reached. Reducing context to ${currentContextSize} tokens (${Math.floor(currentContextSize / 1024)}K)...`);
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } else {
            // Not a memory error, throw it
            throw err;
          }
        }
      }
      
      setLoadingProgress(''); // Clear any retry messages
      
    } catch (err) {
      console.error('Error analyzing log:', err);
      console.error('Error stack:', err.stack);
      
      let errorMsg = err.message;
      
      // Don't show error if analysis was intentionally aborted
      if (errorMsg.includes('aborted') || errorMsg.includes('Analysis aborted')) {
        console.log('Analysis was stopped by user');
        // Error already set in the streaming loop
      } else {
        if (errorMsg.includes('WebGPU')) {
          errorMsg = 'WebGPU error during inference. Try reloading the model.';
        }
        
        setError('Failed to analyze log: ' + errorMsg);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
      shouldStopRef.current = false;
      abortControllerRef.current = null;
    }
  }, [logText, loadModel, getWindowedText, selectedModel, loadedModel, loadedContextSize, AVAILABLE_MODELS, maxContextWindow, getTokenAllocation]);

  const handleStop = useCallback(async () => {
    if (abortControllerRef.current) {
      console.log('Aborting analysis...');
      shouldStopRef.current = true; // Set stop flag immediately
      abortControllerRef.current.abort();
      
      setIsAnalyzing(false);
      setAnalysisProgress('Stopping model...');
      
      // Nuclear option: Unload the model to truly stop GPU processing
      if (engineRef.current) {
        try {
          console.log('Unloading model to stop GPU processing...');
          await engineRef.current.unload();
          engineRef.current = null;
          setModelLoaded(false);
          setLoadedModel(null);
          setLoadedContextSize(null);
          
          setAnalysisProgress('');
          setLoadingProgress('Model stopped - reloading for next analysis...');
          console.log('Model unloaded successfully, now reloading...');
          
          // Automatically reload the model
          await loadModel();
          
          setError('Analysis stopped by user - model reloaded and ready');
          console.log('Model reloaded and ready');
        } catch (err) {
          console.error('Failed to unload/reload model:', err);
          setAnalysisProgress('');
          setError('Analysis stopped (warning: failed to reload model)');
          setModelSectionExpanded(true); // Show model section if reload failed
        }
      } else {
        setAnalysisProgress('');
        setError('Analysis stopped by user');
      }
    }
  }, [loadModel]);

  const handleClear = useCallback(() => {
    setLogText('');
    setAnalysis('');
    setError('');
    setAnalysisProgress('');
    setWindowStart(0);
  }, []);

  const handleLogTextChange = useCallback((e) => {
    setLogText(e.target.value);
    setWindowStart(0); // Reset window when text changes
  }, []);

  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const backupInputRef = useRef(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleContextWindowChange = useCallback(async (e) => {
    const newSize = parseInt(e.target.value, 10);
    const modelMax = AVAILABLE_MODELS[selectedModel].maxContextWindow;
    const clampedSize = Math.min(Math.max(4096, newSize), modelMax);
    setMaxContextWindow(clampedSize);
    localStorage.setItem('webllm-max-context', clampedSize.toString());
    
    // If model is loaded, need to reload with new context size
    if (engineRef.current) {
      console.log(`Context size changed to ${clampedSize}. Reloading model...`);
      setLoadingProgress(`Reloading model with ${Math.floor(clampedSize / 1024)}K token context...`);
      
      // Unload current engine
      await engineRef.current.unload();
      engineRef.current = null;
      setModelLoaded(false);
      setLoadedModel(null);
      
      // Reload with new context size
      setTimeout(() => {
        loadModel();
      }, 500);
    }
  }, [selectedModel, AVAILABLE_MODELS, loadModel]);

  const handleModelChange = useCallback((newModel) => {
    if (newModel === selectedModel) return;
    
    console.log(`Switching from ${selectedModel} to ${newModel}`);
    
    // Unload current model and prepare to load new one
    if (engineRef.current) {
      engineRef.current.unload();
    }
    engineRef.current = null;
    setModelLoaded(false);
    setLoadedModel(null); // Clear loaded model
    setSelectedModel(newModel);
    setModelSectionExpanded(true);
    setLoadingProgress('');
    setWindowStart(0); // Reset window position
    
    // Update cache status for new model
    checkModelCache();
    
    // Automatically start loading the new model
    setTimeout(() => {
      loadModel();
    }, 100);
  }, [selectedModel, loadModel, checkModelCache]);

  const downloadModelBackup = useCallback(async () => {
    try {
      setLoadingProgress('Preparing model backup for download...');
      
      // Access IndexedDB where WebLLM stores model
      const dbName = `webllm/model`;
      const request = indexedDB.open(dbName);
      
      request.onsuccess = async (event) => {
        const db = event.target.result;
        const transaction = db.transaction(db.objectStoreNames, 'readonly');
        const modelData = {};
        
        // Read all stores
        for (const storeName of db.objectStoreNames) {
          const store = transaction.objectStore(storeName);
          const getAllRequest = store.getAll();
          
          await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => {
              modelData[storeName] = getAllRequest.result;
              resolve();
            };
            getAllRequest.onerror = reject;
          });
        }
        
        // Create downloadable file
        const dataStr = JSON.stringify(modelData);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedModel}-backup.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setLoadingProgress('');
        setCacheStatus('Model backup downloaded successfully');
      };
      
      request.onerror = () => {
        setError('Failed to access model data for backup');
        setLoadingProgress('');
      };
    } catch (err) {
      console.error('Error downloading model backup:', err);
      setError('Failed to download model backup: ' + err.message);
      setLoadingProgress('');
    }
  }, [selectedModel]);

  const uploadModelBackup = useCallback(async (file) => {
    try {
      setLoadingProgress('Restoring model from backup...');
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const modelData = JSON.parse(e.target.result);
          
          const dbName = `webllm/model`;
          const request = indexedDB.open(dbName);
          
          request.onsuccess = async (event) => {
            const db = event.target.result;
            
            // Write data back to IndexedDB
            for (const [storeName, data] of Object.entries(modelData)) {
              if (db.objectStoreNames.contains(storeName)) {
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                
                for (const item of data) {
                  store.add(item);
                }
              }
            }
            
            setLoadingProgress('');
            setCacheStatus('Model restored from backup successfully');
          };
          
          request.onerror = () => {
            setError('Failed to restore model backup');
            setLoadingProgress('');
          };
        } catch (err) {
          setError('Invalid backup file: ' + err.message);
          setLoadingProgress('');
        }
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error('Error uploading model backup:', err);
      setError('Failed to upload model backup: ' + err.message);
      setLoadingProgress('');
    }
  }, []);

  const handleBackupUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      uploadModelBackup(file);
    }
  }, [uploadModelBackup]);

  const clearModelCache = useCallback(async () => {
    const modelInfo = AVAILABLE_MODELS[selectedModel];
    if (!window.confirm(`Are you sure you want to clear the model cache? This will require re-downloading the model (${modelInfo.size}) on next use.`)) {
      return;
    }

    try {
      // Unload current model
      if (engineRef.current) {
        await engineRef.current.unload();
        engineRef.current = null;
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        let clearedCount = 0;
        
        for (const name of cacheNames) {
          if (name.includes('webllm') || name.includes('mlc')) {
            await caches.delete(name);
            clearedCount++;
          }
        }
        
        // Also try IndexedDB cleanup for WebLLM
        if (window.indexedDB) {
          try {
            const databases = ['webllm/model', 'webllm/config', 'web-llm-cache'];
            for (const dbName of databases) {
              await window.indexedDB.deleteDatabase(dbName);
              clearedCount++;
            }
          } catch (dbErr) {
            console.log('IndexedDB cleanup skipped:', dbErr);
          }
        }
        
        if (clearedCount > 0) {
          setCacheStatus('Cache cleared - next load will download fresh files');
          setModelLoaded(false);
          setLoadedModel(null);
          setLoadedContextSize(null);
          setModelSectionExpanded(true); // Re-expand when model is cleared
        } else {
          setCacheStatus('No model cache found to clear');
        }
      }
      
      // Reload the page to fully reset
      window.location.reload();
    } catch (err) {
      console.error('Error clearing cache:', err);
      setError('Failed to clear cache: ' + err.message);
    }
  }, [selectedModel, AVAILABLE_MODELS]);

  return (
    <div className="log-analysis-content">
      {!modelLoaded && (
        <div className="log-analysis-header">
          <div className="header-title-row">
            <h2>Log Analysis with AI</h2>
          </div>
          
          <p>Select and load a model to analyze logs (powered by WebLLM - requires WebGPU)</p>
          
          <div className="model-selector">
            <div>
              <label htmlFor="model-select">Model: </label>
              <select 
                id="model-select"
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoadingModel}
              >
                {Object.entries(AVAILABLE_MODELS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name} - {info.size}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="context-window-control">
            <label htmlFor="context-size-initial">Max Context: </label>
            <input 
              type="number"
              id="context-size-initial"
              value={maxContextWindow}
              onChange={handleContextWindowChange}
              min="4096"
              max={AVAILABLE_MODELS[selectedModel].maxContextWindow}
              step="4096"
              disabled={isLoadingModel}
            />
            <span className="context-info">
              tokens ({Math.floor(maxContextWindow / 1024)}K) = 
              {currentAllocation.inputTokens.toLocaleString()}↓ / {currentAllocation.outputTokens.toLocaleString()}↑
            </span>
          </div>
          <div className="context-hint">
            💡 System starts at max and auto-reduces if memory errors occur
          </div>
          
          <div className={navigator.gpu ? "webgpu-info webgpu-available" : "webgpu-info webgpu-required"}>
            {navigator.gpu ? (
              <>✓ WebGPU detected - Ready to load model</>
            ) : (
              <>⚠️ WebGPU REQUIRED for WebLLM. Enable in chrome://flags and restart browser.</>
            )}
          </div>
          
          {cacheStatus && (
            <div className="cache-status not-cached">
              📥 {cacheStatus}
            </div>
          )}
          
          <div className="model-controls">
            <button 
              className="load-model-button" 
              onClick={loadModel}
              disabled={isLoadingModel || !navigator.gpu}
            >
              {isLoadingModel ? 'Loading Model...' : 'Load AI Model'}
            </button>
            <button 
              className="clear-cache-button" 
              onClick={clearModelCache}
              disabled={isLoadingModel}
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
      
      {modelLoaded && (
        <div className="compact-model-bar">
          <span className="compact-model-status">
            ✓ {AVAILABLE_MODELS[loadedModel]?.name || 'Model loaded'} ({Math.floor(loadedContextSize / 1024)}K context)
          </span>
          <button 
            className="compact-settings-button" 
            onClick={() => setModelSectionExpanded(!modelSectionExpanded)}
            title="Model settings"
          >
            ⚙️
          </button>
        </div>
      )}

      {modelLoaded && modelSectionExpanded && (
        <div className="model-settings-panel">
          <h3>Model Settings</h3>
          
          <div className="model-selector">
            <div>
              <label htmlFor="model-select-expanded">Switch Model: </label>
              <select 
                id="model-select-expanded"
                value={selectedModel} 
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isLoadingModel}
              >
                {Object.entries(AVAILABLE_MODELS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name} - {info.size}
                  </option>
                ))}
              </select>
            </div>
            <span className="model-hint">
              Selecting a different model will unload current and load the new one. 
              Input tokens: 75% of context, Output tokens: 25% of context.
            </span>
          </div>
          
          <div className="context-window-control">
            <label htmlFor="context-size">Max Context Window: </label>
            <input 
              type="number"
              id="context-size"
              value={maxContextWindow}
              onChange={handleContextWindowChange}
              min="4096"
              max={AVAILABLE_MODELS[selectedModel].maxContextWindow}
              step="4096"
              disabled={isLoadingModel}
            />
            <span className="context-info">
              tokens ({Math.floor(maxContextWindow / 1024)}K) = 
              {currentAllocation.inputTokens}↓ input / {currentAllocation.outputTokens}↑ output
            </span>
          </div>
          <div className="context-hint">
            💡 Default: 64K tokens (recommended for stability). Max: 128K (may cause OOM).
            {loadedContextSize && loadedContextSize !== maxContextWindow && 
              ` Changed to ${Math.floor(maxContextWindow / 1024)}K - will reload on next analysis.`}
            {AVAILABLE_MODELS[selectedModel].recommendedContext !== maxContextWindow && (
              <button 
                className="reset-context-button"
                onClick={() => {
                  const recommended = AVAILABLE_MODELS[selectedModel].recommendedContext;
                  const event = { target: { value: recommended.toString() } };
                  handleContextWindowChange(event);
                }}
                disabled={isLoadingModel}
              >
                Use Recommended ({Math.floor(AVAILABLE_MODELS[selectedModel].recommendedContext / 1024)}K)
              </button>
            )}
          </div>
          
          <div className={navigator.gpu ? "webgpu-info webgpu-available" : "webgpu-info webgpu-required"}>
            {navigator.gpu ? (
              <>✓ WebGPU enabled - Using GPU acceleration</>
            ) : (
              <>⚠️ WebGPU REQUIRED. Enable in chrome://flags and restart browser.</>
            )}
          </div>
          
          {cacheStatus && (
            <div className="cache-status cached">
              💾 {cacheStatus}
            </div>
          )}
          
          <div className="model-controls">
            <button 
              className="clear-cache-button" 
              onClick={clearModelCache}
              disabled={isLoadingModel}
            >
              Clear Cache & Reload
            </button>
          </div>
          
          <div className="backup-controls">
            <h4>Model Backup (Optional)</h4>
            <p className="backup-hint">Save model to your computer as backup. Useful if you clear browser data frequently.</p>
            <div className="backup-buttons">
              <button 
                className="download-backup-button" 
                onClick={downloadModelBackup}
                disabled={!modelLoaded}
              >
                💾 Download Model Backup
              </button>
              <button 
                className="upload-backup-button" 
                onClick={() => backupInputRef.current?.click()}
                disabled={isLoadingModel}
              >
                📂 Restore from Backup
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                onChange={handleBackupUpload}
                style={{ display: 'none' }}
              />
            </div>
            <p className="backup-note">
              Note: Backup files can be large ({AVAILABLE_MODELS[selectedModel].size}). 
              WebLLM already uses browser IndexedDB which persists unless you clear all site data.
            </p>
          </div>
        </div>
      )}

      {isLoadingModel && loadingProgress && (
        <div className="loading-progress">
          {loadingProgress}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="analysis-workspace">
        <div className="log-input-section">
          <h3>
            Log Input 
            {logText.length > 0 && ` (${logText.length} chars, max ${MAX_WINDOW_SIZE} chars ≈ ${currentAllocation.inputTokens.toLocaleString()} tokens)`}
          </h3>
        
        <div className="textarea-container">
          {logText.length > MAX_WINDOW_SIZE && (
            <div className="highlight-backdrop" ref={highlightRef}>
              <div className="highlight-text">
                <span className="text-before">{logText.slice(0, windowStart)}</span>
                <mark className="text-window">{getWindowedText()}</mark>
                <span className="text-after">{logText.slice(windowStart + MAX_WINDOW_SIZE)}</span>
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            className={`log-textarea ${logText.length > MAX_WINDOW_SIZE ? 'with-highlight' : ''}`}
            value={logText}
            onChange={handleLogTextChange}
            onScroll={handleScroll}
            placeholder="Paste your log excerpt here...&#10;&#10;Example:&#10;2024-10-30 10:15:23 ERROR Failed to connect to database&#10;2024-10-30 10:15:24 WARN Retrying connection...&#10;2024-10-30 10:15:25 INFO Connection established"
            disabled={isAnalyzing}
          />
        </div>
        
        {logText.length > MAX_WINDOW_SIZE && (
          <div className="window-controls-compact">
            <div className="window-info-compact">
              <strong>Analysis Window:</strong> Chars {windowStart + 1} - {Math.min(windowStart + MAX_WINDOW_SIZE, logText.length)} of {logText.length}
            </div>
            
            <div className="window-controls">
              <button onClick={() => moveWindow('start')} disabled={isAnalyzing || windowStart === 0}>
                ⏮
              </button>
              <button onClick={() => moveWindow('prev')} disabled={isAnalyzing || windowStart === 0}>
                ◀
              </button>
              
              <div className="window-slider-container">
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, logText.length - MAX_WINDOW_SIZE)}
                  value={windowStart}
                  onChange={handleSliderChange}
                  disabled={isAnalyzing}
                  className="window-slider"
                />
              </div>
              
              <button onClick={() => moveWindow('next')} disabled={isAnalyzing || windowStart >= logText.length - MAX_WINDOW_SIZE}>
                ▶
              </button>
              <button onClick={() => moveWindow('end')} disabled={isAnalyzing || windowStart >= logText.length - MAX_WINDOW_SIZE}>
                ⏭
              </button>
            </div>
          </div>
        )}
        
        {logText.length > 0 && logText.length <= MAX_WINDOW_SIZE && (
          <div className="window-info-small">
            ✓ Entire text will be analyzed ({logText.length} chars)
          </div>
        )}
          <div className="log-buttons">
            {!isAnalyzing ? (
              <button 
                className="analyze-button" 
                onClick={analyzeLog}
                disabled={!logText.trim()}
              >
                Analyze Logs
              </button>
            ) : (
              <button 
                className="stop-button" 
                onClick={handleStop}
                title="Stops analysis by restarting the AI model"
              >
                ⏹ Stop Analysis
              </button>
            )}
            <button 
              className="clear-button" 
              onClick={handleClear}
              disabled={isAnalyzing}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="log-output-section">
          <h3>Analysis Results {isAnalyzing && analysis && <span className="streaming-indicator">● Generating...</span>}</h3>
          {isAnalyzing && !analysis ? (
            <div className="analysis-in-progress">
              <div className="spinner"></div>
              <p>{analysisProgress || 'Preparing analysis...'}</p>
              <p className="analysis-hint">
                {analysisProgress === 'Preparing analysis...' && 'Initializing...'}
                {analysisProgress === 'Loading AI model...' && 'Please wait while the AI model loads...'}
                {analysisProgress === 'Processing log content...' && 'Analyzing your log data...'}
                {analysisProgress === 'Sending request to AI model...' && 'Communicating with the AI...'}
                {analysisProgress === 'Waiting for model response...' && 'The AI is processing your request...'}
                {!analysisProgress && 'Getting ready...'}
              </p>
            </div>
          ) : analysis ? (
            <div className="analysis-content">
              {analysis}
              {isAnalyzing && <span className="typing-cursor">▋</span>}
            </div>
          ) : (
            <div className="analysis-placeholder">
              <div className="placeholder-icon">📊</div>
              <p>Analysis results will appear here</p>
              <p className="placeholder-hint">Paste logs and click "Analyze Logs" to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LogAnalysis;

