import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from "./components/App/App";
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './index.css';
import './styles/order-print.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)