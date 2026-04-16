import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ViewModeProvider } from './contexts/ViewModeContext';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ViewModeProvider>
          <App />
        </ViewModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// smoke test 2026-04-15T15:09:38Z
