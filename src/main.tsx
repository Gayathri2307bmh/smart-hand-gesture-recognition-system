import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent Monaco web worker warnings in parent/nested context if Monaco is queried/loaded
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: any, label: string) {
      if (label === 'json') {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/language/json/json.worker.min.js');`);
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/language/css/css.worker.min.js');`);
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/language/html/html.worker.min.js');`);
      }
      if (label === 'typescript' || label === 'javascript') {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/language/typescript/ts.worker.min.js');`);
      }
      return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/base/worker/workerMain.js');`);
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

