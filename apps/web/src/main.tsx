import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { engineClient } from './engine';
import { applyTheme, loadTheme } from './hud/theme';
import { bindEngineToStore, bindEventsToStore } from './store/bindEvents';

applyTheme(loadTheme());
bindEventsToStore();
bindEngineToStore(engineClient);
engineClient.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
