import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function initApp() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Check if running on file:// protocol
  if (window.location.protocol === 'file:') {
    // Use a workaround for file:// - manipulate the DOM directly
    // Create a temporary container that React can work with
    const tempDiv = document.createElement('div');
    tempDiv.id = 'react-root-temp';
    rootElement.appendChild(tempDiv);
    
    // Use createRoot on the temp div
    const root = ReactDOM.createRoot(tempDiv);
    root.render(<App />);
  } else {
    // Normal operation for http/https
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
