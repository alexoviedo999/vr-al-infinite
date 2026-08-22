import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('scene-container');
if (!container) {
  throw new Error('Missing #scene-container root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
