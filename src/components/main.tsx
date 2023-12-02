import { enableMapSet, enablePatches, setAutoFreeze } from 'immer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './AppComponent';

enablePatches();
enableMapSet();
setAutoFreeze(true);

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
