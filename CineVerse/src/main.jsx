import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { MovieProvider } from './contexts/MovieContext.jsx';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <MovieProvider>
          <App />
        </MovieProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
