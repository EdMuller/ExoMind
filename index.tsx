import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import { AuthProvider } from './src/AuthContext';
import './src/index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
