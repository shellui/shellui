/**
 * Application entry point - renders the App component to the DOM.
 * This file is used by the CLI (via index.html) to bootstrap the full application.
 * It is NOT part of the library build.
 */
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';

// Store root instance to handle HMR properly
// Use window to persist across HMR reloads
const container = document.getElementById('root')!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
const windowRecord = window as unknown as Record<string, unknown>;
const root =
  (windowRecord.__shellui_root__ as ReturnType<typeof ReactDOM.createRoot>) ||
  ReactDOM.createRoot(container);

if (!windowRecord.__shellui_root__) {
  windowRecord.__shellui_root__ = root;
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
